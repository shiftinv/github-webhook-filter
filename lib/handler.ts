import { http, log } from "../deps.ts";
import config from "./config.ts";
import { verify } from "./crypto.ts";
import filterWebhook from "./filter.ts";
import { UrlConfig } from "./types.d.ts";
import * as util from "./util.ts";

export default async function handle(req: Request): Promise<Response> {
    if (req.method !== "POST") {
        throw http.createHttpError(405);
    }

    // split url into parts
    const url = new URL(req.url);
    const [, id, token] = url.pathname.split("/");
    const signature = url.searchParams.get("sig");
    if (!id || !token || !signature) {
        throw http.createHttpError(400);
    }

    // verify signature
    if (!(await verify(`${id}/${token}`, signature))) {
        throw http.createHttpError(403);
    }

    // extract data
    const urlConfig = getUrlConfig(url.searchParams);
    const data = await req.text();
    const json = JSON.parse(data);

    // do the thing
    const filterReason = filterWebhook(req.headers, json, urlConfig);
    if (filterReason !== null) {
        return new Response(`Ignored by webhook filter (reason: ${filterReason})`, { status: 203 });
    }

    return await sendWebhook(id, token, req.headers, data);
}

function getUrlConfig(params: URLSearchParams): UrlConfig {
    const config: UrlConfig = {};
    for (const [key, value] of params) {
        switch (key) {
            case "sig":
                continue;
            case "allowBranches":
                config.allowBranches = value.split(",");
                break;
            case "hideTags":
                config.hideTags = util.parseBool(value);
                break;
            case "commentBurstLimit":
                config.commentBurstLimit = parseInt(value);
                break;
            default:
                throw http.createHttpError(418, `Unknown config option: ${key}`);
        }
    }
    return config;
}

async function sendWebhook(
    id: string,
    token: string,
    headers: HeadersInit,
    body: string,
): Promise<Response> {
    const url = `https://discord.com/api/webhooks/${id}/${token}/github?wait=1`;

    let res: Response;
    let retries = 0;
    do {
        const req = new Request(url, {
            method: "POST",
            headers: headers,
            body: body,
        });

        log.info(`sending webhook request to ${url}`);
        res = await fetch(req);

        // return response if everything's fine
        if (res.status !== 429) break;

        const reset = res.headers.get("retry-after");
        // should always exist, even for cf bans, but checking anyway
        if (reset === null) break;

        const resetms = parseFloat(reset);
        // if we'd wait longer than the configured limit, just return the 429
        if (resetms > config.maxWebhookRetryMs) break;

        // wait and try again
        log.warning(`retrying after ${resetms}ms`);
        await util.sleep(resetms);
        retries++;
    } while (retries <= config.maxWebhookRetries);
    return res;
}

import { http } from "../deps.ts";
import config from "./config.ts";
import { hasKey, verify } from "./crypto.ts";
import filterWebhook from "./filter.ts";
import fixupEmbeds from "./formatter.ts";
import { UrlConfig } from "./types.d.ts";
import { parseBool, requestLog } from "./util.ts";
import { sendWebhook } from "./webhook.ts";

export default async function handle(
    req: Request,
): Promise<Response | [Response, Record<string, string>]> {
    const url = new URL(req.url);

    // redirect to repo if `GET /`
    if (req.method === "GET" && config.mainRedirect && url.pathname === "/") {
        return Response.redirect(config.mainRedirect);
    }

    // everything else should be a POST
    if (req.method !== "POST") {
        throw http.createHttpError(405);
    }

    // split url into parts
    const [, id, token] = url.pathname.split("/");
    if (!id || !token) {
        throw http.createHttpError(400);
    }

    // verify signature
    if (hasKey) {
        const signature = url.searchParams.get("sig");
        if (!signature) throw http.createHttpError(400);
        if (!(await verify(`${id}/${token}`, signature))) throw http.createHttpError(403);
    }

    // extract data
    const urlConfig = getUrlConfig(url.searchParams);
    const data = await req.text();
    const json: Record<string, any> = JSON.parse(data);

    // do the thing
    const filterReason = await filterWebhook(req.headers, json, urlConfig);
    if (filterReason !== null) {
        const reqLog = requestLog(req.headers);
        reqLog.debug(`handler: ignored due to '${filterReason}'`);
        return new Response(`Ignored by webhook filter (reason: ${filterReason})`, { status: 203 });
    }

    // mutate `json` in-place (fixing codeblocks etc.)
    fixupEmbeds(json);

    return await sendWebhook(id, token, req.headers, json);
}

function getUrlConfig(params: URLSearchParams): UrlConfig {
    const config: UrlConfig = {};
    for (const [key, value] of params) {
        switch (key) {
            case "sig":
                continue;
            case "allowBranches":
                config.allowBranches = value;
                break;
            case "hideTags":
                config.hideTags = parseBool(value);
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

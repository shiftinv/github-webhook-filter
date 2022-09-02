import { verify } from "./crypto.ts";
import { http, log } from "../deps.ts";

function filter(headers: Headers, json: any, config: UrlConfig): string | null {
    const event = headers.get("x-github-event");
    const login: string = json.sender?.login?.toLowerCase() || "";
    if (["coveralls[bot]", "netlify[bot]", "pre-commit-ci[bot]"].some((n) => login.includes(n))) {
        return "bot";
    }

    const branchMatch = /^refs\/heads\/(.*)$/.exec(json.ref);
    if (
        event === "push" && branchMatch &&
        config.allowBranches && !config.allowBranches.includes(branchMatch[1])
    ) {
        return `branch '${branchMatch[1]}' not in ${JSON.stringify(config.allowBranches)}`;
    }

    return null;
}

async function sendWebhook(
    id: string,
    token: string,
    headers: HeadersInit,
    body: string,
): Promise<Response> {
    const url = `https://discord.com/api/webhooks/${id}/${token}/github?wait=1`;
    log.info(`Sending webhook request to ${url}`);
    const req = new Request(url, {
        method: "POST",
        headers: headers,
        body: body,
    });
    return await fetch(req);
}

interface UrlConfig {
    allowBranches?: string[];
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
            default:
                throw http.createHttpError(418, `Unknown config option: ${key}`);
        }
    }
    return config;
}

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
    const filterReason = filter(req.headers, json, urlConfig);
    if (filterReason !== null) {
        return new Response(`Ignored by webhook filter (reason: ${filterReason})`, { status: 203 });
    }

    return await sendWebhook(id, token, req.headers, data);
}

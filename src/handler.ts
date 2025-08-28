import { HTTPException } from "@hono/hono/http-exception";

import { getRequestLog } from "./context.ts";
import filterWebhook from "./filter.ts";
import fixupEmbeds from "./formatter.ts";
import { UrlConfig } from "./types.d.ts";
import { parseBool } from "./util.ts";
import { sendWebhook } from "./webhook.ts";

export default async function handle(
    json: Record<string, any>,
    headers: Record<string, string>,
    queryParams: Record<string, string>,
    id: string,
    token: string,
): Promise<[Response, Record<string, string>]> {
    const urlConfig = getUrlConfig(queryParams);

    // do the thing
    const filterReason = await filterWebhook(headers, json, urlConfig);
    if (filterReason !== null) {
        const reqLog = getRequestLog();
        reqLog.debug(`handler: ignored due to '${filterReason}'`);
        return [
            new Response(`Ignored by webhook filter (reason: ${filterReason})`, { status: 203 }),
            {},
        ];
    }

    // mutate `json` in-place (fixing codeblocks etc.)
    fixupEmbeds(json);

    return await sendWebhook(id, token, headers, json);
}

function getUrlConfig(params: Record<string, string>): UrlConfig {
    const config: UrlConfig = {};
    for (const [key, value] of Object.entries(params)) {
        switch (key) {
            case "sig":
                continue;
            case "allowBranches":
                config.allowBranches = value;
                break;
            case "allowBots": {
                const bool = parseBool(value, false);
                if (bool === undefined) {
                    config.allowBots = value;
                } else {
                    config.allowBots = bool ? ".*" : "";
                }
                break;
            }
            case "hideTags":
                config.hideTags = parseBool(value);
                break;
            case "commentBurstLimit":
                config.commentBurstLimit = parseInt(value);
                break;
            default:
                throw new HTTPException(418, { message: `Unknown config option: ${key}` });
        }
    }
    return config;
}

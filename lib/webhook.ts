import config from "./config.ts";
import { requestLog, sleep } from "./util.ts";

export async function sendWebhook(
    id: string,
    token: string,
    headers: Headers,
    body: string,
): Promise<[Response, Record<string, string>]> {
    const reqLog = requestLog(headers);
    const url = `https://discord.com/api/webhooks/${id}/${token}/github?wait=1`;

    let res: Response;
    let retries = 0;
    do {
        const req = new Request(url, {
            method: "POST",
            headers: headers,
            body: body,
        });

        reqLog.info(`sending webhook request to ${url}`);
        res = await fetch(req);

        // return response if everything's fine
        if (res.status !== 429) break;

        const reset = res.headers.get("retry-after");
        // should always exist, even for cf bans, but checking anyway
        if (reset === null) break;

        // parse retry delay
        let resetms = parseFloat(reset);
        if (!res.headers.has("via")) {
            // if there's no `via` header, this is likely a cf ban, which uses seconds instead of milliseconds
            resetms *= 1000;
        }

        // if we'd wait longer than the configured limit, just return the 429
        if (resetms > config.maxWebhookRetryMs) {
            reqLog.warning(
                `ratelimited for ${resetms}ms (> ${config.maxWebhookRetryMs}ms), not retrying`,
            );
            break;
        }

        // maybe wait and retry
        if (retries >= config.maxWebhookRetries) {
            reqLog.warning(`reached maximum number of retries (${retries})`);
            break;
        }
        retries++;
        reqLog.warning(`retrying after ${resetms}ms (retry ${retries})`);
        await sleep(resetms);
    } while (true);

    // set metadata
    const meta: Record<string, string> = {};
    if (retries) meta["retries"] = retries.toString();

    return [res, meta];
}

import { log } from "../deps.ts";
import config from "./config.ts";
import { sleep } from "./util.ts";

export async function sendWebhook(
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

        // maybe wait and retry
        if (retries >= config.maxWebhookRetries) break;
        retries++;
        log.warning(`retrying after ${resetms}ms (retry ${retries})`);
        await sleep(resetms);
    } while (true);
    return res;
}

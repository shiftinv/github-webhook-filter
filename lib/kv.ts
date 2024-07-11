import type { RequestLog } from "./util.ts";

const KEY_EXPIRY = 3; // seconds
const MAX_RETRIES = 50;

const kv = await Deno.openKv();

export async function getAndIncrementKV(key: string, reqLog: RequestLog): Promise<number> {
    const kvKey = ["pr-comment", key];

    // keep retrying until atomic operation succeeds with same versionstamp
    // (with some sort of sane upper limit, just in case)
    for (let i = 0; i < MAX_RETRIES; i++) {
        const res = await kv.get<number>(kvKey, { consistency: "strong" });
        const value = res.value ?? 0;

        const setRes = await kv
            .atomic()
            .check(res)
            .set(kvKey, value + 1, { expireIn: KEY_EXPIRY * 1000 })
            .commit();
        if (setRes.ok) {
            reqLog.debug(`updated ${JSON.stringify(kvKey)} after ${i} retries`);
            return value;
        }
    }

    throw new Error(
        `failed to atomically update ${JSON.stringify(kvKey)} after ${MAX_RETRIES} retries`,
    );
}

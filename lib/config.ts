import { parseBool } from "./util.ts";

function get(key: string): string;
function get<T>(key: string, def: T): string | T;
function get<T>(key: string, def?: T): string | T {
    const value = Deno.env.get(key);
    if (value !== undefined) return value;
    else if (def !== undefined) return def;
    throw new Error(`Missing environment variable '${key}'.`);
}

export default {
    debug: parseBool(get("DEBUG", "0")),
    hostname: get("HOSTNAME", "127.0.0.1"),
    port: parseInt(get("PORT", "8080")),
    signKey: get("SIGN_KEY", null),
    maxWebhookRetries: parseInt(get("MAX_RETRIES", "3")),
    maxWebhookRetryMs: parseInt(get("MAX_RETRY_MS", "30000")),
};

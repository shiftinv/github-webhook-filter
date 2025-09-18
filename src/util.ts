import type { Context } from "@hono/hono";
import { WebhookEvent, WebhookEventMap, WebhookEventName } from "@octokit/webhooks-types";

export function parseBool(s: string, strict: false): boolean | undefined;
export function parseBool(s: string, strict?: true): boolean;
export function parseBool(s: string, strict: boolean = true): boolean | undefined {
    s = s.toLowerCase();
    if (["1", "true", "on", "y", "yes"].includes(s)) return true;
    else if (["0", "false", "off", "n", "no"].includes(s)) return false;

    if (strict) throw new Error(`invalid bool value: ${s}`);
    return undefined;
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function wildcardMatch(pattern: string, target: string): boolean {
    let invert = false;
    if (pattern[0] === "!") {
        invert = true;
        pattern = pattern.slice(1);
    }
    // add anchors
    pattern = `^(${pattern})$`;

    return invert !== new RegExp(pattern).test(target);
}

/**
 * logging proxy that adds some metadata to log messages
 */
export function requestLog(deliveryId: string | undefined) {
    const prefix = deliveryId ? `[${deliveryId}]` : "";

    // ugh
    // is there a better way to do this? certainly.
    // does this work? also yes.
    const proxyLog: (func: (...args: any[]) => void) => (...args: any[]) => void = (func) => {
        return (...args) => func(prefix, ...args);
    };

    return {
        debug: proxyLog(console.debug),
        info: proxyLog(console.info),
        log: proxyLog(console.log),
        warn: proxyLog(console.warn),
        error: proxyLog(console.error),
    };
}

export type RequestLog = ReturnType<typeof requestLog>;

export function setMetaHeader(c: Context, key: string, value: string): void {
    c.res.headers.set(`x-webhook-filter-${key}`, value);
}

export function isGitHubEvent<T extends WebhookEventName>(
    _data: WebhookEvent,
    eventType: string,
    expected: T,
): _data is WebhookEventMap[T] {
    return eventType === expected;
}

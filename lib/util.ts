import * as log from "@std/log";

export function parseBool(s: string): boolean {
    return ["1", "true", "on", "y", "yes"].includes(s.toLowerCase());
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function _escapeRegex(pattern: string): string {
    return pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function wildcardMatch(pattern: string, target: string): boolean {
    let invert = false;
    if (pattern[0] === "!") {
        invert = true;
        pattern = pattern.slice(1);
    }

    // allow `*` wildcard specifier, translate to `.*` regex;
    // escape everything else
    pattern = pattern.split("*").map(_escapeRegex).join(".*");
    // treat `,` as `|`
    pattern = pattern.replaceAll(",", "|");
    // add anchors
    pattern = `^(${pattern})$`;

    return invert !== new RegExp(pattern).test(target);
}

/**
 * logging proxy that adds some metadata to log messages
 */
export function requestLog(headers: Headers) {
    const deliveryId = headers.get("x-github-delivery");
    const prefix = deliveryId ? `[${deliveryId}] ` : "";

    // ugh
    // is there a better way to do this? certainly.
    // does this work? also yes.
    const proxyLog: (func: (s: any) => string) => (msg: any) => string = (func) => {
        // FIXME: `String()` mangles objects
        return (msg) => func(prefix + String(msg));
    };

    return {
        debug: proxyLog(log.debug),
        info: proxyLog(log.info),
        warn: proxyLog(log.warn),
        error: proxyLog(log.error),
        critical: proxyLog(log.critical),
    };
}

export type RequestLog = ReturnType<typeof requestLog>;

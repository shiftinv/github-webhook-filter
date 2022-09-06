import { log } from "../deps.ts";

export function parseBool(s: string): boolean {
    return ["1", "true", "on", "y", "yes"].includes(s.toLowerCase());
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getLogString(data: unknown): string {
    return log.getLogger().asString(data);
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
        return (msg) => func(prefix + getLogString(msg));
    };

    return {
        debug: proxyLog(log.debug),
        info: proxyLog(log.info),
        warning: proxyLog(log.warning),
        error: proxyLog(log.error),
        critical: proxyLog(log.critical),
    };
}

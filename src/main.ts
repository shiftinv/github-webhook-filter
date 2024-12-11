import * as log from "@std/log";
import * as httpErrors from "x/http_errors";

import config from "./config.ts";
import handler from "./handler.ts";
import { requestLog } from "./util.ts";

function setupLogs() {
    log.setup({
        handlers: {
            console: new log.ConsoleHandler("DEBUG", {
                formatter: (rec) => `${rec.datetime.toISOString()} [${rec.levelName}] ${rec.msg}`,
            }),
        },
        loggers: {
            default: {
                level: config.debug ? "DEBUG" : "INFO",
                handlers: ["console"],
            },
        },
    });
}

async function handleRequest(req: Request, info: Deno.ServeHandlerInfo): Promise<Response> {
    const reqLog = requestLog(req.headers);

    let res: Response;
    let meta: Record<string, string> | null = null;
    try {
        const webhookResult = await handler(req);
        if (webhookResult instanceof Response) {
            res = webhookResult;
        } else {
            [res, meta] = webhookResult;
        }
    } catch (err) {
        if (err instanceof httpErrors.HttpError && err.expose) {
            reqLog.warn(`http error: ${err.message}`);
            res = new Response(err.message, { status: err.status });
        } else {
            reqLog.critical(err);
            res = new Response("Internal Server Error", { status: 500 });
        }
    }

    // clone response to make headers mutable
    res = new Response(res.body, res);

    // set metadata headers
    meta = {
        "deploy": config.deployId,
        ...meta,
    };
    for (const [key, value] of Object.entries(meta)) {
        res.headers.set(`x-webhook-filter-${key}`, value);
    }

    // remove other headers that don't make sense here
    for (const header of ["set-cookie", "alt-svc"]) {
        res.headers.delete(header);
    }

    // log request
    const respLen = res.headers.get("content-length") || 0;
    const addr = info.remoteAddr;
    reqLog.info(
        `http: ${addr.hostname}:${addr.port} - ${req.method} ${req.url} ${res.status} ${respLen}`,
    );

    return res;
}

if (import.meta.main) {
    setupLogs();

    if (config.signKey) {
        log.info("url signing enabled");
    }

    log.info(`starting webserver on ${config.hostname}:${config.port}`);
    Deno.serve({
        hostname: config.hostname,
        port: config.port,
        onListen: () => log.info(`listening on ${config.hostname}:${config.port}`),
    }, handleRequest);
}

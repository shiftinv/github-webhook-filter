import { http, log } from "./deps.ts";
import config from "./lib/config.ts";
import handler from "./lib/handler.ts";
import { requestLog } from "./lib/util.ts";

async function setupLogs(): Promise<void> {
    await log.setup({
        handlers: {
            console: new log.handlers.ConsoleHandler("DEBUG", {
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

async function handleRequest(req: Request, connInfo: http.ConnInfo): Promise<Response> {
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
        if (http.isHttpError(err) && err.expose) {
            reqLog.warning(`http error: ${err.message}`);
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

    // log request
    const respLen = res.headers.get("content-length") || 0;
    const addr = connInfo.remoteAddr as Deno.NetAddr;
    reqLog.info(
        `http: ${addr.hostname}:${addr.port} - ${req.method} ${req.url} ${res.status} ${respLen}`,
    );

    return res;
}

if (import.meta.main) {
    await setupLogs();

    if (!config.signKey) {
        log.warning("url signing disabled");
    }

    log.info(`starting webserver on ${config.hostname}:${config.port}`);
    http.serve(handleRequest, {
        hostname: config.hostname,
        port: config.port,
        onListen: () => log.info(`listening on ${config.hostname}:${config.port}`),
    });
}

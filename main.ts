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
    try {
        res = await handler(req);
    } catch (err) {
        if (http.isHttpError(err) && err.expose) {
            reqLog.warning(`http error: ${err.message}`);
            res = new Response(err.message, { status: err.status });
        } else {
            reqLog.critical(err);
            res = new Response("Internal Server Error", { status: 500 });
        }
    }

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

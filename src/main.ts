import { Hono } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { logger } from "@hono/hono/logger";
import * as log from "@std/log";

import config from "./config.ts";
import { hasKey, verify } from "./crypto.ts";
import handler from "./handler.ts";

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

const app = new Hono();

app.use(logger());

if (config.mainRedirect) {
    app.get("/", (c) => {
        return c.redirect(config.mainRedirect!);
    });
}

app.post("/:id/:token", async (c) => {
    const { id, token } = c.req.param();

    // verify signature
    if (hasKey) {
        const signature = c.req.query("sig");
        if (!signature || !(await verify(`${id}/${token}`, signature))) {
            throw new HTTPException(403);
        }
    }

    const data = await c.req.json();
    let [res, meta] = await handler(data, c.req.header(), c.req.query(), id, token);

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

    return res;
});

if (import.meta.main) {
    setupLogs();

    if (config.signKey) {
        log.info("url signing enabled");
    }

    Deno.serve(
        {
            hostname: config.hostname,
            port: config.port,
            onListen: () => log.info(`listening on ${config.hostname}:${config.port}`),
        },
        app.fetch,
    );
}

import { Hono } from "@hono/hono";
import { HTTPException } from "@hono/hono/http-exception";
import { logger } from "@hono/hono/logger";

import config from "./config.ts";
import { contextMiddleware } from "./context.ts";
import { hasKey, verify } from "./crypto.ts";
import handler from "./handler.ts";

const app = new Hono();

app.use(logger());
app.use(contextMiddleware);

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
    if (config.signKey) {
        console.info("url signing enabled");
    }

    Deno.serve(
        {
            hostname: config.hostname,
            port: config.port,
            onListen: () => console.info(`listening on ${config.hostname}:${config.port}`),
        },
        app.fetch,
    );
}

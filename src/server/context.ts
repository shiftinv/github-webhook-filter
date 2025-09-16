import { createMiddleware } from "@hono/hono/factory";
import { AsyncLocalStorage } from "node:async_hooks";

import { RequestLog, requestLog } from "../util.ts";

interface ContextData {
    requestLog: RequestLog;
}

const store = new AsyncLocalStorage<ContextData>();

export const contextMiddleware = createMiddleware(async (c, next) => {
    const deliveryId = c.req.header("x-github-delivery");
    const reqLog = requestLog(deliveryId);

    await store.run({ requestLog: reqLog }, next);
});

export const getContext = () => {
    const ctx = store.getStore();
    if (ctx === undefined) throw new Error("getContext() may only be called in request handlers");
    return ctx;
};

export const getRequestLog = () => getContext().requestLog;

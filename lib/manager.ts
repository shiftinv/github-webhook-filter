import { log, redis, TTLCache } from "../deps.ts";
import config from "./config.ts";

const KEY_EXPIRY = 3; // seconds

interface CommentManager {
    getAndIncrement(key: string): Promise<number>;
}

class LocalCommentManager implements CommentManager {
    private cache: TTLCache<number>;
    constructor() {
        this.cache = new TTLCache(KEY_EXPIRY * 1000);
    }

    getAndIncrement(key: string): Promise<number> {
        const value = this.cache.get(key) ?? 0;
        this.cache.set(key, value + 1);
        return Promise.resolve(value);
    }
}

class RedisCommentManager implements CommentManager {
    private connectOptions: redis.RedisConnectOptions;
    private _redis: Promise<redis.Redis> | undefined;

    constructor(options: redis.RedisConnectOptions) {
        this.connectOptions = options;
    }

    // manual lazy init, redis.createLazyClient currently doesn't support pipelines :/
    private redis(): Promise<redis.Redis> {
        if (!this._redis) {
            this._redis = redis.connect({
                ...this.connectOptions,
                maxRetryCount: 3,
            });
        }
        return this._redis;
    }

    async getAndIncrement(key: string): Promise<number> {
        const redis = await this.redis();
        key = `reviewcomment:${key}`;

        const pl = redis.pipeline();
        pl.incr(key);
        pl.expire(key, KEY_EXPIRY);
        const results = await pl.flush();

        const newValue = results[0] as number;
        return newValue - 1; // return old value
    }
}

let commentManager: CommentManager;
if (config.redisUrl) {
    const opts = redis.parseURL(config.redisUrl);

    // validate perms now to avoid unnecessarily retrying later on
    const host = opts.hostname + (opts.port ? `:${opts.port}` : "");
    const permStatus = await Deno.permissions.request({ name: "net", host: host });
    if (permStatus.state !== "granted") {
        throw new Error("Network access to redis url is required");
    }

    log.debug("using RedisCommentManager");
    commentManager = new RedisCommentManager(opts);
} else {
    log.debug("using LocalCommentManager, no redis url configured");
    commentManager = new LocalCommentManager();
}

export { commentManager };

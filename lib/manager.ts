import { redis, TTLCache } from "../deps.ts";
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
    private redis: redis.Redis;
    constructor(redisUrl: string) {
        this.redis = redis.createLazyClient({
            ...redis.parseURL(redisUrl),
            maxRetryCount: 3,
        });
    }

    async getAndIncrement(key: string): Promise<number> {
        key = `reviewcomment:${key}`;

        // seems like pipelines don't quite work with the lazy client, so force a connection
        if (!this.redis.isConnected) {
            await this.redis.ping();
        }

        const pl = this.redis.pipeline();
        pl.incr(key);
        pl.expire(key, KEY_EXPIRY);
        const results = await pl.flush();

        const newValue = results[0] as number;
        return newValue - 1; // return old value
    }
}

export const commentManager = config.redisUrl
    ? new RedisCommentManager(config.redisUrl)
    : new LocalCommentManager();

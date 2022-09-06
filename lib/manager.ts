import { redis } from "../deps.ts";
import config from "./config.ts";

class ReviewCommentManager {
    private redis: redis.Redis;
    constructor() {
        this.redis = redis.createLazyClient({
            ...redis.parseURL(config.redisUrl),
            maxRetryCount: 3,
        });
    }

    async getAndIncrement(key: string): Promise<number> {
        if (!this.redis.isConnected) {
            // seems like pipelines don't quite work with the lazy client
            await this.redis.ping();
        }
        const pl = this.redis.pipeline();
        pl.incr(`reviewcomment:${key}`);
        pl.expire(`reviewcomment:${key}`, 3);
        const results = await pl.flush();

        const newValue = results[0] as number;
        return newValue - 1; // return old value
    }
}

export const reviewCommentManager = new ReviewCommentManager();

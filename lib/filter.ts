import { log, TTL } from "../deps.ts";
import { UrlConfig } from "./types.d.ts";

const reviewComments = new TTL<number>(2 * 1000);

export default function filter(headers: Headers, json: any, config: UrlConfig): string | null {
    const event = headers.get("x-github-event") || "unknown";
    const login: string | undefined = json.sender?.login?.toLowerCase();

    // ignore events that Discord won't render anyway
    if (["status", "pull_request_review_thread"].includes(event)) {
        return event;
    }

    // ignore all PR actions except "opened", "closed", "reopened"
    if (
        event === "pull_request" && json.action &&
        !["opened", "closed", "reopened"].includes(json.action)
    ) {
        return "no-op PR action";
    }

    // ignore all issue actions except "opened", "deleted", "closed", "reopened", "transferred"
    if (
        event === "issues" && json.action &&
        !["opened", "deleted", "closed", "reopened", "transferred"].includes(json.action)
    ) {
        return "no-op issue action";
    }

    // ignore some PR review actions
    if (event === "pull_request_review") {
        // ignore edit/dismiss actions
        if (json.action !== "submitted") return "no-op PR review action";
        // if comment (not approval or changes requested), ignore empty review body
        else if (json.review?.state === "commented" && !json.review?.body) return "empty PR review";
    }

    // ignore some PR comment events
    if (event === "pull_request_review_comment") {
        // ignore edit/delete actions
        if (json.action !== "created") return "no-op PR comment action";
        // check if more than x comments on a PR review in a short timespan
        const reviewId: number = json.comment?.pull_request_review_id;
        if (config.commentBurstLimit && reviewId) {
            const cacheKey = `${reviewId}-${login}`;
            log.debug(`filter: checking cache key ${cacheKey}`);
            log.debug(`filter: full comment cache ${JSON.stringify(Array.from(reviewComments))}`);
            const curr = reviewComments.get(cacheKey);
            if (curr && curr >= config.commentBurstLimit) {
                return `exceeded comment burst limit ${config.commentBurstLimit} for review ${reviewId}`;
            }
            reviewComments.set(cacheKey, (curr ?? 0) + 1);
        }
    }

    // ignore bots
    if (
        login &&
        ["coveralls[bot]", "netlify[bot]", "pre-commit-ci[bot]"].some((n) => login.includes(n))
    ) {
        return "bot";
    }

    // ignore branch/tag if configured
    const refMatch = /^refs\/([^\/]+)\/(.+)$/.exec(json.ref);
    if (event === "push" && refMatch) {
        // check if branch is allowed
        if (
            refMatch[1] == "heads" && config.allowBranches !== undefined &&
            !config.allowBranches.includes(refMatch[2])
        ) {
            return `branch '${refMatch[2]}' not in ${JSON.stringify(config.allowBranches)}`;
        }

        // check if it's a tag
        if (refMatch[1] == "tags" && config.hideTags === true) {
            return "tag";
        }
    }

    return null;
}

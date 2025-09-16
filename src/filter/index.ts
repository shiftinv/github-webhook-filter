import { WebhookEvent, WebhookEventMap, WebhookEventName } from "@octokit/webhooks-types";

import { getAndIncrementKV } from "./kv.ts";
import { getRequestLog } from "../server/context.ts";
import { UrlConfig } from "../types.d.ts";
import { wildcardMatch } from "../util.ts";

const COMMON_CI_BOTS = ["coveralls[bot]", "netlify[bot]", "pre-commit-ci[bot]", "dependabot[bot]"];

function isGitHubEvent<T extends WebhookEventName>(
    _data: WebhookEvent,
    eventType: string,
    expected: T,
): _data is WebhookEventMap[T] {
    return eventType === expected;
}

export default async function filter(
    headers: Record<string, string>,
    json: WebhookEvent,
    config: UrlConfig,
): Promise<string | null> {
    const event = headers["x-github-event"] || "unknown";

    if (!("sender" in json)) {
        // Discord always requires a sender (most events have this, but a handful of them don't)
        return "missing sender";
    }
    const login: string | undefined = json.sender?.login?.toLowerCase();

    // ignore events that Discord won't render anyway
    if (["status", "pull_request_review_thread"].includes(event)) {
        return event;
    }

    // ignore all PR actions except "opened", "closed", "reopened"
    if (
        isGitHubEvent(json, event, "pull_request") &&
        !["opened", "closed", "reopened"].includes(json.action)
    ) {
        return `no-op PR action '${json.action}'`;
    }

    // ignore all issue actions except "opened", "deleted", "closed", "reopened", "transferred"
    if (
        isGitHubEvent(json, event, "issues") &&
        !["opened", "deleted", "closed", "reopened", "transferred"].includes(json.action)
    ) {
        return `no-op issue action '${json.action}'`;
    }

    // ignore some PR review actions
    if (isGitHubEvent(json, event, "pull_request_review")) {
        // ignore edit/dismiss actions
        if (json.action !== "submitted") return `no-op PR review action '${json.action}'`;

        // if comment (not approval or changes requested), ignore empty review body
        if (json.review.state === "commented" && !json.review.body) return "empty PR review";
    }

    // ignore some PR comment events
    if (isGitHubEvent(json, event, "pull_request_review_comment")) {
        // ignore edit/delete actions
        if (json.action !== "created") return `no-op PR comment action '${json.action}'`;

        // check if more than x comments on a PR review in a short timespan
        const reviewId: number = json.comment.pull_request_review_id;
        if (config.commentBurstLimit && reviewId) {
            const cacheKey = `${reviewId}-${login}`;

            const reqLog = getRequestLog();
            reqLog.debug(`filter: checking cache key ${cacheKey}`);
            const curr = await getAndIncrementKV(cacheKey, reqLog);
            reqLog.debug(`filter: current value: ${curr}`);

            if (curr && curr >= config.commentBurstLimit) {
                return `exceeded comment burst limit (${config.commentBurstLimit}) for review ${reviewId}`;
            }
        }
    }

    let refType: "branch" | "tag" | undefined;
    let ref: string | undefined;
    if (isGitHubEvent(json, event, "push")) {
        // ignore branch/tag push
        const refMatch = /^refs\/([^\/]+)\/(.+)$/.exec(json.ref);
        if (refMatch) {
            refType = refMatch[1] === "heads"
                ? "branch"
                : (refMatch[1] == "tags" ? "tag" : undefined);
            ref = refMatch[2];
        }
    } else if (isGitHubEvent(json, event, "create") || isGitHubEvent(json, event, "delete")) {
        // ignore creation/deletion of branch/tag
        refType = json.ref_type;
        ref = json.ref;
    }

    // if we have a `push` event for a tag, it will either not show up at all (create/delete),
    // or will show up incorrectly (update).
    // just ignore it, since tag creation/deletion also sends a separate (actually usable) event
    if (event === "push" && refType === "tag") {
        return `tag '${ref}' pushed`;
    }

    // true if `allowBranches` is set and the current branch matches it
    let isExplicitlyAllowedBranch = false;

    if (refType && ref) {
        if (refType == "branch" && config.allowBranches !== undefined) {
            isExplicitlyAllowedBranch = wildcardMatch(config.allowBranches, ref);
            if (!isExplicitlyAllowedBranch) {
                return `branch '${ref}' does not match ${JSON.stringify(config.allowBranches)}`;
            }
        }
        if (refType == "tag" && config.hideTags === true) {
            return `tag '${ref}'`;
        }
    }

    if (login && login.endsWith("[bot]")) {
        if (config.allowBots !== undefined) {
            // ignore bot if matching
            if (!wildcardMatch(config.allowBots, login.slice(0, -5))) {
                return `bot '${login}' does not match ${JSON.stringify(config.allowBots)}`;
            }
        } else if (
            // ignore some CI bots if not explicitly allowed
            !isExplicitlyAllowedBranch && // show bot pushes on allowed branches
            COMMON_CI_BOTS.some((n) => login.includes(n))
        ) {
            return "bot";
        }
    }

    return null;
}

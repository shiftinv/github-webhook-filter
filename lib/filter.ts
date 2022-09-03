import { UrlConfig } from "./types.d.ts";

export default function filter(headers: Headers, json: any, config: UrlConfig): string | null {
    const event = headers.get("x-github-event") || "unknown";
    if (["status", "pull_request_review_thread"].includes(event)) {
        return event;
    }

    if (
        event === "pull_request" && json.action &&
        !["opened", "closed", "reopened"].includes(json.action)
    ) {
        return "no-op PR action";
    }

    if (
        event === "issues" && json.action &&
        !["opened", "deleted", "closed", "reopened", "transferred"].includes(json.action)
    ) {
        return "no-op issue action";
    }

    if (event === "pull_request_review") {
        // ignore edit/dismiss actions
        if (json.action !== "submitted") return "no-op PR review action";
        // if comment (not approval or changes requested), ignore empty review body
        else if (json.review?.state === "commented" && !json.review?.body) return "empty PR review";
    }

    const login: string | undefined = json.sender?.login?.toLowerCase();
    if (
        login &&
        ["coveralls[bot]", "netlify[bot]", "pre-commit-ci[bot]"].some((n) => login.includes(n))
    ) {
        return "bot";
    }

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

// Empirically determined GitHub embed description limit in the Discord API.
// Anything above this will be ellipsized :/
const EMBED_LIMIT = 500;

function maybeTransformText(s: string): string {
    // If length exceeds limit, add backticks since they might otherwise be removed
    const suffix = "…\n```";
    const maxLen = EMBED_LIMIT - suffix.length;
    if (s.includes("```") && s.length > maxLen) {
        s = s.substring(0, maxLen) + suffix;
    }
    return s;
}

export default function fixupEmbeds(data: Record<string, any>): void {
    for (
        const field of [
            // issue
            "issue",
            // issue/pr/discussion comment
            "comment",
            // pr
            "pull_request",
            // pr review
            "review",
            // discussion
            "discussion",
            // discussion answer
            "answer",
        ]
    ) {
        if (data[field]?.body) data[field].body = maybeTransformText(data[field].body);
    }
}

import { emojify as githubEmojify } from "@lambdalisue/github-emoji";

// Empirically determined GitHub embed description limit in the Discord API.
// Anything above this will be ellipsized :/
const EMBED_LIMIT = 500;

// If length exceeds limit, add backticks since they might otherwise be removed
function ellipsizeText(s: string): string {
    const suffix = "…\n```";
    const maxLen = EMBED_LIMIT - suffix.length;
    // n.b. this heuristic is by no means perfect; it might add backticks when not necessary,
    // but I really don't want to implement a markdown parser here c:
    if (s.length > maxLen && s.substring(maxLen).includes("```")) {
        s = s.substring(0, maxLen) + suffix;
    }
    return s;
}

const TRANSFORMS: ((s: string) => string)[] = [
    githubEmojify,
    ellipsizeText,
];

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
        if (data[field]?.body) {
            for (const transform of TRANSFORMS) {
                data[field].body = transform(data[field].body);
            }
        }
    }
}

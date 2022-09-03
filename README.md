# github-webhook-filter

A webhook filter for [Deno](https://deno.land/) that filters GitHub webhook events before
forwarding them to a Discord webhook, reducing noise.

Ignores common bots and no-op events (which Discord ignores anyway) by default; additional options can be configured per URL:

- Only forward events from specific branches (`allowBranches`, comma-separated list)
- Ignore tag updates (`hideTags`)
- Ignore burst PR review comments in a short timespan, only showing the first x comments (`commentBurstLimit`)

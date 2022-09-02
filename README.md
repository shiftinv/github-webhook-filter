# github-webhook-filter

A webhook filter for [Deno](https://deno.land/), that filters github webhook events before
forwarding them to a Discord webhook, reducing noise.

Ignores common bots by default, additional options can be configured per URL:

- Only forward events from specific branches
- Hide tag updates

# github-webhook-filter

A webhook filter for [Deno](https://deno.land/) that filters GitHub events before
forwarding them to a Discord webhook, reducing noise.  
Additionally, it attempts to handle Discord ratelimits and resend the webhook events if needed, instead of just dropping the requests like GitHub does.

Certain no-op events (which Discord would ignore anyway) and common CI bots are ignored by default; see [configuration](#configuration) below for more.


## Usage

0. Host the project somewhere, for example https://deno.com/deploy. Remember to add the environment variables you may want to set, see [`lib/config.ts`](./lib/config.ts).
1. Create a Discord webhook (`https://discord.com/api/webhooks/1234/ABCDWXYZ`).
1. Take the ID (`1234`) and token (`ABCDWXYZ`) from the URL, and enter `https://<filter_url>/1234/ABCDWXYZ` (note: no `/github`) in the GitHub webhook settings:  
    ![settings](./.github/assets/github-settings.png)
1. Optionally add configuration parameters (see below) to the URL, e.g. `?allowBranches=master,dev&hideTags=1`.
1. ????
1. Profit!


## Configuration

Additional options can be configured per URL:

- Only forward events from specific branches (`allowBranches`, simplified wildcard syntax)
    - `abc*xyz` is equivalent to `/^(abc.*xyz)$/`
    - `stuff,things` is equivalent to `/^(stuff|things)$/`
    - `!oh*hi*there` is equivalent to `/^(oh.*hi.*there)$/` inverted
- Ignore tag updates (`hideTags`)
- Ignore burst PR review comments in a short timespan, only showing the first x comments (`commentBurstLimit`)

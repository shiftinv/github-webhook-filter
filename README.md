# github-webhook-filter

A webhook filter for [Deno](https://deno.land/) that filters GitHub events before
forwarding them to a Discord webhook, reducing noise.  
Additionally, it attempts to handle Discord ratelimits and resend the webhook events if needed, instead of just dropping the requests like GitHub does.

Certain no-op events (which Discord would ignore anyway) and common CI bots are ignored by default; see [configuration](#configuration) below for more.


## Usage

> **Note**
> The main service (`https://github-webhook-filter.deno.dev/`) is not open to the public (yet?), and currently requires an api key to prevent abuse. Feel free to message me on Discord if you want to use it.
> Alternatively, you can always host the project yourself, and customize it to your liking c:

1. Create a Discord webhook (`https://discord.com/api/webhooks/1234/ABCDWXYZ`).
2. Take the ID (`1234`) and token (`ABCDWXYZ`) from the URL, and enter `https://<filter_url>/1234/ABCDWXYZ` (note: no `/github`) in the GitHub webhook settings:  
    ![settings](./.github/assets/github-settings.png)
3. Optionally add configuration parameters (see below) to the URL, e.g. `?allowBranches=master,dev&hideTags=1`.
4. ????
5. Profit!


## Configuration

Additional options can be configured per URL:

- Only forward events from specific branches (`allowBranches`, comma-separated list)
- Ignore tag updates (`hideTags`)
- Ignore burst PR review comments in a short timespan, only showing the first x comments (`commentBurstLimit`)

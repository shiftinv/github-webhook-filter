import config from "./config.ts";
import app from "./server/index.ts";

if (import.meta.main) {
    if (config.signKey) {
        console.info("url signing enabled");
    }

    Deno.serve(
        {
            hostname: config.hostname,
            port: config.port,
            onListen: () => console.info(`listening on ${config.hostname}:${config.port}`),
        },
        app.fetch,
    );
}

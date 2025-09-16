import { sign } from "../src/server/crypto.ts";

if (import.meta.main) {
    const arg = Deno.args[0] ?? "";
    if (arg.split("/").length !== 2) {
        throw new Error(`usage: deno run --allow-env --env-file scripts/sign.ts <id>/<sig>`);
    }

    console.log(await sign(arg));
}

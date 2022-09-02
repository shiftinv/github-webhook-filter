function get(key: string, def?: string): string {
    const value = Deno.env.get(key) ?? def;
    if (value !== undefined) {
        return value;
    }
    throw new Error(`Missing environment variable '${key}'.`);
}

export default {
    debug: !!parseInt(get("DEBUG", "0")),
    hostname: get("HOSTNAME", "127.0.0.1"),
    port: parseInt(get("PORT", "8080")),
    signKey: get("SIGN_KEY"),
};

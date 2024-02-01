import config from "./config.ts";
import { hex } from "../deps.ts";

export const hasKey = !!config.signKey;

const encoder = new TextEncoder();

let _signKey: CryptoKey | undefined = undefined;

async function getKey(): Promise<CryptoKey> {
    if (_signKey === undefined) {
        if (!config.signKey) throw new Error("Signature requested but no key configured");

        _signKey = await crypto.subtle.importKey(
            "raw",
            hex.decodeHex(config.signKey),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign", "verify"],
        );
    }
    return _signKey;
}

export async function sign(input: string): Promise<string> {
    const key = await getKey();
    const inputData = encoder.encode(input);
    const sig = await crypto.subtle.sign("HMAC", key, inputData);
    return hex.encodeHex(sig);
}

export async function verify(input: string, signature: string): Promise<boolean> {
    const key = await getKey();
    const inputData = encoder.encode(input);
    const sig = hex.decodeHex(signature);
    return await crypto.subtle.verify("HMAC", key, sig, inputData);
}

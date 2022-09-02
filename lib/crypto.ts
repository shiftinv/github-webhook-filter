import config from "./config.ts";
import { hex } from "../deps.ts";

const signKey = await crypto.subtle.importKey(
    "raw",
    hex.decode(new TextEncoder().encode(config.signKey)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
);

const encoder = new TextEncoder();

export async function sign(input: string): Promise<string> {
    const inputData = encoder.encode(input);
    const sig = await crypto.subtle.sign("HMAC", signKey, inputData);
    return new TextDecoder().decode(hex.encode(new Uint8Array(sig)));
}

export async function verify(input: string, signature: string): Promise<boolean> {
    const signatureData = hex.decode(encoder.encode(signature));
    const inputData = encoder.encode(input);
    return await crypto.subtle.verify("HMAC", signKey, signatureData, inputData);
}

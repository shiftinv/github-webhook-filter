export function parseBool(s: string): boolean {
    return ["1", "true", "on", "y", "yes"].includes(s.toLowerCase());
}

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

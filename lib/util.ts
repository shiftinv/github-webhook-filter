export function parseBool(s: string): boolean {
    return ["1", "true", "on", "y", "yes"].includes(s.toLowerCase());
}

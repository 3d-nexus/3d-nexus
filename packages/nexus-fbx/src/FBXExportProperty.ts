export function serializeFbxProperty(value: unknown): string {
  if (typeof value === "string") {
    return `"${value}"`;
  }
  if (typeof value === "boolean") {
    return value ? "Y" : "N";
  }
  return String(value);
}

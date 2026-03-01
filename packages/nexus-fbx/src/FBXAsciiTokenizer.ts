import type { FBXToken } from "./FBXTokenizer";

function splitArguments(text: string): Array<string | number | boolean | bigint> {
  return text
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith("\"") && part.endsWith("\"")) {
        return part.slice(1, -1).replace(/\\n/g, "\n").replace(/\\t/g, "\t").replace(/\\\\/g, "\\");
      }
      if (part === "Y" || part === "true") return true;
      if (part === "N" || part === "false") return false;
      if (/^-?\d+$/.test(part)) return Number(part);
      return part;
    });
}

export class FBXAsciiTokenizer {
  tokenize(text: string): FBXToken[] {
    const tokens: FBXToken[] = [];

    for (const rawLine of text.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith(";")) {
        continue;
      }

      if (line === "}") {
        tokens.push({ type: "NodeEnd" });
        continue;
      }

      if (line.endsWith("{")) {
        const trimmed = line.slice(0, -1).trim();
        const separator = trimmed.indexOf(":");
        const name = separator >= 0 ? trimmed.slice(0, separator).trim() : trimmed;
        const args = separator >= 0 ? splitArguments(trimmed.slice(separator + 1).trim()) : [];
        tokens.push({ type: "NodeBegin", name, properties: args });
        continue;
      }

      const separator = line.indexOf(":");
      if (separator < 0) {
        continue;
      }

      const name = line.slice(0, separator).trim();
      const rawValue = line.slice(separator + 1).trim();
      const values = splitArguments(rawValue);
      tokens.push({
        type: "Data",
        name,
        value: values.length <= 1 ? (values[0] ?? "") : values,
      });
    }

    return tokens;
  }
}

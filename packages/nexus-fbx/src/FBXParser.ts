import type { FBXToken } from "./FBXTokenizer";

export interface FBXElement {
  name: string;
  properties: Array<string | number | boolean | bigint>;
  children: FBXElement[];
  values: Record<string, unknown[]>;
}

export class FBXParser {
  parse(tokens: FBXToken[]): FBXElement {
    const root: FBXElement = { name: "__root__", properties: [], children: [], values: {} };
    const stack = [root];

    for (const token of tokens) {
      const current = stack[stack.length - 1]!;
      if (token.type === "NodeBegin") {
        const element: FBXElement = {
          name: token.name,
          properties: token.properties,
          children: [],
          values: {},
        };
        current.children.push(element);
        stack.push(element);
      } else if (token.type === "NodeEnd") {
        stack.pop();
      } else {
        const existing = current.values[token.name] ?? [];
        existing.push(token.value);
        current.values[token.name] = existing;
      }
    }

    return root;
  }
}

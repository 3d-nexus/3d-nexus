import { serializeFbxProperty } from "./FBXExportProperty";

export class FbxExportNode {
  constructor(
    public readonly name: string,
    public readonly properties: unknown[] = [],
    public readonly lines: string[] = [],
    public readonly children: FbxExportNode[] = [],
  ) {}

  render(indent = 0): string {
    const padding = "  ".repeat(indent);
    const head =
      this.properties.length > 0
        ? `${padding}${this.name}: ${this.properties.map(serializeFbxProperty).join(", ")} {`
        : `${padding}${this.name}: {`;
    const content = [
      ...this.lines.map((line) => `${padding}  ${line}`),
      ...this.children.map((child) => child.render(indent + 1)),
    ];
    return [head, ...content, `${padding}}`].join("\n");
  }
}

export class FbxExportNode {
  constructor(
    public readonly name: string,
    public readonly properties: unknown[] = [],
    public readonly lines: string[] = [],
    public readonly children: FbxExportNode[] = [],
  ) {}
}

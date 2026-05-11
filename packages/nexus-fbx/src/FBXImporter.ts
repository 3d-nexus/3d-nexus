import type { BaseImporter, ImportResult, ImportSettings } from "@3d-nexus/core";
import { FBXBinaryTokenizer } from "./FBXBinaryTokenizer";
import { FBXConverter } from "./FBXConverter";
import { FbxDocument } from "./FBXDocument";
import { FBXParser } from "./FBXParser";

const FBX_BINARY_MAGIC = "Kaydara FBX Binary  \0\x1a\0";

export class FBXImporter implements BaseImporter {
  private readonly binaryTokenizer = new FBXBinaryTokenizer();
  private readonly parser = new FBXParser();
  private readonly converter = new FBXConverter();

  canRead(buffer: ArrayBuffer, filename: string): boolean {
    if (!filename.toLowerCase().endsWith(".fbx")) {
      return false;
    }

    const header = new TextDecoder("ascii").decode(buffer.slice(0, 23));
    if (header === FBX_BINARY_MAGIC) {
      return true;
    }

    return false;
  }

  read(buffer: ArrayBuffer, _filename: string, _settings?: ImportSettings): ImportResult {
    const header = new TextDecoder("ascii").decode(buffer.slice(0, 23));
    if (header === FBX_BINARY_MAGIC) {
      const tokens = this.binaryTokenizer.tokenize(buffer);
      const document = new FbxDocument(this.parser.parse(tokens));
      return { scene: this.converter.convert(document), warnings: [] };
    }

    throw new Error("Unsupported FBX input: binary FBX is required");
  }
}

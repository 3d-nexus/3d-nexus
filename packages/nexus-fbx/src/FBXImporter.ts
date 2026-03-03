import { AiSceneFlags, type AiScene, type BaseImporter, type ImportResult, type ImportSettings } from "@3d-nexus/core";
import { FBXAsciiTokenizer } from "./FBXAsciiTokenizer";
import { FBXBinaryTokenizer } from "./FBXBinaryTokenizer";
import { FBXConverter } from "./FBXConverter";
import { FbxDocument } from "./FBXDocument";
import { FBXParser } from "./FBXParser";

const FBX_BINARY_MAGIC = "Kaydara FBX Binary  \0\x1a\0";

export class FBXImporter implements BaseImporter {
  private readonly asciiTokenizer = new FBXAsciiTokenizer();
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

    const text = new TextDecoder().decode(buffer.slice(0, 128));
    return /FBXHeaderExtension|Objects:/.test(text);
  }

  read(buffer: ArrayBuffer, _filename: string, _settings?: ImportSettings): ImportResult {
    const header = new TextDecoder("ascii").decode(buffer.slice(0, 23));
    if (header === FBX_BINARY_MAGIC) {
      this.binaryTokenizer.tokenize(buffer);
      const emptyScene: AiScene = {
        flags: AiSceneFlags.AI_SCENE_FLAGS_INCOMPLETE,
        rootNode: {
          name: "BinaryFBXRoot",
          transformation: { data: new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]) },
          parent: null,
          children: [],
          meshIndices: [],
          metadata: null,
        },
        meshes: [],
        materials: [],
        animations: [],
        textures: [],
        lights: [],
        cameras: [],
        metadata: {},
      };
      return { scene: emptyScene, warnings: [] };
    }

    const text = new TextDecoder().decode(buffer);
    const tokens = this.asciiTokenizer.tokenize(text);
    const document = new FbxDocument(this.parser.parse(tokens));
    return { scene: this.converter.convert(document), warnings: [] };
  }
}


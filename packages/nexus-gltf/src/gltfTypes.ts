export interface GltfAsset {
  asset: { version: string; generator?: string };
  scene?: number;
  scenes?: Array<{ nodes?: number[]; name?: string }>;
  nodes?: GltfNode[];
  meshes?: GltfMesh[];
  skins?: GltfSkin[];
  materials?: GltfMaterial[];
  images?: GltfImage[];
  textures?: GltfTexture[];
  buffers?: Array<{ byteLength: number; uri?: string }>;
  bufferViews?: GltfBufferView[];
  accessors?: GltfAccessor[];
  animations?: GltfAnimation[];
}

export interface GltfNode {
  name?: string;
  mesh?: number;
  skin?: number;
  weights?: number[];
  children?: number[];
  matrix?: number[];
  translation?: number[];
  rotation?: number[];
  scale?: number[];
}

export interface GltfSkin {
  name?: string;
  joints: number[];
  inverseBindMatrices?: number;
  skeleton?: number;
}

export interface GltfMesh {
  name?: string;
  primitives: GltfPrimitive[];
  weights?: number[];
  extras?: {
    targetNames?: string[];
    [key: string]: unknown;
  };
}

export interface GltfPrimitive {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  mode?: number;
  targets?: Array<Record<string, number>>;
}

export interface GltfMaterial {
  name?: string;
  pbrMetallicRoughness?: {
    baseColorFactor?: number[];
    baseColorTexture?: GltfTextureInfo;
    metallicRoughnessTexture?: GltfTextureInfo;
    metallicFactor?: number;
    roughnessFactor?: number;
  };
  normalTexture?: GltfTextureInfo;
}

export interface GltfTextureInfo {
  index: number;
  texCoord?: number;
}

export interface GltfTexture {
  source?: number;
  sampler?: number;
  name?: string;
}

export interface GltfImage {
  name?: string;
  uri?: string;
  mimeType?: string;
  bufferView?: number;
}

export interface GltfBufferView {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride?: number;
  target?: number;
}

export interface GltfAccessor {
  bufferView?: number;
  byteOffset?: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4" | "MAT4";
  min?: number[];
  max?: number[];
}

export interface GltfAnimation {
  name?: string;
  samplers: GltfAnimationSampler[];
  channels: GltfAnimationChannel[];
}

export interface GltfAnimationSampler {
  input: number;
  output: number;
  interpolation?: "LINEAR" | "STEP" | "CUBICSPLINE";
}

export interface GltfAnimationChannel {
  sampler: number;
  target: {
    node?: number;
    path: "translation" | "rotation" | "scale" | "weights";
  };
}

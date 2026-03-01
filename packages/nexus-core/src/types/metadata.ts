export enum AiMetadataType {
  BOOL = 0,
  INT32 = 1,
  UINT64 = 2,
  FLOAT = 3,
  DOUBLE = 4,
  AISTRING = 5,
  AIVECTOR3D = 6,
}

export interface AiMetadataEntry {
  type: AiMetadataType;
  data: unknown;
}

export type AiMetadata = Record<string, AiMetadataEntry>;

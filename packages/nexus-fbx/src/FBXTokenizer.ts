export type FBXToken =
  | { type: "NodeBegin"; name: string; properties: Array<string | number | boolean | bigint> }
  | { type: "NodeEnd" }
  | { type: "Data"; name: string; value: string | number | boolean | bigint | ArrayBuffer | TypedArray | Array<unknown> };

export type TypedArray =
  | Int8Array
  | Uint8Array
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

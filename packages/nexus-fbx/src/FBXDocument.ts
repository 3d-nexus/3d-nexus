import type { FBXElement } from "./FBXParser";
import { PropertyTable } from "./FBXProperties";

function parseNumberArray(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item));
  }
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);
}

export interface LazyFbxObject {
  id: bigint;
  kind: string;
  name: string;
  properties: PropertyTable;
  element: FBXElement;
}

export interface FbxConnectionGraph {
  parentToChildren: Map<bigint, bigint[]>;
  childToParents: Map<bigint, bigint[]>;
}

export class FbxModel {
  constructor(private readonly object: LazyFbxObject) {}

  get id(): bigint {
    return this.object.id;
  }

  get name(): string {
    return this.object.name.replace(/^Model::/, "");
  }

  get properties(): PropertyTable {
    return this.object.properties;
  }
}

export class FbxCluster {
  readonly indexes: Int32Array;
  readonly weights: Float64Array;
  readonly transformMatrix: Float64Array;
  readonly linkedModel: FbxModel | null;

  constructor(document: FbxDocument, private readonly object: LazyFbxObject) {
    this.indexes = Int32Array.from(parseNumberArray(object.element.values.Indexes?.[0] ?? []));
    this.weights = Float64Array.from(parseNumberArray(object.element.values.Weights?.[0] ?? []));
    const transformValues = parseNumberArray(object.element.values.TransformMatrix?.[0] ?? []);
    this.transformMatrix = Float64Array.from(
      transformValues.length === 16
        ? transformValues
        : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    );
    const modelObject = document.getChildObjects(object.id).find((entry) => entry.kind === "Model");
    this.linkedModel = modelObject ? new FbxModel(modelObject) : null;
  }

  get id(): bigint {
    return this.object.id;
  }

  get name(): string {
    return this.object.name;
  }
}

export class FbxSkin {
  readonly clusters: FbxCluster[];

  constructor(document: FbxDocument, private readonly object: LazyFbxObject) {
    this.clusters = document
      .getChildObjects(object.id)
      .filter((entry) => entry.kind === "Cluster")
      .map((entry) => new FbxCluster(document, entry));
  }

  get id(): bigint {
    return this.object.id;
  }
}

export class FbxBlendShapeChannel {
  readonly shapeIndexes: Int32Array;
  readonly shapeVertices: Float64Array;
  readonly shapeName: string;

  constructor(document: FbxDocument, private readonly object: LazyFbxObject) {
    const shapeObject = document.getChildObjects(object.id).find((entry) => entry.kind === "Shape");
    this.shapeIndexes = Int32Array.from(parseNumberArray(shapeObject?.element.values.Indexes?.[0] ?? []));
    this.shapeVertices = Float64Array.from(parseNumberArray(shapeObject?.element.values.Vertices?.[0] ?? []));
    this.shapeName = shapeObject?.name.replace(/^Geometry::/, "") ?? object.name;
  }

  get name(): string {
    return this.object.name.replace(/^SubDeformer::/, "");
  }
}

export class FbxBlendShape {
  readonly channels: FbxBlendShapeChannel[];

  constructor(document: FbxDocument, private readonly object: LazyFbxObject) {
    this.channels = document
      .getChildObjects(object.id)
      .filter((entry) => entry.kind === "BlendShapeChannel")
      .map((entry) => new FbxBlendShapeChannel(document, entry));
  }
}

export class FbxAnimationCurve {
  readonly keyTimes: BigInt64Array;
  readonly keyValues: Float32Array;

  constructor(private readonly object: LazyFbxObject) {
    this.keyTimes = BigInt64Array.from(parseNumberArray(object.element.values.KeyTime?.[0] ?? []).map((value) => BigInt(Math.trunc(value))));
    this.keyValues = Float32Array.from(parseNumberArray(object.element.values.KeyValueFloat?.[0] ?? []));
  }

  get name(): string {
    return this.object.name;
  }
}

export class FbxAnimationCurveNode {
  readonly curves: FbxAnimationCurve[];
  readonly linkedModel: FbxModel | null;

  constructor(document: FbxDocument, private readonly object: LazyFbxObject) {
    this.curves = document
      .getChildObjects(object.id)
      .filter((entry) => entry.kind === "AnimationCurve")
      .map((entry) => new FbxAnimationCurve(entry));
    const modelObject = document.getChildObjects(object.id).find((entry) => entry.kind === "Model");
    this.linkedModel = modelObject ? new FbxModel(modelObject) : null;
  }

  get name(): string {
    return this.object.name;
  }
}

export class FbxAnimationLayer {
  readonly curveNodes: FbxAnimationCurveNode[];

  constructor(document: FbxDocument, private readonly object: LazyFbxObject) {
    this.curveNodes = document
      .getChildObjects(object.id)
      .filter((entry) => entry.kind === "AnimationCurveNode")
      .map((entry) => new FbxAnimationCurveNode(document, entry));
  }
}

export class FbxAnimationStack {
  readonly layers: FbxAnimationLayer[];

  constructor(document: FbxDocument, private readonly object: LazyFbxObject) {
    this.layers = document
      .getChildObjects(object.id)
      .filter((entry) => entry.kind === "AnimationLayer")
      .map((entry) => new FbxAnimationLayer(document, entry));
  }

  get name(): string {
    return this.object.name.replace(/^AnimStack::/, "");
  }

  get localStart(): bigint {
    return BigInt(Math.trunc(Number(this.object.element.values.LocalStart?.[0] ?? 0)));
  }

  get localStop(): bigint {
    return BigInt(Math.trunc(Number(this.object.element.values.LocalStop?.[0] ?? 0)));
  }
}

export class FbxDocument {
  readonly objects = new Map<bigint, LazyFbxObject>();
  readonly connections: FbxConnectionGraph = {
    parentToChildren: new Map(),
    childToParents: new Map(),
  };

  constructor(public readonly root: FBXElement) {
    this.loadObjects();
    this.loadConnections();
  }

  getChildObjects(parentId: bigint): LazyFbxObject[] {
    return (this.connections.parentToChildren.get(parentId) ?? [])
      .map((id) => this.objects.get(id))
      .filter((entry): entry is LazyFbxObject => Boolean(entry));
  }

  getParentObjects(childId: bigint): LazyFbxObject[] {
    return (this.connections.childToParents.get(childId) ?? [])
      .map((id) => this.objects.get(id))
      .filter((entry): entry is LazyFbxObject => Boolean(entry));
  }

  private loadObjects(): void {
    const objectsNode = this.root.children.find((child) => child.name === "Objects");
    objectsNode?.children.forEach((child) => {
      const id = BigInt(Number(child.properties[0] ?? 0));
      const name = String(child.properties[1] ?? child.name);
      const kind = String(child.properties[2] ?? child.name);
      const propertiesElement = child.children.find((entry) => entry.name === "Properties70");
      this.objects.set(id, {
        id,
        kind,
        name,
        properties: new PropertyTable(propertiesElement),
        element: child,
      });
    });
  }

  private loadConnections(): void {
    const connectionsNode = this.root.children.find((child) => child.name === "Connections");
    connectionsNode?.values.C?.forEach((entry) => {
      if (!Array.isArray(entry) || entry.length < 3) {
        return;
      }

      const childId = BigInt(Number(entry[1] ?? 0));
      const parentId = BigInt(Number(entry[2] ?? 0));
      const parentChildren = this.connections.parentToChildren.get(parentId) ?? [];
      parentChildren.push(childId);
      this.connections.parentToChildren.set(parentId, parentChildren);

      const childParents = this.connections.childToParents.get(childId) ?? [];
      childParents.push(parentId);
      this.connections.childToParents.set(childId, childParents);
    });
  }
}

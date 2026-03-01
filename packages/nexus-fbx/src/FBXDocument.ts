import type { FBXElement } from "./FBXParser";
import { PropertyTable } from "./FBXProperties";

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

import {
  Color,
  InstancedMesh,
  Object3D,
  type BufferGeometry,
  type MeshLambertMaterial,
} from "three";

export class CustomInstancedMesh {
  private static readonly dummy = new Object3D();
  private readonly _instancedMesh: InstancedMesh;

  constructor(
    geometry: BufferGeometry,
    material: MeshLambertMaterial,
    count: number,
  ) {
    this._instancedMesh = new InstancedMesh(geometry, material, count);
  }

  updateState(
    x: number,
    y: number,
    z: number,
    index: number,
    scaleZ: number,
  ): void {
    CustomInstancedMesh.dummy.position.set(x, y, z);
    CustomInstancedMesh.dummy.scale.set(1, 1, scaleZ);
    CustomInstancedMesh.dummy.updateMatrix();
    this._instancedMesh.setMatrixAt(index, CustomInstancedMesh.dummy.matrix);
    this._instancedMesh.instanceMatrix.needsUpdate = true;
  }

  setColorAt(index: number, color: Color) {
    this._instancedMesh.setColorAt(index, color);
    if (this._instancedMesh.instanceColor) {
      this._instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  get instancedMesh(): InstancedMesh {
    return this._instancedMesh;
  }
}

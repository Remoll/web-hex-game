import {
  InstancedMesh,
  Object3D,
  type BufferGeometry,
  type Material,
} from "three";

export class CustomInstancedMesh {
  private static readonly dummy = new Object3D();
  private readonly _instancedMesh: InstancedMesh;

  constructor(
    geometry: BufferGeometry,
    material: Material,
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
    rotationZ: number = 0,
  ): void {
    CustomInstancedMesh.dummy.position.set(x, y, z);
    CustomInstancedMesh.dummy.scale.set(1, 1, scaleZ);
    CustomInstancedMesh.dummy.rotation.set(0, 0, rotationZ);
    CustomInstancedMesh.dummy.updateMatrix();
    this._instancedMesh.setMatrixAt(index, CustomInstancedMesh.dummy.matrix);
    this._instancedMesh.instanceMatrix.needsUpdate = true;
  }

  get instancedMesh(): InstancedMesh {
    return this._instancedMesh;
  }
}

import * as THREE from "three";
import type { HexCoord, PlaneCoord } from "../types";
import { Formulas } from "../formulas/Formulas";

export abstract class Unit {
  public id: string;
  public position: HexCoord;
  public instanceIndex: number;
  
  constructor(id: string, initialPosition: HexCoord, instanceIndex: number) {
    this.id = id;
    this.position = initialPosition;
    this.instanceIndex = instanceIndex;
  }

  // Przesunięcie jednostki na nowy heks i aktualizacja macierzy w InstancedMesh
  public moveTo(
    newHex: HexCoord,
    instancedMesh: THREE.InstancedMesh,
    size: number,
    dummy: THREE.Object3D
  ): void {
    this.position = newHex;
    const planePos: PlaneCoord = Formulas.hexCoordToPlaneCoord(newHex, size);

    // Z = 0.1, żeby jednostka była wyświetlana nad płaszczyzną heksów (Z = 0)
    dummy.position.set(planePos.x, planePos.y, 0.1);
    dummy.updateMatrix();

    instancedMesh.setMatrixAt(this.instanceIndex, dummy.matrix);
    instancedMesh.instanceMatrix.needsUpdate = true;
  }
}
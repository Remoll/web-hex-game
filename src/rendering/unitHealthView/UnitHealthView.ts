import * as THREE from "three";
import type { Unit } from "@/game/unit/Unit";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { RenderConfig } from "@/rendering/RenderConfig";
import { buildUnitHealthRenderState } from "@/rendering/unitHealthView/UnitHealthRenderModel";

/** Draws health bars with two reusable instanced meshes. */
export class UnitHealthView {
  private static readonly dummy = new THREE.Object3D();
  private readonly background: THREE.InstancedMesh;
  private readonly fill: THREE.InstancedMesh;
  private readonly unitIndices = new Map<string, number>();

  constructor(
    scene: THREE.Scene,
    private readonly gameMap: GameMap,
    private readonly config: RenderConfig,
    private readonly capacity: number = 100,
  ) {
    const geometry = new THREE.PlaneGeometry(
      config.healthBarWidth,
      config.healthBarHeight,
    );
    geometry.rotateX(Math.PI / 2);

    this.background = this.createMesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: 0x260d11, depthWrite: false }),
    );
    this.fill = this.createMesh(
      geometry,
      new THREE.MeshBasicMaterial({ color: 0x49d968, depthWrite: false }),
    );

    scene.add(this.background, this.fill);
  }

  sync(unit: Unit): void {
    const index = this.getOrCreateIndex(unit.id);
    const state = buildUnitHealthRenderState(unit, this.gameMap, this.config);

    if (!state) {
      this.setHidden(this.background, index);
      this.setHidden(this.fill, index);
      return;
    }

    this.setMatrix(this.background, index, state.x, state.y, state.z, 1, 1);
    this.setMatrix(
      this.fill,
      index,
      state.x - (this.config.healthBarWidth * (1 - state.fillRatio)) / 2,
      state.y,
      state.z + this.config.healthBarFillZOffset,
      state.fillRatio,
      1,
    );
  }

  dispose(): void {
    for (const mesh of [this.background, this.fill]) {
      mesh.geometry.dispose();
      disposeMaterials(mesh.material);
      mesh.removeFromParent();
    }
  }

  private createMesh(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
  ): THREE.InstancedMesh {
    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 4;
    return mesh;
  }

  private getOrCreateIndex(unitId: string): number {
    const existing = this.unitIndices.get(unitId);
    if (existing !== undefined) {
      return existing;
    }

    const index = this.unitIndices.size;
    if (index >= this.capacity) {
      throw new Error(`Unit health view capacity of ${this.capacity} was exceeded`);
    }

    this.unitIndices.set(unitId, index);
    this.background.count = index + 1;
    this.fill.count = index + 1;
    return index;
  }

  private setMatrix(
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
    scaleX: number,
    scaleY: number,
  ): void {
    UnitHealthView.dummy.position.set(x, y, z);
    UnitHealthView.dummy.scale.set(scaleX, scaleY, 1);
    UnitHealthView.dummy.rotation.set(0, 0, 0);
    UnitHealthView.dummy.updateMatrix();
    mesh.setMatrixAt(index, UnitHealthView.dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;
  }

  private setHidden(mesh: THREE.InstancedMesh, index: number): void {
    this.setMatrix(mesh, index, 0, 0, 0, 0, 0);
  }
}

function disposeMaterials(material: THREE.Material | THREE.Material[]): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.dispose();
  }
}

import * as THREE from "three";
import type { Unit } from "@/game/unit/Unit";
import type { TacticalUnitPresentation } from "@/game/gameSession/GameSession";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { RenderConfig } from "@/rendering/RenderConfig";
import {
  buildUnitHealthRenderState,
  getHealthBarFillX,
  getUnitHealthBarZFromUnitCenter,
} from "@/rendering/unitHealthView/UnitHealthRenderModel";
import type { UnitRenderState } from "@/rendering/unitView/UnitRenderModel";

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

  sync(
    unit: Unit,
    visible: boolean = true,
    preservePosition: boolean = false,
  ): void {
    this.syncSnapshot(unit, visible, preservePosition);
  }

  syncSnapshot(
    unit: TacticalUnitPresentation,
    visible: boolean = true,
    preservePosition: boolean = false,
  ): void {
    const index = this.getOrCreateIndex(unit.id);
    const state = buildUnitHealthRenderState(unit, this.gameMap, this.config);

    if (!state || !visible) {
      this.setHidden(this.background, index);
      this.setHidden(this.fill, index);
      return;
    }

    if (!preservePosition) {
      this.applyHealthBar(index, state.x, state.y, state.z, state.fillRatio);
    }
  }

  applyMovementFrame(
    unit: TacticalUnitPresentation,
    from: UnitRenderState,
    to: UnitRenderState,
    progress: number,
  ): void {
    const fillRatio = getFillRatio(unit);
    if (fillRatio === undefined) {
      return;
    }

    const index = this.getOrCreateIndex(unit.id);
    const x = interpolate(from.x, to.x, progress);
    const y = interpolate(from.y, to.y, progress);
    const unitZ = interpolate(from.z, to.z, progress);
    const z = getUnitHealthBarZFromUnitCenter(unitZ, this.config);
    this.applyHealthBar(index, x, y, z, fillRatio);
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

  private applyHealthBar(
    index: number,
    x: number,
    y: number,
    z: number,
    fillRatio: number,
  ): void {
    this.setMatrix(this.background, index, x, y, z, 1, 1);
    this.setMatrix(
      this.fill,
      index,
      getHealthBarFillX(x, fillRatio, this.config),
      y,
      z + this.config.healthBarFillZOffset,
      fillRatio,
      1,
    );
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

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

function getFillRatio(unit: TacticalUnitPresentation): number | undefined {
  if (!unit.isAlive || unit.maxHp <= 0) {
    return undefined;
  }

  const fillRatio = unit.currentHp / unit.maxHp;
  return Number.isFinite(fillRatio) && fillRatio > 0 && fillRatio <= 1
    ? fillRatio
    : undefined;
}

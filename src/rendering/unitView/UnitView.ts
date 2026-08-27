import * as THREE from "three";
import type { UnitPresenter } from "@/app/gameController/GameController";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { Unit } from "@/game/unit/Unit";
import type { PlaneCoord } from "@/game/types";
import { AtlasInstancedMesh } from "@/rendering/customInstancedMesh/atlasInstancedMesh/AtlasInstancedMesh";
import type { RenderConfig } from "@/rendering/RenderConfig";
import { unitAtlas } from "@/rendering/textures/UnitAtlas";
import { UnitSprite } from "@/rendering/textures/UnitSprite";
import { getUnitSprite } from "@/rendering/textures/UnitTextureSprite";
import {
  buildUnitRenderState,
  type UnitRenderState,
} from "@/rendering/unitView/UnitRenderModel";

export class UnitView implements UnitPresenter {
  private readonly mesh: AtlasInstancedMesh<UnitSprite>;
  private readonly unitIndices = new Map<string, number>();
  private readonly displayedPlanePositions = new Map<string, PlaneCoord>();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(
    scene: THREE.Scene,
    private readonly gameMap: GameMap,
    private readonly config: RenderConfig,
    private readonly capacity: number = 100,
  ) {
    const geometry = new THREE.PlaneGeometry(
      config.unitsWidth,
      config.unitsHeight,
    );
    geometry.rotateX(Math.PI / 2);

    this.mesh = new AtlasInstancedMesh(
      geometry,
      new THREE.MeshLambertMaterial({
        transparent: true,
        alphaTest: 0.5,
        side: THREE.DoubleSide,
      }),
      capacity,
      unitAtlas,
    );
    this.mesh.instancedMesh.count = 0;
    this.mesh.instancedMesh.frustumCulled = false;
    this.mesh.instancedMesh.renderOrder = 3;
    scene.add(this.mesh.instancedMesh);
  }

  sync(
    unit: Unit,
    visible: boolean = true,
    preservePosition: boolean = false,
  ): void {
    const index = this.getOrCreateIndex(unit.id);

    if (!unit.isAlive || !visible) {
      this.mesh.instancedMesh.setMatrixAt(index, this.hiddenMatrix);
      this.mesh.instancedMesh.instanceMatrix.needsUpdate = true;
      return;
    }

    this.mesh.setTextureIndex(index, getUnitSprite(unit.texture));
    if (!preservePosition) {
      this.applyState(index, unit.id, buildUnitRenderState(unit, this.gameMap, this.config));
    }
  }

  applyMovementFrame(
    unitId: string,
    from: UnitRenderState,
    to: UnitRenderState,
    progress: number,
  ): void {
    const index = this.getOrCreateIndex(unitId);
    this.applyPosition(
      index,
      unitId,
      interpolate(from.x, to.x, progress),
      interpolate(from.y, to.y, progress),
      interpolate(from.z, to.z, progress),
    );
  }

  getDisplayedPlanePosition(unitId: string): PlaneCoord | undefined {
    return this.displayedPlanePositions.get(unitId);
  }

  dispose(): void {
    this.mesh.instancedMesh.geometry.dispose();
    const material = this.mesh.instancedMesh.material;
    for (const item of Array.isArray(material) ? material : [material]) {
      item.dispose();
    }
    this.mesh.instancedMesh.removeFromParent();
    this.displayedPlanePositions.clear();
  }

  private applyState(index: number, unitId: string, state: UnitRenderState): void {
    this.applyPosition(index, unitId, state.x, state.y, state.z);
  }

  private applyPosition(
    index: number,
    unitId: string,
    x: number,
    y: number,
    z: number,
  ): void {
    this.mesh.updateState(x, y, z, index, 1);
    const displayedPosition = this.displayedPlanePositions.get(unitId);
    if (displayedPosition) {
      displayedPosition.x = x;
      displayedPosition.y = y;
      return;
    }

    this.displayedPlanePositions.set(unitId, { x, y });
  }

  private getOrCreateIndex(unitId: string): number {
    const existingIndex = this.unitIndices.get(unitId);
    if (existingIndex !== undefined) {
      return existingIndex;
    }

    const index = this.unitIndices.size;
    if (index >= this.capacity) {
      throw new Error(`Unit view capacity of ${this.capacity} was exceeded`);
    }

    this.unitIndices.set(unitId, index);
    this.mesh.instancedMesh.count = index + 1;
    return index;
  }
}

function interpolate(from: number, to: number, progress: number): number {
  return from + (to - from) * progress;
}

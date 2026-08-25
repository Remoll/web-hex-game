import * as THREE from "three";
import type { UnitPresenter } from "@/app/gameController/GameController";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { Unit } from "@/game/unit/Unit";
import { AtlasInstancedMesh } from "@/rendering/customInstancedMesh/atlasInstancedMesh/AtlasInstancedMesh";
import type { RenderConfig } from "@/rendering/RenderConfig";
import { unitAtlas } from "@/rendering/textures/UnitAtlas";
import { UnitSprite } from "@/rendering/textures/UnitSprite";
import { getUnitSprite } from "@/rendering/textures/UnitTextureSprite";
import { buildUnitRenderState } from "@/rendering/unitView/UnitRenderModel";

export class UnitView implements UnitPresenter {
  private readonly mesh: AtlasInstancedMesh<UnitSprite>;
  private readonly unitIndices = new Map<string, number>();

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
    scene.add(this.mesh.instancedMesh);
  }

  sync(unit: Unit): void {
    const index = this.getOrCreateIndex(unit.id);
    const state = buildUnitRenderState(unit, this.gameMap, this.config);
    this.mesh.updateState(state.x, state.y, state.z, index, 1);
    this.mesh.setTextureIndex(index, getUnitSprite(unit.texture));
  }

  dispose(): void {
    this.mesh.instancedMesh.geometry.dispose();
    const material = this.mesh.instancedMesh.material;
    for (const item of Array.isArray(material) ? material : [material]) {
      item.dispose();
    }
    this.mesh.instancedMesh.removeFromParent();
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

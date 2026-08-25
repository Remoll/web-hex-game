import * as THREE from "three";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { HexCoord, TerrainType } from "@/game/types";
import { Hex } from "@/rendering/geometry/hex/Hex";
import {
  buildMapRenderModel,
  getHexForInstance,
  type MapRenderModel,
} from "@/rendering/mapView/MapRenderModel";
import { AtlasInstancedMesh } from "@/rendering/customInstancedMesh/atlasInstancedMesh/AtlasInstancedMesh";
import { CustomInstancedMesh } from "@/rendering/customInstancedMesh/CustomInstancedMesh";
import type { RenderConfig } from "@/rendering/RenderConfig";
import { terrainAtlas } from "@/rendering/textures/TerrainAtlas";

export class MapView {
  private readonly model: MapRenderModel;
  private readonly sides: CustomInstancedMesh;
  private readonly caps: AtlasInstancedMesh<TerrainType>;

  constructor(
    scene: THREE.Scene,
    gameMap: GameMap,
    config: RenderConfig,
  ) {
    this.model = buildMapRenderModel(gameMap, config);

    this.sides = new CustomInstancedMesh(
      Hex.createHexSidesGeometry(config.hexSize),
      new THREE.MeshLambertMaterial({ color: 0x553311 }),
      this.model.cells.length,
    );
    this.caps = new AtlasInstancedMesh(
      Hex.createHexTopGeometry(config.hexSize, config.borderWidth),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      this.model.cells.length,
      terrainAtlas,
    );

    for (const cell of this.model.cells) {
      this.sides.updateState(cell.x, cell.y, 0, cell.instanceId, cell.height);
      this.caps.updateState(cell.x, cell.y, cell.height, cell.instanceId, 1);
      this.caps.setTextureIndex(cell.instanceId, cell.terrainType);
    }

    scene.add(this.sides.instancedMesh, this.caps.instancedMesh);
  }

  get pickableMesh(): THREE.InstancedMesh {
    return this.caps.instancedMesh;
  }

  getHexAtInstance(instanceId: number): HexCoord | undefined {
    return getHexForInstance(this.model, instanceId);
  }

  dispose(): void {
    this.sides.instancedMesh.geometry.dispose();
    this.caps.instancedMesh.geometry.dispose();
    disposeMaterials(this.sides.instancedMesh.material);
    disposeMaterials(this.caps.instancedMesh.material);
    this.sides.instancedMesh.removeFromParent();
    this.caps.instancedMesh.removeFromParent();
  }
}

function disposeMaterials(material: THREE.Material | THREE.Material[]): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.dispose();
  }
}

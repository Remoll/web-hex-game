import * as THREE from "three";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { HexCoord, TerrainType } from "@/game/types";
import {
  FieldVisibility,
  type FieldVisibilityReader,
} from "@/game/visibility/MageVisibility";
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
  private static readonly fogDummy = new THREE.Object3D();

  private readonly model: MapRenderModel;
  private readonly sides: CustomInstancedMesh;
  private readonly caps: AtlasInstancedMesh<TerrainType>;
  private readonly undiscoveredFog: THREE.InstancedMesh;
  private readonly discoveredFog: THREE.InstancedMesh;

  constructor(
    scene: THREE.Scene,
    gameMap: GameMap,
    private readonly config: RenderConfig,
  ) {
    this.model = buildMapRenderModel(gameMap, this.config);

    this.sides = new CustomInstancedMesh(
      Hex.createHexSidesGeometry(this.config.hexSize),
      new THREE.MeshLambertMaterial({ color: 0x553311 }),
      this.model.cells.length,
    );
    this.caps = new AtlasInstancedMesh(
      Hex.createHexTopGeometry(this.config.hexSize, this.config.borderWidth),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
      this.model.cells.length,
      terrainAtlas,
    );
    this.undiscoveredFog = this.createFogMesh(
      config.undiscoveredFogColor,
      1,
    );
    this.discoveredFog = this.createFogMesh(
      config.discoveredFogColor,
      config.discoveredFogOpacity,
    );

    for (const cell of this.model.cells) {
      this.sides.updateState(cell.x, cell.y, 0, cell.instanceId, cell.height);
      this.caps.updateState(cell.x, cell.y, cell.height, cell.instanceId, 1);
      this.caps.setTextureIndex(cell.instanceId, cell.terrainType);
    }

    scene.add(
      this.sides.instancedMesh,
      this.caps.instancedMesh,
      this.undiscoveredFog,
      this.discoveredFog,
    );
  }

  get pickableMesh(): THREE.InstancedMesh {
    return this.caps.instancedMesh;
  }

  getHexAtInstance(instanceId: number): HexCoord | undefined {
    return getHexForInstance(this.model, instanceId);
  }

  /** Refreshes reusable fog instances after a domain visibility event. */
  syncVisibility(visibility: FieldVisibilityReader): void {
    for (const cell of this.model.cells) {
      const state = visibility.getFieldVisibility(cell.coord);
      this.setFogVisible(
        this.undiscoveredFog,
        cell,
        state === FieldVisibility.Undiscovered,
      );
      this.setFogVisible(
        this.discoveredFog,
        cell,
        state === FieldVisibility.Discovered,
      );
    }

    this.undiscoveredFog.instanceMatrix.needsUpdate = true;
    this.discoveredFog.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.sides.instancedMesh.geometry.dispose();
    this.caps.instancedMesh.geometry.dispose();
    disposeMaterials(this.sides.instancedMesh.material);
    disposeMaterials(this.caps.instancedMesh.material);
    this.undiscoveredFog.geometry.dispose();
    this.discoveredFog.geometry.dispose();
    disposeMaterials(this.undiscoveredFog.material);
    disposeMaterials(this.discoveredFog.material);
    this.sides.instancedMesh.removeFromParent();
    this.caps.instancedMesh.removeFromParent();
    this.undiscoveredFog.removeFromParent();
    this.discoveredFog.removeFromParent();
  }

  private createFogMesh(color: number, opacity: number): THREE.InstancedMesh {
    const geometry = Hex.createHexTopGeometry(
      this.config.hexSize,
      this.config.borderWidth,
    );
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: opacity < 1,
      opacity,
      depthWrite: false,
    });
    const mesh = new THREE.InstancedMesh(
      geometry,
      material,
      this.model.cells.length,
    );
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }

  private setFogVisible(
    mesh: THREE.InstancedMesh,
    cell: MapRenderModel["cells"][number],
    visible: boolean,
  ): void {
    MapView.fogDummy.position.set(
      visible ? cell.x : 0,
      visible ? cell.y : 0,
      visible ? cell.height + this.config.fogZOffset : 0,
    );
    MapView.fogDummy.scale.setScalar(visible ? 1 : 0);
    MapView.fogDummy.rotation.set(0, 0, 0);
    MapView.fogDummy.updateMatrix();
    mesh.setMatrixAt(cell.instanceId, MapView.fogDummy.matrix);
  }
}

function disposeMaterials(material: THREE.Material | THREE.Material[]): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.dispose();
  }
}

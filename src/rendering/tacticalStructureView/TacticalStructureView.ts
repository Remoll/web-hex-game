import * as THREE from "three";
import {
  DoorBlockInitialState,
  TacticalHexStructureType,
} from "@/game/board/structure/TacticalHexStructure";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { FieldVisibilityReader } from "@/game/visibility/MageVisibility";
import {
  AtlasInstancedMesh,
  type AtlasTextureRegion,
} from "@/rendering/customInstancedMesh/atlasInstancedMesh/AtlasInstancedMesh";
import { CustomInstancedMesh } from "@/rendering/customInstancedMesh/CustomInstancedMesh";
import { Hex } from "@/rendering/geometry/hex/Hex";
import type { RenderConfig } from "@/rendering/RenderConfig";
import {
  edgeStructureAtlas,
  propsAtlas,
} from "@/rendering/tacticalStructureView/TacticalStructureAtlas";
import { wallTextureAtlasRegions } from "@/rendering/tacticalStructureView/TacticalStructureAtlasMapping";
import {
  EdgeStructureSprite,
  PropsSprite,
} from "@/rendering/tacticalStructureView/TacticalStructureSprite";
import {
  buildTacticalStructureRenderStates,
  getTacticalStructureVisualKind,
  isTacticalStructureVisible,
  tacticalStructureTopCapZOffset,
  TacticalStructureVisualKind,
  type TacticalStructureRenderState,
} from "@/rendering/tacticalStructureView/TacticalStructureRenderModel";

const minimumInstancedMeshCapacity = 1;
const structureRenderOrder = 2;
const opaqueMaterialAlphaTest = 0.5;
const wallTopCapColor = 0x111111;
const wallTopCapBorderWidth = 0;
/** Faces the fixed isometric camera, preserving an upright sprite silhouette. */
const isometricCardRotationXRadians = Math.PI / 4;
const edgeStructureCardWidthHexSizeMultiplier = 1.25;
const edgeStructureCardHeightDepthLayers = 4;
const treeCardWidthHexSizeMultiplier = 1.8;
const treeCardHeightHexSizeMultiplier = 2.2;

/** Read-only rendering boundary for the current state of authored DoorBlocks. */
export interface DoorBlockStateReader {
  getDoorBlockState(doorBlockId: string): DoorBlockInitialState | undefined;
}

/**
 * Efficient map-owned structure rendering. It reads immutable placements and
 * a narrow door-state projection; it never changes gameplay or fog state.
 */
export class TacticalStructureView {
  private static readonly cardDummy = new THREE.Object3D();

  private readonly wallStates: readonly TacticalStructureRenderState[];
  private readonly edgeStates: readonly TacticalStructureRenderState[];
  private readonly treeStates: readonly TacticalStructureRenderState[];
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly wallSides: AtlasInstancedMesh<EdgeStructureSprite>;
  private readonly wallTopCaps: CustomInstancedMesh;
  private readonly edges: AtlasInstancedMesh<EdgeStructureSprite>;
  private readonly trees: AtlasInstancedMesh<PropsSprite>;

  constructor(
    scene: THREE.Scene,
    gameMap: GameMap,
    private readonly config: RenderConfig,
  ) {
    const states = buildTacticalStructureRenderStates(gameMap, config);
    this.wallStates = states.filter((state) => (
      state.placement.structure.type === TacticalHexStructureType.WallBlock
    ));
    this.edgeStates = states.filter((state) => (
      state.placement.structure.type === TacticalHexStructureType.DoorBlock
      || state.placement.structure.type === TacticalHexStructureType.WindowBlock
    ));
    this.treeStates = states.filter((state) => (
      state.placement.structure.type === TacticalHexStructureType.Tree
    ));

    this.wallSides = new AtlasInstancedMesh(
      Hex.createTexturedHexSidesGeometry(config.hexSize),
      createAtlasMaterial(),
      getInstancedMeshCapacity(this.wallStates.length),
      edgeStructureAtlas,
    );
    this.wallTopCaps = new CustomInstancedMesh(
      Hex.createHexTopGeometry(config.hexSize, wallTopCapBorderWidth),
      new THREE.MeshLambertMaterial({ color: wallTopCapColor }),
      getInstancedMeshCapacity(this.wallStates.length),
    );
    this.edges = new AtlasInstancedMesh(
      new THREE.PlaneGeometry(
        config.hexSize * edgeStructureCardWidthHexSizeMultiplier,
        config.hexDepth * edgeStructureCardHeightDepthLayers,
      ),
      createAtlasMaterial(),
      getInstancedMeshCapacity(this.edgeStates.length),
      edgeStructureAtlas,
    );
    this.trees = new AtlasInstancedMesh(
      new THREE.PlaneGeometry(
        config.hexSize * treeCardWidthHexSizeMultiplier,
        config.hexSize * treeCardHeightHexSizeMultiplier,
      ),
      createAtlasMaterial(),
      getInstancedMeshCapacity(this.treeStates.length),
      propsAtlas,
    );

    this.configureMesh(this.wallSides.instancedMesh, this.wallStates.length);
    this.configureMesh(this.wallTopCaps.instancedMesh, this.wallStates.length);
    this.configureMesh(this.edges.instancedMesh, this.edgeStates.length);
    this.configureMesh(this.trees.instancedMesh, this.treeStates.length);
    scene.add(
      this.wallSides.instancedMesh,
      this.wallTopCaps.instancedMesh,
      this.edges.instancedMesh,
      this.trees.instancedMesh,
    );
  }

  /** Refreshes visibility and DoorBlock sprites after one resolved tactical event. */
  sync(
    visibility: FieldVisibilityReader,
    doorStateReader: DoorBlockStateReader,
  ): void {
    this.syncWalls(visibility);
    this.syncEdges(visibility, doorStateReader);
    this.syncTrees(visibility);
  }

  dispose(): void {
    disposeInstancedMesh(this.wallSides.instancedMesh);
    disposeInstancedMesh(this.wallTopCaps.instancedMesh);
    disposeInstancedMesh(this.edges.instancedMesh);
    disposeInstancedMesh(this.trees.instancedMesh);
  }

  private syncWalls(visibility: FieldVisibilityReader): void {
    for (const [index, state] of this.wallStates.entries()) {
      if (!isTacticalStructureVisible(state, visibility)) {
        this.setHidden(this.wallSides.instancedMesh, index);
        this.setHidden(this.wallTopCaps.instancedMesh, index);
        continue;
      }

      const visualKind = getTacticalStructureVisualKind(
        state.placement,
        () => undefined,
      );
      this.wallSides.setTextureIndex(index, getEdgeStructureSprite(visualKind));
      this.wallSides.setTextureRegion(
        index,
        getWallTextureAtlasRegion(visualKind),
      );
      this.wallSides.updateState(
        state.x,
        state.y,
        state.baseZ,
        index,
        state.blockHeight,
      );
      this.wallTopCaps.updateState(
        state.x,
        state.y,
        state.baseZ + state.blockHeight + tacticalStructureTopCapZOffset,
        index,
        1,
      );
    }

    this.wallSides.instancedMesh.instanceMatrix.needsUpdate = true;
    this.wallTopCaps.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  private syncEdges(
    visibility: FieldVisibilityReader,
    doorStateReader: DoorBlockStateReader,
  ): void {
    const edgeStructureCardHeight = this.config.hexDepth
      * edgeStructureCardHeightDepthLayers;
    for (const [index, state] of this.edgeStates.entries()) {
      if (!isTacticalStructureVisible(state, visibility)) {
        this.setHidden(this.edges.instancedMesh, index);
        continue;
      }

      const visualKind = getTacticalStructureVisualKind(
        state.placement,
        (doorBlockId) => doorStateReader.getDoorBlockState(doorBlockId),
      );
      this.edges.setTextureIndex(index, getEdgeStructureSprite(visualKind));
      this.setCameraFacingCard(
        this.edges.instancedMesh,
        index,
        state.x,
        state.y,
        state.baseZ + edgeStructureCardHeight / 2,
      );
    }

    this.edges.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  private syncTrees(visibility: FieldVisibilityReader): void {
    const treeCardHeight = this.config.hexSize * treeCardHeightHexSizeMultiplier;
    for (const [index, state] of this.treeStates.entries()) {
      if (!isTacticalStructureVisible(state, visibility)) {
        this.setHidden(this.trees.instancedMesh, index);
        continue;
      }

      this.trees.setTextureIndex(index, PropsSprite.OakTree);
      this.setCameraFacingCard(
        this.trees.instancedMesh,
        index,
        state.x,
        state.y,
        state.baseZ + treeCardHeight / 2,
      );
    }

    this.trees.instancedMesh.instanceMatrix.needsUpdate = true;
  }

  private configureMesh(mesh: THREE.InstancedMesh, count: number): void {
    mesh.count = count;
    mesh.frustumCulled = false;
    mesh.renderOrder = structureRenderOrder;
  }

  /** Positions a sprite plane perpendicular to the fixed isometric camera. */
  private setCameraFacingCard(
    mesh: THREE.InstancedMesh,
    index: number,
    x: number,
    y: number,
    z: number,
  ): void {
    TacticalStructureView.cardDummy.position.set(x, y, z);
    TacticalStructureView.cardDummy.scale.set(1, 1, 1);
    TacticalStructureView.cardDummy.rotation.set(
      isometricCardRotationXRadians,
      0,
      0,
    );
    TacticalStructureView.cardDummy.updateMatrix();
    mesh.setMatrixAt(index, TacticalStructureView.cardDummy.matrix);
  }

  private setHidden(mesh: THREE.InstancedMesh, index: number): void {
    mesh.setMatrixAt(index, this.hiddenMatrix);
  }
}

function createAtlasMaterial(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({
    transparent: true,
    alphaTest: opaqueMaterialAlphaTest,
    side: THREE.DoubleSide,
  });
}

function getInstancedMeshCapacity(itemCount: number): number {
  return Math.max(itemCount, minimumInstancedMeshCapacity);
}

function getEdgeStructureSprite(
  visualKind: TacticalStructureVisualKind,
): EdgeStructureSprite {
  switch (visualKind) {
    case TacticalStructureVisualKind.StoneWall:
      return EdgeStructureSprite.StoneWall;
    case TacticalStructureVisualKind.TimberWall:
      return EdgeStructureSprite.TimberWall;
    case TacticalStructureVisualKind.ClosedDoor:
      return EdgeStructureSprite.ClosedDoor;
    case TacticalStructureVisualKind.OpenDoor:
      return EdgeStructureSprite.OpenDoor;
    case TacticalStructureVisualKind.Window:
      return EdgeStructureSprite.Window;
    case TacticalStructureVisualKind.Tree:
      throw new Error("Tree structures use the props atlas");
  }
}

function getWallTextureAtlasRegion(
  visualKind: TacticalStructureVisualKind,
): AtlasTextureRegion {
  const sprite = getEdgeStructureSprite(visualKind);
  const region = wallTextureAtlasRegions.get(sprite);
  if (!region) {
    throw new Error(`Structure sprite ${sprite} cannot texture a wall side`);
  }
  return region;
}

function disposeInstancedMesh(mesh: THREE.InstancedMesh): void {
  mesh.geometry.dispose();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) {
    material.dispose();
  }
  mesh.removeFromParent();
}

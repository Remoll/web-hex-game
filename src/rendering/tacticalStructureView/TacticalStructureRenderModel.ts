import {
  DoorBlockInitialState,
  TacticalHexAxis,
  TacticalHexStructureType,
  WallBlockSideMaterial,
  type TacticalHexStructurePlacementProjection,
} from "@/game/board/structure/TacticalHexStructure";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import {
  FieldVisibility,
  type FieldVisibilityReader,
} from "@/game/visibility/MageVisibility";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import type { RenderConfig } from "@/rendering/RenderConfig";

/** Visual variants selected entirely from authored structure data and door state. */
export enum TacticalStructureVisualKind {
  StoneWall = "stone-wall",
  TimberWall = "timber-wall",
  ClosedDoor = "closed-door",
  OpenDoor = "open-door",
  Window = "window",
  Tree = "tree",
}

/** Four terrain-depth layers make a WallBlock read as a tall hex structure. */
export const tacticalStructureBlockHeightDepthLayers = 4;
/** Keeps a WallBlock top cap above its scaled side geometry. */
export const tacticalStructureTopCapZOffset = 0.01;

const axisQRotationRadians = Math.PI / 6;
const axisRRotationRadians = Math.PI / 2;
const axisSRotationRadians = (Math.PI * 5) / 6;

export interface TacticalStructureRenderState {
  readonly placement: TacticalHexStructurePlacementProjection;
  readonly x: number;
  readonly y: number;
  /** The terrain-cap elevation on which the structure starts. */
  readonly baseZ: number;
  /** The relevant full-hex axis for DoorBlocks and WindowBlocks. */
  readonly rotationZ: number;
  readonly blockHeight: number;
}

/** Builds static transforms; door visuals are resolved separately on sync. */
export function buildTacticalStructureRenderStates(
  gameMap: GameMap,
  config: RenderConfig,
): readonly TacticalStructureRenderState[] {
  const states: TacticalStructureRenderState[] = [];

  gameMap.forEachStructure((placement) => {
    const field = gameMap.getField(placement.coordinate.q, placement.coordinate.r);
    if (!field) {
      return;
    }

    const planePosition = HexLayout.hexCoordToPlaneCoord(
      placement.coordinate,
      config.hexSize,
    );
    states.push(Object.freeze({
      placement,
      x: planePosition.x,
      y: planePosition.y,
      baseZ: (field.getGroundLevel() + config.terrainBaseLevel) * config.hexDepth,
      rotationZ: getTacticalStructureRotationZ(placement),
      blockHeight: config.hexDepth * tacticalStructureBlockHeightDepthLayers,
    }));
  });

  return Object.freeze(states);
}

/** Resolves a safe visual kind without allowing rendering to modify domain state. */
export function getTacticalStructureVisualKind(
  placement: TacticalHexStructurePlacementProjection,
  getDoorBlockState: (doorBlockId: string) => DoorBlockInitialState | undefined,
): TacticalStructureVisualKind {
  switch (placement.structure.type) {
    case TacticalHexStructureType.WallBlock:
      return placement.structure.sideMaterial === WallBlockSideMaterial.Stone
        ? TacticalStructureVisualKind.StoneWall
        : TacticalStructureVisualKind.TimberWall;
    case TacticalHexStructureType.DoorBlock:
      return getDoorBlockState(placement.id) === DoorBlockInitialState.Open
        ? TacticalStructureVisualKind.OpenDoor
        : TacticalStructureVisualKind.ClosedDoor;
    case TacticalHexStructureType.WindowBlock:
      return TacticalStructureVisualKind.Window;
    case TacticalHexStructureType.Tree:
      return TacticalStructureVisualKind.Tree;
  }
}

/** Structures obey the same undiscovered-information boundary as terrain. */
export function isTacticalStructureVisible(
  state: TacticalStructureRenderState,
  visibility: FieldVisibilityReader,
): boolean {
  return visibility.getFieldVisibility(state.placement.coordinate)
    !== FieldVisibility.Undiscovered;
}

function getTacticalStructureRotationZ(
  placement: TacticalHexStructurePlacementProjection,
): number {
  if (placement.structure.type !== TacticalHexStructureType.DoorBlock
    && placement.structure.type !== TacticalHexStructureType.WindowBlock) {
    return 0;
  }

  switch (placement.structure.axis) {
    case TacticalHexAxis.Q:
      return axisQRotationRadians;
    case TacticalHexAxis.R:
      return axisRRotationRadians;
    case TacticalHexAxis.S:
      return axisSRotationRadians;
  }
}

import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  DoorBlockInitialState,
  TacticalHexAxis,
  TacticalHexStructureType,
  WallBlockSideMaterial,
  type TacticalHexStructurePlacementProjection,
} from "@/game/board/structure/TacticalHexStructure";
import { MovementType, TerrainType, type MapArray } from "@/game/types";
import { FieldVisibility } from "@/game/visibility/MageVisibility";
import { defaultRenderConfig } from "@/rendering/RenderConfig";
import {
  buildTacticalStructureRenderStates,
  getTacticalStructureVisualKind,
  isTacticalStructureVisible,
  tacticalStructureBlockHeightDepthLayers,
  TacticalStructureVisualKind,
} from "@/rendering/tacticalStructureView/TacticalStructureRenderModel";

const map: MapArray = [
  {
    q: 0,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Cobblestone,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 2,
      leavingCostMultiplier: 1,
    },
  },
  {
    q: 1,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Cobblestone,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
  {
    q: 0,
    r: 1,
    fieldAttrs: {
      terrainType: TerrainType.Cobblestone,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
  {
    q: -1,
    r: 1,
    fieldAttrs: {
      terrainType: TerrainType.Cobblestone,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
  {
    q: 1,
    r: -1,
    fieldAttrs: {
      terrainType: TerrainType.Cobblestone,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
];

function getRequiredPlacement(
  gameMap: GameMap,
  id: string,
): TacticalHexStructurePlacementProjection {
  const placement = gameMap.getStructurePlacementById(id);
  if (!placement) {
    throw new Error(`Expected structure placement ${id}`);
  }
  return placement;
}

describe("TacticalStructureRenderModel", () => {
  it("builds stable terrain-cap transforms and full-hex axis rotations", () => {
    const gameMap = new GameMap(map, [
      {
        id: "stone-wall",
        q: 0,
        r: 0,
        structure: {
          type: TacticalHexStructureType.WallBlock,
          sideMaterial: WallBlockSideMaterial.Stone,
        },
      },
      {
        id: "axis-q-door",
        q: 1,
        r: 0,
        structure: {
          type: TacticalHexStructureType.DoorBlock,
          axis: TacticalHexAxis.Q,
          initialState: DoorBlockInitialState.Closed,
        },
      },
      {
        id: "axis-r-window",
        q: 0,
        r: 1,
        structure: {
          type: TacticalHexStructureType.WindowBlock,
          axis: TacticalHexAxis.R,
        },
      },
      {
        id: "tree",
        q: -1,
        r: 1,
        structure: { type: TacticalHexStructureType.Tree },
      },
    ]);

    const states = buildTacticalStructureRenderStates(gameMap, defaultRenderConfig);

    expect(states).toHaveLength(4);
    expect(states[0]).toMatchObject({
      placement: { id: "stone-wall" },
      x: 0,
      y: 0,
      baseZ: 48,
      rotationZ: 0,
      blockHeight: defaultRenderConfig.hexDepth * tacticalStructureBlockHeightDepthLayers,
    });
    expect(states[1]?.rotationZ).toBeCloseTo(Math.PI / 6);
    expect(states[2]?.rotationZ).toBeCloseTo(Math.PI / 2);
    expect(states[3]?.rotationZ).toBe(0);
  });

  it("maps structure definitions and mutable DoorBlock state to visual variants", () => {
    const gameMap = new GameMap(map, [
      {
        id: "stone-wall",
        q: 0,
        r: 0,
        structure: {
          type: TacticalHexStructureType.WallBlock,
          sideMaterial: WallBlockSideMaterial.Stone,
        },
      },
      {
        id: "timber-wall",
        q: 1,
        r: 0,
        structure: {
          type: TacticalHexStructureType.WallBlock,
          sideMaterial: WallBlockSideMaterial.Timber,
        },
      },
      {
        id: "door",
        q: 0,
        r: 1,
        structure: {
          type: TacticalHexStructureType.DoorBlock,
          axis: TacticalHexAxis.S,
          initialState: DoorBlockInitialState.Closed,
        },
      },
      {
        id: "tree",
        q: -1,
        r: 1,
        structure: { type: TacticalHexStructureType.Tree },
      },
      {
        id: "window",
        q: 1,
        r: -1,
        structure: {
          type: TacticalHexStructureType.WindowBlock,
          axis: TacticalHexAxis.Q,
        },
      },
    ]);
    const getDoorState = (doorBlockId: string): DoorBlockInitialState | undefined => (
      doorBlockId === "door" ? DoorBlockInitialState.Open : undefined
    );

    expect(getTacticalStructureVisualKind(
      getRequiredPlacement(gameMap, "stone-wall"),
      getDoorState,
    )).toBe(TacticalStructureVisualKind.StoneWall);
    expect(getTacticalStructureVisualKind(
      getRequiredPlacement(gameMap, "timber-wall"),
      getDoorState,
    )).toBe(TacticalStructureVisualKind.TimberWall);
    expect(getTacticalStructureVisualKind(
      getRequiredPlacement(gameMap, "door"),
      getDoorState,
    )).toBe(TacticalStructureVisualKind.OpenDoor);
    expect(getTacticalStructureVisualKind(
      getRequiredPlacement(gameMap, "door"),
      () => undefined,
    )).toBe(TacticalStructureVisualKind.ClosedDoor);
    expect(getTacticalStructureVisualKind(
      getRequiredPlacement(gameMap, "window"),
      getDoorState,
    )).toBe(TacticalStructureVisualKind.Window);
    expect(getTacticalStructureVisualKind(
      getRequiredPlacement(gameMap, "tree"),
      getDoorState,
    )).toBe(TacticalStructureVisualKind.Tree);
  });

  it("hides structures only while their own field is Undiscovered", () => {
    const gameMap = new GameMap(map, [{
      id: "tree",
      q: 0,
      r: 0,
      structure: { type: TacticalHexStructureType.Tree },
    }]);
    const state = buildTacticalStructureRenderStates(gameMap, defaultRenderConfig)[0];
    if (!state) {
      throw new Error("Expected a tree render state");
    }

    expect(isTacticalStructureVisible(state, {
      getFieldVisibility: () => FieldVisibility.Undiscovered,
    })).toBe(false);
    expect(isTacticalStructureVisible(state, {
      getFieldVisibility: () => FieldVisibility.Discovered,
    })).toBe(true);
    expect(isTacticalStructureVisible(state, {
      getFieldVisibility: () => FieldVisibility.Visible,
    })).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { TacticalDoorState } from "@/game/board/structure/TacticalDoorState";
import {
  DoorBlockInitialState,
  TacticalHexAxis,
  TacticalHexStructureType,
  WallBlockSideMaterial,
} from "@/game/board/structure/TacticalHexStructure";
import { MovementType, TerrainType, type MapArray } from "@/game/types";

const doorCoordinate = { q: 0, r: 0 };
const wallCoordinate = { q: 1, r: 0 };
const doorBlockId = "test-door";
const wallBlockId = "test-wall";
const unknownDoorBlockId = "unknown-door";

const map: MapArray = [doorCoordinate, wallCoordinate].map(({ q, r }) => ({
  q,
  r,
  fieldAttrs: {
    terrainType: TerrainType.Grass,
    allowedMovements: {
      [MovementType.Ground]: true,
      [MovementType.Flying]: true,
    },
    groundLevel: 0,
    leavingCostMultiplier: 1,
  },
}));

describe("TacticalDoorState", () => {
  it("derives mutable DoorBlock state without mutating authored map structures", () => {
    const gameMap = new GameMap(map, [
      {
        id: doorBlockId,
        ...doorCoordinate,
        structure: {
          type: TacticalHexStructureType.DoorBlock,
          axis: TacticalHexAxis.Q,
          initialState: DoorBlockInitialState.Closed,
        },
      },
      {
        id: wallBlockId,
        ...wallCoordinate,
        structure: {
          type: TacticalHexStructureType.WallBlock,
          sideMaterial: WallBlockSideMaterial.Stone,
        },
      },
    ]);
    const doorState = new TacticalDoorState(gameMap);

    expect(doorState.getDoorBlockIdAt(doorCoordinate)).toBe(doorBlockId);
    expect(doorState.getDoorBlockIdAt(wallCoordinate)).toBeUndefined();
    expect(doorState.getState(doorBlockId)).toBe(DoorBlockInitialState.Closed);
    expect(doorState.isGroundEntryBlocked(doorCoordinate)).toBe(true);
    expect(doorState.isSightBlocked(doorCoordinate)).toBe(true);
    expect(doorState.isGroundEntryBlocked(wallCoordinate)).toBe(true);
    expect(doorState.isSightBlocked(wallCoordinate)).toBe(true);

    expect(doorState.toggle(doorBlockId)).toBe(DoorBlockInitialState.Open);
    expect(doorState.isGroundEntryBlocked(doorCoordinate)).toBe(false);
    expect(doorState.isSightBlocked(doorCoordinate)).toBe(false);
    expect(gameMap.getStructurePlacementById(doorBlockId)?.structure).toEqual({
      type: TacticalHexStructureType.DoorBlock,
      axis: TacticalHexAxis.Q,
      initialState: DoorBlockInitialState.Closed,
    });
    expect(doorState.toggle(unknownDoorBlockId)).toBeUndefined();
  });
});

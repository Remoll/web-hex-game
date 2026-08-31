import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  DoorBlockInitialState,
  TacticalHexAxis,
  TacticalHexStructureType,
  WallBlockSideMaterial,
} from "@/game/board/structure/TacticalHexStructure";
import { Faction } from "@/game/faction/Faction";
import {
  GameActionPreviewType,
} from "@/game/gameSession/GameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { createGameSession } from "@/game/levels/createGameSession";
import { parseLevelDefinition } from "@/game/levels/parseLevelDefinition";
import { MovementType, TerrainType } from "@/game/types";
import { UnitTacticalRole, UnitTexture } from "@/game/unit/Unit";
import { hasElevationLineOfSight } from "@/game/visibility/ElevationLineOfSight";

const structureShowcaseLevelPath = fileURLToPath(
  new URL("../../../public/levels/structure-showcase.json", import.meta.url),
);
const structureShowcaseMapRadius = 5;
const structureShowcaseFieldCount = 91;
const structureShowcaseEntryCoordinate = { q: -5, r: 0 };
const closedDoorId = "showcase-south-west-door-north";
const closedDoorCoordinate = { q: -4, r: 1 };
const adjacentDoorApproachCoordinate = { q: -5, r: 1 };
const alignedWindowObserverCoordinate = { q: -5, r: 2 };
const alignedWindowTargetCoordinate = { q: -3, r: 2 };
const structureCount = 27;
const treeClearingCoordinates = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: 1, r: -1 },
  { q: -1, r: 1 },
  { q: -2, r: 1 },
  { q: -1, r: 0 },
  { q: -1, r: -1 },
] as const;
const roomCornerIds = [
  "showcase-corner-north-west",
  "showcase-corner-north-east",
  "showcase-corner-east",
  "showcase-corner-south-east",
  "showcase-corner-south-west",
  "showcase-corner-west",
] as const;
const roomSides = [
  { doorIds: ["showcase-north-door-west", "showcase-north-door-east"], windowId: "showcase-north-window" },
  { doorIds: ["showcase-north-east-door-north", "showcase-north-east-door-south"], windowId: "showcase-north-east-window" },
  { doorIds: ["showcase-south-east-door-east", "showcase-south-east-door-south"], windowId: "showcase-south-east-window" },
  { doorIds: ["showcase-south-door-east", "showcase-south-door-west"], windowId: "showcase-south-window" },
  { doorIds: ["showcase-south-west-door-south", "showcase-south-west-door-north"], windowId: "showcase-south-west-window" },
  { doorIds: ["showcase-north-west-door-west", "showcase-north-west-door-north"], windowId: "showcase-north-west-window" },
] as const;

async function loadStructureShowcaseLevel(): Promise<LevelDefinition> {
  const serializedLevel: unknown = JSON.parse(
    await readFile(structureShowcaseLevelPath, "utf8"),
  );
  return parseLevelDefinition(serializedLevel);
}

describe("structure-showcase level fixture", () => {
  it("defines a reproducible tactical map with every approved authored structure type", async () => {
    const level = await loadStructureShowcaseLevel();
    const gameMap = new GameMap(level.map, level.structures);

    expect(level.map).toHaveLength(structureShowcaseFieldCount);
    expect(gameMap.radiusInHex).toBe(structureShowcaseMapRadius);
    expect(level.player).toMatchObject({
      id: "player",
      position: structureShowcaseEntryCoordinate,
      texture: UnitTexture.PlayerIdle,
      faction: Faction.Player,
      movementType: MovementType.Ground,
      tacticalRole: UnitTacticalRole.Mage,
    });
    expect(level.units.map((unit) => unit.id)).toEqual([
      "showcase-window-guard",
      "showcase-courtyard-guard",
    ]);
    expect(gameMap.structureCount).toBe(structureCount);
    expect(gameMap.getStructurePlacementById("showcase-corner-north-west")).toMatchObject({
      structure: {
        type: TacticalHexStructureType.WallBlock,
        sideMaterial: WallBlockSideMaterial.Stone,
      },
    });
    expect(gameMap.getStructurePlacementById("showcase-corner-north-east")).toMatchObject({
      structure: {
        type: TacticalHexStructureType.WallBlock,
        sideMaterial: WallBlockSideMaterial.Timber,
      },
    });
    expect(gameMap.getStructurePlacementById(closedDoorId)).toMatchObject({
      coordinate: closedDoorCoordinate,
      structure: {
        type: TacticalHexStructureType.DoorBlock,
        axis: TacticalHexAxis.Q,
        initialState: DoorBlockInitialState.Closed,
      },
    });
    expect(gameMap.getStructurePlacementById("showcase-south-west-window")).toMatchObject({
      structure: {
        type: TacticalHexStructureType.WindowBlock,
        axis: TacticalHexAxis.Q,
      },
    });
    expect(gameMap.getStructurePlacementById("showcase-oak-one")).toMatchObject({
      structure: { type: TacticalHexStructureType.Tree },
    });
    for (const coordinate of treeClearingCoordinates) {
      expect(gameMap.getField(coordinate.q, coordinate.r)?.getTerrainType()).toBe(
        TerrainType.Grass,
      );
    }
  });

  it("forms a six-sided room with a door pair and window on every side", async () => {
    const level = await loadStructureShowcaseLevel();
    const gameMap = new GameMap(level.map, level.structures);

    expect(roomCornerIds).toHaveLength(6);
    for (const cornerId of roomCornerIds) {
      expect(gameMap.getStructurePlacementById(cornerId)?.structure.type).toBe(
        TacticalHexStructureType.WallBlock,
      );
    }

    expect(roomSides).toHaveLength(6);
    for (const side of roomSides) {
      expect(side.doorIds).toHaveLength(2);
      for (const doorId of side.doorIds) {
        expect(gameMap.getStructurePlacementById(doorId)?.structure).toMatchObject({
          type: TacticalHexStructureType.DoorBlock,
          initialState: DoorBlockInitialState.Closed,
        });
      }
      expect(gameMap.getStructurePlacementById(side.windowId)?.structure.type).toBe(
        TacticalHexStructureType.WindowBlock,
      );
    }
  });

  it("keeps the door interaction and window sight demonstration reachable", async () => {
    const level = await loadStructureShowcaseLevel();
    const gameMap = new GameMap(level.map, level.structures);
    const { session, player } = createGameSession(level);

    expect(hasElevationLineOfSight(
      gameMap,
      alignedWindowObserverCoordinate,
      alignedWindowTargetCoordinate,
    )).toBe(true);
    expect(session.clickHex(player.position)).toMatchObject({ unitId: player.id });
    expect(session.clickHex(adjacentDoorApproachCoordinate)).toMatchObject({
      unitId: player.id,
      to: adjacentDoorApproachCoordinate,
    });
    expect(session.previewHex(closedDoorCoordinate)).toEqual({
      type: GameActionPreviewType.ValidDoorInteraction,
      mageId: player.id,
      doorBlockId: closedDoorId,
      currentState: DoorBlockInitialState.Closed,
    });
    expect(gameMap.getField(alignedWindowObserverCoordinate.q, alignedWindowObserverCoordinate.r)
      ?.getTerrainType()).toBe(TerrainType.Cobblestone);
  });
});

import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  TacticalHexAxis,
  TacticalHexStructureType,
  WallBlockSideMaterial,
} from "@/game/board/structure/TacticalHexStructure";
import { MovementType, TerrainType, type MapArray } from "@/game/types";
import {
  hasElevationLineOfSight,
  steepElevationVisionBlockerDifference,
} from "@/game/visibility/ElevationLineOfSight";

const observerCoordinate = { q: 0, r: 0 };
const solidStructureCoordinate = { q: 1, r: 0 };
const targetBeyondSolidStructureCoordinate = { q: 2, r: 0 };
const wallStructureId = "sight-wall";
const treeStructureId = "sight-tree";
const windowStructureId = "sight-window";

describe("hasElevationLineOfSight", () => {
  it("keeps an elevated intervening field visible but blocks fields beyond it", () => {
    const map = new GameMap(createElevationMap([0, 2, 0]));
    const observer = { q: 0, r: 0 };
    const blocker = { q: 1, r: 0 };
    const hiddenBeyondBlocker = { q: 2, r: 0 };

    expect(steepElevationVisionBlockerDifference).toBe(2);
    expect(hasElevationLineOfSight(map, observer, blocker)).toBe(true);
    expect(hasElevationLineOfSight(map, observer, hiddenBeyondBlocker)).toBe(false);
  });

  it("does not block a line without the named elevation difference", () => {
    const map = new GameMap(createElevationMap([0, 1, 0]));

    expect(hasElevationLineOfSight(
      map,
      { q: 0, r: 0 },
      { q: 2, r: 0 },
    )).toBe(true);
  });

  it("blocks a line as soon as any of several intervening fields is steep", () => {
    const map = new GameMap(createElevationMap([0, 1, 2, 0]));

    expect(hasElevationLineOfSight(
      map,
      { q: 0, r: 0 },
      { q: 3, r: 0 },
    )).toBe(false);
  });

  it("keeps sight through an equally direct neighbouring line beside a blocker", () => {
    const map = new GameMap([
      mapItem(0, 0, 0),
      mapItem(1, 0, 2),
      mapItem(0, 1, 0),
      mapItem(1, 1, 0),
    ]);

    expect(hasElevationLineOfSight(
      map,
      { q: 0, r: 0 },
      { q: 1, r: 1 },
    )).toBe(true);
  });

  it("blocks sight when every equally direct neighbouring line is steep", () => {
    const map = new GameMap([
      mapItem(0, 0, 0),
      mapItem(1, 0, 2),
      mapItem(0, 1, 2),
      mapItem(1, 1, 0),
    ]);

    expect(hasElevationLineOfSight(
      map,
      { q: 0, r: 0 },
      { q: 1, r: 1 },
    )).toBe(false);
  });

  it("keeps a downhill line clear when no intervening field rises steeply", () => {
    const map = new GameMap(createElevationMap([2, 0, 0]));

    expect(hasElevationLineOfSight(
      map,
      { q: 0, r: 0 },
      { q: 2, r: 0 },
    )).toBe(true);
  });

  it("treats an incomplete tactical line as blocked instead of routing around it", () => {
    const map = new GameMap([
      mapItem(0, 0, 0),
      mapItem(2, 0, 0),
      mapItem(0, 1, 0),
    ]);

    expect(hasElevationLineOfSight(
      map,
      { q: 0, r: 0 },
      { q: 2, r: 0 },
    )).toBe(false);
  });

  it("keeps a solid structure field visible but blocks sight beyond WallBlocks and Trees", () => {
    const wallMap = new GameMap(createElevationMap([0, 0, 0]), [{
      id: wallStructureId,
      ...solidStructureCoordinate,
      structure: {
        type: TacticalHexStructureType.WallBlock,
        sideMaterial: WallBlockSideMaterial.Timber,
      },
    }]);
    const treeMap = new GameMap(createElevationMap([0, 1, 0]), [{
      id: treeStructureId,
      ...solidStructureCoordinate,
      structure: { type: TacticalHexStructureType.Tree },
    }]);

    expect(wallMap.isSightBlockedByStructure(solidStructureCoordinate)).toBe(true);
    expect(hasElevationLineOfSight(
      wallMap,
      observerCoordinate,
      solidStructureCoordinate,
    )).toBe(true);
    expect(hasElevationLineOfSight(
      wallMap,
      observerCoordinate,
      targetBeyondSolidStructureCoordinate,
    )).toBe(false);
    expect(hasElevationLineOfSight(
      treeMap,
      observerCoordinate,
      targetBeyondSolidStructureCoordinate,
    )).toBe(false);
  });

  it("does not restrict sight through WindowBlocks regardless of their axis", () => {
    const alignedWindowMap = new GameMap(createElevationMap([0, 0, 0]), [{
      id: windowStructureId,
      ...solidStructureCoordinate,
      structure: {
        type: TacticalHexStructureType.WindowBlock,
        axis: TacticalHexAxis.Q,
      },
    }]);
    const crossAxisWindowMap = new GameMap(createElevationMap([0, 0, 0]), [{
      id: windowStructureId,
      ...solidStructureCoordinate,
      structure: {
        type: TacticalHexStructureType.WindowBlock,
        axis: TacticalHexAxis.R,
      },
    }]);

    expect(alignedWindowMap.isSightBlockedByStructure(solidStructureCoordinate)).toBe(false);
    expect(hasElevationLineOfSight(
      alignedWindowMap,
      observerCoordinate,
      targetBeyondSolidStructureCoordinate,
    )).toBe(true);
    expect(hasElevationLineOfSight(
      crossAxisWindowMap,
      observerCoordinate,
      targetBeyondSolidStructureCoordinate,
    )).toBe(true);

    const turningWindowMap = new GameMap([
      mapItem(0, 0, 0),
      mapItem(1, 0, 0),
      mapItem(2, 0, 0),
      mapItem(3, -1, 0),
    ], [{
      id: windowStructureId,
      ...solidStructureCoordinate,
      structure: {
        type: TacticalHexStructureType.WindowBlock,
        axis: TacticalHexAxis.Q,
      },
    }]);

    expect(hasElevationLineOfSight(
      turningWindowMap,
      observerCoordinate,
      { q: 3, r: -1 },
    )).toBe(true);
  });

  it("blocks a target only when every equally direct sight line crosses a solid structure", () => {
    const map = new GameMap([
      mapItem(0, 0, 0),
      mapItem(1, 0, 0),
      mapItem(0, 1, 0),
      mapItem(1, 1, 0),
    ], [
      {
        id: wallStructureId,
        q: 1,
        r: 0,
        structure: {
          type: TacticalHexStructureType.WallBlock,
          sideMaterial: WallBlockSideMaterial.Stone,
        },
      },
      {
        id: treeStructureId,
        q: 0,
        r: 1,
        structure: { type: TacticalHexStructureType.Tree },
      },
    ]);

    expect(hasElevationLineOfSight(
      map,
      observerCoordinate,
      { q: 1, r: 1 },
    )).toBe(false);
  });
});

function createElevationMap(levels: readonly number[]): MapArray {
  return levels.map((groundLevel, q) => mapItem(q, 0, groundLevel));
}

function mapItem(q: number, r: number, groundLevel: number) {
  return {
    q,
    r,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel,
      leavingCostMultiplier: 1,
    },
  };
}

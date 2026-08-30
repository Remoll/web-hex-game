import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  DoorBlockInitialState,
  TacticalHexAxis,
  TacticalHexStructureType,
  WallBlockSideMaterial,
} from "@/game/board/structure/TacticalHexStructure";
import { parseLevelDefinition } from "@/game/levels/parseLevelDefinition";

const validStructureLevelPath = fileURLToPath(
  new URL("fixtures/valid-structures.json", import.meta.url),
);
const invalidStructureLevelPath = fileURLToPath(
  new URL("fixtures/invalid-structures.json", import.meta.url),
);
const duplicateStructureId = "stone-wall";
const duplicateStructureCoordinate = { q: 0, r: 0 };
const missingStructureMapCoordinate = { q: 9, r: 9 };
const secondTreeStructureId = "second-tree";
const outsideMapStructureId = "outside-map";

async function loadJsonFixture(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

describe("parseLevelDefinition", () => {
  it("parses valid explicit structure JSON placements while preserving legacy omission", async () => {
    const level = parseLevelDefinition(await loadJsonFixture(validStructureLevelPath));

    expect(level.structures).toEqual([
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
        id: "timber-door",
        q: 1,
        r: 0,
        structure: {
          type: TacticalHexStructureType.DoorBlock,
          axis: TacticalHexAxis.Q,
          initialState: DoorBlockInitialState.Closed,
        },
      },
      {
        id: "window-r",
        q: 0,
        r: 1,
        structure: {
          type: TacticalHexStructureType.WindowBlock,
          axis: TacticalHexAxis.R,
        },
      },
      {
        id: "tree-s",
        q: -1,
        r: 1,
        structure: { type: TacticalHexStructureType.Tree },
      },
    ]);
    expect(Object.isFrozen(level.structures?.[0])).toBe(true);
    expect(Object.isFrozen(level.structures?.[0]?.structure)).toBe(true);

    const legacyLevel = parseLevelDefinition({
      map: [],
      player: {
        id: "player",
        position: { q: 0, r: 0 },
        texture: "player-idle",
      },
      units: [],
    });
    expect(legacyLevel.structures).toBeUndefined();
  });

  it("rejects malformed JSON fixture structure data before a session can begin", async () => {
    const fixture = await loadJsonFixture(invalidStructureLevelPath);

    expect(() => parseLevelDefinition(fixture)).toThrow(
      "Level structure 0 does not support property sideMaterial",
    );
  });

  it("rejects duplicate ids, duplicate coordinates, and placements outside the map", async () => {
    const fixture = await loadJsonFixture(validStructureLevelPath);
    if (!isRecord(fixture) || !Array.isArray(fixture.structures)) {
      throw new Error("The valid structure fixture must provide a structures array");
    }

    const duplicateIdFixture = {
      ...fixture,
      structures: [
        ...fixture.structures,
        {
          id: duplicateStructureId,
          q: 1,
          r: 0,
          structure: { type: TacticalHexStructureType.Tree },
        },
      ],
    };
    expect(() => parseLevelDefinition(duplicateIdFixture)).toThrow(
      `Level structures contain duplicate id ${duplicateStructureId}`,
    );

    const duplicateCoordinateFixture = {
      ...fixture,
      structures: [
        ...fixture.structures,
        {
          id: secondTreeStructureId,
          ...duplicateStructureCoordinate,
          structure: { type: TacticalHexStructureType.Tree },
        },
      ],
    };
    expect(() => parseLevelDefinition(duplicateCoordinateFixture)).toThrow(
      "Level structures contain duplicate placement at 0,0",
    );

    const missingMapFieldFixture = {
      ...fixture,
      structures: [{
        id: outsideMapStructureId,
        ...missingStructureMapCoordinate,
        structure: { type: TacticalHexStructureType.Tree },
      }],
    };
    expect(() => parseLevelDefinition(missingMapFieldFixture)).toThrow(
      "Level structure 0 references missing map field 9,9",
    );

    const missingIdFixture = {
      ...fixture,
      structures: [{
        q: 0,
        r: 0,
        structure: { type: TacticalHexStructureType.Tree },
      }],
    };
    expect(() => parseLevelDefinition(missingIdFixture)).toThrow(
      "Level structure 0 is missing required property id",
    );
  });
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

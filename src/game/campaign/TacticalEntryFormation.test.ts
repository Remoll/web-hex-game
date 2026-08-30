import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { TacticalEntryDirection } from "@/game/campaign/CampaignDefinition";
import { createTacticalEntryFormation } from "@/game/campaign/TacticalEntryFormation";
import { TerrainType, MovementType, type MapArray } from "@/game/types";

const map: MapArray = [
  { q: 0, r: 0 },
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: 1, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: -1 },
].map(({ q, r }) => ({
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

describe("createTacticalEntryFormation", () => {
  it("places party members in deterministic East-facing entry slots", () => {
    expect(createTacticalEntryFormation(
      new GameMap(map),
      { q: 0, r: 0 },
      TacticalEntryDirection.East,
      ["mage", "servant-one", "servant-two"],
      [],
    )).toEqual([
      { unitId: "mage", position: { q: 0, r: 0 } },
      { unitId: "servant-one", position: { q: 1, r: 0 } },
      { unitId: "servant-two", position: { q: 0, r: 1 } },
    ]);
  });

  it("rotates servant slots from the route's declared entry direction", () => {
    expect(createTacticalEntryFormation(
      new GameMap(map),
      { q: 0, r: 0 },
      TacticalEntryDirection.West,
      ["mage", "servant-one", "servant-two"],
      [],
    )).toEqual([
      { unitId: "mage", position: { q: 0, r: 0 } },
      { unitId: "servant-one", position: { q: -1, r: 0 } },
      { unitId: "servant-two", position: { q: -1, r: 1 } },
    ]);
  });

  it("rejects an occupied authored formation slot instead of overlapping party members", () => {
    expect(() => createTacticalEntryFormation(
      new GameMap(map),
      { q: 0, r: 0 },
      TacticalEntryDirection.East,
      ["mage", "servant-one"],
      [{ q: 1, r: 0 }],
    )).toThrow("The tactical entry formation slot for servant-one is unavailable");
  });
});

import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { StrategicSession } from "@/game/strategicSession/StrategicSession";
import { TerrainType, MovementType, type MapArray } from "@/game/types";

const map: MapArray = [0, 1, 2].map((q) => ({
  q,
  r: 0,
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

describe("StrategicSession", () => {
  it("moves one legal Ground edge without tactical AP or timeline state", () => {
    const session = new StrategicSession(new GameMap(map), { q: 0, r: 0 });

    expect(session.canMoveTo({ q: 2, r: 0 })).toBe(false);
    expect(session.moveTo({ q: 1, r: 0 })).toBe(true);
    expect(session.partyPosition).toEqual({ q: 1, r: 0 });
    expect(session.getReachableCoordinates()).toEqual([
      { q: 2, r: 0 },
      { q: 0, r: 0 },
    ]);
  });
});

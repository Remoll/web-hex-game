import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { GameSession } from "@/game/gameSession/GameSession";
import { UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
import { MovementType, TerrainType, type MapArray } from "@/game/types";

const mapData: MapArray = [
  {
    q: 0,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
  {
    q: 1,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Water,
      allowedMovements: { [MovementType.Ground]: false, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
  {
    q: 0,
    r: 1,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 0,
      leavingCostMultiplier: 1,
    },
  },
];

function createSession(): { session: GameSession; player: Player } {
  const player = new Player(
    "player",
    { q: 0, r: 0 },
    UnitTexture.PlayerIdle,
  );
  return {
    session: new GameSession(new GameMap(mapData), [player]),
    player,
  };
}

describe("GameSession", () => {
  it("selects and deselects a clicked unit", () => {
    const { session } = createSession();

    expect(session.clickHex({ q: 0, r: 0 })).toEqual({
      type: "selected",
      unitId: "player",
    });
    expect(session.selectedUnitId).toBe("player");

    expect(session.clickHex({ q: 0, r: 0 })).toEqual({
      type: "deselected",
      unitId: "player",
    });
    expect(session.selectedUnitId).toBeNull();
  });

  it("moves a selected unit onto water and preserves the selection", () => {
    const { session, player } = createSession();
    session.clickHex({ q: 0, r: 0 });

    expect(session.clickHex({ q: 1, r: 0 })).toEqual({
      type: "moved",
      unitId: "player",
      from: { q: 0, r: 0 },
      to: { q: 1, r: 0 },
    });
    expect(player.position).toEqual({ q: 1, r: 0 });
    expect(session.selectedUnitId).toBe("player");
  });

  it("ignores a map field when no unit is selected", () => {
    const { session, player } = createSession();

    expect(session.clickHex({ q: 0, r: 1 })).toEqual({
      type: "ignored",
      reason: "no-selected-unit",
    });
    expect(player.position).toEqual({ q: 0, r: 0 });
  });

  it("ignores a coordinate outside the map without moving the selected unit", () => {
    const { session, player } = createSession();
    session.clickHex({ q: 0, r: 0 });

    expect(session.clickHex({ q: 9, r: 9 })).toEqual({
      type: "ignored",
      reason: "missing-field",
    });
    expect(player.position).toEqual({ q: 0, r: 0 });
    expect(session.selectedUnitId).toBe("player");
  });
});

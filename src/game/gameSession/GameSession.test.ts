import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { Faction } from "@/game/faction/Faction";
import {
  GameActionPreviewType,
  GameActionRejectionReason,
  GameActionType,
  GameSession,
} from "@/game/gameSession/GameSession";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
import { MovementType, TerrainType, type MapArray } from "@/game/types";
import { FieldVisibility } from "@/game/visibility/MageVisibility";

const mapData: MapArray = [
  { q: 0, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: 1, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: 2, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: 3, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: -1, r: 0, fieldAttrs: field(TerrainType.Grass) },
  { q: 0, r: -1, fieldAttrs: field(TerrainType.Grass) },
  { q: 0, r: -2, fieldAttrs: field(TerrainType.Grass) },
  { q: 0, r: -3, fieldAttrs: field(TerrainType.Grass) },
  { q: 0, r: 1, fieldAttrs: field(TerrainType.Water, false) },
];

function field(terrainType: TerrainType, ground = true) {
  return {
    terrainType,
    allowedMovements: {
      [MovementType.Ground]: ground,
      [MovementType.Flying]: true,
    },
    groundLevel: 0,
    leavingCostMultiplier: 1,
  };
}

function createSession(): {
  session: GameSession;
  player: Player;
  playerAlly: Unit;
  enemy: Unit;
  neutral: Unit;
} {
  const player = new Player("player", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
  const playerAlly = new Unit(
    "player-ally",
    { q: -1, r: 0 },
    UnitTexture.PlayerIdle,
    { faction: Faction.Player },
  );
  const enemy = new Unit("enemy", { q: 2, r: 0 }, UnitTexture.EnemyIdle, {
    faction: Faction.Enemy,
  });
  const neutral = new Unit("neutral", { q: 3, r: 0 }, UnitTexture.EnemyIdle, {
    faction: Faction.Neutral,
  });

  return {
    session: new GameSession(
      new GameMap(mapData),
      [player, playerAlly, enemy, neutral],
    ),
    player,
    playerAlly,
    enemy,
    neutral,
  };
}

describe("GameSession", () => {
  it("selects and deselects only Player-faction units", () => {
    const { session, playerAlly } = createSession();

    expect(session.clickHex({ q: 2, r: 0 })).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotPlayerControlled,
    });
    expect(session.selectedUnitId).toBeNull();

    expect(session.previewHex({ q: 0, r: 0 })).toEqual({
      type: GameActionPreviewType.Selection,
      unitId: "player",
    });
    expect(session.clickHex({ q: 0, r: 0 })).toEqual({
      type: GameActionType.Selected,
      unitId: "player",
    });
    expect(session.clickHex(playerAlly.position)).toEqual({
      type: GameActionType.Selected,
      unitId: "player-ally",
    });
    expect(session.selectedUnitId).toBe("player-ally");
    expect(session.clickHex({ q: 0, r: 0 })).toEqual({
      type: GameActionType.Selected,
      unitId: "player",
    });
    expect(session.clickHex({ q: 0, r: 0 })).toEqual({
      type: GameActionType.Deselected,
      unitId: "player",
    });
  });

  it("spends Ground movement by path cost and restores it only through the round reset", () => {
    const { session, player } = createSession();
    session.clickHex({ q: 0, r: 0 });

    expect(session.previewHex({ q: 0, r: -1 })).toEqual({
      type: GameActionPreviewType.ValidMove,
      unitId: "player",
      destination: { q: 0, r: -1 },
      path: {
        cost: 1,
        steps: [{ q: 0, r: -1 }],
      },
    });
    expect(session.getReachableHexes()).toEqual(
      expect.arrayContaining([{ coord: { q: 0, r: -3 }, cost: 3 }]),
    );

    expect(session.clickHex({ q: 0, r: -1 })).toEqual({
      type: GameActionType.Moved,
      unitId: "player",
      from: { q: 0, r: 0 },
      to: { q: 0, r: -1 },
    });
    expect(player.remainingMovement).toBe(2);
    expect(player.remainingActions).toBe(1);
    expect(session.previewHex({ q: 0, r: -2 })).toMatchObject({
      type: GameActionPreviewType.ValidMove,
      destination: { q: 0, r: -2 },
    });

    session.clickHex({ q: 0, r: -3 });
    expect(player.remainingMovement).toBe(0);
    expect(player.remainingActions).toBe(1);
    expect(session.previewHex({ q: 0, r: -2 })).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.RoundExhausted,
    });

    session.resetRoundBudgets();
    expect(player.remainingMovement).toBe(3);
    expect(player.remainingActions).toBe(1);
  });

  it("rejects impassable Ground terrain and live-unit movement destinations", () => {
    const { session } = createSession();
    session.clickHex({ q: 0, r: 0 });

    expect(session.previewHex({ q: 0, r: 1 })).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.OutOfRange,
    });
    expect(session.clickHex({ q: 0, r: 1 })).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.OutOfRange,
    });
    expect(session.previewHex({ q: 3, r: 0 })).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.NotHostile,
    });
  });

  it("allows an adjacent attack after movement, then exhausts the round and leaves corpses non-blocking", () => {
    const { session, player, enemy, neutral } = createSession();
    session.clickHex({ q: 0, r: 0 });
    session.clickHex({ q: 1, r: 0 });
    expect(player.remainingMovement).toBe(2);
    expect(player.remainingActions).toBe(1);

    expect(session.previewHex({ q: 2, r: 0 })).toEqual({
      type: GameActionPreviewType.ValidAttack,
      attackerId: "player",
      targetId: "enemy",
    });
    expect(session.clickHex({ q: 2, r: 0 })).toEqual({
      type: GameActionType.Attacked,
      attackerId: "player",
      targetId: "enemy",
      damage: 20,
      targetCurrentHp: 80,
      targetDefeated: false,
    });
    expect(player.remainingMovement).toBe(0);
    expect(player.remainingActions).toBe(0);

    for (let health = 60; health >= 0; health -= 20) {
      session.resetRoundBudgets();
      expect(session.clickHex({ q: 2, r: 0 })).toMatchObject({
        type: GameActionType.Attacked,
        targetCurrentHp: health,
        targetDefeated: health === 0,
      });
    }

    expect(enemy.isAlive).toBe(false);
    expect(session.getUnitAt({ q: 2, r: 0 })).toBeUndefined();
    expect(session.units).toContain(enemy);
    expect(neutral.isAlive).toBe(true);

    session.resetRoundBudgets();
    expect(session.previewHex({ q: 2, r: 0 })).toMatchObject({
      type: GameActionPreviewType.ValidMove,
      destination: { q: 2, r: 0 },
    });
  });

  it("tracks Mage discovery after movement and rejects hidden unit selection", () => {
    const visibilityMap: MapArray = [0, 1, 2, 3].map((q) => ({
      q,
      r: 0,
      fieldAttrs: field(TerrainType.Grass),
    }));
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { viewRange: 1 },
    );
    const hiddenAlly = new Unit(
      "hidden-ally",
      { q: 3, r: 0 },
      UnitTexture.PlayerIdle,
      { faction: Faction.Player },
    );
    const session = new GameSession(
      new GameMap(visibilityMap),
      [mage, hiddenAlly],
    );

    expect(session.getFieldVisibility({ q: 0, r: 0 })).toBe(
      FieldVisibility.Visible,
    );
    expect(session.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Undiscovered,
    );
    expect(session.previewHex(hiddenAlly.position)).toEqual({
      type: GameActionPreviewType.OutOfRange,
      reason: GameActionRejectionReason.NotVisible,
    });
    expect(session.clickHex(hiddenAlly.position)).toEqual({
      type: GameActionType.Ignored,
      reason: GameActionRejectionReason.NotVisible,
    });

    session.clickHex(mage.position);
    session.clickHex({ q: 1, r: 0 });
    session.clickHex({ q: 2, r: 0 });

    expect(session.getFieldVisibility({ q: 0, r: 0 })).toBe(
      FieldVisibility.Discovered,
    );
    expect(session.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Visible,
    );
  });

  it("requires exactly one living Mage", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const secondMage = new Player(
      "second-mage",
      { q: 1, r: 0 },
      UnitTexture.PlayerIdle,
    );

    expect(() => new GameSession(
      new GameMap(mapData),
      [mage, secondMage],
    )).toThrow("A game session requires exactly one living Mage");
  });
});

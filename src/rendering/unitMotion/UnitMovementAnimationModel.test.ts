import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import type { UnitMovementEvent } from "@/game/gameSession/GameSession";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Faction, MovementType, TerrainType, type MapArray } from "@/game/types";
import { defaultRenderConfig } from "@/rendering/RenderConfig";
import { buildVisibleUnitMovementAnimation } from "@/rendering/unitMotion/UnitMovementAnimationModel";

const map: MapArray = [
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
      terrainType: TerrainType.Grass,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 1,
      leavingCostMultiplier: 1,
    },
  },
];

const movementEvent: UnitMovementEvent = {
  unitId: "enemy",
  from: { q: 0, r: 0 },
  steps: [{ q: 1, r: 0 }],
};

describe("buildVisibleUnitMovementAnimation", () => {
  it("does not create presentation work for a unit outside current Mage sight", () => {
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );

    expect(buildVisibleUnitMovementAnimation(
      movementEvent,
      enemy,
      false,
      new GameMap(map),
      defaultRenderConfig,
    )).toBeUndefined();
  });

  it("retains every event keyframe for a visible living unit", () => {
    const enemy = new Unit(
      "enemy",
      { q: 1, r: 0 },
      UnitTexture.EnemyIdle,
      { faction: Faction.Enemy },
    );

    const animation = buildVisibleUnitMovementAnimation(
      movementEvent,
      enemy,
      true,
      new GameMap(map),
      defaultRenderConfig,
    );

    expect(animation).toMatchObject({
      unitId: enemy.id,
      states: [
        { x: 0, y: 0 },
        { x: 96 },
      ],
    });
    expect(animation?.states).toHaveLength(2);
  });
});

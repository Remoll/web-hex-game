import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  TacticalPresentationEventKind,
  type UnitMovementEvent,
} from "@/game/gameSession/GameSession";
import { UnitTexture } from "@/game/unit/Unit";
import { MovementType, TerrainType, type MapArray } from "@/game/types";
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
  kind: TacticalPresentationEventKind.Move,
  unit: {
    id: "enemy",
    position: { q: 1, r: 0 },
    texture: UnitTexture.EnemyIdle,
    currentHp: 100,
    maxHp: 100,
    isAlive: true,
  },
  from: { q: 0, r: 0 },
  steps: [{ q: 1, r: 0 }],
};

describe("buildVisibleUnitMovementAnimation", () => {
  it("does not create presentation work for a defeated snapshot", () => {
    expect(buildVisibleUnitMovementAnimation(
      {
        ...movementEvent,
        unit: { ...movementEvent.unit, isAlive: false },
      },
      new GameMap(map),
      defaultRenderConfig,
    )).toBeUndefined();
  });

  it("retains every keyframe for a fog-safe living Move event", () => {
    const animation = buildVisibleUnitMovementAnimation(
      movementEvent,
      new GameMap(map),
      defaultRenderConfig,
    );

    expect(animation).toMatchObject({
      unitId: movementEvent.unit.id,
      states: [
        { x: 0, y: 0 },
        { x: 96 },
      ],
    });
    expect(animation?.states).toHaveLength(2);
  });
});

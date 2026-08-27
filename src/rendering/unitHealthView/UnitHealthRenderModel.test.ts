import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Faction, MovementType, TerrainType, type MapArray } from "@/game/types";
import { buildUnitHealthRenderState } from "@/rendering/unitHealthView/UnitHealthRenderModel";
import { defaultRenderConfig } from "@/rendering/RenderConfig";

const map: MapArray = [
  {
    q: 0,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: {
        [MovementType.Ground]: true,
        [MovementType.Flying]: true,
      },
      groundLevel: 1,
      leavingCostMultiplier: 1,
    },
  },
];

describe("buildUnitHealthRenderState", () => {
  it("maps a living unit's health ratio above its terrain elevation", () => {
    const unit = new Unit(
      "player",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      {
        faction: Faction.Player,
        movementType: MovementType.Ground,
        movementRange: 3,
        currentHp: 50,
        attackPower: 20,
      },
    );

    expect(
      buildUnitHealthRenderState(unit, new GameMap(map), defaultRenderConfig),
    ).toEqual(
      expect.objectContaining({
        unitId: "player",
        fillRatio: 0.5,
        z:
          2 * defaultRenderConfig.hexDepth +
          defaultRenderConfig.unitsHeight +
          defaultRenderConfig.healthBarOffset,
      }),
    );
  });
});

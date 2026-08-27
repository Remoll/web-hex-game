import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { Unit, UnitTexture } from "@/game/unit/Unit";
import { Faction, MovementType, TerrainType, type MapArray } from "@/game/types";
import { buildRemainsRenderState } from "@/rendering/remainsView/RemainsRenderModel";
import { defaultRenderConfig } from "@/rendering/RenderConfig";

const map: MapArray = [{
  q: 0,
  r: 0,
  fieldAttrs: {
    terrainType: TerrainType.Grass,
    allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
    groundLevel: 0,
    leavingCostMultiplier: 1,
  },
}];

describe("buildRemainsRenderState", () => {
  it("renders only a dead unit at its final coordinate", () => {
    const unit = new Unit("enemy", { q: 0, r: 0 }, UnitTexture.EnemyIdle, {
      faction: Faction.Enemy,
      movementType: MovementType.Ground,
      movementRange: 3,
      currentHp: 20,
      attackPower: 20,
    });
    expect(buildRemainsRenderState(unit, new GameMap(map), defaultRenderConfig)).toBeUndefined();

    unit.receiveDamage(20);
    expect(buildRemainsRenderState(unit, new GameMap(map), defaultRenderConfig)).toEqual(
      expect.objectContaining({
        unitId: "enemy",
        z:
          defaultRenderConfig.terrainBaseLevel * defaultRenderConfig.hexDepth
          + defaultRenderConfig.remainsZOffset,
      }),
    );
  });
});

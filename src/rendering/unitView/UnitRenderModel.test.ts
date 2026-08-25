import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
import { MovementType, TerrainType, type MapArray } from "@/game/types";
import { defaultRenderConfig } from "@/rendering/RenderConfig";
import { buildUnitRenderState } from "@/rendering/unitView/UnitRenderModel";

const mapData: MapArray = [
  {
    q: 1,
    r: -1,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: { [MovementType.Ground]: true, [MovementType.Flying]: true },
      groundLevel: 2,
      leavingCostMultiplier: 1,
    },
  },
];

describe("UnitRenderModel", () => {
  it("positions a unit over the top of its field", () => {
    const state = buildUnitRenderState(
      new Player(
        "player",
        { q: 1, r: -1 },
        UnitTexture.PlayerIdle,
      ),
      new GameMap(mapData),
      defaultRenderConfig,
    );

    expect(state.x).toBe(96);
    expect(state.y).toBeCloseTo(-55.4256258422);
    expect(state.z).toBe(73.6);
  });
});

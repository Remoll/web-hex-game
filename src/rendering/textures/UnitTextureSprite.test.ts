import { describe, expect, it } from "vitest";
import { UnitTexture } from "@/game/unit/Unit";
import { UnitSprite } from "@/rendering/textures/UnitSprite";
import { getUnitSprite } from "@/rendering/textures/UnitTextureSprite";

describe("getUnitSprite", () => {
  it("maps domain texture keys to renderer-only sprites", () => {
    expect(getUnitSprite(UnitTexture.PlayerIdle)).toBe(UnitSprite.PlayerIdle);
    expect(getUnitSprite(UnitTexture.EnemyIdle)).toBe(UnitSprite.EnemyIdle);
  });
});

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { UnitTexture } from "@/game/unit/Unit";

const exampleLevelPath = fileURLToPath(
  new URL("../../../public/levels/example.json", import.meta.url),
);

function hexDistance(
  first: { q: number; r: number },
  second: { q: number; r: number },
): number {
  return Math.max(
    Math.abs(first.q - second.q),
    Math.abs(first.r - second.r),
    Math.abs(first.q + first.r - second.q - second.r),
  );
}

describe("example level", () => {
  it("defines a player and one enemy two hexes away", async () => {
    const level = JSON.parse(
      await readFile(exampleLevelPath, "utf8"),
    ) as LevelDefinition;

    expect(level.player).toMatchObject({
      id: "player",
      position: { q: 0, r: 0 },
      texture: UnitTexture.PlayerIdle,
    });
    expect(level.units).toHaveLength(1);
    expect(level.units[0]).toMatchObject({
      id: "enemy-1",
      position: { q: 2, r: 0 },
      texture: UnitTexture.EnemyIdle,
    });
    expect(hexDistance(level.player.position, level.units[0].position)).toBe(2);
  });
});

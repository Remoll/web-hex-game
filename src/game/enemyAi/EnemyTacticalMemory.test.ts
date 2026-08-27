import { describe, expect, it } from "vitest";
import { EnemyTacticalMemory } from "@/game/enemyAi/EnemyTacticalMemory";

describe("EnemyTacticalMemory", () => {
  it("stores an isolated last-known hostile position per Enemy", () => {
    const memory = new EnemyTacticalMemory();
    const rememberedPosition = { q: 2, r: -1 };

    memory.rememberHostilePosition("enemy-a", "mage", rememberedPosition);
    memory.rememberHostilePosition("enemy-b", "servant", { q: 1, r: 0 });
    rememberedPosition.q = 99;
    const exposedPosition = memory.getLastKnownHostilePosition("enemy-a");
    exposedPosition!.r = 99;

    expect(memory.getLastKnownHostilePosition("enemy-a")).toEqual({ q: 2, r: -1 });
    expect(memory.getLastKnownHostilePosition("enemy-b")).toEqual({ q: 1, r: 0 });

    memory.clear("enemy-a");
    expect(memory.getLastKnownHostilePosition("enemy-a")).toBeUndefined();
  });

  it("forgets every Enemy memory for a defeated hostile only", () => {
    const memory = new EnemyTacticalMemory();
    memory.rememberHostilePosition("enemy-a", "mage", { q: 2, r: -1 });
    memory.rememberHostilePosition("enemy-b", "mage", { q: 3, r: -1 });
    memory.rememberHostilePosition("enemy-c", "servant", { q: 1, r: 0 });

    memory.forgetHostile("mage");

    expect(memory.getLastKnownHostilePosition("enemy-a")).toBeUndefined();
    expect(memory.getLastKnownHostilePosition("enemy-b")).toBeUndefined();
    expect(memory.getLastKnownHostilePosition("enemy-c")).toEqual({ q: 1, r: 0 });
  });
});

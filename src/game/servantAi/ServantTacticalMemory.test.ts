import { describe, expect, it } from "vitest";
import { ServantTacticalMemory } from "@/game/servantAi/ServantTacticalMemory";

describe("ServantTacticalMemory", () => {
  it("keeps each servant target independent and forgets invalidated targets", () => {
    const memory = new ServantTacticalMemory();

    memory.rememberDefaultTarget("servant-a", "enemy-a");
    memory.rememberDefaultTarget("servant-b", "enemy-a");
    memory.rememberDefaultTarget("servant-c", "enemy-b");
    memory.forgetTarget("enemy-a");

    expect(memory.getDefaultTargetId("servant-a")).toBeUndefined();
    expect(memory.getDefaultTargetId("servant-b")).toBeUndefined();
    expect(memory.getDefaultTargetId("servant-c")).toBe("enemy-b");
  });
});

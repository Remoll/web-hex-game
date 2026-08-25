import { describe, expect, it, vi } from "vitest";
import { loadLevel } from "@/app/gameApp/loadLevel";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { UnitTexture } from "@/game/unit/Unit";

const level: LevelDefinition = {
  map: [],
  player: {
    id: "player",
    position: { q: 0, r: 0 },
    texture: UnitTexture.PlayerIdle,
  },
  units: [],
};

describe("loadLevel", () => {
  it("returns JSON from a public level URL", async () => {
    const request = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue(level),
    });

    await expect(
      loadLevel("/levels/example.json", request as typeof fetch),
    ).resolves.toBe(level);
    expect(request).toHaveBeenCalledWith("/levels/example.json");
  });

  it("rejects a failed level request with its URL and status", async () => {
    const request = vi.fn().mockResolvedValue({ ok: false, status: 404 });

    await expect(
      loadLevel("/levels/missing.json", request as typeof fetch),
    ).rejects.toThrow("Could not load level from /levels/missing.json (HTTP 404)");
  });
});

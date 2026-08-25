import { Texture } from "three";
import { describe, expect, it } from "vitest";
import { TextureAtlas } from "@/rendering/textures/textureAtlas/TextureAtlas";

describe("TextureAtlas", () => {
  it("returns the configured sprite index", () => {
    const texture = new Texture();
    const atlas = new TextureAtlas(
      texture,
      2,
      1,
      new Map<string, number>([
        ["grass", 0],
        ["water", 1],
      ]),
    );

    expect(atlas.getIndex("water")).toBe(1);
    expect(texture.version).toBe(0);
  });

  it("rejects sprites that are not included in the atlas", () => {
    const atlas = new TextureAtlas(
      new Texture(),
      1,
      1,
      new Map<string, number>([["player", 0]]),
    );

    expect(() => atlas.getIndex("missing")).toThrow(
      "Sprite missing is not present in this atlas",
    );
  });
});

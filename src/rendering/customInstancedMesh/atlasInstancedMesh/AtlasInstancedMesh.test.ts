import {
  MeshBasicMaterial,
  PlaneGeometry,
  Texture,
} from "three";
import { describe, expect, it } from "vitest";
import {
  AtlasInstancedMesh,
  type AtlasTextureRegion,
} from "@/rendering/customInstancedMesh/atlasInstancedMesh/AtlasInstancedMesh";
import { TextureAtlas } from "@/rendering/textures/textureAtlas/TextureAtlas";

enum TestSprite {
  Sample = "sample",
}

const testAtlas = new TextureAtlas(
  new Texture(),
  1,
  1,
  new Map([[TestSprite.Sample, 0]]),
);
const croppedTextureRegion: AtlasTextureRegion = {
  uOffset: 0.1,
  vOffset: 0.2,
  uScale: 0.7,
  vScale: 0.6,
};

interface TextureRegionAttributeReader {
  readonly itemSize: number;
  getX(index: number): number;
  getY(index: number): number;
  getZ(index: number): number;
  getW(index: number): number;
}

describe("AtlasInstancedMesh", () => {
  it("defaults every instance to a full atlas cell and supports a per-instance crop", () => {
    const geometry = new PlaneGeometry(1, 1);
    const material = new MeshBasicMaterial();
    const mesh = new AtlasInstancedMesh(
      geometry,
      material,
      2,
      testAtlas,
    );
    const textureRegions = mesh.instancedMesh.geometry.getAttribute(
      "instanceTextureRegion",
    );

    expect(textureRegions.itemSize).toBe(4);
    expectTextureRegion(textureRegions, 0, [0, 0, 1, 1]);
    expectTextureRegion(textureRegions, 1, [0, 0, 1, 1]);

    mesh.setTextureRegion(1, croppedTextureRegion);

    expectTextureRegion(textureRegions, 1, [0.1, 0.2, 0.7, 0.6]);

    mesh.instancedMesh.geometry.dispose();
    material.dispose();
    geometry.dispose();
  });
});

function expectTextureRegion(
  attribute: TextureRegionAttributeReader,
  index: number,
  expected: readonly number[],
): void {
  const actual = [
    attribute.getX(index),
    attribute.getY(index),
    attribute.getZ(index),
    attribute.getW(index),
  ];
  for (const [componentIndex, expectedValue] of expected.entries()) {
    expect(actual[componentIndex]).toBeCloseTo(expectedValue ?? 0);
  }
}

import { describe, expect, it } from "vitest";
import { Hex } from "@/rendering/geometry/hex/Hex";

const unitPrismBaseZ = 0;
const unitPrismTopZ = 1;
const hexSideCount = 6;
const fogWallVertexCount = hexSideCount * 2 * 3;
const fogCapVertexCount = hexSideCount * 3;
const texturedSideVertexCount = hexSideCount * 2 * 3;

describe("Hex", () => {
  it("builds a unit-height fog prism with a cap and vertical wall vertices", () => {
    const geometry = Hex.createHexFogPrismGeometry(10);
    const position = geometry.getAttribute("position");
    const zValues = Array.from(
      { length: position.count },
      (_unusedValue, index) => position.getZ(index),
    );

    expect(Math.min(...zValues)).toBe(unitPrismBaseZ);
    expect(Math.max(...zValues)).toBe(unitPrismTopZ);
    expect(zValues.filter((z) => z === unitPrismBaseZ)).not.toHaveLength(0);
    expect(zValues.filter((z) => z === unitPrismTopZ)).not.toHaveLength(0);
    expect(geometry.groups).toEqual([
      { start: 0, count: fogWallVertexCount, materialIndex: 0 },
      { start: fogWallVertexCount, count: fogCapVertexCount, materialIndex: 1 },
    ]);

    geometry.dispose();
  });

  it("builds one complete UV tile for each tall textured hex side", () => {
    const geometry = Hex.createTexturedHexSidesGeometry(10);
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");

    expect(position.count).toBe(texturedSideVertexCount);
    expect(uv.count).toBe(texturedSideVertexCount);
    expect(Math.min(...Array.from({ length: uv.count }, (_value, index) => uv.getX(index)))).toBe(0);
    expect(Math.max(...Array.from({ length: uv.count }, (_value, index) => uv.getX(index)))).toBe(1);
    expect(Math.min(...Array.from({ length: uv.count }, (_value, index) => uv.getY(index)))).toBe(0);
    expect(Math.max(...Array.from({ length: uv.count }, (_value, index) => uv.getY(index)))).toBe(1);

    geometry.dispose();
  });
});

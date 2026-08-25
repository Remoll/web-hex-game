import { describe, expect, it } from "vitest";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";

describe("HexLayout", () => {
  it("converts flat-top axial coordinates to the expected plane position", () => {
    expect(HexLayout.hexCoordToPlaneCoord({ q: 2, r: -1 }, 10)).toEqual({
      x: 30,
      y: 0,
    });
  });

  it.each([
    { q: 0, r: 0 },
    { q: 1, r: -2 },
    { q: -3, r: 2 },
  ])("round-trips axial coordinate %o", (coord) => {
    const plane = HexLayout.hexCoordToPlaneCoord(coord, 64);
    expect(HexLayout.planeCoordToHexCoord(plane, 64)).toEqual(coord);
  });

  it("rounds a point close to a negative hex center to that hex", () => {
    const center = HexLayout.hexCoordToPlaneCoord({ q: -1, r: 1 }, 20);
    expect(
      HexLayout.planeCoordToHexCoord(
        { x: center.x + 2, y: center.y - 2 },
        20,
      ),
    ).toEqual({ q: -1, r: 1 });
  });

  it("maps a vertex onto the corresponding normalized texture coordinate", () => {
    const point = HexLayout.hexVertex(0, 20);
    expect(HexLayout.planeCoordToTextureCoordinates(point, 20)).toEqual([1, 0.5]);
  });
});

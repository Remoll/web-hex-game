import { describe, expect, it } from "vitest";
import {
  compareHexCoords,
  getHexCoordKey,
  getHexDistance,
  isSameHexCoord,
} from "@/game/board/hexCoord/HexCoord";

describe("HexCoord", () => {
  it("creates stable value keys for positive and negative axial coordinates", () => {
    expect(getHexCoordKey({ q: 0, r: 0 })).toBe("0,0");
    expect(getHexCoordKey({ q: -2, r: 3 })).toBe("-2,3");
  });

  it("compares coordinate values without depending on object identity", () => {
    expect(isSameHexCoord({ q: 2, r: -1 }, { q: 2, r: -1 })).toBe(true);
    expect(isSameHexCoord({ q: 2, r: -1 }, { q: -1, r: 2 })).toBe(false);
  });

  it("orders coordinates by q and then r for deterministic ties", () => {
    const coordinates = [
      { q: 1, r: 0 },
      { q: 0, r: 1 },
      { q: 0, r: -1 },
      { q: -1, r: 2 },
    ];

    expect(coordinates.sort(compareHexCoords)).toEqual([
      { q: -1, r: 2 },
      { q: 0, r: -1 },
      { q: 0, r: 1 },
      { q: 1, r: 0 },
    ]);
  });

  it("calculates axial distance for identical, adjacent, and off-map coordinates", () => {
    expect(getHexDistance({ q: 0, r: 0 }, { q: 0, r: 0 })).toBe(0);
    expect(getHexDistance({ q: 0, r: 0 }, { q: 1, r: -1 })).toBe(1);
    expect(getHexDistance({ q: 0, r: 0 }, { q: -2, r: 3 })).toBe(3);
  });
});

import type { HexCoord, PlaneCoord } from "../types";

export class Formulas {
  static hexCoordToPlaneCoord(hex: HexCoord, size: number): PlaneCoord {
    const x = size * ((3 / 2) * hex.q);
    const y = size * ((Math.sqrt(3) / 2) * hex.q + Math.sqrt(3) * hex.r);

    return { x, y };
  }
}

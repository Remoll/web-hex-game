import type { HexCoord, PlaneCoord } from "@/game/types";

export class HexLayout {
  /** Coordinates of a flat-top hexagon vertex, numbered clockwise from +X. */
  public static hexVertex(index: number, radius: number): PlaneCoord {
    const angle = index * (Math.PI / 3);

    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle),
    };
  }

  /** Maps a point centered at (0, 0) to 0..1 texture coordinates around a hex. */
  public static planeCoordToTextureCoordinates(
    position: PlaneCoord,
    outerRadius: number,
  ): readonly [u: number, v: number] {
    return [
      0.5 + position.x / (2 * outerRadius),
      0.5 + position.y / (2 * outerRadius),
    ];
  }

  // Converts a flat-top axial hex coordinate to plane coordinates.
  public static hexCoordToPlaneCoord(hex: HexCoord, size: number): PlaneCoord {
    const x = size * ((3 / 2) * hex.q);
    const y = size * ((Math.sqrt(3) / 2) * hex.q + Math.sqrt(3) * hex.r);
    return { x, y };
  }

  // Converts plane coordinates to the nearest axial hex coordinate.
  public static planeCoordToHexCoord(pos: PlaneCoord, size: number): HexCoord {
    const q = ((2 / 3) * pos.x) / size;
    const r = ((-1 / 3) * pos.x + (Math.sqrt(3) / 3) * pos.y) / size;
    return HexLayout.hexRound(q, r);
  }

  // Rounds fractional axial coordinates to the nearest hex.
  private static hexRound(q: number, r: number): HexCoord {
    const s = -q - r;

    let rx = Math.round(q);
    let ry = Math.round(r);
    let rz = Math.round(s);

    const xDiff = Math.abs(rx - q);
    const yDiff = Math.abs(ry - r);
    const zDiff = Math.abs(rz - s);

    if (xDiff > yDiff && xDiff > zDiff) {
      rx = -ry - rz;
    } else if (yDiff > zDiff) {
      ry = -rx - rz;
    }

    return { q: rx, r: ry };
  }
}

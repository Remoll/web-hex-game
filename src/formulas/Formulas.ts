import type { HexCoord, PlaneCoord } from "../types";

export class Formulas {
  // Przeliczenie heksu na piksele (płaski na górze)
  public static hexCoordToPlaneCoord(hex: HexCoord, size: number): PlaneCoord {
    const x = size * ((3 / 2) * hex.q);
    const y = size * ((Math.sqrt(3) / 2) * hex.q + Math.sqrt(3) * hex.r);
    return { x, y };
  }

  // Przeliczenie pozycji (x, y) z ekranu 3D na najbliższy heks (q, r)
  public static planeCoordToHexCoord(pos: PlaneCoord, size: number): HexCoord {
    const q = ((2 / 3) * pos.x) / size;
    const r = ((-1 / 3) * pos.x + (Math.sqrt(3) / 3) * pos.y) / size;
    return Formulas.hexRound(q, r);
  }

  // Zaokrąglanie współrzędnych ciągłych do najbliższych całkowitych w siatce heksagonów
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
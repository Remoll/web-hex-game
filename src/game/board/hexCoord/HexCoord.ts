import type { HexCoord } from "@/game/types";

/** Creates a stable value key for maps and sets indexed by an axial hex coordinate. */
export function getHexCoordKey(coord: HexCoord): string {
  return `${coord.q},${coord.r}`;
}

/** Compares axial coordinates by value rather than object identity. */
export function isSameHexCoord(first: HexCoord, second: HexCoord): boolean {
  return first.q === second.q && first.r === second.r;
}

/** Stable axial ordering for deterministic tactical tie-breaks. */
export function compareHexCoords(first: HexCoord, second: HexCoord): number {
  return first.q - second.q || first.r - second.r;
}

/** Calculates cube-equivalent distance between two axial hex coordinates. */
export function getHexDistance(first: HexCoord, second: HexCoord): number {
  return Math.max(
    Math.abs(first.q - second.q),
    Math.abs(first.r - second.r),
    Math.abs(first.q + first.r - second.q - second.r),
  );
}

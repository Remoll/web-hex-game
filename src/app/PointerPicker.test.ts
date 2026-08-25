import { describe, expect, it } from "vitest";
import {
  normalizePointer,
  resolveHexFromIntersections,
} from "@/app/PointerPicker";

describe("PointerPicker", () => {
  it("normalizes pointer coordinates relative to the canvas, not the window", () => {
    expect(
      normalizePointer(60, 70, { left: 10, top: 20, width: 100, height: 100 }),
    ).toEqual({ x: 0, y: 0 });
    expect(
      normalizePointer(0, 0, { left: 0, top: 0, width: 0, height: 100 }),
    ).toBeUndefined();
  });

  it("maps the first instanced intersection to a hex and ignores no-hit results", () => {
    const resolve = (instanceId: number) =>
      instanceId === 4 ? { q: -1, r: 2 } : undefined;

    expect(resolveHexFromIntersections([{ instanceId: 4 }], resolve)).toEqual({
      q: -1,
      r: 2,
    });
    expect(resolveHexFromIntersections([], resolve)).toBeUndefined();
    expect(resolveHexFromIntersections([{ instanceId: 5 }], resolve)).toBeUndefined();
  });
});

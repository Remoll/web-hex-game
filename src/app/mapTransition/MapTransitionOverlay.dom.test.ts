// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { MapTransitionOverlay } from "@/app/mapTransition/MapTransitionOverlay";

afterEach(() => {
  document.body.replaceChildren();
  vi.useRealTimers();
});

describe("MapTransitionOverlay", () => {
  it("swaps immediately without a fade when reduced motion is requested", async () => {
    const swap = vi.fn();
    const overlay = new MapTransitionOverlay({
      container: document.body,
      isReducedMotion: () => true,
    });

    await overlay.transition(swap);

    expect(swap).toHaveBeenCalledOnce();
    expect(document.querySelector(".map-transition-overlay--visible")).toBeNull();
    overlay.dispose();
  });

  it("removes its visible state when the covered swap throws", async () => {
    const overlay = new MapTransitionOverlay({
      container: document.body,
      isReducedMotion: () => true,
    });

    await expect(overlay.transition(() => {
      throw new Error("swap failed");
    })).rejects.toThrow("swap failed");

    expect(document.querySelector(".map-transition-overlay--visible")).toBeNull();
    overlay.dispose();
  });
});

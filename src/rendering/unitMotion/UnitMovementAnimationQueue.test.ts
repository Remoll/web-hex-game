import { describe, expect, it } from "vitest";
import {
  UnitMovementAnimationQueue,
  type UnitMovementAnimationState,
} from "@/rendering/unitMotion/UnitMovementAnimationQueue";

const stepDurationMs = 100;

function state(x: number): UnitMovementAnimationState {
  return { x, y: 0, z: 0 };
}

describe("UnitMovementAnimationQueue", () => {
  it("interpolates every ordered path step before starting the next event", () => {
    const queue = new UnitMovementAnimationQueue(stepDurationMs, true);
    const frames: Array<{ unitId: string; x: number }> = [];
    const applyFrame = (
      unitId: string,
      from: UnitMovementAnimationState,
      to: UnitMovementAnimationState,
      progress: number,
    ) => frames.push({ unitId, x: from.x + (to.x - from.x) * progress });

    queue.enqueue([
      { unitId: "first", states: [state(0), state(10), state(20)] },
      { unitId: "second", states: [state(50), state(60)] },
    ]);

    expect(queue.isAnimating).toBe(true);
    queue.update(0, applyFrame);
    queue.update(stepDurationMs / 2, applyFrame);
    queue.update(stepDurationMs, applyFrame);
    queue.update(stepDurationMs + stepDurationMs / 2, applyFrame);
    expect(queue.update(stepDurationMs * 2, applyFrame)).toEqual(["first"]);
    queue.update(stepDurationMs * 2 + stepDurationMs / 2, applyFrame);
    expect(queue.update(stepDurationMs * 3, applyFrame)).toEqual(["second"]);

    expect(frames).toEqual([
      { unitId: "first", x: 0 },
      { unitId: "first", x: 5 },
      { unitId: "first", x: 10 },
      { unitId: "first", x: 15 },
      { unitId: "first", x: 20 },
      { unitId: "second", x: 50 },
      { unitId: "second", x: 55 },
      { unitId: "second", x: 60 },
    ]);
    expect(queue.isAnimating).toBe(false);
  });

  it("does not queue work when animation is disabled", () => {
    const queue = new UnitMovementAnimationQueue(stepDurationMs, false);
    queue.enqueue([{ unitId: "unit", states: [state(0), state(10)] }]);

    expect(queue.isAnimating).toBe(false);
    expect(queue.update(0, () => undefined)).toEqual([]);
  });

  it("clears pending and active paths without retaining animation work", () => {
    const queue = new UnitMovementAnimationQueue(stepDurationMs, true);
    queue.enqueue([{ unitId: "unit", states: [state(0), state(10)] }]);
    queue.update(0, () => undefined);

    queue.clear();

    expect(queue.isAnimating).toBe(false);
    expect(queue.hasAnimationForUnit("unit")).toBe(false);
  });
});

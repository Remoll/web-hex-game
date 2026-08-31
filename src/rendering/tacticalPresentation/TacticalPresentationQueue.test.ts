import { describe, expect, it } from "vitest";
import {
  DoorBlockInitialState,
} from "@/game/board/structure/TacticalHexStructure";
import {
  TacticalPresentationEventKind,
  type TacticalPresentationEvent,
  type TacticalUnitPresentation,
  type UnitMovementEvent,
} from "@/game/gameSession/GameSession";
import { UnitTexture } from "@/game/unit/Unit";
import { UnitMovementAnimationQueue } from "@/rendering/unitMotion/UnitMovementAnimationQueue";
import { TacticalPresentationQueue } from "@/rendering/tacticalPresentation/TacticalPresentationQueue";

const movementStepDurationMs = 100;

function presentationUnit(
  id: string,
  position: { readonly q: number; readonly r: number },
  currentHp: number = 100,
): TacticalUnitPresentation {
  return {
    id,
    position,
    texture: id === "mage" ? UnitTexture.PlayerIdle : UnitTexture.EnemyIdle,
    currentHp,
    maxHp: 100,
    isAlive: currentHp > 0,
  };
}

function moveEvent(
  unit: TacticalUnitPresentation,
  from: { readonly q: number; readonly r: number },
): UnitMovementEvent {
  return {
    kind: TacticalPresentationEventKind.Move,
    unit,
    from,
    steps: [unit.position],
  };
}

function attackEvent(
  attacker: TacticalUnitPresentation,
  target: TacticalUnitPresentation,
): TacticalPresentationEvent {
  return {
    kind: TacticalPresentationEventKind.Attack,
    attacker,
    target,
  };
}

function doorStateChangedEvent(): TacticalPresentationEvent {
  return {
    kind: TacticalPresentationEventKind.DoorStateChanged,
    doorBlockId: "test-door",
    currentState: DoorBlockInitialState.Open,
  };
}

describe("TacticalPresentationQueue", () => {
  it("completes a DoorBlock state change before a following movement animation", () => {
    const completed: TacticalPresentationEvent[] = [];
    const queue = createQueue(true, completed);
    const enemy = presentationUnit("enemy", { q: 1, r: 0 });

    queue.enqueue([
      doorStateChangedEvent(),
      moveEvent(enemy, { q: 2, r: 0 }),
    ]);

    expect(completed.map((event) => event.kind)).toEqual([
      TacticalPresentationEventKind.DoorStateChanged,
    ]);
    expect(queue.isAnimating).toBe(true);

    queue.update(0);
    queue.update(movementStepDurationMs);
    expect(completed.map((event) => event.kind)).toEqual([
      TacticalPresentationEventKind.DoorStateChanged,
      TacticalPresentationEventKind.Move,
    ]);
  });

  it("completes an Attack only after the preceding Move animation", () => {
    const completed: TacticalPresentationEvent[] = [];
    const queue = createQueue(true, completed);
    const enemy = presentationUnit("enemy", { q: 1, r: 0 });
    const mageAfterHit = presentationUnit("mage", { q: 0, r: 0 }, 0);

    queue.enqueue([
      moveEvent(enemy, { q: 2, r: 0 }),
      attackEvent(enemy, mageAfterHit),
    ]);

    expect(completed).toEqual([]);
    expect(queue.isAnimating).toBe(true);

    queue.update(0);
    expect(completed).toEqual([]);

    queue.update(movementStepDurationMs);
    expect(completed.map((event) => event.kind)).toEqual([
      TacticalPresentationEventKind.Move,
      TacticalPresentationEventKind.Attack,
    ]);
    const attack = completed[1];
    if (!attack || attack.kind !== TacticalPresentationEventKind.Attack) {
      throw new Error("Expected the Move to be followed by an Attack");
    }
    expect(attack.target).toMatchObject({ currentHp: 0, isAlive: false });
    expect(queue.isAnimating).toBe(false);
  });

  it("keeps multiple Move and Attack pairs in FIFO resolution order", () => {
    const completed: TacticalPresentationEvent[] = [];
    const queue = createQueue(true, completed);
    const enemy = presentationUnit("enemy", { q: 2, r: 0 });
    const mage = presentationUnit("mage", { q: 0, r: 0 });
    const servant = presentationUnit("servant", { q: 1, r: 0 });

    queue.enqueue([
      moveEvent(enemy, { q: 3, r: 0 }),
      attackEvent(enemy, presentationUnit("mage", mage.position, 80)),
      moveEvent(servant, { q: 0, r: 1 }),
      attackEvent(servant, presentationUnit("mage", mage.position, 60)),
    ]);

    queue.update(0);
    queue.update(movementStepDurationMs);
    queue.update(movementStepDurationMs * 2);
    queue.update(movementStepDurationMs * 3);

    expect(completed.map((event) => event.kind)).toEqual([
      TacticalPresentationEventKind.Move,
      TacticalPresentationEventKind.Attack,
      TacticalPresentationEventKind.Move,
      TacticalPresentationEventKind.Attack,
    ]);
    const completedAttacks = completed.filter(
      (event) => event.kind === TacticalPresentationEventKind.Attack,
    );
    expect(completedAttacks.map((event) => event.target.currentHp)).toEqual([80, 60]);
    expect(queue.isAnimating).toBe(false);
  });

  it("finishes events synchronously when reduced motion disables movement animation", () => {
    const completed: TacticalPresentationEvent[] = [];
    const queue = createQueue(false, completed);
    const enemy = presentationUnit("enemy", { q: 1, r: 0 });

    queue.enqueue([
      moveEvent(enemy, { q: 2, r: 0 }),
      attackEvent(enemy, presentationUnit("mage", { q: 0, r: 0 }, 80)),
    ]);

    expect(completed.map((event) => event.kind)).toEqual([
      TacticalPresentationEventKind.Move,
      TacticalPresentationEventKind.Attack,
    ]);
    expect(queue.isAnimating).toBe(false);
  });
});

function createQueue(
  isAnimationEnabled: boolean,
  completed: TacticalPresentationEvent[],
): TacticalPresentationQueue {
  return new TacticalPresentationQueue({
    movementAnimationQueue: new UnitMovementAnimationQueue(
      movementStepDurationMs,
      isAnimationEnabled,
    ),
    createMovementAnimation: (event) => ({
      unitId: event.unit.id,
      states: [
        { x: event.from.q, y: event.from.r, z: 0 },
        { x: event.unit.position.q, y: event.unit.position.r, z: 0 },
      ],
    }),
    onEventCompleted: (event) => completed.push(event),
    onMovementFrame: () => undefined,
  });
}

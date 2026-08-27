import type { InitiativeQueueEntry } from "@/game/gameSession/GameSession";

/**
 * Returns the only unit identifier a queue interaction may pass to the
 * controller. Unknown and currently hidden cards intentionally return nothing.
 */
export function getInitiativeQueueHighlightTarget(
  entry: InitiativeQueueEntry,
): string | undefined {
  return entry.canHighlight ? entry.unitId : undefined;
}

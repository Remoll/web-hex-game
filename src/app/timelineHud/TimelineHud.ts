import {
  TacticalActionPointCost,
  type TimelinePresentation,
} from "@/game/eventTimeline/EventTimeline";

export interface TimelineHudOptions {
  readonly container: HTMLElement;
  readonly mageId: string;
  readonly onWait: () => void;
  readonly onEndTurn: () => void;
}

/**
 * Small DOM-only readout for the discrete tactical timeline. It is updated by
 * game state transitions, never from the render loop.
 */
export class TimelineHud {
  private readonly root = document.createElement("section");
  private readonly currentTime = document.createElement("span");
  private readonly readyActor = document.createElement("span");
  private readonly actionCosts = document.createElement("span");
  private readonly activationControls = document.createElement("div");
  private readonly waitButton = document.createElement("button");
  private readonly endTurnButton = document.createElement("button");

  constructor(private readonly options: TimelineHudOptions) {
    this.root.className = "timeline-hud";
    this.root.setAttribute("aria-label", "Tactical timeline");

    this.currentTime.className = "timeline-hud__time";
    this.readyActor.className = "timeline-hud__actor";
    this.actionCosts.className = "timeline-hud__costs";

    this.activationControls.className = "timeline-hud__activation-controls";
    this.activationControls.setAttribute("aria-label", "Mage activation controls");
    this.activationControls.setAttribute("role", "group");

    this.waitButton.type = "button";
    this.waitButton.className = "timeline-hud__wait";
    this.waitButton.textContent = "Wait";
    this.waitButton.setAttribute("aria-label", "Wait");
    this.waitButton.addEventListener("click", this.handleWait);

    this.endTurnButton.type = "button";
    this.endTurnButton.className = "timeline-hud__end-turn";
    this.endTurnButton.setAttribute("aria-label", "End Turn");
    this.endTurnButton.addEventListener("click", this.handleEndTurn);

    this.activationControls.append(this.waitButton, this.endTurnButton);

    this.root.append(
      this.currentTime,
      this.readyActor,
      this.actionCosts,
      this.activationControls,
    );
    options.container.appendChild(this.root);
  }

  sync(presentation: TimelinePresentation): void {
    this.currentTime.textContent = `Time: ${presentation.currentTime}`;
    this.readyActor.textContent = `Ready: ${this.getActorLabel(presentation.readyActorId)}`;
    this.actionCosts.textContent = [
      `AP: ${presentation.readyActorActionPoints === undefined
        ? "—"
        : presentation.readyActorActionPoints}/${presentation.actionPointsPerActivation}`,
      `Move ${TacticalActionPointCost.Move} AP (${TacticalActionPointCost.MoveUphill} uphill)`,
      `Attack ${TacticalActionPointCost.Attack} AP`,
      `Command ${TacticalActionPointCost.ServantStrategyCommand} AP`,
    ].join(" · ");
    const isMageReady = presentation.readyActorId === this.options.mageId;
    this.waitButton.disabled = !isMageReady || presentation.readyActorHasWaited;
    this.endTurnButton.disabled = !isMageReady;
    this.endTurnButton.textContent = presentation.readyActorRecoveryDelay === undefined
      ? "End Turn"
      : `End Turn +${presentation.readyActorRecoveryDelay}`;
    this.endTurnButton.setAttribute("aria-label", this.endTurnButton.textContent);
  }

  dispose(): void {
    this.waitButton.removeEventListener("click", this.handleWait);
    this.endTurnButton.removeEventListener("click", this.handleEndTurn);
    this.root.remove();
  }

  private readonly handleWait = (): void => {
    this.options.onWait();
  };

  private readonly handleEndTurn = (): void => {
    this.options.onEndTurn();
  };

  private getActorLabel(actorId: string | undefined): string {
    if (!actorId) {
      return "None";
    }

    return actorId === this.options.mageId ? "Mage" : actorId;
  }
}

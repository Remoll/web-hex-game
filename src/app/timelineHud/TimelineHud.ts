import {
  TimelineAction,
  type TimelinePresentation,
} from "@/game/eventTimeline/EventTimeline";

export interface TimelineHudOptions {
  readonly container: HTMLElement;
  readonly mageId: string;
  readonly onWait: () => void;
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
  private readonly waitButton = document.createElement("button");

  constructor(private readonly options: TimelineHudOptions) {
    this.root.className = "timeline-hud";
    this.root.setAttribute("aria-label", "Tactical timeline");

    this.currentTime.className = "timeline-hud__time";
    this.readyActor.className = "timeline-hud__actor";
    this.actionCosts.className = "timeline-hud__costs";

    this.waitButton.type = "button";
    this.waitButton.className = "timeline-hud__wait";
    this.waitButton.addEventListener("click", this.handleWait);

    this.root.append(
      this.currentTime,
      this.readyActor,
      this.actionCosts,
      this.waitButton,
    );
    options.container.appendChild(this.root);
  }

  sync(presentation: TimelinePresentation): void {
    this.currentTime.textContent = `Time: ${presentation.currentTime}`;
    this.readyActor.textContent = `Ready: ${this.getActorLabel(presentation.readyActorId)}`;
    this.actionCosts.textContent = [
      `Move +${presentation.actionCosts[TimelineAction.Move]}`,
      `Attack +${presentation.actionCosts[TimelineAction.Attack]}`,
    ].join(" · ");
    this.waitButton.textContent = `Wait +${presentation.actionCosts[TimelineAction.Wait]}`;
    this.waitButton.disabled = presentation.readyActorId !== this.options.mageId;
  }

  dispose(): void {
    this.waitButton.removeEventListener("click", this.handleWait);
    this.root.remove();
  }

  private readonly handleWait = (): void => {
    this.options.onWait();
  };

  private getActorLabel(actorId: string | undefined): string {
    if (!actorId) {
      return "None";
    }

    return actorId === this.options.mageId ? "Mage" : actorId;
  }
}

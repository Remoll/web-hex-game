import type { ServantCommandPresentation } from "@/game/gameSession/GameSession";
import { ServantStrategyType } from "@/game/unit/servantStrategy/ServantStrategy";

export interface ServantCommandHudOptions {
  readonly container: HTMLElement;
  readonly onAssignHold: () => void;
  readonly onBeginPursue: () => void;
  readonly onClearStrategy: () => void;
}

/**
 * DOM-only command surface. It is fed with visibility-safe state after game
 * events; it does not inspect units, fog, or timeline state itself.
 */
export class ServantCommandHud {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("span");
  private readonly assignHoldButton = document.createElement("button");
  private readonly assignPursueButton = document.createElement("button");
  private readonly clearStrategyButton = document.createElement("button");

  constructor(private readonly options: ServantCommandHudOptions) {
    this.root.className = "servant-command-hud";
    this.root.setAttribute("aria-label", "Servant strategy command");

    this.status.className = "servant-command-hud__status";

    this.assignHoldButton.type = "button";
    this.assignHoldButton.className = "servant-command-hud__button";
    this.assignHoldButton.textContent = "Assign Hold";
    this.assignHoldButton.addEventListener("click", this.handleAssignHold);

    this.assignPursueButton.type = "button";
    this.assignPursueButton.className = "servant-command-hud__button";
    this.assignPursueButton.textContent = "Assign Pursue";
    this.assignPursueButton.addEventListener("click", this.handleBeginPursue);

    this.clearStrategyButton.type = "button";
    this.clearStrategyButton.className = "servant-command-hud__button";
    this.clearStrategyButton.textContent = "Clear strategy";
    this.clearStrategyButton.addEventListener("click", this.handleClearStrategy);

    this.root.append(
      this.status,
      this.assignHoldButton,
      this.assignPursueButton,
      this.clearStrategyButton,
    );
    options.container.appendChild(this.root);
  }

  sync(presentation: ServantCommandPresentation): void {
    this.status.textContent = getCommandStatus(presentation);
    this.assignHoldButton.disabled = !presentation.canAssignHold;
    this.assignPursueButton.disabled = !presentation.canAssignPursue;
    this.clearStrategyButton.disabled = !presentation.canClearStrategy;
    this.clearStrategyButton.textContent = presentation.isSelectingPursuitTarget
      ? "Cancel target selection"
      : "Clear strategy";
  }

  dispose(): void {
    this.assignHoldButton.removeEventListener("click", this.handleAssignHold);
    this.assignPursueButton.removeEventListener("click", this.handleBeginPursue);
    this.clearStrategyButton.removeEventListener("click", this.handleClearStrategy);
    this.root.remove();
  }

  private readonly handleAssignHold = (): void => {
    this.options.onAssignHold();
  };

  private readonly handleBeginPursue = (): void => {
    this.options.onBeginPursue();
  };

  private readonly handleClearStrategy = (): void => {
    this.options.onClearStrategy();
  };
}

function getCommandStatus(presentation: ServantCommandPresentation): string {
  if (!presentation.targetServantId) {
    return "Command: select a visible servant";
  }

  if (presentation.isSelectingPursuitTarget) {
    return `Servant: ${presentation.targetServantId} · Select a visible Enemy`;
  }

  const visibleTarget = presentation.visiblePursuitTargetId
    ? ` · Target: ${presentation.visiblePursuitTargetId}`
    : "";
  return `Servant: ${presentation.targetServantId} · ${getStrategyLabel(
    presentation.targetStrategyType,
  )}${visibleTarget}`;
}

function getStrategyLabel(strategyType: ServantStrategyType | undefined): string {
  switch (strategyType) {
    case ServantStrategyType.Hold:
      return "Strategy: Hold";
    case ServantStrategyType.PursueDesignatedEnemy:
      return "Strategy: Pursue designated Enemy";
    default:
      return "Strategy: None";
  }
}

import type { ServantCommandPresentation } from "@/game/gameSession/GameSession";
import { ServantStrategyType } from "@/game/unit/servantStrategy/ServantStrategy";

export interface ServantCommandHudOptions {
  readonly container: HTMLElement;
  readonly onAssignHold: () => void;
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
  private readonly clearStrategyButton = document.createElement("button");

  constructor(private readonly options: ServantCommandHudOptions) {
    this.root.className = "servant-command-hud";
    this.root.setAttribute("aria-label", "Servant strategy command");

    this.status.className = "servant-command-hud__status";

    this.assignHoldButton.type = "button";
    this.assignHoldButton.className = "servant-command-hud__button";
    this.assignHoldButton.textContent = "Assign Hold";
    this.assignHoldButton.addEventListener("click", this.handleAssignHold);

    this.clearStrategyButton.type = "button";
    this.clearStrategyButton.className = "servant-command-hud__button";
    this.clearStrategyButton.textContent = "Clear strategy";
    this.clearStrategyButton.addEventListener("click", this.handleClearStrategy);

    this.root.append(this.status, this.assignHoldButton, this.clearStrategyButton);
    options.container.appendChild(this.root);
  }

  sync(presentation: ServantCommandPresentation): void {
    this.status.textContent = presentation.targetServantId
      ? `Servant: ${presentation.targetServantId} · ${getStrategyLabel(
        presentation.targetStrategyType,
      )}`
      : "Command: select a visible servant";
    this.assignHoldButton.disabled = !presentation.canAssignHold;
    this.clearStrategyButton.disabled = !presentation.canClearStrategy;
  }

  dispose(): void {
    this.assignHoldButton.removeEventListener("click", this.handleAssignHold);
    this.clearStrategyButton.removeEventListener("click", this.handleClearStrategy);
    this.root.remove();
  }

  private readonly handleAssignHold = (): void => {
    this.options.onAssignHold();
  };

  private readonly handleClearStrategy = (): void => {
    this.options.onClearStrategy();
  };
}

function getStrategyLabel(strategyType: ServantStrategyType | undefined): string {
  switch (strategyType) {
    case ServantStrategyType.Hold:
      return "Strategy: Hold";
    default:
      return "Strategy: None";
  }
}

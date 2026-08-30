import {
  ServantStrategyTargetSelection,
  type ServantCommandPresentation,
} from "@/game/gameSession/GameSession";
import { servantStrategyCommandActionPointCost } from "@/game/eventTimeline/EventTimeline";
import { ServantStrategyType } from "@/game/unit/servantStrategy/ServantStrategy";

const servantCommandText = {
  AssignHold: "Assign Hold",
  AssignProtectMage: "Assign Protect Mage",
  AssignPursue: "Assign Pursue",
  AssignSecure: "Assign Secure",
  ClearStrategy: "Clear strategy",
  CancelTargetSelection: "Cancel target selection",
} as const;

export interface ServantCommandHudOptions {
  readonly container: HTMLElement;
  readonly onAssignHold: () => void;
  readonly onAssignProtect: () => void;
  readonly onBeginPursue: () => void;
  readonly onBeginSecure: () => void;
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
  private readonly assignProtectButton = document.createElement("button");
  private readonly assignPursueButton = document.createElement("button");
  private readonly assignSecureButton = document.createElement("button");
  private readonly clearStrategyButton = document.createElement("button");

  constructor(private readonly options: ServantCommandHudOptions) {
    this.root.className = "servant-command-hud";
    this.root.setAttribute("aria-label", "Servant strategy command");

    this.status.className = "servant-command-hud__status";

    this.assignHoldButton.type = "button";
    this.assignHoldButton.className = "servant-command-hud__button";
    this.assignHoldButton.textContent = getActionPointCommandLabel(
      servantCommandText.AssignHold,
    );
    this.assignHoldButton.addEventListener("click", this.handleAssignHold);

    this.assignProtectButton.type = "button";
    this.assignProtectButton.className = "servant-command-hud__button";
    this.assignProtectButton.textContent = getActionPointCommandLabel(
      servantCommandText.AssignProtectMage,
    );
    this.assignProtectButton.addEventListener("click", this.handleAssignProtect);

    this.assignPursueButton.type = "button";
    this.assignPursueButton.className = "servant-command-hud__button";
    this.assignPursueButton.textContent = getActionPointCommandLabel(
      servantCommandText.AssignPursue,
    );
    this.assignPursueButton.addEventListener("click", this.handleBeginPursue);

    this.assignSecureButton.type = "button";
    this.assignSecureButton.className = "servant-command-hud__button";
    this.assignSecureButton.textContent = getActionPointCommandLabel(
      servantCommandText.AssignSecure,
    );
    this.assignSecureButton.addEventListener("click", this.handleBeginSecure);

    this.clearStrategyButton.type = "button";
    this.clearStrategyButton.className = "servant-command-hud__button";
    this.clearStrategyButton.textContent = getActionPointCommandLabel(
      servantCommandText.ClearStrategy,
    );
    this.clearStrategyButton.addEventListener("click", this.handleClearStrategy);

    this.root.append(
      this.status,
      this.assignHoldButton,
      this.assignProtectButton,
      this.assignPursueButton,
      this.assignSecureButton,
      this.clearStrategyButton,
    );
    options.container.appendChild(this.root);
  }

  sync(presentation: ServantCommandPresentation): void {
    this.status.textContent = getCommandStatus(presentation);
    this.assignHoldButton.disabled = !presentation.canAssignHold;
    this.assignProtectButton.disabled = !presentation.canAssignProtect;
    this.assignPursueButton.disabled = !presentation.canAssignPursue;
    this.assignSecureButton.disabled = !presentation.canAssignSecure;
    this.clearStrategyButton.disabled = !presentation.canClearStrategy;
    this.clearStrategyButton.textContent = presentation.targetSelection
      ? servantCommandText.CancelTargetSelection
      : getActionPointCommandLabel(servantCommandText.ClearStrategy);
  }

  setVisible(isVisible: boolean): void {
    this.root.hidden = !isVisible;
  }

  dispose(): void {
    this.assignHoldButton.removeEventListener("click", this.handleAssignHold);
    this.assignProtectButton.removeEventListener("click", this.handleAssignProtect);
    this.assignPursueButton.removeEventListener("click", this.handleBeginPursue);
    this.assignSecureButton.removeEventListener("click", this.handleBeginSecure);
    this.clearStrategyButton.removeEventListener("click", this.handleClearStrategy);
    this.root.remove();
  }

  private readonly handleAssignHold = (): void => {
    this.options.onAssignHold();
  };

  private readonly handleAssignProtect = (): void => {
    this.options.onAssignProtect();
  };

  private readonly handleBeginPursue = (): void => {
    this.options.onBeginPursue();
  };

  private readonly handleBeginSecure = (): void => {
    this.options.onBeginSecure();
  };

  private readonly handleClearStrategy = (): void => {
    this.options.onClearStrategy();
  };
}

function getActionPointCommandLabel(commandLabel: string): string {
  return `${commandLabel} (${servantStrategyCommandActionPointCost} AP)`;
}

function getCommandStatus(presentation: ServantCommandPresentation): string {
  if (!presentation.targetServantId) {
    return "Command: select a visible servant";
  }

  switch (presentation.targetSelection) {
    case ServantStrategyTargetSelection.PursueEnemy:
      return `Servant: ${presentation.targetServantId} · Select a visible Enemy`;
    case ServantStrategyTargetSelection.SecureHex:
      return `Servant: ${presentation.targetServantId} · Select a visible hex`;
    case undefined:
      break;
  }

  const visiblePursuitTarget = presentation.visiblePursuitTargetId
    ? ` · Target: ${presentation.visiblePursuitTargetId}`
    : "";
  const visibleSecureTarget = presentation.visibleSecureTargetHex
    ? ` · Target: ${presentation.visibleSecureTargetHex.q},${presentation.visibleSecureTargetHex.r}`
    : "";
  return `Servant: ${presentation.targetServantId} · ${getStrategyLabel(
    presentation.targetStrategyType,
  )}${visiblePursuitTarget}${visibleSecureTarget}`;
}

function getStrategyLabel(strategyType: ServantStrategyType | undefined): string {
  switch (strategyType) {
    case ServantStrategyType.Hold:
      return "Strategy: Hold";
    case ServantStrategyType.PursueDesignatedEnemy:
      return "Strategy: Pursue designated Enemy";
    case ServantStrategyType.SecureDesignatedHex:
      return "Strategy: Secure designated hex";
    case ServantStrategyType.ProtectMage:
      return "Strategy: Protect Mage";
    default:
      return "Strategy: None";
  }
}

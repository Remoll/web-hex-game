import {
  DoorBlockInitialState,
} from "@/game/board/structure/TacticalHexStructure";
import type { DoorBlockInteractionPresentation } from "@/game/gameSession/GameSession";
import { TacticalActionPointCost } from "@/game/eventTimeline/EventTimeline";

const doorInteractionText = {
  Open: "Open door",
  Close: "Close door",
  Enter: "Enter",
  Cancel: "Cancel",
  ClosedStatus: "Closed door",
  OpenStatus: "Open door",
} as const;

export interface DoorInteractionHudOptions {
  readonly container: HTMLElement;
  readonly onOpen: () => void;
  readonly onClose: () => void;
  readonly onEnter: () => void;
  readonly onDismiss: () => void;
}

/** Accessible contextual actions for the selected Mage's adjacent DoorBlock. */
export class DoorInteractionHud {
  private readonly root = document.createElement("section");
  private readonly status = document.createElement("span");
  private readonly openButton = document.createElement("button");
  private readonly closeButton = document.createElement("button");
  private readonly enterButton = document.createElement("button");
  private readonly cancelButton = document.createElement("button");

  constructor(private readonly options: DoorInteractionHudOptions) {
    this.root.className = "door-interaction-hud";
    this.root.setAttribute("role", "dialog");
    this.root.setAttribute("aria-label", "Door interaction");
    this.root.hidden = true;

    this.status.className = "door-interaction-hud__status";
    this.status.setAttribute("aria-live", "polite");

    this.openButton.type = "button";
    this.openButton.className = "door-interaction-hud__button";
    this.openButton.textContent = getDoorToggleLabel(doorInteractionText.Open);
    this.openButton.addEventListener("click", this.handleOpen);

    this.closeButton.type = "button";
    this.closeButton.className = "door-interaction-hud__button";
    this.closeButton.textContent = getDoorToggleLabel(doorInteractionText.Close);
    this.closeButton.addEventListener("click", this.handleClose);

    this.enterButton.type = "button";
    this.enterButton.className = "door-interaction-hud__button";
    this.enterButton.addEventListener("click", this.handleEnter);

    this.cancelButton.type = "button";
    this.cancelButton.className = "door-interaction-hud__button";
    this.cancelButton.textContent = doorInteractionText.Cancel;
    this.cancelButton.addEventListener("click", this.handleDismiss);

    this.root.append(
      this.status,
      this.openButton,
      this.closeButton,
      this.enterButton,
      this.cancelButton,
    );
    options.container.appendChild(this.root);
  }

  sync(presentation: DoorBlockInteractionPresentation | undefined): void {
    this.root.hidden = presentation === undefined;
    if (!presentation) {
      return;
    }

    const isDoorOpen = presentation.currentState === DoorBlockInitialState.Open;
    this.status.textContent = isDoorOpen
      ? doorInteractionText.OpenStatus
      : doorInteractionText.ClosedStatus;
    this.openButton.hidden = isDoorOpen;
    this.openButton.disabled = !presentation.canOpen;
    this.closeButton.hidden = !isDoorOpen;
    this.closeButton.disabled = !presentation.canClose;
    this.enterButton.hidden = !isDoorOpen;
    this.enterButton.disabled = presentation.enterActionPointCost === undefined;
    this.enterButton.textContent = getEnterLabel(presentation.enterActionPointCost);
  }

  setVisible(isVisible: boolean): void {
    if (!isVisible) {
      this.root.hidden = true;
    }
  }

  dispose(): void {
    this.openButton.removeEventListener("click", this.handleOpen);
    this.closeButton.removeEventListener("click", this.handleClose);
    this.enterButton.removeEventListener("click", this.handleEnter);
    this.cancelButton.removeEventListener("click", this.handleDismiss);
    this.root.remove();
  }

  private readonly handleOpen = (): void => {
    this.options.onOpen();
  };

  private readonly handleClose = (): void => {
    this.options.onClose();
  };

  private readonly handleEnter = (): void => {
    this.options.onEnter();
  };

  private readonly handleDismiss = (): void => {
    this.options.onDismiss();
  };
}

function getDoorToggleLabel(actionLabel: string): string {
  return `${actionLabel} (${TacticalActionPointCost.DoorInteraction} AP)`;
}

function getEnterLabel(actionPointCost: number | undefined): string {
  const actionPointLabel = actionPointCost === undefined
    ? "—"
    : String(actionPointCost);
  return `${doorInteractionText.Enter} (${actionPointLabel} AP)`;
}

export interface AreaTravelPresentation {
  readonly areaName: string;
  readonly guidance: string;
  readonly actionLabel: string;
  readonly canTravel: boolean;
  readonly isInputLocked: boolean;
}

export interface AreaTravelHudOptions {
  readonly container: HTMLElement;
  readonly onTravel: () => void;
}

/** Accessible explicit map-entry control; availability comes from CampaignSession. */
export class AreaTravelHud {
  private readonly root = document.createElement("section");
  private readonly location = document.createElement("span");
  private readonly guidance = document.createElement("span");
  private readonly travelButton = document.createElement("button");

  constructor(private readonly options: AreaTravelHudOptions) {
    this.root.className = "area-travel-hud";
    this.root.setAttribute("aria-label", "Area travel");
    this.root.setAttribute("aria-live", "polite");

    this.location.className = "area-travel-hud__location";
    this.guidance.className = "area-travel-hud__guidance";
    this.travelButton.type = "button";
    this.travelButton.className = "area-travel-hud__button";
    this.travelButton.addEventListener("click", this.handleTravel);

    this.root.append(this.location, this.guidance, this.travelButton);
    options.container.appendChild(this.root);
  }

  sync(presentation: AreaTravelPresentation): void {
    this.location.textContent = `Location: ${presentation.areaName}`;
    this.guidance.textContent = presentation.guidance;
    this.travelButton.textContent = presentation.actionLabel;
    this.travelButton.setAttribute("aria-label", presentation.actionLabel);
    this.travelButton.disabled = !presentation.canTravel || presentation.isInputLocked;
  }

  dispose(): void {
    this.travelButton.removeEventListener("click", this.handleTravel);
    this.root.remove();
  }

  private readonly handleTravel = (): void => {
    this.options.onTravel();
  };
}

const defaultTransitionDurationInMilliseconds = 160;
const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

export interface MapTransitionOverlayOptions {
  readonly container: HTMLElement;
  readonly transitionDurationInMilliseconds?: number;
  readonly isReducedMotion?: () => boolean;
}

/** Presentation-only fade; callers own interaction locks and all domain mutation. */
export class MapTransitionOverlay {
  private readonly overlay = document.createElement("div");
  private readonly transitionDurationInMilliseconds: number;
  private readonly isReducedMotion: () => boolean;

  constructor(options: MapTransitionOverlayOptions) {
    this.transitionDurationInMilliseconds = options.transitionDurationInMilliseconds
      ?? defaultTransitionDurationInMilliseconds;
    this.isReducedMotion = options.isReducedMotion ?? getReducedMotionPreference;
    this.overlay.className = "map-transition-overlay";
    this.overlay.setAttribute("aria-hidden", "true");
    options.container.appendChild(this.overlay);
  }

  async transition(performCoveredSwap: () => void): Promise<void> {
    const duration = this.isReducedMotion() ? 0 : this.transitionDurationInMilliseconds;
    this.overlay.classList.add("map-transition-overlay--visible");
    await waitForTransitionDuration(duration);
    try {
      performCoveredSwap();
    } finally {
      this.overlay.classList.remove("map-transition-overlay--visible");
      await waitForTransitionDuration(duration);
    }
  }

  dispose(): void {
    this.overlay.remove();
  }
}

function getReducedMotionPreference(): boolean {
  return typeof window.matchMedia === "function"
    && window.matchMedia(reducedMotionMediaQuery).matches;
}

function waitForTransitionDuration(durationInMilliseconds: number): Promise<void> {
  return durationInMilliseconds === 0
    ? Promise.resolve()
    : new Promise((resolve) => window.setTimeout(resolve, durationInMilliseconds));
}

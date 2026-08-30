import {
  InitiativeQueueCardState,
  type InitiativeQueueEntry,
  type InitiativeQueuePresentation,
} from "@/game/gameSession/GameSession";
import { getInitiativeQueueHighlightTarget } from "@/app/initiativeQueueHud/InitiativeQueueInteraction";

const initiativeQueueElementName = {
  Root: "section",
  Cards: "div",
  Card: "button",
  CardContent: "span",
} as const;

const initiativeQueueDom = {
  RootClassName: "initiative-queue-hud",
  CardsClassName: "initiative-queue-hud__cards",
  CardClassName: "initiative-queue-hud__card",
  CurrentCardClassName: "initiative-queue-hud__card--current",
  UnknownCardClassName: "initiative-queue-hud__card--unknown",
  GlyphClassName: "initiative-queue-hud__glyph",
  LabelClassName: "initiative-queue-hud__label",
  CurrentMarkerClassName: "initiative-queue-hud__current-marker",
  CardSelector: ".initiative-queue-hud__card",
  CardIdDatasetKey: "cardId",
  HighlightUnitIdDatasetKey: "highlightUnitId",
  RoleAttribute: "role",
  AriaLabelAttribute: "aria-label",
  AriaHiddenAttribute: "aria-hidden",
  ListRole: "list",
  ListItemRole: "listitem",
  ButtonType: "button",
  TrueAttributeValue: "true",
  EmptyText: "",
} as const;

const initiativeQueueEventType = {
  PointerOver: "pointerover",
  PointerLeave: "pointerleave",
  FocusIn: "focusin",
  FocusOut: "focusout",
  Click: "click",
} as const;

const initiativeQueueText = {
  AccessibleQueueLabel: "Upcoming initiative order",
  UnknownActor: "Unknown",
  UnknownActorGlyph: "?",
  CurrentActorMarker: "Now",
  CurrentActor: "current actor",
  UpcomingActor: "upcoming actor",
  VisibleLocation: "visible",
  HiddenLocation: "location hidden",
} as const;

export interface InitiativeQueueHudOptions {
  readonly container: HTMLElement;
  readonly onHighlightUnit: (unitId: string) => void;
  readonly onClearHighlight: () => void;
}

/**
 * DOM-only, responsive initiative-card queue. It consumes the safe projection
 * from GameSession and never reads units, coordinates, fog, or timeline data.
 */
export class InitiativeQueueHud {
  private readonly root = document.createElement(initiativeQueueElementName.Root);
  private readonly cards = document.createElement(initiativeQueueElementName.Cards);
  private readonly cardsById = new Map<string, HTMLButtonElement>();
  private activeUnitId: string | undefined;

  constructor(private readonly options: InitiativeQueueHudOptions) {
    this.root.className = initiativeQueueDom.RootClassName;
    this.root.setAttribute(
      initiativeQueueDom.AriaLabelAttribute,
      initiativeQueueText.AccessibleQueueLabel,
    );

    this.cards.className = initiativeQueueDom.CardsClassName;
    this.cards.setAttribute(
      initiativeQueueDom.RoleAttribute,
      initiativeQueueDom.ListRole,
    );
    this.cards.addEventListener(
      initiativeQueueEventType.PointerOver,
      this.handlePointerOver,
    );
    this.cards.addEventListener(
      initiativeQueueEventType.PointerLeave,
      this.handlePointerLeave,
    );
    this.cards.addEventListener(
      initiativeQueueEventType.FocusIn,
      this.handleFocusIn,
    );
    this.cards.addEventListener(
      initiativeQueueEventType.FocusOut,
      this.handleFocusOut,
    );
    this.cards.addEventListener(initiativeQueueEventType.Click, this.handleClick);

    this.root.append(this.cards);
    options.container.appendChild(this.root);
  }

  sync(presentation: InitiativeQueuePresentation): void {
    this.clearHighlight();
    const renderedCardIds = new Set<string>();

    for (const entry of presentation.entries) {
      renderedCardIds.add(entry.cardId);
      const card = this.cardsById.get(entry.cardId) ?? this.createCard(entry.cardId);
      this.syncCard(card, entry);
      this.cards.appendChild(card);
    }

    for (const [cardId, card] of this.cardsById) {
      if (!renderedCardIds.has(cardId)) {
        card.remove();
        this.cardsById.delete(cardId);
      }
    }
  }

  setVisible(isVisible: boolean): void {
    this.root.hidden = !isVisible;
  }

  dispose(): void {
    this.cards.removeEventListener(
      initiativeQueueEventType.PointerOver,
      this.handlePointerOver,
    );
    this.cards.removeEventListener(
      initiativeQueueEventType.PointerLeave,
      this.handlePointerLeave,
    );
    this.cards.removeEventListener(
      initiativeQueueEventType.FocusIn,
      this.handleFocusIn,
    );
    this.cards.removeEventListener(
      initiativeQueueEventType.FocusOut,
      this.handleFocusOut,
    );
    this.cards.removeEventListener(
      initiativeQueueEventType.Click,
      this.handleClick,
    );
    this.cardsById.clear();
    this.root.remove();
  }

  private createCard(cardId: string): HTMLButtonElement {
    const card = document.createElement(initiativeQueueElementName.Card);
    card.type = initiativeQueueDom.ButtonType;
    card.className = initiativeQueueDom.CardClassName;
    card.dataset[initiativeQueueDom.CardIdDatasetKey] = cardId;
    card.setAttribute(
      initiativeQueueDom.RoleAttribute,
      initiativeQueueDom.ListItemRole,
    );
    this.cardsById.set(cardId, card);
    return card;
  }

  private syncCard(card: HTMLButtonElement, entry: InitiativeQueueEntry): void {
    const highlightTarget = getInitiativeQueueHighlightTarget(entry);
    card.classList.toggle(initiativeQueueDom.CurrentCardClassName, entry.isCurrent);
    card.classList.toggle(
      initiativeQueueDom.UnknownCardClassName,
      entry.state === InitiativeQueueCardState.Unknown,
    );
    card.disabled = highlightTarget === undefined;
    card.dataset[initiativeQueueDom.HighlightUnitIdDatasetKey] = highlightTarget
      ?? initiativeQueueDom.EmptyText;
    card.setAttribute(
      initiativeQueueDom.AriaLabelAttribute,
      getCardAccessibleLabel(entry),
    );
    card.replaceChildren(
      createCardGlyph(entry),
      createCardLabel(entry),
      createCurrentMarker(entry),
    );
  }

  private readonly handlePointerOver = (event: PointerEvent): void => {
    this.highlightCardFromEventTarget(event.target);
  };

  private readonly handlePointerLeave = (): void => {
    this.clearHighlight();
  };

  private readonly handleFocusIn = (event: FocusEvent): void => {
    this.highlightCardFromEventTarget(event.target);
  };

  private readonly handleFocusOut = (event: FocusEvent): void => {
    if (!(event.relatedTarget instanceof Node)
      || !this.cards.contains(event.relatedTarget)) {
      this.clearHighlight();
    }
  };

  private readonly handleClick = (event: MouseEvent): void => {
    this.highlightCardFromEventTarget(event.target);
  };

  private highlightCardFromEventTarget(target: EventTarget | null): void {
    const card = target instanceof Element
      ? target.closest<HTMLButtonElement>(initiativeQueueDom.CardSelector)
      : undefined;
    const unitId = card?.dataset[initiativeQueueDom.HighlightUnitIdDatasetKey];
    if (!unitId) {
      this.clearHighlight();
      return;
    }

    this.activeUnitId = unitId;
    this.options.onHighlightUnit(unitId);
  }

  private clearHighlight(): void {
    if (!this.activeUnitId) {
      return;
    }

    this.activeUnitId = undefined;
    this.options.onClearHighlight();
  }
}

function createCardGlyph(entry: InitiativeQueueEntry): HTMLSpanElement {
  const glyph = document.createElement(initiativeQueueElementName.CardContent);
  glyph.className = initiativeQueueDom.GlyphClassName;
  glyph.textContent = entry.state === InitiativeQueueCardState.Unknown
    ? initiativeQueueText.UnknownActorGlyph
    : entry.label?.charAt(0) ?? initiativeQueueText.UnknownActorGlyph;
  glyph.setAttribute(
    initiativeQueueDom.AriaHiddenAttribute,
    initiativeQueueDom.TrueAttributeValue,
  );
  return glyph;
}

function createCardLabel(entry: InitiativeQueueEntry): HTMLSpanElement {
  const label = document.createElement(initiativeQueueElementName.CardContent);
  label.className = initiativeQueueDom.LabelClassName;
  label.textContent = entry.state === InitiativeQueueCardState.Unknown
    ? initiativeQueueText.UnknownActor
    : entry.label ?? initiativeQueueText.UnknownActor;
  return label;
}

function createCurrentMarker(entry: InitiativeQueueEntry): HTMLSpanElement {
  const marker = document.createElement(initiativeQueueElementName.CardContent);
  marker.className = initiativeQueueDom.CurrentMarkerClassName;
  marker.textContent = entry.isCurrent
    ? initiativeQueueText.CurrentActorMarker
    : initiativeQueueDom.EmptyText;
  return marker;
}

function getCardAccessibleLabel(entry: InitiativeQueueEntry): string {
  if (entry.state === InitiativeQueueCardState.Unknown) {
    const timing = entry.isCurrent
      ? initiativeQueueText.CurrentActor
      : initiativeQueueText.UpcomingActor;
    return `${initiativeQueueText.UnknownActor} ${timing}`;
  }

  const locationStatus = entry.canHighlight
    ? initiativeQueueText.VisibleLocation
    : initiativeQueueText.HiddenLocation;
  const timing = entry.isCurrent
    ? initiativeQueueText.CurrentActor
    : initiativeQueueText.UpcomingActor;
  return `${entry.label} ${timing}, ${locationStatus}`;
}

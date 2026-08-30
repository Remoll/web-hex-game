import * as THREE from "three";
import { AreaTravelHud } from "@/app/areaTravelHud/AreaTravelHud";
import { CampaignRouteFeedbackPresenter } from "@/app/campaignRouteFeedback/CampaignRouteFeedbackPresenter";
import {
  GameController,
  type TacticalPresentationPresenter,
} from "@/app/gameController/GameController";
import { InputController } from "@/app/inputController/InputController";
import { InitiativeQueueHud } from "@/app/initiativeQueueHud/InitiativeQueueHud";
import { MapTransitionOverlay } from "@/app/mapTransition/MapTransitionOverlay";
import { ServantCommandHud } from "@/app/servantCommandHud/ServantCommandHud";
import { StrategicController } from "@/app/strategicController/StrategicController";
import { TimelineHud } from "@/app/timelineHud/TimelineHud";
import {
  CampaignAreaKind,
  type CampaignRouteDefinition,
} from "@/game/campaign/CampaignDefinition";
import {
  CampaignSession,
  type TacticalCampaignArea,
} from "@/game/campaign/CampaignSession";
import {
  type GameSession,
  TacticalPresentationEventKind,
  type TacticalPresentationEvent,
  type TacticalUnitPresentation,
} from "@/game/gameSession/GameSession";
import { deriveMaximumHp, resolveTacticalAttributes } from "@/game/unit/tacticalAttributes/TacticalAttributes";
import {
  FieldVisibility,
  type FieldVisibilityReader,
} from "@/game/visibility/MageVisibility";
import { CameraMode } from "@/rendering/gameCamera/CameraMode";
import { GameCamera } from "@/rendering/gameCamera/GameCamera";
import { MapHighlightView } from "@/rendering/mapHighlightView/MapHighlightView";
import { MapView } from "@/rendering/mapView/MapView";
import { RemainsView } from "@/rendering/remainsView/RemainsView";
import {
  defaultRenderConfig,
  type RenderConfig,
} from "@/rendering/RenderConfig";
import { TacticalPresentationQueue } from "@/rendering/tacticalPresentation/TacticalPresentationQueue";
import { buildVisibleUnitMovementAnimation } from "@/rendering/unitMotion/UnitMovementAnimationModel";
import { UnitMovementAnimationQueue } from "@/rendering/unitMotion/UnitMovementAnimationQueue";
import { UnitHealthView } from "@/rendering/unitHealthView/UnitHealthView";
import { UnitView } from "@/rendering/unitView/UnitView";

export interface GameAppOptions {
  readonly campaign: CampaignSession;
  readonly container: HTMLElement;
  readonly renderConfig?: RenderConfig;
}

const cameraFrustumSize = 30;
const sceneBackgroundColor = 0xffffff;
const ambientLightIntensity = 0.6;
const directionalLightIntensity = 0.8;
const maximumDevicePixelRatio = 2;
const directionalLightPosition = { x: 200, y: -300, z: 400 } as const;
const allVisibleFieldVisibility: FieldVisibilityReader = {
  getFieldVisibility: () => FieldVisibility.Visible,
};

/**
 * Owns presentation for whichever campaign area is active. CampaignSession
 * remains the route and persistence authority; GameSession remains tactical.
 */
export class GameApp {
  readonly campaign: CampaignSession;

  private readonly scene = new THREE.Scene();
  private readonly renderer: THREE.WebGLRenderer;
  private readonly renderConfig: RenderConfig;
  private readonly timelineHud: TimelineHud;
  private readonly initiativeQueueHud: InitiativeQueueHud;
  private readonly servantCommandHud: ServantCommandHud;
  private readonly areaTravelHud: AreaTravelHud;
  private readonly mapTransitionOverlay: MapTransitionOverlay;

  private camera: GameCamera | undefined;
  private mapView: MapView | undefined;
  private mapHighlightView: MapHighlightView | undefined;
  private campaignRouteFeedbackPresenter: CampaignRouteFeedbackPresenter | undefined;
  private unitView: UnitView | undefined;
  private unitHealthView: UnitHealthView | undefined;
  private remainsView: RemainsView | undefined;
  private unitMovementAnimationQueue: UnitMovementAnimationQueue | undefined;
  private tacticalPresentationQueue: TacticalPresentationQueue | undefined;
  private input: InputController | undefined;
  private gameController: GameController | undefined;
  private activeTacticalSession: GameSession | undefined;
  private tacticalVisibilitySyncPending = false;
  private isInputLocked = false;

  constructor({ campaign, container, renderConfig = defaultRenderConfig }: GameAppOptions) {
    this.campaign = campaign;
    this.renderConfig = renderConfig;
    this.scene.background = new THREE.Color(sceneBackgroundColor);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maximumDevicePixelRatio));
    container.appendChild(this.renderer.domElement);
    this.addSceneLighting();

    this.timelineHud = new TimelineHud({
      container,
      mageId: this.campaign.party[0]?.definition.id ?? "",
      onWait: () => this.runTacticalInteraction((controller) => {
        controller.waitForMage();
      }),
      onEndTurn: () => this.runTacticalInteraction((controller) => {
        controller.endMageTurn();
      }),
    });
    this.initiativeQueueHud = new InitiativeQueueHud({
      container,
      onHighlightUnit: (unitId) => this.runTacticalInteraction((controller) => {
        controller.highlightInitiativeQueueUnit(unitId);
      }),
      onClearHighlight: () => this.runTacticalInteraction((controller) => {
        controller.clearInitiativeQueueHighlight();
      }),
    });
    this.servantCommandHud = new ServantCommandHud({
      container,
      onAssignHold: () => this.runTacticalInteraction((controller) => {
        controller.assignHoldStrategy();
      }),
      onAssignProtect: () => this.runTacticalInteraction((controller) => {
        controller.assignProtectMageStrategy();
      }),
      onBeginPursue: () => this.runTacticalInteraction((controller) => {
        controller.beginPursueDesignatedEnemySelection();
      }),
      onBeginSecure: () => this.runTacticalInteraction((controller) => {
        controller.beginSecureDesignatedHexSelection();
      }),
      onClearStrategy: () => this.runTacticalInteraction((controller) => {
        controller.clearServantStrategy();
      }),
    });
    this.areaTravelHud = new AreaTravelHud({
      container,
      onTravel: () => void this.travelAvailableRoute(),
    });
    this.mapTransitionOverlay = new MapTransitionOverlay({ container });

    this.activateCampaignArea();
    this.renderer.setAnimationLoop(() => this.renderCurrentArea());
  }

  /** Exposes tactical authority only while a tactical area is active. */
  get session(): GameSession | undefined {
    return this.activeTacticalSession;
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.disposeActiveAreaPresentation();
    this.timelineHud.dispose();
    this.initiativeQueueHud.dispose();
    this.servantCommandHud.dispose();
    this.areaTravelHud.dispose();
    this.mapTransitionOverlay.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private addSceneLighting(): void {
    this.scene.add(new THREE.AmbientLight(sceneBackgroundColor, ambientLightIntensity));
    const directionalLight = new THREE.DirectionalLight(
      sceneBackgroundColor,
      directionalLightIntensity,
    );
    directionalLight.position.set(
      directionalLightPosition.x,
      directionalLightPosition.y,
      directionalLightPosition.z,
    );
    this.scene.add(directionalLight);
  }

  private activateCampaignArea(): void {
    this.disposeActiveAreaPresentation();
    const activeArea = this.campaign.activeArea;
    const gameMap = activeArea.session.gameMap;

    this.camera = new GameCamera(
      cameraFrustumSize,
      this.renderer.domElement,
      CameraMode.FOLLOW,
      gameMap,
      this.renderConfig,
    );
    this.mapView = new MapView(this.scene, gameMap, this.renderConfig);
    this.mapHighlightView = new MapHighlightView(this.scene, gameMap, this.renderConfig);
    this.campaignRouteFeedbackPresenter = new CampaignRouteFeedbackPresenter(
      this.mapHighlightView,
    );
    this.unitView = new UnitView(this.scene, gameMap, this.renderConfig);
    this.syncCampaignRouteFeedback();

    if (activeArea.kind === CampaignAreaKind.Strategic) {
      this.activateStrategicArea(activeArea);
    } else {
      this.activateTacticalArea(activeArea);
    }

    this.input?.setEnabled(!this.isInputLocked);
    this.syncAreaTravelHud();
  }

  private activateStrategicArea(
    activeArea: Extract<CampaignSession["activeArea"], { kind: CampaignAreaKind.Strategic }>,
  ): void {
    const mapView = this.requireMapView();
    const campaignRouteFeedbackPresenter = this.requireCampaignRouteFeedbackPresenter();
    mapView.syncVisibility(allVisibleFieldVisibility);
    this.syncStrategicPartyMarker();
    const strategicController = new StrategicController(
      activeArea.session,
      campaignRouteFeedbackPresenter,
      { onPartyMoved: () => {
        this.syncStrategicPartyMarker();
        this.syncAreaTravelHud();
      } },
    );
    this.input = new InputController(
      this.renderer.domElement,
      this.requireCamera(),
      mapView,
      strategicController,
    );
    this.timelineHud.setVisible(false);
    this.initiativeQueueHud.setVisible(false);
    this.servantCommandHud.setVisible(false);
  }

  private activateTacticalArea(activeArea: TacticalCampaignArea): void {
    const gameMap = activeArea.session.gameMap;
    const unitView = this.requireUnitView();
    const mapView = this.requireMapView();
    const campaignRouteFeedbackPresenter = this.requireCampaignRouteFeedbackPresenter();
    this.activeTacticalSession = activeArea.session;
    this.unitHealthView = new UnitHealthView(this.scene, gameMap, this.renderConfig);
    this.remainsView = new RemainsView(this.scene, gameMap, this.renderConfig);
    this.unitMovementAnimationQueue = new UnitMovementAnimationQueue(
      this.renderConfig.unitMovementStepDurationMs,
      isMovementAnimationEnabled(),
    );
    const unitMovementAnimationQueue = this.unitMovementAnimationQueue;
    const tacticalSession = activeArea.session;
    this.tacticalPresentationQueue = new TacticalPresentationQueue({
      movementAnimationQueue: unitMovementAnimationQueue,
      createMovementAnimation: (event) => buildVisibleUnitMovementAnimation(
        event,
        gameMap,
        this.renderConfig,
      ),
      onEventCompleted: (event) => this.completeTacticalPresentationEvent(
        tacticalSession,
        event,
      ),
      onMovementFrame: (event, from, to, progress) => {
        unitView.applyMovementFrame(event.unit.id, from, to, progress);
        this.unitHealthView?.applyMovementFrame(event.unit, from, to, progress);
      },
    });
    const tacticalPresentationQueue = this.tacticalPresentationQueue;
    const tacticalPresentationPresenter: TacticalPresentationPresenter = {
      sync: (events, requiresTacticalVisibilitySync) => {
        if (this.activeTacticalSession !== tacticalSession) {
          return;
        }
        this.tacticalVisibilitySyncPending ||= requiresTacticalVisibilitySync;
        tacticalPresentationQueue.enqueue(events);
        this.syncTacticalPresentationWhenIdle(tacticalSession);
      },
      get isAnimating(): boolean {
        return tacticalPresentationQueue.isAnimating;
      },
    };

    this.timelineHud.setVisible(true);
    this.initiativeQueueHud.setVisible(true);
    this.servantCommandHud.setVisible(true);
    this.gameController = new GameController(
      tacticalSession,
      tacticalPresentationPresenter,
      campaignRouteFeedbackPresenter,
      this.timelineHud,
      this.servantCommandHud,
      this.initiativeQueueHud,
    );
    this.syncTacticalPresentation(tacticalSession);
    this.input = new InputController(
      this.renderer.domElement,
      this.requireCamera(),
      mapView,
      this.gameController,
    );
  }

  private disposeActiveAreaPresentation(): void {
    this.input?.dispose();
    this.input = undefined;
    this.camera?.dispose();
    this.camera = undefined;
    this.mapView?.dispose();
    this.mapView = undefined;
    this.mapHighlightView?.dispose();
    this.mapHighlightView = undefined;
    this.campaignRouteFeedbackPresenter = undefined;
    this.tacticalPresentationQueue?.clear();
    this.tacticalPresentationQueue = undefined;
    this.unitMovementAnimationQueue = undefined;
    this.unitView?.dispose();
    this.unitView = undefined;
    this.unitHealthView?.dispose();
    this.unitHealthView = undefined;
    this.remainsView?.dispose();
    this.remainsView = undefined;
    this.gameController = undefined;
    this.activeTacticalSession = undefined;
    this.tacticalVisibilitySyncPending = false;
  }

  private async travelAvailableRoute(): Promise<void> {
    if (this.isInputLocked
      || !this.campaign.getAvailableRoute()
      || this.tacticalPresentationQueue?.isAnimating) {
      return;
    }

    this.isInputLocked = true;
    this.input?.setEnabled(false);
    this.syncAreaTravelHud();
    try {
      await this.mapTransitionOverlay.transition(() => {
        this.campaign.travelAvailableRoute();
        this.activateCampaignArea();
      });
    } finally {
      this.isInputLocked = false;
      this.input?.setEnabled(true);
      this.syncAreaTravelHud();
    }
  }

  private syncAreaTravelHud(): void {
    const activeArea = this.campaign.activeArea;
    const route = this.campaign.getAvailableRoute();
    const outboundRoutes = this.campaign.getOutboundRoutes();
    this.areaTravelHud.sync({
      areaName: activeArea.definition.displayName,
      guidance: getTravelGuidance(
        activeArea.kind,
        route,
        outboundRoutes,
        this.campaign,
      ),
      actionLabel: route
        ? getRouteActionLabel(route, this.campaign)
        : getUnavailableRouteActionLabel(activeArea.kind, outboundRoutes.length),
      canTravel: route !== undefined,
      isInputLocked: this.isInputLocked,
    });
  }

  private syncCampaignRouteFeedback(): void {
    this.requireCampaignRouteFeedbackPresenter().syncRouteEndpoints(
      this.campaign.getOutboundRoutes().map((route) => route.from.coordinate),
    );
  }

  private syncStrategicPartyMarker(): void {
    const activeArea = this.campaign.activeArea;
    if (activeArea.kind !== CampaignAreaKind.Strategic) {
      return;
    }
    const mage = activeArea.mage.definition;
    const maxHp = deriveMaximumHp(resolveTacticalAttributes(mage.attributes));
    const currentHp = mage.currentHp ?? maxHp;
    this.requireUnitView().syncSnapshot({
      id: mage.id,
      position: activeArea.session.partyPosition,
      texture: mage.texture,
      currentHp,
      maxHp,
      isAlive: currentHp > 0,
    });
  }

  private syncTacticalPresentation(session: GameSession): void {
    if (this.activeTacticalSession !== session) {
      return;
    }
    this.requireMapView().syncVisibility(session.visibility);
    for (const unit of session.units) {
      this.syncTacticalUnitPresentation(session, unit);
    }
  }

  private syncTacticalUnitPresentation(
    session: GameSession,
    unit: import("@/game/unit/Unit").Unit,
  ): void {
    const visible = session.isUnitVisible(unit);
    const preservePosition = this.unitMovementAnimationQueue?.hasAnimationForUnit(unit.id) ?? false;
    this.requireUnitView().sync(unit, visible, preservePosition);
    this.requireUnitHealthView().sync(unit, visible, preservePosition);
    this.requireRemainsView().sync(unit, visible);
  }

  private syncTacticalSnapshot(
    session: GameSession,
    unit: TacticalUnitPresentation,
  ): void {
    const preservePosition = this.tacticalPresentationQueue?.hasAnimationForUnit(unit.id) ?? false;
    const currentUnit = session.getUnit(unit.id);
    const isVisible = currentUnit !== undefined && session.isUnitVisible(currentUnit);
    this.requireUnitView().syncSnapshot(unit, isVisible, preservePosition);
    this.requireUnitHealthView().syncSnapshot(unit, isVisible, preservePosition);
    this.requireRemainsView().syncSnapshot(unit, isVisible);
  }

  private completeTacticalPresentationEvent(
    session: GameSession,
    event: TacticalPresentationEvent,
  ): void {
    if (this.activeTacticalSession !== session) {
      return;
    }
    switch (event.kind) {
      case TacticalPresentationEventKind.Move:
        this.syncTacticalSnapshot(session, event.unit);
        return;
      case TacticalPresentationEventKind.Attack:
        this.syncTacticalSnapshot(session, event.attacker);
        this.syncTacticalSnapshot(session, event.target);
        return;
    }
  }

  private renderCurrentArea(): void {
    const tacticalPresentationQueue = this.tacticalPresentationQueue;
    if (tacticalPresentationQueue) {
      tacticalPresentationQueue.update(performance.now());
      if (this.activeTacticalSession) {
        this.syncTacticalPresentationWhenIdle(this.activeTacticalSession);
      }
    }
    const activeArea = this.campaign.activeArea;
    const mageId = activeArea.kind === CampaignAreaKind.Tactical
      ? activeArea.mageId
      : activeArea.mage.definition.id;
    this.camera?.update(this.unitView?.getDisplayedPlanePosition(mageId));
    if (this.camera) {
      this.renderer.render(this.scene, this.camera.camera);
    }
  }

  private syncTacticalPresentationWhenIdle(session: GameSession): void {
    if (!this.tacticalVisibilitySyncPending
      || this.tacticalPresentationQueue?.isAnimating
      || this.activeTacticalSession !== session) {
      return;
    }
    this.syncTacticalPresentation(session);
    this.tacticalVisibilitySyncPending = false;
  }

  private runTacticalInteraction(
    interaction: (controller: GameController) => void,
  ): void {
    if (this.isInputLocked || !this.gameController) {
      return;
    }
    interaction(this.gameController);
  }

  private requireCamera(): GameCamera {
    if (!this.camera) {
      throw new Error("Campaign area camera is unavailable");
    }
    return this.camera;
  }

  private requireMapView(): MapView {
    if (!this.mapView) {
      throw new Error("Campaign area map view is unavailable");
    }
    return this.mapView;
  }

  private requireCampaignRouteFeedbackPresenter(): CampaignRouteFeedbackPresenter {
    if (!this.campaignRouteFeedbackPresenter) {
      throw new Error("Campaign route feedback presenter is unavailable");
    }
    return this.campaignRouteFeedbackPresenter;
  }

  private requireUnitView(): UnitView {
    if (!this.unitView) {
      throw new Error("Campaign area unit view is unavailable");
    }
    return this.unitView;
  }

  private requireUnitHealthView(): UnitHealthView {
    if (!this.unitHealthView) {
      throw new Error("Tactical health view is unavailable outside a tactical area");
    }
    return this.unitHealthView;
  }

  private requireRemainsView(): RemainsView {
    if (!this.remainsView) {
      throw new Error("Tactical remains view is unavailable outside a tactical area");
    }
    return this.remainsView;
  }
}

function getRouteActionLabel(
  route: CampaignRouteDefinition,
  campaign: CampaignSession,
): string {
  const destination = campaign.getAreaDefinition(route.to.areaId);
  return destination.kind === CampaignAreaKind.Tactical
    ? `Enter ${destination.displayName}`
    : `Return to ${destination.displayName}`;
}

function getUnavailableRouteActionLabel(
  activeAreaKind: CampaignAreaKind,
  outboundRouteCount: number,
): string {
  if (outboundRouteCount === 0) {
    return "No route available";
  }
  return activeAreaKind === CampaignAreaKind.Strategic
    ? "Reach highlighted entrance"
    : "Reach highlighted exit";
}

function getTravelGuidance(
  activeAreaKind: CampaignAreaKind,
  availableRoute: CampaignRouteDefinition | undefined,
  outboundRoutes: readonly CampaignRouteDefinition[],
  campaign: CampaignSession,
): string {
  const endpointLabel = activeAreaKind === CampaignAreaKind.Strategic
    ? "entrance"
    : "exit";
  if (availableRoute) {
    return `At the highlighted ${endpointLabel}. Use ${getRouteActionLabel(availableRoute, campaign)} to travel.`;
  }

  const nextRoute = outboundRoutes[0];
  if (!nextRoute) {
    return "No campaign route is available from this area.";
  }
  const actorLabel = activeAreaKind === CampaignAreaKind.Strategic ? "party" : "Mage";
  if (outboundRoutes.length > 1) {
    return `Move the ${actorLabel} to a highlighted ${endpointLabel} to choose a destination.`;
  }

  const destination = campaign.getAreaDefinition(nextRoute.to.areaId);
  const travelVerb = destination.kind === CampaignAreaKind.Tactical
    ? `enter ${destination.displayName}`
    : `return to ${destination.displayName}`;
  return `Move the ${actorLabel} to the highlighted ${endpointLabel} to ${travelVerb}.`;
}

const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

function isMovementAnimationEnabled(): boolean {
  return typeof window.matchMedia !== "function"
    || !window.matchMedia(reducedMotionMediaQuery).matches;
}

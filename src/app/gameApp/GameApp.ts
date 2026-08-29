import * as THREE from "three";
import {
  GameController,
  type TacticalPresentationPresenter,
} from "@/app/gameController/GameController";
import { InputController } from "@/app/inputController/InputController";
import { TimelineHud } from "@/app/timelineHud/TimelineHud";
import { InitiativeQueueHud } from "@/app/initiativeQueueHud/InitiativeQueueHud";
import { ServantCommandHud } from "@/app/servantCommandHud/ServantCommandHud";
import {
  type GameSession,
  TacticalPresentationEventKind,
  type TacticalPresentationEvent,
  type TacticalUnitPresentation,
} from "@/game/gameSession/GameSession";
import {
  createGameSession,
} from "@/game/levels/createGameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { CameraMode } from "@/rendering/gameCamera/CameraMode";
import { GameCamera } from "@/rendering/gameCamera/GameCamera";
import { MapView } from "@/rendering/mapView/MapView";
import { MapHighlightView } from "@/rendering/mapHighlightView/MapHighlightView";
import { RemainsView } from "@/rendering/remainsView/RemainsView";
import {
  defaultRenderConfig,
  type RenderConfig,
} from "@/rendering/RenderConfig";
import { UnitView } from "@/rendering/unitView/UnitView";
import { UnitHealthView } from "@/rendering/unitHealthView/UnitHealthView";
import {
  UnitMovementAnimationQueue,
} from "@/rendering/unitMotion/UnitMovementAnimationQueue";
import { buildVisibleUnitMovementAnimation } from "@/rendering/unitMotion/UnitMovementAnimationModel";
import { TacticalPresentationQueue } from "@/rendering/tacticalPresentation/TacticalPresentationQueue";

export interface GameAppOptions {
  readonly level: LevelDefinition;
  readonly container: HTMLElement;
  readonly renderConfig?: RenderConfig;
}

export class GameApp {
  public readonly session: GameSession;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly renderConfig: RenderConfig;
  private readonly camera: GameCamera;
  private readonly mapView: MapView;
  private readonly mapHighlightView: MapHighlightView;
  private readonly unitView: UnitView;
  private readonly unitHealthView: UnitHealthView;
  private readonly unitMovementAnimationQueue: UnitMovementAnimationQueue;
  private readonly tacticalPresentationQueue: TacticalPresentationQueue;
  private readonly remainsView: RemainsView;
  private readonly timelineHud: TimelineHud;
  private readonly initiativeQueueHud: InitiativeQueueHud;
  private readonly servantCommandHud: ServantCommandHud;
  private readonly input: InputController;
  private tacticalVisibilitySyncPending = false;

  constructor({ level, container, renderConfig = defaultRenderConfig }: GameAppOptions) {
    this.renderConfig = renderConfig;
    const { session, player } = createGameSession(level);
    this.session = session;
    const gameMap = session.gameMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(200, -300, 400);
    scene.add(directionalLight);

    this.camera = new GameCamera(
      30,
      this.renderer.domElement,
      CameraMode.FOLLOW,
      gameMap,
      renderConfig,
    );
    this.mapView = new MapView(scene, gameMap, renderConfig);
    this.mapHighlightView = new MapHighlightView(scene, gameMap, renderConfig);
    this.unitView = new UnitView(scene, gameMap, renderConfig);
    this.unitHealthView = new UnitHealthView(scene, gameMap, renderConfig);
    this.unitMovementAnimationQueue = new UnitMovementAnimationQueue(
      renderConfig.unitMovementStepDurationMs,
      isMovementAnimationEnabled(),
    );
    this.remainsView = new RemainsView(scene, gameMap, renderConfig);
    this.tacticalPresentationQueue = new TacticalPresentationQueue({
      movementAnimationQueue: this.unitMovementAnimationQueue,
      createMovementAnimation: (event) => buildVisibleUnitMovementAnimation(
        event,
        gameMap,
        this.renderConfig,
      ),
      onEventCompleted: (event) => this.completeTacticalPresentationEvent(event),
      onMovementFrame: (event, from, to, progress) => {
        this.unitView.applyMovementFrame(event.unit.id, from, to, progress);
        this.unitHealthView.applyMovementFrame(event.unit, from, to, progress);
      },
    });
    let gameController: GameController | undefined;
    this.timelineHud = new TimelineHud({
      container,
      mageId: player.id,
      onWait: () => gameController?.waitForMage(),
    });
    this.initiativeQueueHud = new InitiativeQueueHud({
      container,
      onHighlightUnit: (unitId) => gameController?.highlightInitiativeQueueUnit(unitId),
      onClearHighlight: () => gameController?.clearInitiativeQueueHighlight(),
    });
    this.servantCommandHud = new ServantCommandHud({
      container,
      onAssignHold: () => gameController?.assignHoldStrategy(),
      onAssignProtect: () => gameController?.assignProtectMageStrategy(),
      onBeginPursue: () => gameController?.beginPursueDesignatedEnemySelection(),
      onBeginSecure: () => gameController?.beginSecureDesignatedHexSelection(),
      onClearStrategy: () => gameController?.clearServantStrategy(),
    });
    this.syncTacticalPresentation();

    const tacticalPresentationQueue = this.tacticalPresentationQueue;
    const tacticalPresentationPresenter: TacticalPresentationPresenter = {
      sync: (events, requiresTacticalVisibilitySync) => {
        this.tacticalVisibilitySyncPending ||= requiresTacticalVisibilitySync;
        this.tacticalPresentationQueue.enqueue(events);
        this.syncTacticalPresentationWhenIdle();
      },
      get isAnimating(): boolean {
        return tacticalPresentationQueue.isAnimating;
      },
    };

    gameController = new GameController(
      this.session,
      tacticalPresentationPresenter,
      this.mapHighlightView,
      this.timelineHud,
      this.servantCommandHud,
      this.initiativeQueueHud,
    );
    this.input = new InputController(
      this.renderer.domElement,
      this.camera,
      this.mapView,
      gameController,
    );

    this.renderer.setAnimationLoop(() => {
      this.updateUnitMovementPresentation();
      this.camera.update(this.unitView.getDisplayedPlanePosition(player.id));
      this.renderer.render(scene, this.camera.camera);
    });
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.input.dispose();
    this.camera.dispose();
    this.mapView.dispose();
    this.mapHighlightView.dispose();
    this.tacticalPresentationQueue.clear();
    this.unitView.dispose();
    this.unitHealthView.dispose();
    this.remainsView.dispose();
    this.timelineHud.dispose();
    this.initiativeQueueHud.dispose();
    this.servantCommandHud.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private syncUnitPresentation(unit: import("@/game/unit/Unit").Unit): void {
    const visible = this.session.isUnitVisible(unit);
    const preservePosition = this.unitMovementAnimationQueue
      .hasAnimationForUnit(unit.id);
    this.unitView.sync(unit, visible, preservePosition);
    this.unitHealthView.sync(unit, visible, preservePosition);
    this.remainsView.sync(unit, visible);
  }

  private syncUnitSnapshot(unit: TacticalUnitPresentation): void {
    const preservePosition = this.tacticalPresentationQueue
      .hasAnimationForUnit(unit.id);
    const currentUnit = this.session.getUnit(unit.id);
    const isVisible = currentUnit !== undefined && this.session.isUnitVisible(currentUnit);
    this.unitView.syncSnapshot(unit, isVisible, preservePosition);
    this.unitHealthView.syncSnapshot(unit, isVisible, preservePosition);
    this.remainsView.syncSnapshot(unit, isVisible);
  }

  private syncTacticalPresentation(): void {
    this.mapView.syncVisibility(this.session.visibility);
    for (const unit of this.session.units) {
      this.syncUnitPresentation(unit);
    }
  }

  private completeTacticalPresentationEvent(event: TacticalPresentationEvent): void {
    switch (event.kind) {
      case TacticalPresentationEventKind.Move:
        this.syncUnitSnapshot(event.unit);
        return;
      case TacticalPresentationEventKind.Attack:
        this.syncUnitSnapshot(event.attacker);
        this.syncUnitSnapshot(event.target);
        return;
    }
  }

  private updateUnitMovementPresentation(): void {
    this.tacticalPresentationQueue.update(performance.now());
    this.syncTacticalPresentationWhenIdle();
  }

  private syncTacticalPresentationWhenIdle(): void {
    if (!this.tacticalVisibilitySyncPending || this.tacticalPresentationQueue.isAnimating) {
      return;
    }

    this.syncTacticalPresentation();
    this.tacticalVisibilitySyncPending = false;
  }
}

const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

function isMovementAnimationEnabled(): boolean {
  return typeof window.matchMedia !== "function"
    || !window.matchMedia(reducedMotionMediaQuery).matches;
}

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
  type UnitMovementEvent,
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
  type UnitMovementAnimation,
} from "@/rendering/unitMotion/UnitMovementAnimationQueue";
import { buildVisibleUnitMovementAnimation } from "@/rendering/unitMotion/UnitMovementAnimationModel";

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
  private readonly remainsView: RemainsView;
  private readonly timelineHud: TimelineHud;
  private readonly initiativeQueueHud: InitiativeQueueHud;
  private readonly servantCommandHud: ServantCommandHud;
  private readonly input: InputController;

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

    const unitMovementAnimationQueue = this.unitMovementAnimationQueue;
    const tacticalPresentationPresenter: TacticalPresentationPresenter = {
      sync: (events) => {
        this.enqueueUnitMovementAnimations(events);
        this.syncTacticalPresentation();
      },
      get isAnimating(): boolean {
        return unitMovementAnimationQueue.isAnimating;
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
    this.unitMovementAnimationQueue.clear();
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

  private syncTacticalPresentation(): void {
    this.mapView.syncVisibility(this.session.visibility);
    for (const unit of this.session.units) {
      this.syncUnitPresentation(unit);
    }
  }

  private enqueueUnitMovementAnimations(events: readonly UnitMovementEvent[]): void {
    const animations: UnitMovementAnimation[] = [];

    for (const event of events) {
      const unit = this.session.getUnit(event.unitId);
      const animation = buildVisibleUnitMovementAnimation(
        event,
        unit,
        unit !== undefined && this.session.isUnitVisible(unit),
        this.session.gameMap,
        this.renderConfig,
      );
      if (animation) {
        animations.push(animation);
      }
    }

    this.unitMovementAnimationQueue.enqueue(animations);
  }

  private updateUnitMovementPresentation(): void {
    const completedUnitIds = this.unitMovementAnimationQueue.update(
      performance.now(),
      (unitId, from, to, progress) => {
        const unit = this.session.getUnit(unitId);
        if (!unit?.isAlive || !this.session.isUnitVisible(unit)) {
          return;
        }

        this.unitView.applyMovementFrame(unitId, from, to, progress);
        this.unitHealthView.applyMovementFrame(unit, from, to, progress);
      },
    );

    for (const unitId of completedUnitIds) {
      if (this.unitMovementAnimationQueue.hasAnimationForUnit(unitId)) {
        continue;
      }

      const unit = this.session.getUnit(unitId);
      if (unit) {
        this.syncUnitPresentation(unit);
      }
    }
  }
}

const reducedMotionMediaQuery = "(prefers-reduced-motion: reduce)";

function isMovementAnimationEnabled(): boolean {
  return typeof window.matchMedia !== "function"
    || !window.matchMedia(reducedMotionMediaQuery).matches;
}

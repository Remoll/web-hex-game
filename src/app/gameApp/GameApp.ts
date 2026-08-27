import * as THREE from "three";
import { GameController } from "@/app/gameController/GameController";
import { InputController } from "@/app/inputController/InputController";
import type { GameSession } from "@/game/gameSession/GameSession";
import {
  createGameSession,
} from "@/game/levels/createGameSession";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";
import { CameraMode } from "@/rendering/gameCamera/CameraMode";
import { GameCamera } from "@/rendering/gameCamera/GameCamera";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import { MapView } from "@/rendering/mapView/MapView";
import { MapHighlightView } from "@/rendering/mapHighlightView/MapHighlightView";
import { RemainsView } from "@/rendering/remainsView/RemainsView";
import {
  defaultRenderConfig,
  type RenderConfig,
} from "@/rendering/RenderConfig";
import { UnitView } from "@/rendering/unitView/UnitView";
import { UnitHealthView } from "@/rendering/unitHealthView/UnitHealthView";

export interface GameAppOptions {
  readonly level: LevelDefinition;
  readonly container: HTMLElement;
  readonly renderConfig?: RenderConfig;
}

export class GameApp {
  public readonly session: GameSession;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: GameCamera;
  private readonly mapView: MapView;
  private readonly mapHighlightView: MapHighlightView;
  private readonly unitView: UnitView;
  private readonly unitHealthView: UnitHealthView;
  private readonly remainsView: RemainsView;
  private readonly input: InputController;

  constructor({ level, container, renderConfig = defaultRenderConfig }: GameAppOptions) {
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
      gameMap.radiusInHex,
      renderConfig,
    );
    this.mapView = new MapView(scene, gameMap, renderConfig);
    this.mapHighlightView = new MapHighlightView(scene, gameMap, renderConfig);
    this.unitView = new UnitView(scene, gameMap, renderConfig);
    this.unitHealthView = new UnitHealthView(scene, gameMap, renderConfig);
    this.remainsView = new RemainsView(scene, gameMap, renderConfig);
    this.syncTacticalPresentation();

    const gameController = new GameController(
      this.session,
      { sync: () => this.syncTacticalPresentation() },
      this.mapHighlightView,
    );
    this.input = new InputController(
      this.renderer.domElement,
      this.camera,
      this.mapView,
      gameController,
    );

    this.renderer.setAnimationLoop(() => {
      const playerPlanePosition = HexLayout.hexCoordToPlaneCoord(
        player.position,
        renderConfig.hexSize,
      );
      this.camera.update(playerPlanePosition);
      this.renderer.render(scene, this.camera.camera);
    });
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    this.input.dispose();
    this.camera.dispose();
    this.mapView.dispose();
    this.mapHighlightView.dispose();
    this.unitView.dispose();
    this.unitHealthView.dispose();
    this.remainsView.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private syncUnitPresentation(unit: import("@/game/unit/Unit").Unit): void {
    const visible = this.session.isUnitVisible(unit);
    this.unitView.sync(unit, visible);
    this.unitHealthView.sync(unit, visible);
    this.remainsView.sync(unit, visible);
  }

  private syncTacticalPresentation(): void {
    this.mapView.syncVisibility(this.session.visibility);
    for (const unit of this.session.units) {
      this.syncUnitPresentation(unit);
    }
  }
}

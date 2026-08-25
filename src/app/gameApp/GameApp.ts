import * as THREE from "three";
import { GameController } from "@/app/gameController/GameController";
import { InputController } from "@/app/inputController/InputController";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { GameSession } from "@/game/gameSession/GameSession";
import { Player } from "@/game/unit/player/Player";
import type { MapArray } from "@/game/types";
import { CameraMode } from "@/rendering/gameCamera/CameraMode";
import { GameCamera } from "@/rendering/gameCamera/GameCamera";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import { MapView } from "@/rendering/mapView/MapView";
import {
  defaultRenderConfig,
  type RenderConfig,
} from "@/rendering/RenderConfig";
import { UnitView } from "@/rendering/unitView/UnitView";

export interface GameAppOptions {
  readonly map: MapArray;
  readonly container: HTMLElement;
  readonly renderConfig?: RenderConfig;
}

export class GameApp {
  public readonly session: GameSession;

  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: GameCamera;
  private readonly mapView: MapView;
  private readonly unitView: UnitView;
  private readonly input: InputController;

  constructor({ map, container, renderConfig = defaultRenderConfig }: GameAppOptions) {
    const gameMap = new GameMap(map);
    const player = new Player("player", { q: 0, r: 0 });
    this.session = new GameSession(gameMap, [player]);

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
    this.unitView = new UnitView(scene, gameMap, renderConfig);
    this.unitView.sync(player);

    const gameController = new GameController(this.session, this.unitView);
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
    this.unitView.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

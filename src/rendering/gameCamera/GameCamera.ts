import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { PlaneCoord } from "@/game/types";
import { buildIsometricCameraBounds } from "@/rendering/gameCamera/IsometricCameraBounds";
import { CameraMode } from "@/rendering/gameCamera/CameraMode";
import type { RenderConfig } from "@/rendering/RenderConfig";

export class GameCamera {
  public camera: THREE.OrthographicCamera;
  public controls: MapControls;
  public mode: CameraMode;

  private readonly frustumSize: number;
  private readonly targetXLimit: number;
  private readonly targetYLimit: number;
  private readonly offsetY: number;
  private readonly offsetZ: number;

  constructor(
    frustumSize: number,
    domElement: HTMLElement,
    initialMode: CameraMode,
    gameMap: GameMap,
    config: RenderConfig,
  ) {
    this.frustumSize = frustumSize;
    this.mode = initialMode;
    const bounds = buildIsometricCameraBounds(gameMap, config);
    this.targetXLimit = bounds.targetXLimit;
    this.targetYLimit = bounds.targetYLimit;
    this.offsetY = bounds.offsetY;
    this.offsetZ = bounds.offsetZ;

    const aspect = window.innerWidth / window.innerHeight;

    this.camera = new THREE.OrthographicCamera(
      (-this.frustumSize * aspect) / 2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      bounds.nearPlane,
      bounds.farPlane,
    );

    // Position the camera at an isometric angle.
    this.camera.position.set(0, this.offsetY, this.offsetZ);

    this.controls = new MapControls(this.camera, domElement);
    this.initControls();

    window.addEventListener("resize", this.handleResize);
  }

  public dispose(): void {
    window.removeEventListener("resize", this.handleResize);
    this.controls.dispose();
  }

  private initControls(): void {
    this.controls.screenSpacePanning = true;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enableRotate = false; // Keep the isometric viewpoint fixed.

    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    };

    this.controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.controls.minZoom = 0.007;
    this.controls.maxZoom = 0.1;
  }

  public setMode(newMode: CameraMode): void {
    this.mode = newMode;
    console.log(`Tryb kamery zmieniony na: ${this.mode}`);
  }

  public toggleMode(): void {
    this.setMode(
      this.mode === CameraMode.FOLLOW ? CameraMode.FREE : CameraMode.FOLLOW,
    );
  }

  private clampTarget(): void {
    const clampedX = THREE.MathUtils.clamp(
      this.controls.target.x,
      -this.targetXLimit,
      this.targetXLimit,
    );
    const clampedY = THREE.MathUtils.clamp(
      this.controls.target.y,
      -this.targetYLimit,
      this.targetYLimit,
    );
    const deltaX = clampedX - this.controls.target.x;
    const deltaY = clampedY - this.controls.target.y;

    this.controls.target.x = clampedX;
    this.controls.target.y = clampedY;
    this.camera.position.x += deltaX;
    this.camera.position.y += deltaY;
  }

  private readonly handleResize = (): void => {
    const aspect = window.innerWidth / window.innerHeight;

    this.camera.left = (-this.frustumSize * aspect) / 2;
    this.camera.right = (this.frustumSize * aspect) / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;

    this.camera.updateProjectionMatrix();
  };

  public update(targetPosition?: PlaneCoord): void {
    if (this.mode === CameraMode.FOLLOW && targetPosition) {
      this.controls.target.x +=
        (targetPosition.x - this.controls.target.x) * 0.05;
      this.controls.target.y +=
        (targetPosition.y - this.controls.target.y) * 0.05;

      // Preserve the camera tilt with fixed offsets in follow mode.
      this.camera.position.x = this.controls.target.x;
      this.camera.position.y = this.controls.target.y + this.offsetY;
      this.camera.position.z = this.controls.target.z + this.offsetZ;
    }

    this.controls.update();
    this.clampTarget();
  }
}

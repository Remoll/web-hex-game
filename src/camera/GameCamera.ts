import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import type { PlaneCoord } from "../types";

export type CameraMode = "FOLLOW" | "FREE";

export class GameCamera {
  public camera: THREE.OrthographicCamera;
  public controls: MapControls;
  public mode: CameraMode;

  private frustumSize: number;
  private mapMaxRadius: number;

  constructor(
    frustumSize: number = 30,
    mapRadiusUnits: number,
    domElement: HTMLElement,
    initialMode: CameraMode = "FOLLOW"
  ) {
    this.frustumSize = frustumSize;
    this.mapMaxRadius = mapRadiusUnits;
    this.mode = initialMode;

    const aspect = window.innerWidth / window.innerHeight;

    // Inicjalizacja Kamery Ortograficznej
    this.camera = new THREE.OrthographicCamera(
      (-this.frustumSize * aspect) / 2,
      (this.frustumSize * aspect) / 2,
      this.frustumSize / 2,
      -this.frustumSize / 2,
      0.1,
      1000
    );
    this.camera.position.set(0, 0, 500);

    // Inicjalizacja Sterowania (MapControls)
    this.controls = new MapControls(this.camera, domElement);
    this.initControls();

    // Nasłuchiwanie na zmianę rozmiaru okna
    window.addEventListener("resize", this.handleResize.bind(this));
  }

  private initControls(): void {
    this.controls.screenSpacePanning = true;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.enableRotate = false;

    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.NONE,
    };

    this.controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN,
    };

    this.controls.minZoom = 0.007;
    this.controls.maxZoom = 0.1;
  }

  // Zmiana trybu kamery w dowolnym momencie gry
  public setMode(newMode: CameraMode): void {
    this.mode = newMode;
    console.log(`Tryb kamery zmieniony na: ${this.mode}`);
  }

  // Przełączanie trybu (np. skrótem klawiszowym)
  public toggleMode(): void {
    this.setMode(this.mode === "FOLLOW" ? "FREE" : "FOLLOW");
  }

  // Ograniczenie celu kamery do obszaru mapy
  private clampTarget(): void {
    this.controls.target.x = THREE.MathUtils.clamp(
      this.controls.target.x,
      -this.mapMaxRadius,
      this.mapMaxRadius
    );
    this.controls.target.y = THREE.MathUtils.clamp(
      this.controls.target.y,
      -this.mapMaxRadius,
      this.mapMaxRadius
    );
  }

  // Obsługa powiększenia / pomniejszenia okna przeglądarki
  private handleResize(): void {
    const aspect = window.innerWidth / window.innerHeight;

    this.camera.left = (-this.frustumSize * aspect) / 2;
    this.camera.right = (this.frustumSize * aspect) / 2;
    this.camera.top = this.frustumSize / 2;
    this.camera.bottom = -this.frustumSize / 2;

    this.camera.updateProjectionMatrix();
  }

  // Aktualizacja pozycji kamery w pętli animacji
  public update(targetPosition?: PlaneCoord): void {
    // Jeśli jesteśmy w trybie FOLLOW i przekazano pozycję docelową (gracza)
    if (this.mode === "FOLLOW" && targetPosition) {
      this.controls.target.x += (targetPosition.x - this.controls.target.x) * 0.05;
      this.controls.target.y += (targetPosition.y - this.controls.target.y) * 0.05;

      this.camera.position.x = this.controls.target.x;
      this.camera.position.y = this.controls.target.y;
    }

    this.controls.update();
    this.clampTarget();
  }
}
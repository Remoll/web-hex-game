import * as THREE from "three";
import type { GameController } from "@/app/gameController/GameController";
import type { GameCamera } from "@/rendering/gameCamera/GameCamera";
import {
  normalizePointer,
  resolveHexFromIntersections,
} from "@/app/PointerPicker";
import type { MapView } from "@/rendering/mapView/MapView";

export class InputController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gameCamera: GameCamera,
    private readonly mapView: MapView,
    private readonly gameController: GameController,
  ) {
    window.addEventListener("keydown", this.handleKeyDown);
    this.canvas.addEventListener("click", this.handleClick);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.canvas.removeEventListener("click", this.handleClick);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === "c") {
      this.gameCamera.toggleMode();
    }
  };

  private readonly handleClick = (event: MouseEvent): void => {
    const normalized = normalizePointer(
      event.clientX,
      event.clientY,
      this.canvas.getBoundingClientRect(),
    );
    if (!normalized) {
      return;
    }

    this.pointer.set(normalized.x, normalized.y);
    this.raycaster.setFromCamera(this.pointer, this.gameCamera.camera);
    const intersections = this.raycaster.intersectObject(this.mapView.pickableMesh);
    const clickedHex = resolveHexFromIntersections(
      intersections,
      (instanceId) => this.mapView.getHexAtInstance(instanceId),
    );

    if (clickedHex) {
      this.gameController.clickHex(clickedHex);
    }
  };
}

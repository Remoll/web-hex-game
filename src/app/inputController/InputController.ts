import * as THREE from "three";
import type { GameController } from "@/app/gameController/GameController";
import type { GameCamera } from "@/rendering/gameCamera/GameCamera";
import {
  normalizePointer,
  resolveHexFromIntersections,
} from "@/app/PointerPicker";
import type { MapView } from "@/rendering/mapView/MapView";
import {
  TacticalCursor,
  getTacticalCursor,
  getTacticalCursorStyle,
} from "@/app/inputController/TacticalCursor";
import type { HexCoord } from "@/game/types";

export class InputController {
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly intersections: THREE.Intersection[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gameCamera: GameCamera,
    private readonly mapView: MapView,
    private readonly gameController: GameController,
  ) {
    this.canvas.style.cursor = getTacticalCursorStyle(
      TacticalCursor.Unavailable,
    );
    window.addEventListener("keydown", this.handleKeyDown);
    this.canvas.addEventListener("click", this.handleClick);
    this.canvas.addEventListener("mousemove", this.handlePointerMove);
    this.canvas.addEventListener("mouseleave", this.handlePointerLeave);
  }

  dispose(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    this.canvas.removeEventListener("click", this.handleClick);
    this.canvas.removeEventListener("mousemove", this.handlePointerMove);
    this.canvas.removeEventListener("mouseleave", this.handlePointerLeave);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key.toLowerCase() === "c") {
      this.gameCamera.toggleMode();
    }
  };

  private readonly handleClick = (event: MouseEvent): void => {
    const clickedHex = this.resolveHex(event);
    if (clickedHex) {
      this.gameController.clickHex(clickedHex);
      this.updateTacticalCursor(clickedHex);
      return;
    }

    this.updateTacticalCursor();
  };

  private readonly handlePointerMove = (event: MouseEvent): void => {
    this.updateTacticalCursor(this.resolveHex(event));
  };

  private readonly handlePointerLeave = (): void => {
    this.gameController.clearPreview();
    this.canvas.style.cursor = getTacticalCursorStyle(
      TacticalCursor.Unavailable,
    );
  };

  private updateTacticalCursor(hoveredHex?: HexCoord): void {
    const preview = hoveredHex
      ? this.gameController.previewHex(hoveredHex)
      : undefined;
    this.canvas.style.cursor = getTacticalCursorStyle(
      getTacticalCursor(preview),
    );
  }

  private resolveHex(event: MouseEvent) {
    const normalized = normalizePointer(
      event.clientX,
      event.clientY,
      this.canvas.getBoundingClientRect(),
    );
    if (!normalized) {
      return undefined;
    }

    this.pointer.set(normalized.x, normalized.y);
    this.raycaster.setFromCamera(this.pointer, this.gameCamera.camera);
    this.intersections.length = 0;
    this.raycaster.intersectObject(
      this.mapView.pickableMesh,
      false,
      this.intersections,
    );
    return resolveHexFromIntersections(
      this.intersections,
      (instanceId) => this.mapView.getHexAtInstance(instanceId),
    );
  }
}

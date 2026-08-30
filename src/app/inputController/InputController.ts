import * as THREE from "three";
import type { MapInteractionController } from "@/app/inputController/MapInteractionController";
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
  private isEnabled = true;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly gameCamera: GameCamera,
    private readonly mapView: MapView,
    private readonly mapInteractionController: MapInteractionController,
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

  /** Disables map input during an atomic presentation transition. */
  setEnabled(isEnabled: boolean): void {
    this.isEnabled = isEnabled;
    if (!isEnabled) {
      this.mapInteractionController.clearPreview();
      this.canvas.style.cursor = getTacticalCursorStyle(TacticalCursor.Unavailable);
    }
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (!this.isEnabled) {
      return;
    }
    if (event.key.toLowerCase() === "c") {
      this.gameCamera.toggleMode();
    }
  };

  private readonly handleClick = (event: MouseEvent): void => {
    if (!this.isEnabled) {
      return;
    }
    const clickedHex = this.resolveHex(event);
    if (clickedHex) {
      this.mapInteractionController.clickHex(clickedHex);
      this.updateTacticalCursor(clickedHex);
      return;
    }

    this.updateTacticalCursor();
  };

  private readonly handlePointerMove = (event: MouseEvent): void => {
    if (!this.isEnabled) {
      return;
    }
    this.updateTacticalCursor(this.resolveHex(event));
  };

  private readonly handlePointerLeave = (): void => {
    this.mapInteractionController.clearPreview();
    this.canvas.style.cursor = getTacticalCursorStyle(
      TacticalCursor.Unavailable,
    );
  };

  private updateTacticalCursor(hoveredHex?: HexCoord): void {
    const preview = hoveredHex
      ? this.mapInteractionController.previewHex(hoveredHex)
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

import * as THREE from "three";
import type { HexCoord, Q, R } from "../types";
import { GameState } from "../GameState/GameState";

export class EventsHandler {
  static initEventsListeners(
    renderer: THREE.WebGLRenderer,
    capsInstancedMesh: THREE.InstancedMesh,
    updatePlayerPosition: () => void,
  ) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const { gameMap, gameCamera, player } = GameState.getSingleton();

    window.addEventListener("keydown", (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "c") {
        gameCamera.toggleMode();
      }
    });

    window.addEventListener("click", (event: MouseEvent) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, gameCamera.camera);

      // Raycastujemy bezpośrednio w nakładki górne (capsInstancedMesh)
      const intersects = raycaster.intersectObject(capsInstancedMesh);

      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId;

        if (instanceId !== undefined) {
          // Indeks instancji bezpośrednio odpowiada indeksowi pola w mapie!
          let currentIndex = 0;
          let clickedHex: HexCoord | null = null;

          gameMap.forEachField((q: Q, r: R) => {
            if (currentIndex === instanceId) {
              clickedHex = { q, r };
            }
            currentIndex++;
          });

          if (clickedHex !== null) {
            if (
              (clickedHex as HexCoord).q === player.position.q &&
              (clickedHex as HexCoord).r === player.position.r
            ) {
              player.isSelected = !player.isSelected;
              console.log(
                `Gracz ${player.isSelected ? "ZAZNACZONY" : "ODZNACZONY"}`,
              );
              return;
            }

            if (player.isSelected) {
              player.position = clickedHex;
              updatePlayerPosition();
              console.log(
                `Gracz przemieszczony na Q:${(clickedHex as HexCoord).q}, R:${(clickedHex as HexCoord).r}`,
              );
            }
          }
        }
      }
    });

    window.addEventListener("resize", () => {
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }
}

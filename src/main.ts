import * as THREE from "three";
import type { HexCoord, PlaneCoord } from "./types";
import { Formulas } from "./formulas/Formulas";
import { Hex } from "./hex/Hex";
import { Player } from "./units/Player";
import { GameCamera } from "./camera/GameCamera";

// --- SCENA I RENDERER ---
const scene = new THREE.Scene();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const size = 1;
const borderWidth = 0.08;
const mapRadius = 18;
const mapMaxRadius = size * (3 / 2) * mapRadius;

// --- INICJALIZACJA WYODRĘBNIONEJ KAMERY ---
// Domyślnie uruchamia się w trybie "FOLLOW"
const gameCamera = new GameCamera(30, mapMaxRadius, renderer.domElement, "FOLLOW");

// Opcjonalnie: Przełączanie trybu kamery klawiszem "C" (Follow <-> Free)
window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key.toLowerCase() === "c") {
    gameCamera.toggleMode();
  }
});

// --- GEOMETRIA I INSTANCED MESH MAPY ---
const hexGeometry = Hex.createHexWithInnerBorderGeometry(size, borderWidth);
const hexMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
});

const hexMap: HexCoord[] = Hex.createHexMap(mapRadius);

const mapInstancedMesh = new THREE.InstancedMesh(
  hexGeometry,
  hexMaterial,
  hexMap.length
);

const dummy = new THREE.Object3D();

// Wyrenderowanie siatki mapy
hexMap.forEach((field, index) => {
  const pos: PlaneCoord = Formulas.hexCoordToPlaneCoord(field, size);
  dummy.position.set(pos.x, pos.y, 0);
  dummy.updateMatrix();
  mapInstancedMesh.setMatrixAt(index, dummy.matrix);
});

mapInstancedMesh.instanceMatrix.needsUpdate = true;
scene.add(mapInstancedMesh);

// --- GEOMETRIA I INSTANCED MESH DLA JEDNOSTEK ---
const unitGeometry = new THREE.PlaneGeometry(size * 0.8, size * 0.8);
const playerMaterial = new THREE.MeshBasicMaterial({
  color: 0x0088ff, // Niebieski kwadrat
  side: THREE.DoubleSide,
});

const maxUnits = 100;
const unitsInstancedMesh = new THREE.InstancedMesh(
  unitGeometry,
  playerMaterial,
  maxUnits
);

// Renderujemy tylko 1 instancję (Gracza)
unitsInstancedMesh.count = 1;
scene.add(unitsInstancedMesh);

// Tworzymy gracza na środku mapy (q: 0, r: 0) na slocie 0
const player = new Player("player_1", { q: 0, r: 0 }, 0);
player.moveTo(player.position, unitsInstancedMesh, size, dummy);

// --- OBSŁUGA INTERAKCJI / KLIKNIĘĆ (RAYCASTER) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const planeXY = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const intersectionPoint = new THREE.Vector3();

window.addEventListener("click", (event: MouseEvent) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, gameCamera.camera);

  if (raycaster.ray.intersectPlane(planeXY, intersectionPoint)) {
    const clickedHex = Formulas.planeCoordToHexCoord(
      { x: intersectionPoint.x, y: intersectionPoint.y },
      size
    );

    // 1. Sprawdzamy czy kliknięto w Gracza
    if (
      clickedHex.q === player.position.q &&
      clickedHex.r === player.position.r
    ) {
      player.isSelected = !player.isSelected;
      console.log(`Gracz ${player.isSelected ? "ZAZNACZONY" : "ODZNACZONY"}`);
      return;
    }

    // 2. Jeśli gracz był zaznaczony -> Przemieszczamy go
    if (player.isSelected) {
      player.moveTo(clickedHex, unitsInstancedMesh, size, dummy);
      player.isSelected = false;
      console.log("Gracz przemieszczony na:", clickedHex);
    }
  }
});

// Resizing obsługiwany jest wewnętrznie przez GameCamera i poniższy listener dla renderera
window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- PĘTLA ANIMACJI ---
function animate() {
  // Przeliczamy aktualną pozycję 2D gracza na potrzeby LERP w kamerze
  const playerPlanePos = Formulas.hexCoordToPlaneCoord(player.position, size);

  // Aktualizacja kamery (sama podejmie decyzję czy śledzić gracza na podstawie pola mode)
  gameCamera.update(playerPlanePos);

  renderer.render(scene, gameCamera.camera);
}

renderer.setAnimationLoop(animate);
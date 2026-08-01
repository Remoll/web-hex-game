import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import type { HexCoord, PlaneCoord } from "./types";
import { Formulas } from "./formulas/Formulas";
import { Hex } from "./hex/Hex";
import { Player } from "./units/Player";

// --- SCENA I RENDERER ---
const scene = new THREE.Scene();

// --- KAMERA ORTOGRAFICZNA (DLA GRY 2D) ---
const frustumSize = 30; // Zmienna określająca wielkość pola widzenia (Zoom)
let aspect = window.innerWidth / window.innerHeight;

const camera = new THREE.OrthographicCamera(
  (-frustumSize * aspect) / 2,
  (frustumSize * aspect) / 2,
  frustumSize / 2,
  -frustumSize / 2,
  0.1,
  1000
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const size = 1;
const borderWidth = 0.08;

// --- GEOMETRIA I INSTANCED MESH MAPY ---
const hexGeometry = Hex.createHexWithInnerBorderGeometry(size, borderWidth);
const hexMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
});

const mapRadius = 18;
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

// --- GEOMETRIA I INSTANCED MESH DLA JEDNOSTEK / GRACZA ---
const unitGeometry = new THREE.PlaneGeometry(size * 0.8, size * 0.8);
const playerMaterial = new THREE.MeshBasicMaterial({
  color: 0x0088ff, // Niebieski kwadrat
  side: THREE.DoubleSide,
});

// Rezerwujemy InstancedMesh na max 100 jednostek
const maxUnits = 100;
const unitsInstancedMesh = new THREE.InstancedMesh(
  unitGeometry,
  playerMaterial,
  maxUnits
);

// FIX: Renderujemy tylko 1 instancję (obecnie jest tylko Gracz)
unitsInstancedMesh.count = 1;

scene.add(unitsInstancedMesh);

// Tworzymy gracza na środku mapy (q: 0, r: 0) na slocie 0 w InstancedMesh
const player = new Player("player_1", { q: 0, r: 0 }, 0);
player.moveTo(player.position, unitsInstancedMesh, size, dummy);

// --- STEROWANIE KAMERĄ ---
camera.position.set(0, 0, 50);

const controls = new MapControls(camera, renderer.domElement);
controls.screenSpacePanning = true;
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enableRotate = false;

controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.NONE,
};

// Dla Ortograficznej Kamery zoom ogranicza się właściwościami minZoom i maxZoom
controls.minZoom = 0.5;
controls.maxZoom = 3;

const mapMaxRadius = size * (3 / 2) * mapRadius;

function clampCameraTarget() {
  controls.target.x = THREE.MathUtils.clamp(
    controls.target.x,
    -mapMaxRadius,
    mapMaxRadius
  );
  controls.target.y = THREE.MathUtils.clamp(
    controls.target.y,
    -mapMaxRadius,
    mapMaxRadius
  );
}

// --- OBSŁUGA INTERAKCJI / KLIKNIĘĆ (RAYCASTER) ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const planeXY = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); // Płaszczyzna Z=0
const intersectionPoint = new THREE.Vector3();

window.addEventListener("click", (event: MouseEvent) => {
  // Przeliczenie pozycji myszy na współrzędne Normalized Device Coordinates (-1 do +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Wyznaczamy punkt przecięcia promienia myszy z płaszczyzną mapy (Z = 0)
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

    // 2. Jeśli gracz był zaznaczony i kliknięto w inny heks -> Przemieść Gracza
    if (player.isSelected) {
      player.moveTo(clickedHex, unitsInstancedMesh, size, dummy);
      player.isSelected = false; // Odznaczamy po wykonaniu ruchu
      console.log("Gracz przemieszczony na:", clickedHex);
    }
  }
});

// --- OBSŁUGA RESIZE DLA KAMERY ORTOGRAFICZNEJ ---
window.addEventListener("resize", () => {
  aspect = window.innerWidth / window.innerHeight;

  camera.left = (-frustumSize * aspect) / 2;
  camera.right = (frustumSize * aspect) / 2;
  camera.top = frustumSize / 2;
  camera.bottom = -frustumSize / 2;

  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- PĘTLA ANIMACJI / PŁYNNE PODĄŻANIE KAMERY ---
function animate() {
  // Płynne przesuwanie celu kamery (controls.target) za Graczem
  const playerPlanePos = Formulas.hexCoordToPlaneCoord(player.position, size);

  // LERP (Linear Interpolation) zapewnia płynny ruch kamery za graczem
  controls.target.x += (playerPlanePos.x - controls.target.x) * 0.05;
  controls.target.y += (playerPlanePos.y - controls.target.y) * 0.05;

  // Przesuwamy pozycję kamery równolegle w osi Z
  camera.position.x = controls.target.x;
  camera.position.y = controls.target.y;

  controls.update();
  clampCameraTarget();

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);
import * as THREE from "three";
import { MapControls } from "three/addons/controls/MapControls.js";
import type { HexCoord, PlaneCoord } from "./types";
import { Formulas } from "./formulas/Formulas";
import { Hex } from "./hex/Hex";

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000,
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const size = 1;
const borderWidth = 0.08;

const hexGeometry: THREE.BufferGeometry<
  THREE.NormalBufferAttributes,
  THREE.BufferGeometryEventMap
> = Hex.createHexWithInnerBorderGeometry(size, borderWidth);
const hexMaterial = new THREE.MeshBasicMaterial({
  vertexColors: true,
  side: THREE.DoubleSide,
});

const mapRadius = 18;
const hexMap: HexCoord[] = Hex.createHexMap(mapRadius);

const instancedMesh = new THREE.InstancedMesh(
  hexGeometry,
  hexMaterial,
  hexMap.length,
);

const dummy = new THREE.Object3D();

hexMap.forEach((field, index) => {
  const pos: PlaneCoord = Formulas.hexCoordToPlaneCoord(field, size);
  dummy.position.set(pos.x, pos.y, 0);
  dummy.updateMatrix();
  instancedMesh.setMatrixAt(index, dummy.matrix);
});

instancedMesh.instanceMatrix.needsUpdate = true;
scene.add(instancedMesh);

// Ustawienie początkowej pozycji kamery naprzeciwko płaszczyzny XY
camera.position.set(0, 0, 35);

const controls = new MapControls(camera, renderer.domElement);

// Włączenie przesuwania w płaszczyźnie ekranu (kluczowe dla płaszczyzny XY)
controls.screenSpacePanning = true;

// Włączenie płynności/amortyzacji ruchu
controls.enableDamping = true;
controls.dampingFactor = 0.08;

// Zapobieganie obracaniu widoku (jeśli ma to być sztywny widok 2D/top-down)
controls.enableRotate = false;

// Przypisanie przesuwania (pan) pod LEWY PRZYCISK MYSZY (LPM)
controls.mouseButtons = {
  LEFT: THREE.MOUSE.PAN,
  MIDDLE: THREE.MOUSE.DOLLY,
  RIGHT: THREE.MOUSE.NONE,
};

// Sterowanie na smartfonach
controls.touches = {
  ONE: THREE.TOUCH.PAN, // 1 palec = łapanie i przesuwanie mapy
  TWO: THREE.TOUCH.DOLLY_PAN, // 2 palce = przybliżanie / oddalanie (pinch)
};

// Ograniczenia Zoomu (dystansu kamery w osi Z)
controls.minDistance = 5;
controls.maxDistance = 60;

// Wyliczenie przybliżonego promienia całej mapy w jednostkach 3D
const mapMaxRadius = size * (3 / 2) * mapRadius;

function clampCameraTarget() {
  controls.target.x = THREE.MathUtils.clamp(
    controls.target.x,
    -mapMaxRadius,
    mapMaxRadius,
  );
  controls.target.y = THREE.MathUtils.clamp(
    controls.target.y,
    -mapMaxRadius,
    mapMaxRadius,
  );
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  // Aktualizacja amortyzacji i gestów
  controls.update();

  // Pilnowanie, aby gracz nie odjechał kamerą poza obszar hexów
  clampCameraTarget();

  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

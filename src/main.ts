import * as THREE from "three";
import {
  TerrainType,
  type HexCoord,
  type MapArray,
  type Q,
  type R,
} from "./types";
import { Formulas } from "./formulas/Formulas";
import { Hex } from "./hex/Hex";
import { Player } from "./units/Player";
import { GameCamera } from "./camera/GameCamera";
import { GameMap } from "./gameMap/GameMap";
import exampleMap from "./gameMap/maps/example.json";

// --- SCENA I RENDERER ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // Białe tło

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const SIZE = 64;
const BORDER_WIDTH = 4; // Nieco grubsza ramka dla lepszej widoczności
const HEX_DEPTH = 16;
const mapRadius = 2;
const mapMaxRadius = SIZE * (3 / 2) * mapRadius;

// --- ŚWIATŁA ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(200, -300, 400);
scene.add(dirLight);

// --- KAMERA ---
const gameCamera = new GameCamera(
  30,
  mapMaxRadius,
  renderer.domElement,
  "FOLLOW",
);

window.addEventListener("keydown", (event: KeyboardEvent) => {
  if (event.key.toLowerCase() === "c") {
    gameCamera.toggleMode();
  }
});

const mapArray: MapArray = exampleMap;

const gameMap = new GameMap(mapArray);
const totalFields = mapArray.length;

// --- TWORZENIE INSTANCED MESH DLA FILARÓW (BOKÓW) ---
const sidesGeometry = Hex.createHexSidesGeometry(SIZE);
const sidesMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 }); // Jednolity kolor ziemi dla wszystkich boków
const sidesInstancedMesh = new THREE.InstancedMesh(
  sidesGeometry,
  sidesMaterial,
  totalFields,
);

// --- TWORZENIE INSTANCED MESH DLA NAKŁADEK GÓRNYCH ---
const capsGeometry = Hex.createHexTopGeometry(SIZE, BORDER_WIDTH);
const capsMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const capsInstancedMesh = new THREE.InstancedMesh(
  capsGeometry,
  capsMaterial,
  totalFields,
);

const dummy = new THREE.Object3D();
const colorGrass = new THREE.Color(0x00cc44);
const colorWater = new THREE.Color(0x0088ff);

let index = 0;
gameMap.forEachField((q, r, field) => {
  const pos = Formulas.hexCoordToPlaneCoord({ q, r }, SIZE);
  const level = field.getGroundLevel();
  const totalHeight = (level + 1) * HEX_DEPTH;

  // 1. Ustawienie filara (boki rozciągnięte w osi Z od 0 do totalHeight)
  dummy.position.set(pos.x, pos.y, 0);
  dummy.scale.set(1, 1, totalHeight);
  dummy.updateMatrix();
  sidesInstancedMesh.setMatrixAt(index, dummy.matrix);

  // 2. Ustawienie górnej nakładki na samej górze filara
  dummy.position.set(pos.x, pos.y, totalHeight);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  capsInstancedMesh.setMatrixAt(index, dummy.matrix);

  // Kolor górnej powierzchni
  if (field.getTerrainType() === TerrainType.Water) {
    capsInstancedMesh.setColorAt(index, colorWater);
  } else {
    capsInstancedMesh.setColorAt(index, colorGrass);
  }

  index++;
});

sidesInstancedMesh.instanceMatrix.needsUpdate = true;
capsInstancedMesh.instanceMatrix.needsUpdate = true;
if (capsInstancedMesh.instanceColor) {
  capsInstancedMesh.instanceColor.needsUpdate = true;
}

scene.add(sidesInstancedMesh);
scene.add(capsInstancedMesh); // Raycaster będzie sprawdzał tę siatkę

// --- GEOMETRIA I JEDNOSTKA GRACZA ---
const PLAYER_HEIGHT = SIZE * 0.8;
const unitGeometry = new THREE.BoxGeometry(
  SIZE * 0.5,
  SIZE * 0.5,
  PLAYER_HEIGHT,
);
const playerMaterial = new THREE.MeshLambertMaterial({ color: 0xee2222 });

const unitsInstancedMesh = new THREE.InstancedMesh(
  unitGeometry,
  playerMaterial,
  100,
);
unitsInstancedMesh.count = 1;
unitsInstancedMesh.frustumCulled = false;
scene.add(unitsInstancedMesh);

const player = new Player("player_1", { q: 0, r: 0 }, 0);

// Ustawienie gracza na starcie
function updatePlayerPosition() {
  const field = gameMap
    .getGameMap()
    .get(player.position.q)
    ?.get(player.position.r);
  const level = field ? field.getGroundLevel() : 0;
  const targetZ = (level + 1) * HEX_DEPTH + PLAYER_HEIGHT / 2;

  const pos2D = Formulas.hexCoordToPlaneCoord(player.position, SIZE);
  dummy.position.set(pos2D.x, pos2D.y, targetZ);
  dummy.scale.set(1, 1, 1);
  dummy.updateMatrix();
  unitsInstancedMesh.setMatrixAt(0, dummy.matrix);
  unitsInstancedMesh.instanceMatrix.needsUpdate = true;
}

updatePlayerPosition();

// --- INTERAKCJA / RAYCASTER ---
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

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

      gameMap.forEachField((q, r) => {
        if (currentIndex === instanceId) {
          clickedHex = { q, r };
        }
        currentIndex++;
      });

      if (clickedHex !== null) {
        if (
          clickedHex.q === player.position.q &&
          clickedHex.r === player.position.r
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
            `Gracz przemieszczony na Q:${clickedHex.q}, R:${clickedHex.r}`,
          );
        }
      }
    }
  }
});

window.addEventListener("resize", () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- PĘTLA ANIMACJI ---
function animate() {
  const playerPlanePos = Formulas.hexCoordToPlaneCoord(player.position, SIZE);
  gameCamera.update(playerPlanePos);
  renderer.render(scene, gameCamera.camera);
}

renderer.setAnimationLoop(animate);

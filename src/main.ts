import * as THREE from "three";
import { TerrainType, type MapArray } from "./types";
import { Formulas } from "./formulas/Formulas";
import { Hex } from "./hex/Hex";
import { Player } from "./units/Player";
import { GameCamera } from "./camera/GameCamera";
import { GameMap } from "./gameMap/GameMap";
import exampleMap from "./gameMap/maps/example.json";
import { EventsHandler } from "./EventsHandler/EventsHandler";
import { GameState } from "./GameState/GameState";
import { CustomInstancedMesh } from "./CustomInstancedMesh/CustomInstancedMesh";

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

const mapArray: MapArray = exampleMap;

const gameMap = new GameMap(mapArray);
const totalFields = mapArray.length;

// --- TWORZENIE INSTANCED MESH DLA FILARÓW (BOKÓW) ---
const sidesGeometry = Hex.createHexSidesGeometry(SIZE);
const sidesMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 }); // Jednolity kolor ziemi dla wszystkich boków
const sidesInstancedMesh = new CustomInstancedMesh(
  sidesGeometry,
  sidesMaterial,
  totalFields,
);

// --- TWORZENIE INSTANCED MESH DLA NAKŁADEK GÓRNYCH ---
const capsGeometry = Hex.createHexTopGeometry(SIZE, BORDER_WIDTH);
const capsMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const capsInstancedMesh = new CustomInstancedMesh(
  capsGeometry,
  capsMaterial,
  totalFields,
);

const colorGrass = new THREE.Color(0x00cc44);
const colorWater = new THREE.Color(0x0088ff);

let index = 0;
gameMap.forEachField((q, r, field) => {
  const pos = Formulas.hexCoordToPlaneCoord({ q, r }, SIZE);
  const level = field.getGroundLevel();
  const totalHeight = (level + 1) * HEX_DEPTH;

  // 1. Ustawienie filara (boki rozciągnięte w osi Z od 0 do totalHeight)
  sidesInstancedMesh.updateState(pos.x, pos.y, 0, index, totalHeight);

  // 2. Ustawienie górnej nakładki na samej górze filara
  capsInstancedMesh.updateState(pos.x, pos.y, totalHeight, index, 1);

  // Kolor górnej powierzchni
  if (field.getTerrainType() === TerrainType.Water) {
    capsInstancedMesh.setColorAt(index, colorWater);
  } else {
    capsInstancedMesh.setColorAt(index, colorGrass);
  }

  index++;
});

scene.add(sidesInstancedMesh.instancedMesh);
scene.add(capsInstancedMesh.instancedMesh); // Raycaster będzie sprawdzał tę siatkę

// --- GEOMETRIA I JEDNOSTKA GRACZA ---
const PLAYER_HEIGHT = SIZE * 0.8;
const unitGeometry = new THREE.BoxGeometry(
  SIZE * 0.5,
  SIZE * 0.5,
  PLAYER_HEIGHT,
);
const playerMaterial = new THREE.MeshLambertMaterial({ color: 0xee2222 });

const unitsInstancedMesh = new CustomInstancedMesh(
  unitGeometry,
  playerMaterial,
  100,
);

unitsInstancedMesh.instancedMesh.count = 1;
unitsInstancedMesh.instancedMesh.frustumCulled = false;
scene.add(unitsInstancedMesh.instancedMesh);

const player = new Player("player_1", { q: 0, r: 0 }, 0);

GameState.initSingleton(gameMap, gameCamera, player);

// Ustawienie gracza na starcie
function updatePlayerPosition() {
  const field = gameMap
    .getGameMap()
    .get(player.position.q)
    ?.get(player.position.r);
  const level = field ? field.getGroundLevel() : 0;
  const targetZ = (level + 1) * HEX_DEPTH + PLAYER_HEIGHT / 2;

  const pos2D = Formulas.hexCoordToPlaneCoord(player.position, SIZE);
  unitsInstancedMesh.updateState(pos2D.x, pos2D.y, targetZ, 0, 1);
}

updatePlayerPosition();

EventsHandler.initEventsListeners(
  renderer,
  capsInstancedMesh.instancedMesh,
  updatePlayerPosition,
);

// --- PĘTLA ANIMACJI ---
function animate() {
  const playerPlanePos = Formulas.hexCoordToPlaneCoord(player.position, SIZE);
  gameCamera.update(playerPlanePos);
  renderer.render(scene, gameCamera.camera);
}

renderer.setAnimationLoop(animate);

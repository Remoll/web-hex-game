import * as THREE from "three";
import { CameraMode } from "@/types";
import { Formulas } from "@/Formulas/Formulas";
import { Hex } from "@/Hex/Hex";
import { Player } from "@/Units/Player/Player";
import { GameCamera } from "@/GameCamera/GameCamera";
import { GameMap } from "@/GameMap/GameMap";
import exampleMap from "@/GameMap/maps/example.json";
import { EventsHandler } from "@/EventsHandler/EventsHandler";
import { GameContext } from "@/GameContext/GameContext";
import { AtlasInstancedMesh } from "@/CustomInstancedMesh/AtlasInstancedMesh/AtlasInstancedMesh";
import { CustomInstancedMesh } from "@/CustomInstancedMesh/CustomInstancedMesh";
import { GameConstants } from "@/GameConstants/GameContsants";
import { terrainAtlas } from "@/Textures/TerrainAtlas";
import { unitAtlas, UnitSprite } from "@/Textures/UnitAtlas";

// --- SCENA I RENDERER ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // Białe tło

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

GameConstants.init(64, 4, 16, 64 * 0.8, 64 * 0.5);

GameContext.gameMap = new GameMap(exampleMap);

const totalFields = exampleMap.length;

// --- ŚWIATŁA ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
dirLight.position.set(200, -300, 400);
scene.add(dirLight);

// --- KAMERA ---
GameContext.gameCamera = new GameCamera(
  30,
  renderer.domElement,
  CameraMode.FOLLOW,
);

// --- TWORZENIE INSTANCED MESH DLA FILARÓW (BOKÓW) ---
const sidesGeometry = Hex.createHexSidesGeometry(GameConstants.SIZE);
const sidesMaterial = new THREE.MeshLambertMaterial({ color: 0x553311 }); // Jednolity kolor ziemi dla wszystkich boków
const sidesInstancedMesh = new CustomInstancedMesh(
  sidesGeometry,
  sidesMaterial,
  totalFields,
);

// --- TWORZENIE INSTANCED MESH DLA NAKŁADEK GÓRNYCH ---
const capsGeometry = Hex.createHexTopGeometry(
  GameConstants.SIZE,
  GameConstants.BORDER_WIDTH,
);
const capsMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
const capsInstancedMesh = new AtlasInstancedMesh(
  capsGeometry,
  capsMaterial,
  totalFields,
  terrainAtlas,
);

let index = 0;
GameContext.gameMap.forEachField((q, r, field) => {
  const pos = Formulas.hexCoordToPlaneCoord({ q, r }, GameConstants.SIZE);
  const level = field.getGroundLevel();
  const totalHeight = (level + 1) * GameConstants.HEX_DEPTH;

  // 1. Ustawienie filara (boki rozciągnięte w osi Z od 0 do totalHeight)
  sidesInstancedMesh.updateState(pos.x, pos.y, 0, index, totalHeight);

  // 2. Ustawienie górnej nakładki na samej górze filara
  capsInstancedMesh.updateState(pos.x, pos.y, totalHeight, index, 1);

  // GameMap stores TerrainType; only the renderer knows its atlas cell.
  capsInstancedMesh.setTextureIndex(index, field.getTerrainType());

  index++;
});

scene.add(sidesInstancedMesh.instancedMesh);
scene.add(capsInstancedMesh.instancedMesh); // Raycaster będzie sprawdzał tę siatkę

// --- GEOMETRIA I JEDNOSTKA GRACZA ---
const unitGeometry = new THREE.PlaneGeometry(
  GameConstants.UNITS_WIDTH,
  GameConstants.UNITS_HEIGHT,
);
unitGeometry.rotateX(Math.PI / 2);

const playerMaterial = new THREE.MeshLambertMaterial({
  transparent: true,
  alphaTest: 0.5,
  side: THREE.DoubleSide,
});

const unitsInstancedMesh = new AtlasInstancedMesh(
  unitGeometry,
  playerMaterial,
  100,
  unitAtlas,
);

unitsInstancedMesh.instancedMesh.count = 1;
unitsInstancedMesh.instancedMesh.frustumCulled = false;
unitsInstancedMesh.setTextureIndex(0, UnitSprite.PlayerIdle);
scene.add(unitsInstancedMesh.instancedMesh);

GameContext.player = new Player("player", { q: 0, r: 0 }, unitsInstancedMesh);

GameContext.player.moveTo(GameContext.player.position);

EventsHandler.initEventsListeners(renderer, capsInstancedMesh.instancedMesh);

// --- PĘTLA ANIMACJI ---
function animate() {
  const playerPlanePos = Formulas.hexCoordToPlaneCoord(
    GameContext.player.position,
    GameConstants.SIZE,
  );
  GameContext.gameCamera.update(playerPlanePos);
  renderer.render(scene, GameContext.gameCamera.camera);
}

renderer.setAnimationLoop(animate);

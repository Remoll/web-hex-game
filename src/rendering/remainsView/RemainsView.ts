import * as THREE from "three";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { Unit } from "@/game/unit/Unit";
import type { RenderConfig } from "@/rendering/RenderConfig";
import { buildRemainsRenderState } from "@/rendering/remainsView/RemainsRenderModel";

/** Renders non-interactive corpse markers on the board surface. */
export class RemainsView {
  private static readonly dummy = new THREE.Object3D();
  private readonly mesh: THREE.InstancedMesh;
  private readonly unitIndices = new Map<string, number>();

  constructor(
    scene: THREE.Scene,
    private readonly gameMap: GameMap,
    private readonly config: RenderConfig,
    private readonly capacity: number = 100,
  ) {
    const texture = new THREE.TextureLoader().load(
      "/textures/remains-placeholder.png",
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    const geometry = new THREE.PlaneGeometry(config.remainsSize, config.remainsSize);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      alphaTest: 0.05,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
  }

  sync(unit: Unit): void {
    const index = this.getOrCreateIndex(unit.id);
    const state = buildRemainsRenderState(unit, this.gameMap, this.config);

    RemainsView.dummy.position.set(state?.x ?? 0, state?.y ?? 0, state?.z ?? 0);
    RemainsView.dummy.scale.setScalar(state ? 1 : 0);
    RemainsView.dummy.rotation.set(0, 0, 0);
    RemainsView.dummy.updateMatrix();
    this.mesh.setMatrixAt(index, RemainsView.dummy.matrix);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    disposeMaterials(this.mesh.material);
    const texture = this.getTexture();
    texture?.dispose();
    this.mesh.removeFromParent();
  }

  private getOrCreateIndex(unitId: string): number {
    const existing = this.unitIndices.get(unitId);
    if (existing !== undefined) {
      return existing;
    }

    const index = this.unitIndices.size;
    if (index >= this.capacity) {
      throw new Error(`Remains view capacity of ${this.capacity} was exceeded`);
    }

    this.unitIndices.set(unitId, index);
    this.mesh.count = index + 1;
    return index;
  }

  private getTexture(): THREE.Texture | undefined {
    const material = this.mesh.material;
    return material instanceof THREE.MeshBasicMaterial ? material.map ?? undefined : undefined;
  }
}

function disposeMaterials(material: THREE.Material | THREE.Material[]): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.dispose();
  }
}

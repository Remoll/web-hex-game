import * as THREE from "three";
import type { GameMap } from "@/game/board/gameMap/GameMap";
import { Hex } from "@/rendering/geometry/hex/Hex";
import {
  buildMapHighlightRenderStates,
  tacticalHighlightKinds,
  type TacticalHighlight,
  TacticalHighlightKind,
} from "@/rendering/mapHighlightView/MapHighlightRenderModel";
import type { RenderConfig } from "@/rendering/RenderConfig";

const highlightColors: Readonly<Record<TacticalHighlightKind, number>> = {
  [TacticalHighlightKind.Selected]: 0x28c7fa,
  [TacticalHighlightKind.Command]: 0xe4bd49,
  [TacticalHighlightKind.Move]: 0x45df79,
  [TacticalHighlightKind.Attack]: 0xf04f55,
  [TacticalHighlightKind.Initiative]: 0xa46df4,
};

/** Efficient static preview overlay. It receives semantic state, never rules. */
export class MapHighlightView {
  private static readonly dummy = new THREE.Object3D();
  private readonly meshes: Readonly<
    Record<TacticalHighlightKind, THREE.InstancedMesh>
  >;

  constructor(
    scene: THREE.Scene,
    private readonly gameMap: GameMap,
    private readonly config: RenderConfig,
  ) {
    const capacity = countFields(gameMap);
    this.meshes = Object.fromEntries(
      tacticalHighlightKinds.map((kind) => [
        kind,
        this.createMesh(kind, capacity),
      ]),
    ) as Record<TacticalHighlightKind, THREE.InstancedMesh>;

    for (const mesh of Object.values(this.meshes)) {
      scene.add(mesh);
    }
  }

  sync(highlights: readonly TacticalHighlight[]): void {
    const states = buildMapHighlightRenderStates(
      highlights,
      this.gameMap,
      this.config,
    );

    for (const kind of tacticalHighlightKinds) {
      const mesh = this.meshes[kind];
      const kindStates = states.filter((state) => state.kind === kind);

      for (const [index, state] of kindStates.entries()) {
        MapHighlightView.dummy.position.set(state.x, state.y, state.z);
        MapHighlightView.dummy.scale.setScalar(1);
        MapHighlightView.dummy.rotation.set(0, 0, 0);
        MapHighlightView.dummy.updateMatrix();
        mesh.setMatrixAt(index, MapHighlightView.dummy.matrix);
      }

      mesh.count = kindStates.length;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  dispose(): void {
    for (const mesh of Object.values(this.meshes)) {
      mesh.geometry.dispose();
      disposeMaterials(mesh.material);
      mesh.removeFromParent();
    }
  }

  private createMesh(
    kind: TacticalHighlightKind,
    capacity: number,
  ): THREE.InstancedMesh {
    const geometry = Hex.createHexTopGeometry(
      this.config.hexSize * 0.9,
      Math.max(this.config.borderWidth, 3),
    );
    const material = new THREE.MeshBasicMaterial({
      color: highlightColors[kind],
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    return mesh;
  }
}

function countFields(gameMap: GameMap): number {
  let count = 0;
  gameMap.forEachField(() => {
    count += 1;
  });
  return count;
}

function disposeMaterials(material: THREE.Material | THREE.Material[]): void {
  for (const item of Array.isArray(material) ? material : [material]) {
    item.dispose();
  }
}

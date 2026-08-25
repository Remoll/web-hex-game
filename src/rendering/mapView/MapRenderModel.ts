import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { HexCoord, TerrainType } from "@/game/types";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import type { RenderConfig } from "@/rendering/RenderConfig";

export interface MapRenderCell {
  readonly instanceId: number;
  readonly coord: HexCoord;
  readonly x: number;
  readonly y: number;
  readonly height: number;
  readonly terrainType: TerrainType;
}

export interface MapRenderModel {
  readonly cells: readonly MapRenderCell[];
}

/** Builds renderer data while preserving a stable picking index for each field. */
export function buildMapRenderModel(
  gameMap: GameMap,
  config: RenderConfig,
): MapRenderModel {
  const cells: MapRenderCell[] = [];

  gameMap.forEachField((q, r, field) => {
    const coord = { q, r };
    const position = HexLayout.hexCoordToPlaneCoord(coord, config.hexSize);

    cells.push({
      instanceId: cells.length,
      coord,
      x: position.x,
      y: position.y,
      height: (field.getGroundLevel() + 1) * config.hexDepth,
      terrainType: field.getTerrainType(),
    });
  });

  return { cells };
}

export function getHexForInstance(
  model: MapRenderModel,
  instanceId: number,
): HexCoord | undefined {
  const coord = model.cells[instanceId]?.coord;
  return coord ? { ...coord } : undefined;
}

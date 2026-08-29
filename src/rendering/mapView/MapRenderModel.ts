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
  /** Prism height lets fog mask the cap and every vertical terrain wall. */
  readonly fogPrismHeight: number;
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

    const height = (field.getGroundLevel() + config.terrainBaseLevel) * config.hexDepth;

    cells.push({
      instanceId: cells.length,
      coord,
      x: position.x,
      y: position.y,
      height,
      fogPrismHeight: height + config.fogZOffset,
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

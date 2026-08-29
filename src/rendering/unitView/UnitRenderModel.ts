import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { HexCoord } from "@/game/types";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import type { RenderConfig } from "@/rendering/RenderConfig";

export interface UnitRenderState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface UnitPositionPresentation {
  readonly position: Readonly<HexCoord>;
}

export function buildUnitRenderState(
  unit: UnitPositionPresentation,
  gameMap: GameMap,
  config: RenderConfig,
): UnitRenderState {
  return buildUnitRenderStateAt(unit.position, gameMap, config);
}

/** Builds a unit transform for one visual movement keyframe. */
export function buildUnitRenderStateAt(
  coord: Readonly<HexCoord>,
  gameMap: GameMap,
  config: RenderConfig,
): UnitRenderState {
  const position = HexLayout.hexCoordToPlaneCoord(coord, config.hexSize);
  const field = gameMap.getField(coord.q, coord.r);
  const level = field?.getGroundLevel() ?? 0;

  return {
    x: position.x,
    y: position.y,
    z:
      (level + config.terrainBaseLevel) * config.hexDepth
      + config.unitsHeight / 2,
  };
}

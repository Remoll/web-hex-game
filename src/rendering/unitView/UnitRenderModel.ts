import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { Unit } from "@/game/unit/Unit";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import type { RenderConfig } from "@/rendering/RenderConfig";

export interface UnitRenderState {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export function buildUnitRenderState(
  unit: Unit,
  gameMap: GameMap,
  config: RenderConfig,
): UnitRenderState {
  const position = HexLayout.hexCoordToPlaneCoord(unit.position, config.hexSize);
  const field = gameMap.getField(unit.position.q, unit.position.r);
  const level = field?.getGroundLevel() ?? 0;

  return {
    x: position.x,
    y: position.y,
    z:
      (level + config.terrainBaseLevel) * config.hexDepth
      + config.unitsHeight / 2,
  };
}

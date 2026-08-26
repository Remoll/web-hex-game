import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { Unit } from "@/game/unit/Unit";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import type { RenderConfig } from "@/rendering/RenderConfig";

export interface UnitHealthRenderState {
  readonly unitId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly fillRatio: number;
}

/** Builds a Three.js-independent health-bar state for a living unit. */
export function buildUnitHealthRenderState(
  unit: Unit,
  gameMap: GameMap,
  config: RenderConfig,
): UnitHealthRenderState | undefined {
  if (!unit.isAlive || unit.maxHp <= 0) {
    return undefined;
  }

  const fillRatio = unit.currentHp / unit.maxHp;
  if (!Number.isFinite(fillRatio) || fillRatio <= 0 || fillRatio > 1) {
    return undefined;
  }

  const position = unit.position;
  const planePosition = HexLayout.hexCoordToPlaneCoord(position, config.hexSize);
  const field = gameMap.getField(position.q, position.r);
  const level = field?.getGroundLevel() ?? 0;

  return {
    unitId: unit.id,
    x: planePosition.x,
    y: planePosition.y,
    z:
      (level + config.terrainBaseLevel) * config.hexDepth +
      config.unitsHeight +
      config.healthBarOffset,
    fillRatio,
  };
}

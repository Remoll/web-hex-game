import type { GameMap } from "@/game/board/gameMap/GameMap";
import type { HexCoord } from "@/game/types";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";
import type { RenderConfig } from "@/rendering/RenderConfig";

/** Unit render states are positioned at the vertical centre of the sprite. */
const unitCenterToTopHeightRatio = 0.5;
/** The fill remains centred within its fixed-width health-bar background. */
const healthBarFillCenterAlignmentRatio = 0.5;

export interface UnitHealthRenderState {
  readonly unitId: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly fillRatio: number;
}

export interface UnitHealthPresentation {
  readonly id: string;
  readonly position: Readonly<HexCoord>;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly isAlive: boolean;
}

/** Converts a unit-sprite centre elevation into the health-bar elevation above it. */
export function getUnitHealthBarZFromUnitCenter(
  unitCenterZ: number,
  config: RenderConfig,
): number {
  return unitCenterZ
    + config.unitsHeight * unitCenterToTopHeightRatio
    + config.healthBarOffset;
}

/** Keeps a health fill visually centred as its width shrinks from the right. */
export function getHealthBarFillX(
  healthBarCenterX: number,
  fillRatio: number,
  config: RenderConfig,
): number {
  const missingHealthBarWidth = config.healthBarWidth * (1 - fillRatio);
  return healthBarCenterX
    - missingHealthBarWidth * healthBarFillCenterAlignmentRatio;
}

/** Builds a Three.js-independent health-bar state for a living unit. */
export function buildUnitHealthRenderState(
  unit: UnitHealthPresentation,
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

  const unitCenterZ = (level + config.terrainBaseLevel) * config.hexDepth
    + config.unitsHeight * unitCenterToTopHeightRatio;

  return {
    unitId: unit.id,
    x: planePosition.x,
    y: planePosition.y,
    z: getUnitHealthBarZFromUnitCenter(unitCenterZ, config),
    fillRatio,
  };
}

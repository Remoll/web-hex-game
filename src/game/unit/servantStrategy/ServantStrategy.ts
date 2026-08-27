import type { HexCoord } from "@/game/types";

/**
 * A Mage-owned standing instruction. The servant resolves it only during its
 * own timeline activation; it never grants direct player control.
 */
export enum ServantStrategyType {
  Hold = "hold",
  PursueDesignatedEnemy = "pursue-designated-enemy",
  SecureDesignatedHex = "secure-designated-hex",
}

export interface HoldServantStrategy {
  readonly type: ServantStrategyType.Hold;
}

export interface PursueDesignatedEnemyServantStrategy {
  readonly type: ServantStrategyType.PursueDesignatedEnemy;
  readonly targetEnemyId: string;
}

export interface SecureDesignatedHexServantStrategy {
  readonly type: ServantStrategyType.SecureDesignatedHex;
  /** A value copy prevents callers from mutating the standing order in-place. */
  readonly targetHex: HexCoord;
}

export type ServantStrategy =
  | HoldServantStrategy
  | PursueDesignatedEnemyServantStrategy
  | SecureDesignatedHexServantStrategy;

/** The default safe instruction: consume the servant activation without moving. */
export const holdServantStrategy: HoldServantStrategy = {
  type: ServantStrategyType.Hold,
};

/** Stores identity only; current target position remains domain-private. */
export function pursueDesignatedEnemyStrategy(
  targetEnemyId: string,
): PursueDesignatedEnemyServantStrategy {
  return {
    type: ServantStrategyType.PursueDesignatedEnemy,
    targetEnemyId,
  };
}

/** Stores one tactical hex objective without introducing area ownership. */
export function secureDesignatedHexStrategy(
  targetHex: HexCoord,
): SecureDesignatedHexServantStrategy {
  return {
    type: ServantStrategyType.SecureDesignatedHex,
    targetHex: { ...targetHex },
  };
}

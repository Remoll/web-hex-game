/**
 * A Mage-owned standing instruction. The servant resolves it only during its
 * own timeline activation; it never grants direct player control.
 */
export enum ServantStrategyType {
  Hold = "hold",
  PursueDesignatedEnemy = "pursue-designated-enemy",
}

export interface HoldServantStrategy {
  readonly type: ServantStrategyType.Hold;
}

export interface PursueDesignatedEnemyServantStrategy {
  readonly type: ServantStrategyType.PursueDesignatedEnemy;
  readonly targetEnemyId: string;
}

export type ServantStrategy =
  | HoldServantStrategy
  | PursueDesignatedEnemyServantStrategy;

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

/**
 * A Mage-owned standing instruction. Concrete target-bearing strategies are
 * deliberately added by later Stories; this union keeps their dispatch point
 * explicit without granting a servant manual player control.
 */
export enum ServantStrategyType {
  Hold = "hold",
}

export interface HoldServantStrategy {
  readonly type: ServantStrategyType.Hold;
}

export type ServantStrategy = HoldServantStrategy;

/** The default safe instruction: consume the servant activation without moving. */
export const holdServantStrategy: HoldServantStrategy = {
  type: ServantStrategyType.Hold,
};

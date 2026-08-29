/** Every tactical movement path is budgeted in integer Action Points. */
export const baseMovementActionPointCost = 1;
/** Ground units may traverse only one terrain layer per edge. */
export const maximumGroundElevationDifference = 1;
/** The only upward transition currently allowed for Ground movement. */
export const singleGroundUphillElevationDifference = 1;
/** Climbing one layer costs one AP in addition to the origin's base exit cost. */
export const groundUphillAdditionalActionPointCost = 1;
export const groundUphillMovementActionPointCost = baseMovementActionPointCost
  + groundUphillAdditionalActionPointCost;
/** Serialized Shallow Water fields multiply their outgoing Ground travel cost. */
export const shallowWaterLeavingCostMultiplier = 2;

/**
 * Applies origin terrain effort before the additional cost for one legal
 * uphill Ground transition.
 */
export function calculateGroundTraversalActionPointCost(
  originFieldLeavingCostMultiplier: number,
  elevationDifference: number,
): number {
  const baseTraversalCost = baseMovementActionPointCost
    * originFieldLeavingCostMultiplier;

  return elevationDifference === singleGroundUphillElevationDifference
    ? baseTraversalCost + groundUphillAdditionalActionPointCost
    : baseTraversalCost;
}

/** Every tactical movement path is budgeted in integer Action Points. */
export const baseMovementActionPointCost = 1;
/** Ground units may traverse only one terrain layer per edge. */
export const maximumGroundElevationDifference = 1;
/** The only upward transition currently allowed for Ground movement. */
export const singleGroundUphillElevationDifference = 1;
/** Climbing one layer costs one AP in addition to the base entry cost. */
export const groundUphillAdditionalActionPointCost = 1;
export const groundUphillMovementActionPointCost = baseMovementActionPointCost
  + groundUphillAdditionalActionPointCost;

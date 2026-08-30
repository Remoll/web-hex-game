import { TacticalHighlightKind } from "@/rendering/mapHighlightView/MapHighlightRenderModel";

export interface MapHighlightMaterialPolicy {
  readonly color: number;
  readonly opacity: number;
  readonly depthTest: boolean;
  readonly renderOrder: number;
}

const tacticalInteractionHighlightColor = 0x28c7fa;
const commandHighlightColor = 0xe4bd49;
const moveHighlightColor = 0x45df79;
const attackHighlightColor = 0xf04f55;
const initiativeHighlightColor = 0xa46df4;
const campaignRouteHighlightColor = 0xffd34e;
const tacticalInteractionHighlightOpacity = 0.35;
const campaignRouteHighlightOpacity = 0.72;
const tacticalInteractionHighlightRenderOrder = 1;
const campaignRouteHighlightRenderOrder = 2;

const policies: Readonly<Record<TacticalHighlightKind, MapHighlightMaterialPolicy>> = {
  [TacticalHighlightKind.CampaignRoute]: {
    color: campaignRouteHighlightColor,
    opacity: campaignRouteHighlightOpacity,
    // Route endpoints are public navigation data and must remain readable over fog.
    depthTest: false,
    renderOrder: campaignRouteHighlightRenderOrder,
  },
  [TacticalHighlightKind.Selected]: {
    color: tacticalInteractionHighlightColor,
    opacity: tacticalInteractionHighlightOpacity,
    depthTest: true,
    renderOrder: tacticalInteractionHighlightRenderOrder,
  },
  [TacticalHighlightKind.Command]: {
    color: commandHighlightColor,
    opacity: tacticalInteractionHighlightOpacity,
    depthTest: true,
    renderOrder: tacticalInteractionHighlightRenderOrder,
  },
  [TacticalHighlightKind.Move]: {
    color: moveHighlightColor,
    opacity: tacticalInteractionHighlightOpacity,
    depthTest: true,
    renderOrder: tacticalInteractionHighlightRenderOrder,
  },
  [TacticalHighlightKind.Attack]: {
    color: attackHighlightColor,
    opacity: tacticalInteractionHighlightOpacity,
    depthTest: true,
    renderOrder: tacticalInteractionHighlightRenderOrder,
  },
  [TacticalHighlightKind.Initiative]: {
    color: initiativeHighlightColor,
    opacity: tacticalInteractionHighlightOpacity,
    depthTest: true,
    renderOrder: tacticalInteractionHighlightRenderOrder,
  },
};

/** Keeps public route feedback visible while regular tactical feedback obeys depth. */
export function getMapHighlightMaterialPolicy(
  kind: TacticalHighlightKind,
): MapHighlightMaterialPolicy {
  return policies[kind];
}

export interface RenderConfig {
  readonly hexSize: number;
  readonly borderWidth: number;
  readonly hexDepth: number;
  /** Base terrain height, expressed in whole hex-depth layers. */
  readonly terrainBaseLevel: number;
  readonly unitsHeight: number;
  readonly unitsWidth: number;
  readonly healthBarWidth: number;
  readonly healthBarHeight: number;
  readonly healthBarOffset: number;
  readonly healthBarFillZOffset: number;
  readonly remainsSize: number;
  readonly tacticalHighlightZOffset: number;
  readonly remainsZOffset: number;
}

export const defaultRenderConfig: RenderConfig = {
  hexSize: 64,
  borderWidth: 4,
  hexDepth: 16,
  terrainBaseLevel: 1,
  unitsHeight: 64 * 0.8,
  unitsWidth: 64 * 0.5,
  healthBarWidth: 40,
  healthBarHeight: 5,
  healthBarOffset: 8,
  healthBarFillZOffset: 0.1,
  remainsSize: 44,
  tacticalHighlightZOffset: 0.2,
  remainsZOffset: 0.3,
};

export interface RenderConfig {
  readonly hexSize: number;
  readonly borderWidth: number;
  readonly hexDepth: number;
  readonly unitsHeight: number;
  readonly unitsWidth: number;
}

export const defaultRenderConfig: RenderConfig = {
  hexSize: 64,
  borderWidth: 4,
  hexDepth: 16,
  unitsHeight: 64 * 0.8,
  unitsWidth: 64 * 0.5,
};

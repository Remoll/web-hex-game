import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { MovementType, TerrainType, type MapArray } from "@/game/types";
import {
  buildMapHighlightRenderStates,
  TacticalHighlightKind,
  type TacticalHighlight,
} from "@/rendering/mapHighlightView/MapHighlightRenderModel";
import { defaultRenderConfig } from "@/rendering/RenderConfig";

const map: MapArray = [
  {
    q: 0,
    r: 0,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: {
        [MovementType.Ground]: true,
        [MovementType.Flying]: true,
      },
      groundLevel: 2,
      leavingCostMultiplier: 1,
    },
  },
];

describe("buildMapHighlightRenderStates", () => {
  it("maps valid semantic highlights once and ignores invalid coordinates", () => {
    const highlights: TacticalHighlight[] = [
      { kind: TacticalHighlightKind.Move, coord: { q: 0, r: 0 } },
      { kind: TacticalHighlightKind.Move, coord: { q: 0, r: 0 } },
      { kind: TacticalHighlightKind.Attack, coord: { q: 4, r: 4 } },
    ];

    expect(
      buildMapHighlightRenderStates(
        highlights,
        new GameMap(map),
        defaultRenderConfig,
      ),
    ).toEqual([
      expect.objectContaining({
        kind: TacticalHighlightKind.Move,
        coord: { q: 0, r: 0 },
        z:
          (2 + defaultRenderConfig.terrainBaseLevel)
            * defaultRenderConfig.hexDepth
          + defaultRenderConfig.tacticalHighlightZOffset,
      }),
    ]);
  });
});

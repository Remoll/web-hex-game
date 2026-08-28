import { describe, expect, it } from "vitest";
import { GameMap } from "@/game/board/gameMap/GameMap";
import { MovementType, TerrainType, type MapArray } from "@/game/types";
import { UnitTexture } from "@/game/unit/Unit";
import { Player } from "@/game/unit/player/Player";
import { TacticalAttribute } from "@/game/unit/tacticalAttributes/TacticalAttributes";
import { FieldVisibility, MageVisibility } from "@/game/visibility/MageVisibility";

const mapData: MapArray = [0, 1, 2].map((q) => ({
  q,
  r: 0,
  fieldAttrs: {
    terrainType: TerrainType.Grass,
    allowedMovements: {
      [MovementType.Ground]: true,
      [MovementType.Flying]: true,
    },
    groundLevel: 0,
    leavingCostMultiplier: 1,
  },
}));

describe("MageVisibility", () => {
  it("keeps explored terrain discovered after it leaves Mage vision", () => {
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { viewRange: 1 },
    );
    const visibility = new MageVisibility(new GameMap(mapData));

    visibility.recalculate(mage);
    expect(visibility.getFieldVisibility({ q: 0, r: 0 })).toBe(
      FieldVisibility.Visible,
    );
    expect(visibility.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Undiscovered,
    );

    mage.moveTo({ q: 2, r: 0 });
    visibility.recalculate(mage);

    expect(visibility.getFieldVisibility({ q: 0, r: 0 })).toBe(
      FieldVisibility.Discovered,
    );
    expect(visibility.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Visible,
    );
  });

  it("marks every field non-visible when its Mage is defeated", () => {
    const mage = new Player("mage", { q: 0, r: 0 }, UnitTexture.PlayerIdle);
    const visibility = new MageVisibility(new GameMap(mapData));

    visibility.recalculate(mage);
    mage.receiveDamage(mage.maxHp);
    visibility.recalculate(mage);

    expect(visibility.getFieldVisibility({ q: 0, r: 0 })).toBe(
      FieldVisibility.Discovered,
    );
  });

  it("uses the Mage's derived Insight range during visibility recalculation", () => {
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      {
        viewRange: 1,
        attributes: { [TacticalAttribute.Insight]: 12 },
      },
    );
    const visibility = new MageVisibility(new GameMap(mapData));

    visibility.recalculate(mage);

    expect(mage.viewRange).toBe(2);
    expect(visibility.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Visible,
    );
  });

  it("keeps a steep blocker visible while retaining previously explored terrain behind it", () => {
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { viewRange: 3 },
    );
    const visibility = new MageVisibility(new GameMap([
      mapItem(0, 0, 0),
      mapItem(1, 0, 2),
      mapItem(2, 0, 0),
    ]));

    visibility.recalculate(mage);
    expect(visibility.getFieldVisibility({ q: 1, r: 0 })).toBe(
      FieldVisibility.Visible,
    );
    expect(visibility.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Undiscovered,
    );

    mage.moveTo({ q: 2, r: 0 });
    visibility.recalculate(mage);
    mage.moveTo({ q: 0, r: 0 });
    visibility.recalculate(mage);

    expect(visibility.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Discovered,
    );
  });

  it("does not grant a Mage extra view range for standing on higher ground", () => {
    const mage = new Player(
      "mage",
      { q: 0, r: 0 },
      UnitTexture.PlayerIdle,
      { viewRange: 1 },
    );
    const visibility = new MageVisibility(new GameMap([
      mapItem(0, 0, 2),
      mapItem(1, 0, 0),
      mapItem(2, 0, 0),
    ]));

    visibility.recalculate(mage);

    expect(visibility.getFieldVisibility({ q: 1, r: 0 })).toBe(
      FieldVisibility.Visible,
    );
    expect(visibility.getFieldVisibility({ q: 2, r: 0 })).toBe(
      FieldVisibility.Undiscovered,
    );
  });
});

function mapItem(q: number, r: number, groundLevel: number) {
  return {
    q,
    r,
    fieldAttrs: {
      terrainType: TerrainType.Grass,
      allowedMovements: {
        [MovementType.Ground]: true,
        [MovementType.Flying]: true,
      },
      groundLevel,
      leavingCostMultiplier: 1,
    },
  };
}

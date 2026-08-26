import { describe, expect, it } from "vitest";
import {
  Faction,
  FactionDisposition,
  factionDefinitions,
  getFactionDisposition,
  type FactionDefinition,
  validateFactionDefinition,
} from "@/game/faction/Faction";

describe("factionDefinitions", () => {
  it("assigns every faction to exactly one explicit relationship category", () => {
    for (const faction of Object.values(Faction)) {
      expect(factionDefinitions[faction].id).toBe(faction);
      const categories = factionDefinitions[faction].dispositionToFactions;

      expect(Object.keys(categories).sort()).toEqual([
        FactionDisposition.Enemy,
        FactionDisposition.Friendly,
        FactionDisposition.Neutral,
      ]);
      expect([
        ...categories.friendly,
        ...categories.enemy,
        ...categories.neutral,
      ].sort()).toEqual([...Object.values(Faction)].sort());
    }
  });

  it("allows attacks only where the acting faction declares an enemy", () => {
    expect(getFactionDisposition(Faction.Player, Faction.Enemy))
      .toBe(FactionDisposition.Enemy);
    expect(getFactionDisposition(Faction.Player, Faction.Player))
      .toBe(FactionDisposition.Friendly);
    expect(getFactionDisposition(Faction.Player, Faction.Neutral))
      .toBe(FactionDisposition.Neutral);
  });

  it("rejects duplicate, omitted, or unsupported faction assignments", () => {
    const duplicate: FactionDefinition = {
      id: Faction.Player,
      dispositionToFactions: {
        friendly: [Faction.Player, Faction.Enemy],
        enemy: [Faction.Enemy],
        neutral: [Faction.Neutral],
      },
    };
    const omitted: FactionDefinition = {
      id: Faction.Player,
      dispositionToFactions: {
        friendly: [Faction.Player],
        enemy: [Faction.Enemy],
        neutral: [],
      },
    };
    const invalidCategory = {
      id: Faction.Player,
      dispositionToFactions: {
        friendly: [Faction.Player],
        enemy: [Faction.Enemy],
        neutral: [Faction.Neutral],
        unknown: [],
      },
    } as FactionDefinition;

    expect(() => validateFactionDefinition(duplicate)).toThrow("multiple dispositions");
    expect(() => validateFactionDefinition(omitted)).toThrow("no disposition");
    expect(() => validateFactionDefinition(invalidCategory)).toThrow("must define friendly, enemy, and neutral categories");
  });
});

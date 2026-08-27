import { describe, expect, it } from "vitest";
import {
  TacticalAttribute,
  baseTacticalAttributeScore,
  defaultTacticalAttributes,
  deriveMaximumHp,
  deriveMeleeDamage,
  deriveTempo,
  deriveViewRange,
  getTacticalAttributeModifier,
  resolveTacticalAttributes,
} from "@/game/unit/tacticalAttributes/TacticalAttributes";

describe("TacticalAttributes", () => {
  it("uses explicit score-ten defaults and the documented modifier formula", () => {
    expect(defaultTacticalAttributes).toEqual({
      [TacticalAttribute.Might]: baseTacticalAttributeScore,
      [TacticalAttribute.Finesse]: baseTacticalAttributeScore,
      [TacticalAttribute.Vitality]: baseTacticalAttributeScore,
      [TacticalAttribute.Insight]: baseTacticalAttributeScore,
    });
    expect(getTacticalAttributeModifier(9)).toBe(-1);
    expect(getTacticalAttributeModifier(10)).toBe(0);
    expect(getTacticalAttributeModifier(11)).toBe(0);
    expect(getTacticalAttributeModifier(12)).toBe(1);
  });

  it("resolves omitted scores and rejects invalid serialized input", () => {
    expect(resolveTacticalAttributes({ [TacticalAttribute.Might]: 12 })).toEqual({
      [TacticalAttribute.Might]: 12,
      [TacticalAttribute.Finesse]: baseTacticalAttributeScore,
      [TacticalAttribute.Vitality]: baseTacticalAttributeScore,
      [TacticalAttribute.Insight]: baseTacticalAttributeScore,
    });
    expect(() => resolveTacticalAttributes({
      [TacticalAttribute.Finesse]: 10.5,
    })).toThrow("Tactical attribute finesse must be a non-negative integer");
    expect(() => resolveTacticalAttributes({
      unknown: baseTacticalAttributeScore,
    } as never)).toThrow("Unknown tactical attribute unknown");
  });

  it("derives current tactical statistics without changing score-ten baselines", () => {
    const attributes = resolveTacticalAttributes({
      [TacticalAttribute.Might]: 14,
      [TacticalAttribute.Finesse]: 14,
      [TacticalAttribute.Vitality]: 14,
      [TacticalAttribute.Insight]: 14,
    });

    expect(deriveMeleeDamage(20, defaultTacticalAttributes)).toBe(20);
    expect(deriveMaximumHp(defaultTacticalAttributes)).toBe(100);
    expect(deriveTempo(defaultTacticalAttributes)).toBe(100);
    expect(deriveViewRange(4, defaultTacticalAttributes)).toBe(4);
    expect(deriveMeleeDamage(20, attributes)).toBe(24);
    expect(deriveMaximumHp(attributes)).toBe(120);
    expect(deriveTempo(attributes)).toBe(102);
    expect(deriveViewRange(4, attributes)).toBe(6);
  });
});

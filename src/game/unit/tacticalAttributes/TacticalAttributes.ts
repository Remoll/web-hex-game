/** Stable serialized keys for the tactical capabilities of every unit. */
export enum TacticalAttribute {
  Might = "might",
  Finesse = "finesse",
  Vitality = "vitality",
  Insight = "insight",
}

export const tacticalAttributeKeys = [
  TacticalAttribute.Might,
  TacticalAttribute.Finesse,
  TacticalAttribute.Vitality,
  TacticalAttribute.Insight,
] as const;

const tacticalAttributeKeySet = new Set<string>(tacticalAttributeKeys);

export type TacticalAttributes = Readonly<Record<TacticalAttribute, number>>;

export type TacticalAttributeInput = Readonly<Partial<TacticalAttributes>>;

export const baseTacticalAttributeScore = 10;
export const baseMaximumHp = 100;
export const baseTacticalTempo = 100;
export const minimumTacticalTempo = 90;
export const maximumTacticalTempo = 110;
export const tempoPerFinesseModifier = 1;
export const meleeDamagePerMightModifier = 2;
export const maximumHpPerVitalityModifier = 10;
export const minimumMaximumHp = 1;
export const minimumMeleeDamage = 0;
export const minimumViewRange = 1;

/** A score of ten preserves the prototype's pre-attribute behaviour. */
export const defaultTacticalAttributes: TacticalAttributes = {
  [TacticalAttribute.Might]: baseTacticalAttributeScore,
  [TacticalAttribute.Finesse]: baseTacticalAttributeScore,
  [TacticalAttribute.Vitality]: baseTacticalAttributeScore,
  [TacticalAttribute.Insight]: baseTacticalAttributeScore,
};

export function resolveTacticalAttributes(
  input: TacticalAttributeInput = {},
): TacticalAttributes {
  validateTacticalAttributeKeys(input);
  const attributes: TacticalAttributes = {
    ...defaultTacticalAttributes,
    ...input,
  };

  for (const attribute of tacticalAttributeKeys) {
    const score = attributes[attribute];
    if (!Number.isInteger(score) || score < 0) {
      throw new Error(`Tactical attribute ${attribute} must be a non-negative integer`);
    }
  }

  return attributes;
}

export function getTacticalAttributeModifier(score: number): number {
  if (!Number.isInteger(score) || score < 0) {
    throw new Error("Tactical attribute scores must be non-negative integers");
  }

  return Math.floor((score - baseTacticalAttributeScore) / 2);
}

export function deriveMeleeDamage(
  baseMeleeDamage: number,
  attributes: TacticalAttributes,
): number {
  return Math.max(
    minimumMeleeDamage,
    baseMeleeDamage
      + getTacticalAttributeModifier(attributes[TacticalAttribute.Might])
        * meleeDamagePerMightModifier,
  );
}

export function deriveMaximumHp(
  attributes: TacticalAttributes,
): number {
  return Math.max(
    minimumMaximumHp,
    baseMaximumHp
      + getTacticalAttributeModifier(attributes[TacticalAttribute.Vitality])
        * maximumHpPerVitalityModifier,
  );
}

/** Higher Finesse increases tempo; the timeline converts it into recovery time. */
export function deriveTempo(attributes: TacticalAttributes): number {
  const value = baseTacticalTempo
    + getTacticalAttributeModifier(attributes[TacticalAttribute.Finesse])
      * tempoPerFinesseModifier;
  return Math.min(maximumTacticalTempo, Math.max(minimumTacticalTempo, value));
}

export function deriveViewRange(
  baseViewRange: number,
  attributes: TacticalAttributes,
): number {
  return Math.max(
    minimumViewRange,
    baseViewRange + getTacticalAttributeModifier(attributes[TacticalAttribute.Insight]),
  );
}

function validateTacticalAttributeKeys(input: TacticalAttributeInput): void {
  for (const key of Object.keys(input)) {
    if (!tacticalAttributeKeySet.has(key)) {
      throw new Error(`Unknown tactical attribute ${key}`);
    }
  }
}

/** A unit's strategic allegiance. Values are safe to serialize in level JSON. */
export enum Faction {
  Player = "player",
  Enemy = "enemy",
  Neutral = "neutral",
}

/** The relationship one faction declares towards another faction. */
export enum FactionDisposition {
  Friendly = "friendly",
  Enemy = "enemy",
  Neutral = "neutral",
}

/**
 * Every target faction belongs to exactly one relationship category. The
 * category-first shape makes the configured diplomatic intent easy to inspect.
 */
export interface DispositionToFactions {
  readonly friendly: readonly Faction[];
  readonly enemy: readonly Faction[];
  readonly neutral: readonly Faction[];
}

export interface FactionDefinition {
  readonly id: Faction;
  readonly dispositionToFactions: DispositionToFactions;
}

const allFactions = Object.values(Faction);
const allDispositions = Object.values(FactionDisposition);

/**
 * Faction relationships are intentionally data-driven. They need not be
 * symmetric in future game modes, so combat always queries the attacker first.
 */
export const factionDefinitions: Readonly<Record<Faction, FactionDefinition>> =
  createFactionDefinitions([
    {
      id: Faction.Player,
      dispositionToFactions: {
        friendly: [Faction.Player],
        enemy: [Faction.Enemy],
        neutral: [Faction.Neutral],
      },
    },
    {
      id: Faction.Enemy,
      dispositionToFactions: {
        friendly: [Faction.Enemy],
        enemy: [Faction.Player],
        neutral: [Faction.Neutral],
      },
    },
    {
      id: Faction.Neutral,
      dispositionToFactions: {
        friendly: [Faction.Neutral],
        enemy: [],
        neutral: [Faction.Player, Faction.Enemy],
      },
    },
  ]);

/** Returns the one configured relationship that applies to a target faction. */
export function getFactionDisposition(
  source: Faction,
  target: Faction,
): FactionDisposition {
  const dispositions = factionDefinitions[source].dispositionToFactions;

  for (const disposition of allDispositions) {
    if (dispositions[disposition].includes(target)) {
      return disposition;
    }
  }

  throw new Error(`Faction ${source} has no disposition for faction ${target}`);
}

/**
 * Ensures all three categories are present and every known faction appears in
 * one, and only one, category. Exported for validation of future data-driven
 * faction definitions.
 */
export function validateFactionDefinition(definition: FactionDefinition): void {
  const dispositionKeys = Object.keys(definition.dispositionToFactions).sort();
  const expectedDispositionKeys = [...allDispositions].sort();
  if (dispositionKeys.length !== expectedDispositionKeys.length
    || dispositionKeys.some((key, index) => key !== expectedDispositionKeys[index])) {
    throw new Error(`Faction ${definition.id} must define friendly, enemy, and neutral categories`);
  }

  const assignedFactions = new Set<Faction>();
  for (const disposition of allDispositions) {
    for (const target of definition.dispositionToFactions[disposition]) {
      if (!allFactions.includes(target)) {
        throw new Error(`Faction ${definition.id} assigns an unknown faction ${String(target)}`);
      }

      if (assignedFactions.has(target)) {
        throw new Error(`Faction ${definition.id} assigns ${target} to multiple dispositions`);
      }

      assignedFactions.add(target);
    }
  }

  const missingFactions = allFactions.filter((faction) => !assignedFactions.has(faction));
  if (missingFactions.length > 0) {
    throw new Error(`Faction ${definition.id} has no disposition for ${missingFactions.join(", ")}`);
  }
}

function createFactionDefinitions(
  definitions: readonly FactionDefinition[],
): Readonly<Record<Faction, FactionDefinition>> {
  const definitionsById = new Map<Faction, FactionDefinition>();
  for (const definition of definitions) {
    if (definitionsById.has(definition.id)) {
      throw new Error(`Faction ${definition.id} is defined more than once`);
    }

    validateFactionDefinition(definition);
    definitionsById.set(definition.id, definition);
  }

  const missingDefinitions = allFactions.filter((faction) => !definitionsById.has(faction));
  if (missingDefinitions.length > 0) {
    throw new Error(`Missing faction definitions: ${missingDefinitions.join(", ")}`);
  }

  return Object.fromEntries(definitionsById) as Record<Faction, FactionDefinition>;
}

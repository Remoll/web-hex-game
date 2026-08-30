import type { GameMap } from "@/game/board/gameMap/GameMap";
import { getHexCoordKey } from "@/game/board/hexCoord/HexCoord";
import { TacticalEntryDirection } from "@/game/campaign/CampaignDefinition";
import { MovementType, type HexCoord } from "@/game/types";

const directionalNeighbourOffsets: Readonly<Record<
  TacticalEntryDirection,
  HexCoord
>> = {
  [TacticalEntryDirection.East]: { q: 1, r: 0 },
  [TacticalEntryDirection.NorthEast]: { q: 1, r: -1 },
  [TacticalEntryDirection.NorthWest]: { q: 0, r: -1 },
  [TacticalEntryDirection.West]: { q: -1, r: 0 },
  [TacticalEntryDirection.SouthWest]: { q: -1, r: 1 },
  [TacticalEntryDirection.SouthEast]: { q: 0, r: 1 },
};

const formationDirectionOrder: readonly TacticalEntryDirection[] = [
  TacticalEntryDirection.East,
  TacticalEntryDirection.SouthEast,
  TacticalEntryDirection.NorthEast,
  TacticalEntryDirection.West,
  TacticalEntryDirection.SouthWest,
  TacticalEntryDirection.NorthWest,
];

const firstPartyMemberIndex = 0;

export interface TacticalEntryPlacement {
  readonly unitId: string;
  readonly position: HexCoord;
}

/**
 * Places the Mage on the entry hex and living servants in a deterministic,
 * direction-relative neighbour sequence. A blocked authored entry fails fast.
 */
export function createTacticalEntryFormation(
  gameMap: GameMap,
  entryCoordinate: HexCoord,
  entryDirection: TacticalEntryDirection,
  partyMemberIds: readonly string[],
  occupiedCoordinates: readonly HexCoord[],
): readonly TacticalEntryPlacement[] {
  if (partyMemberIds.length === 0) {
    throw new Error("A tactical entry formation requires a Mage");
  }

  const occupiedCoordinateKeys = new Set(occupiedCoordinates.map(getHexCoordKey));
  const placements: TacticalEntryPlacement[] = [];
  const entryFormationCoordinates = [
    entryCoordinate,
    ...getDirectionalFormationCoordinates(entryCoordinate, entryDirection),
  ];

  for (const [index, unitId] of partyMemberIds.entries()) {
    const coordinate = entryFormationCoordinates[index];
    if (!coordinate) {
      throw new Error("The tactical entry formation has no available party slot");
    }
    if (!isGroundTraversable(gameMap, coordinate)
      || occupiedCoordinateKeys.has(getHexCoordKey(coordinate))) {
      throw new Error(`The tactical entry formation slot for ${unitId} is unavailable`);
    }

    placements.push({ unitId, position: { ...coordinate } });
    occupiedCoordinateKeys.add(getHexCoordKey(coordinate));
  }

  if (placements[firstPartyMemberIndex]?.position.q !== entryCoordinate.q
    || placements[firstPartyMemberIndex]?.position.r !== entryCoordinate.r) {
    throw new Error("The tactical entry Mage must occupy the route endpoint");
  }

  return Object.freeze(placements);
}

function getDirectionalFormationCoordinates(
  entryCoordinate: HexCoord,
  entryDirection: TacticalEntryDirection,
): readonly HexCoord[] {
  const directionIndex = formationDirectionOrder.indexOf(entryDirection);
  if (directionIndex < 0) {
    throw new Error(`Unknown tactical entry direction ${entryDirection}`);
  }

  const formationCoordinates: HexCoord[] = [];
  for (let index = 0; index < formationDirectionOrder.length; index += 1) {
    const rotatedDirection = formationDirectionOrder[
      (directionIndex + index) % formationDirectionOrder.length
    ];
    if (!rotatedDirection) {
      throw new Error("The tactical entry formation direction is missing");
    }
    const offset = directionalNeighbourOffsets[rotatedDirection];
    formationCoordinates.push({
      q: entryCoordinate.q + offset.q,
      r: entryCoordinate.r + offset.r,
    });
  }
  return formationCoordinates;
}

function isGroundTraversable(gameMap: GameMap, coordinate: HexCoord): boolean {
  return gameMap.getField(coordinate.q, coordinate.r)
    ?.getAllowedMovements()[MovementType.Ground] ?? false;
}

import { GameMap } from "@/game/board/gameMap/GameMap";
import {
  DoorBlockInitialState,
  TacticalHexStructureType,
} from "@/game/board/structure/TacticalHexStructure";
import type { HexCoord } from "@/game/types";

/**
 * Mutable tactical state derived from immutable DoorBlock JSON definitions.
 * It deliberately stays outside GameMap so authored map data never changes at
 * runtime and can be reused to create a fresh tactical session.
 */
export class TacticalDoorState {
  private readonly stateByDoorBlockId = new Map<string, DoorBlockInitialState>();

  constructor(private readonly gameMap: GameMap) {
    this.gameMap.forEachStructure((placement) => {
      if (placement.structure.type === TacticalHexStructureType.DoorBlock) {
        this.stateByDoorBlockId.set(
          placement.id,
          placement.structure.initialState,
        );
      }
    });
  }

  getDoorBlockIdAt(coord: HexCoord): string | undefined {
    const placement = this.gameMap.getStructurePlacement(coord.q, coord.r);
    return placement?.structure.type === TacticalHexStructureType.DoorBlock
      ? placement.id
      : undefined;
  }

  getState(doorBlockId: string): DoorBlockInitialState | undefined {
    return this.stateByDoorBlockId.get(doorBlockId);
  }

  toggle(doorBlockId: string): DoorBlockInitialState | undefined {
    const state = this.stateByDoorBlockId.get(doorBlockId);
    if (state === undefined) {
      return undefined;
    }

    const nextState = state === DoorBlockInitialState.Closed
      ? DoorBlockInitialState.Open
      : DoorBlockInitialState.Closed;
    this.stateByDoorBlockId.set(doorBlockId, nextState);
    return nextState;
  }

  isGroundEntryBlocked(coord: HexCoord): boolean {
    if (this.gameMap.isGroundEntryBlockedByStructure(coord)) {
      return true;
    }

    const doorBlockId = this.getDoorBlockIdAt(coord);
    return doorBlockId !== undefined
      && this.getState(doorBlockId) === DoorBlockInitialState.Closed;
  }

  isSightBlocked(coord: HexCoord): boolean {
    if (this.gameMap.isSightBlockedByStructure(coord)) {
      return true;
    }

    const doorBlockId = this.getDoorBlockIdAt(coord);
    return doorBlockId !== undefined
      && this.getState(doorBlockId) === DoorBlockInitialState.Closed;
  }
}

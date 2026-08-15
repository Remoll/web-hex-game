import { Field } from "../fields/Field";
import type { MapArray, Q, R } from "../types";

export class GameMap {
  private gameMap: Map<Q, Map<R, Field>> = new Map();

  constructor(mapArray: MapArray) {
    mapArray.forEach(({ q, r, fieldAttrs }) => {
      if (!this.gameMap.has(q)) {
        this.gameMap.set(q, new Map());
      }

      this.gameMap.get(q)!.set(r, new Field(fieldAttrs));
    });
  }

  getGameMap() {
    return this.gameMap;
  }

  forEachField(callback: (q: Q, r: R, field: Field) => void) {
    for (const [q, col] of this.gameMap) {
      for (const [r, field] of col) {
        callback(q, r, field);
      }
    }
  }

  getField(q: Q, r: R): Field | undefined {
    return this.gameMap.get(q)?.get(r);
  }
}

import { Field } from "../fields/Field";
import type { MapArray, Q, R } from "../types";

export class GameMap {
  private gameMap: Map<Q, Map<R, Field>> = new Map();
  private fieldsNumber: number = 0;

  constructor(mapArray: MapArray) {
    mapArray.forEach(({ q, r, fieldAttrs }) => {
      if (!this.gameMap.has(q)) {
        this.gameMap.set(q, new Map());
      }

      this.gameMap.get(q)!.set(r, new Field(fieldAttrs));
      this.fieldsNumber++;
    });
  }

  getGameMap() {
    return this.gameMap;
  }

  //   używam totalBlocks w main.js, może można to tutaj liczyć
  getFieldsNumber() {
    return this.fieldsNumber;
  }

  forEachField(callback: (q: Q, r: R, field: Field) => void) {
    for (const [q, col] of this.gameMap) {
      for (const [r, field] of col) {
        callback(q, r, field);
      }
    }
  }

  getField(q: Q, r: R) {
    return this.gameMap.get(q)?.get(r);
  }
}

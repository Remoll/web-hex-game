import { Field } from "@/Field/Field";
import type { FieldsMap, MapArray, Q, R } from "@/types";

export class GameMap {
  private readonly fieldsMap: FieldsMap = new Map();
  private readonly _radiusInHex;

  constructor(mapArray: MapArray) {
    mapArray.forEach(({ q, r, fieldAttrs }) => {
      if (!this.fieldsMap.has(q)) {
        this.fieldsMap.set(q, new Map());
      }

      this.fieldsMap.get(q)!.set(r, new Field(fieldAttrs));
    });

    this._radiusInHex = this.getRadiusInHex();
  }

  forEachField(callback: (q: Q, r: R, field: Field) => void) {
    for (const [q, col] of this.fieldsMap) {
      for (const [r, field] of col) {
        callback(q, r, field);
      }
    }
  }

  getField(q: Q, r: R): Field | undefined {
    return this.fieldsMap.get(q)?.get(r);
  }

  get radiusInHex(): number {
    return this._radiusInHex;
  }

  private getRadiusInHex(): number {
    let radius = 0;

    this.forEachField((q, r) => {
      radius = Math.max(radius, Math.abs(q), Math.abs(r), Math.abs(q + r));
    });

    return radius;
  }
}

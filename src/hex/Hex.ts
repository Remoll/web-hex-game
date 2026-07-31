import * as THREE from "three";
import type { HexCoord } from "../types";

export class Hex {
  static createHexWithInnerBorderGeometry(
    size: number,
    border: number,
  ): THREE.BufferGeometry<
    THREE.NormalBufferAttributes,
    THREE.BufferGeometryEventMap
  > {
    const geometry = new THREE.BufferGeometry();
    const outerRadius = size;
    const innerRadius = size - border;

    const outerPoints: number[][] = [];
    const innerPoints: number[][] = [];

    for (let i = 0; i < 6; i++) {
      const angleRad = (Math.PI / 180) * (60 * i);
      outerPoints.push([
        outerRadius * Math.cos(angleRad),
        outerRadius * Math.sin(angleRad),
        0,
      ]);
      innerPoints.push([
        innerRadius * Math.cos(angleRad),
        innerRadius * Math.sin(angleRad),
        0,
      ]);
    }
    console.log(outerPoints);

    const positions: number[] = [];
    const colors: number[] = [];

    const innerColor = new THREE.Color(0x00ff00);
    const borderColor = new THREE.Color(0x003300);

    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      const o1 = outerPoints[i];
      const o2 = outerPoints[next];
      const i1 = innerPoints[i];
      const i2 = innerPoints[next];

      positions.push(...i1, ...i2, ...o2);
      colors.push(
        innerColor.r,
        innerColor.g,
        innerColor.b,
        innerColor.r,
        innerColor.g,
        innerColor.b,
        borderColor.r,
        borderColor.g,
        borderColor.b,
      );

      positions.push(...i1, ...o2, ...o1);
      colors.push(
        innerColor.r,
        innerColor.g,
        innerColor.b,
        borderColor.r,
        borderColor.g,
        borderColor.b,
        borderColor.r,
        borderColor.g,
        borderColor.b,
      );
    }

    const centerPositions: number[] = [];
    const centerColors: number[] = [];

    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      const i1 = innerPoints[i];
      const i2 = innerPoints[next];

      centerPositions.push(0, 0, 0, ...i1, ...i2);
      centerColors.push(
        innerColor.r,
        innerColor.g,
        innerColor.b,
        innerColor.r,
        innerColor.g,
        innerColor.b,
        innerColor.r,
        innerColor.g,
        innerColor.b,
      );
    }

    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([...positions, ...centerPositions], 3),
    );
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute([...colors, ...centerColors], 3),
    );

    return geometry;
  }

  static createHexMap(mapRadius: number): HexCoord[] {
    const hexMap: HexCoord[] = [];

    for (let r = -mapRadius; r <= mapRadius; r++) {
      const q1 = Math.max(-mapRadius, -r - mapRadius);
      const q2 = Math.min(mapRadius, -r + mapRadius);

      for (let q = q1; q <= q2; q++) {
        hexMap.push({ q, r });
      }
    }

    return hexMap;
  }
}

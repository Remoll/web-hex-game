import * as THREE from "three";
// import type { HexCoord } from "@/types";

export class Hex {
  // Geometria samej górnej powierzchni z wyraźnym obrysem
  static createHexTopGeometry(size: number, border: number): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();

  const outerRadius = size;
  const innerRadius = size - border;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const borderColor = new THREE.Color(0x222222);
  const innerColor = new THREE.Color(0xffffff);

  // Środek
  positions.push(0, 0, 0);
  colors.push(innerColor.r, innerColor.g, innerColor.b);

  // Wewnętrzny sześciokąt
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;

    positions.push(
      innerRadius * Math.cos(a),
      innerRadius * Math.sin(a),
      0
    );

    colors.push(innerColor.r, innerColor.g, innerColor.b);
  }

  // Zewnętrzny sześciokąt
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;

    positions.push(
      outerRadius * Math.cos(a),
      outerRadius * Math.sin(a),
      0
    );

    colors.push(borderColor.r, borderColor.g, borderColor.b);
  }

  // Środek (fan)
  for (let i = 0; i < 6; i++) {
    const a = 1 + i;
    const b = 1 + ((i + 1) % 6);

    indices.push(0, a, b);
  }

  // Ramka
  for (let i = 0; i < 6; i++) {
    const in1 = 1 + i;
    const in2 = 1 + ((i + 1) % 6);

    const out1 = 7 + i;
    const out2 = 7 + ((i + 1) % 6);

    indices.push(in1, out1, out2);
    indices.push(in1, out2, in2);
  }

  geometry.setIndex(indices);

  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );

  geometry.setAttribute(
    "color",
    new THREE.Float32BufferAttribute(colors, 3)
  );

  geometry.computeVertexNormals();

  return geometry;
}
  // Geometria samych ścian bocznych o wysokości 1 (do skalowania w osi Z)
  static createHexSidesGeometry(size: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const outerRadius = size;
    const outerPoints: number[][] = [];

    for (let i = 0; i < 6; i++) {
      const angleRad = (Math.PI / 180) * (60 * i);
      outerPoints.push([
        outerRadius * Math.cos(angleRad),
        outerRadius * Math.sin(angleRad),
      ]);
    }

    const positions: number[] = [];

    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      const x1 = outerPoints[i][0];
      const y1 = outerPoints[i][1];
      const x2 = outerPoints[next][0];
      const y2 = outerPoints[next][1];

      // Trójkąty boczne (wysokość od Z=0 do Z=1)
      positions.push(x1, y1, 1, x2, y2, 0, x2, y2, 1);
      positions.push(x1, y1, 1, x1, y1, 0, x2, y2, 0);
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    return geometry;
  }

  // static createHexMap(mapRadius: number): HexCoord[] {
  //   const hexMap: HexCoord[] = [];

  //   for (let r = -mapRadius; r <= mapRadius; r++) {
  //     const q1 = Math.max(-mapRadius, -r - mapRadius);
  //     const q2 = Math.min(mapRadius, -r + mapRadius);

  //     for (let q = q1; q <= q2; q++) {
  //       hexMap.push({ q, r });
  //     }
  //   }

  //   return hexMap;
  // }
}

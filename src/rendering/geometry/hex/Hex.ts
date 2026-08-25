import * as THREE from "three";
import type { PlaneCoord } from "@/game/types";
import { HexLayout } from "@/rendering/geometry/hexLayout/HexLayout";

export class Hex {
  // Top surface geometry with a visible border.
  static createHexTopGeometry(size: number, border: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const outerRadius = size;
    const innerRadius = size - border;

    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    const borderColor = new THREE.Color(0x222222);
    const innerColor = new THREE.Color(0xffffff);

    // Center vertex.
    positions.push(0, 0, 0);
    colors.push(innerColor.r, innerColor.g, innerColor.b);
    uvs.push(0.5, 0.5);

    // Inner hexagon.
    for (let i = 0; i < 6; i++) {
      const point = HexLayout.hexVertex(i, innerRadius);
      const [u, v] = HexLayout.planeCoordToTextureCoordinates(
        point,
        outerRadius,
      );

      positions.push(point.x, point.y, 0);
      colors.push(innerColor.r, innerColor.g, innerColor.b);
      uvs.push(u, v);
    }

    // Outer hexagon.
    for (let i = 0; i < 6; i++) {
      const point = HexLayout.hexVertex(i, outerRadius);
      const [u, v] = HexLayout.planeCoordToTextureCoordinates(
        point,
        outerRadius,
      );

      positions.push(point.x, point.y, 0);
      colors.push(borderColor.r, borderColor.g, borderColor.b);
      uvs.push(u, v);
    }

    // Center triangle fan.
    for (let i = 0; i < 6; i++) {
      const a = 1 + i;
      const b = 1 + ((i + 1) % 6);

      indices.push(0, a, b);
    }

    // Border ring.
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
      new THREE.Float32BufferAttribute(positions, 3),
    );
    geometry.setAttribute(
      "color",
      new THREE.Float32BufferAttribute(colors, 3),
    );
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));

    geometry.computeVertexNormals();

    return geometry;
  }
  // Side-wall geometry with unit height for Z-axis scaling.
  static createHexSidesGeometry(size: number): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    const outerRadius = size;
    const outerPoints: PlaneCoord[] = [];

    for (let i = 0; i < 6; i++) {
      outerPoints.push(HexLayout.hexVertex(i, outerRadius));
    }

    const positions: number[] = [];

    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      const start = outerPoints[i];
      const end = outerPoints[next];

      // Side triangles spanning from Z=0 to Z=1.
      positions.push(start.x, start.y, 1, end.x, end.y, 0, end.x, end.y, 1);
      positions.push(start.x, start.y, 1, start.x, start.y, 0, end.x, end.y, 0);
    }

    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();

    return geometry;
  }
}

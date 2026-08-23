import {
  InstancedBufferAttribute,
  type BufferGeometry,
  type MeshBasicMaterial,
  type MeshLambertMaterial,
} from "three";
import { CustomInstancedMesh } from "@/CustomInstancedMesh/CustomInstancedMesh";
import type { TextureAtlas } from "@/Textures/TextureAtlas";

type AtlasMaterial = MeshBasicMaterial | MeshLambertMaterial;

/**
 * One material, one texture atlas and one float attribute shared by all
 * instances. The attribute identifies the atlas cell for each instance.
 */
export class AtlasInstancedMesh<TSprite extends PropertyKey> extends CustomInstancedMesh {
  private readonly textureIndices: InstancedBufferAttribute;

  constructor(
    geometry: BufferGeometry,
    material: AtlasMaterial,
    count: number,
    private readonly atlas: TextureAtlas<TSprite>,
  ) {
    // The per-instance attribute belongs to this mesh only, so callers can
    // safely reuse the source geometry for another renderer in the future.
    super(geometry.clone(), material, count);

    this.textureIndices = new InstancedBufferAttribute(
      new Float32Array(count),
      1,
    );
    this.instancedMesh.geometry.setAttribute(
      "instanceTextureIndex",
      this.textureIndices,
    );

    material.map = atlas.texture;
    this.configureAtlasShader(material);
    material.needsUpdate = true;
  }

  setTextureIndex(index: number, sprite: TSprite): void {
    this.textureIndices.setX(index, this.atlas.getIndex(sprite));
    this.textureIndices.needsUpdate = true;
  }

  private configureAtlasShader(material: AtlasMaterial): void {
    const previousOnBeforeCompile = material.onBeforeCompile;
    const previousCacheKey = material.customProgramCacheKey;
    const columns = this.atlas.columns.toFixed(1);
    const rows = this.atlas.rows.toFixed(1);

    material.onBeforeCompile = (shader, renderer) => {
      previousOnBeforeCompile(shader, renderer);

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        "#include <common>\nattribute float instanceTextureIndex;",
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>

#ifdef USE_MAP
float atlasColumn = mod( instanceTextureIndex, ${columns} );
float atlasRow = floor( instanceTextureIndex / ${columns} );
vec2 atlasTileSize = vec2( 1.0 / ${columns}, 1.0 / ${rows} );
vec2 atlasUv = MAP_UV * atlasTileSize + vec2(
  atlasColumn * atlasTileSize.x,
  (${rows} - atlasRow - 1.0) * atlasTileSize.y
);
vMapUv = ( mapTransform * vec3( atlasUv, 1 ) ).xy;
#endif`,
      );
    };
    material.customProgramCacheKey = () =>
      `${previousCacheKey.call(material)}|atlas:${this.atlas.columns}x${this.atlas.rows}`;
  }
}

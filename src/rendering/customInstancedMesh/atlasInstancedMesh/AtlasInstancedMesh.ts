import {
  InstancedBufferAttribute,
  type BufferGeometry,
  type MeshBasicMaterial,
  type MeshLambertMaterial,
} from "three";
import { CustomInstancedMesh } from "@/rendering/customInstancedMesh/CustomInstancedMesh";
import type { TextureAtlas } from "@/rendering/textures/textureAtlas/TextureAtlas";

type AtlasMaterial = MeshBasicMaterial | MeshLambertMaterial;

/** A normalized subregion inside one atlas cell. */
export interface AtlasTextureRegion {
  readonly uOffset: number;
  readonly vOffset: number;
  readonly uScale: number;
  readonly vScale: number;
}

const fullAtlasTextureRegion: AtlasTextureRegion = {
  uOffset: 0,
  vOffset: 0,
  uScale: 1,
  vScale: 1,
};

/**
 * One material, one texture atlas and one float attribute shared by all
 * instances. The attribute identifies the atlas cell for each instance.
 */
export class AtlasInstancedMesh<TSprite extends PropertyKey> extends CustomInstancedMesh {
  private readonly textureIndices: InstancedBufferAttribute;
  private readonly textureRegions: InstancedBufferAttribute;

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
    this.textureRegions = new InstancedBufferAttribute(
      new Float32Array(count * 4),
      4,
    );
    for (let index = 0; index < count; index += 1) {
      this.setTextureRegion(index, fullAtlasTextureRegion);
    }
    this.instancedMesh.geometry.setAttribute(
      "instanceTextureIndex",
      this.textureIndices,
    );
    this.instancedMesh.geometry.setAttribute(
      "instanceTextureRegion",
      this.textureRegions,
    );

    material.map = atlas.texture;
    this.configureAtlasShader(material);
    material.needsUpdate = true;
  }

  setTextureIndex(index: number, sprite: TSprite): void {
    this.textureIndices.setX(index, this.atlas.getIndex(sprite));
    this.textureIndices.needsUpdate = true;
  }

  /** Crops one sprite inside its atlas cell without affecting other instances. */
  setTextureRegion(index: number, region: AtlasTextureRegion): void {
    this.textureRegions.setXYZW(
      index,
      region.uOffset,
      region.vOffset,
      region.uScale,
      region.vScale,
    );
    this.textureRegions.needsUpdate = true;
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
        "#include <common>\nattribute float instanceTextureIndex;\nattribute vec4 instanceTextureRegion;",
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <uv_vertex>",
        `#include <uv_vertex>

#ifdef USE_MAP
float atlasColumn = mod( instanceTextureIndex, ${columns} );
float atlasRow = floor( instanceTextureIndex / ${columns} );
vec2 atlasTileSize = vec2( 1.0 / ${columns}, 1.0 / ${rows} );
vec2 croppedMapUv = MAP_UV * instanceTextureRegion.zw
  + instanceTextureRegion.xy;
vec2 atlasUv = croppedMapUv * atlasTileSize + vec2(
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

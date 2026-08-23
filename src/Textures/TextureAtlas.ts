import {
  NearestFilter,
  SRGBColorSpace,
  type Texture,
} from "three";

/**
 * Keeps atlas layout separate from game-state values such as TerrainType.
 */
export class TextureAtlas<TSprite extends PropertyKey> {
  public readonly texture: Texture;

  constructor(
    texture: Texture,
    public readonly columns: number,
    public readonly rows: number,
    private readonly spriteIndices: ReadonlyMap<TSprite, number>,
  ) {
    this.texture = texture;
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.magFilter = NearestFilter;
    this.texture.minFilter = NearestFilter;
    this.texture.generateMipmaps = false;
    this.texture.needsUpdate = true;
  }

  getIndex(sprite: TSprite): number {
    const index = this.spriteIndices.get(sprite);

    if (index === undefined) {
      throw new Error(`Sprite ${String(sprite)} is not present in this atlas`);
    }

    return index;
  }
}

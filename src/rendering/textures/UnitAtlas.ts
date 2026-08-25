import { TextureLoader } from "three";
import { TextureAtlas } from "@/rendering/textures/textureAtlas/TextureAtlas";
import { UnitSprite } from "@/rendering/textures/UnitSprite";

export { UnitSprite } from "@/rendering/textures/UnitSprite";

const texture = new TextureLoader().load("/textures/units-atlas.png");

/** Renderer-specific sprite names map to physical cells in the unit atlas. */
export const unitAtlas = new TextureAtlas<UnitSprite>(
  texture,
  8,
  4,
  new Map([
    [UnitSprite.PlayerIdle, 27],
    [UnitSprite.EnemyIdle, 31],
  ]),
);

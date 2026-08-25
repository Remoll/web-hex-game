import { TextureLoader } from "three";
import { TextureAtlas } from "@/rendering/textures/textureAtlas/TextureAtlas";

export enum UnitSprite {
  PlayerIdle,
}

const texture = new TextureLoader().load("/textures/units-atlas.png");

/** Domain-level sprite names stay independent of physical cell numbers. */
export const unitAtlas = new TextureAtlas<UnitSprite>(
  texture,
  8,
  4,
  new Map([[UnitSprite.PlayerIdle, 27]]),
);

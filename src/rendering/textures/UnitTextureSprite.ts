import { UnitTexture } from "@/game/unit/Unit";
import { UnitSprite } from "@/rendering/textures/UnitSprite";

const unitTextureSprites: Readonly<Record<UnitTexture, UnitSprite>> = {
  [UnitTexture.PlayerIdle]: UnitSprite.PlayerIdle,
  [UnitTexture.EnemyIdle]: UnitSprite.EnemyIdle,
};

/** Converts a domain visual key into a renderer-specific atlas sprite. */
export function getUnitSprite(texture: UnitTexture): UnitSprite {
  return unitTextureSprites[texture];
}

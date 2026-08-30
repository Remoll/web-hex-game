import { parseLevelDefinition } from "@/game/levels/parseLevelDefinition";
import type { LevelDefinition } from "@/game/levels/LevelDefinition";

/** Loads a level stored as a public JSON asset. */
export async function loadLevel(
  url: string,
  request: typeof fetch = fetch,
): Promise<LevelDefinition> {
  const response = await request(url);

  if (!response.ok) {
    throw new Error(`Could not load level from ${url} (HTTP ${response.status})`);
  }

  const serializedLevel: unknown = await response.json();
  return parseLevelDefinition(serializedLevel);
}

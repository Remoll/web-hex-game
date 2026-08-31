import { initGameApp } from "@/app/gameApp/initGameApp";
import { loadLevel } from "@/app/gameApp/loadLevel";
import { CampaignSession } from "@/game/campaign/CampaignSession";
import { createExampleCampaign } from "@/game/campaign/createExampleCampaign";
import "@/style.css";

async function startGame(): Promise<void> {
  try {
    const [level, towerGroundLevel, towerUpperLevel, structureShowcaseLevel] = await Promise.all([
      loadLevel("/levels/example.json"),
      loadLevel("/levels/tower-ground.json"),
      loadLevel("/levels/tower-upper.json"),
      loadLevel("/levels/structure-showcase.json"),
    ]);
    initGameApp({
      campaign: new CampaignSession(
        createExampleCampaign(
          level,
          towerGroundLevel,
          towerUpperLevel,
          structureShowcaseLevel,
        ),
      ),
      container: document.body,
    });
  } catch (error) {
    console.error("Unable to start the game", error);
    document.body.textContent = "Unable to load the game level.";
  }
}

void startGame();

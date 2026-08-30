import { initGameApp } from "@/app/gameApp/initGameApp";
import { loadLevel } from "@/app/gameApp/loadLevel";
import { CampaignSession } from "@/game/campaign/CampaignSession";
import { createExampleCampaign } from "@/game/campaign/createExampleCampaign";
import "@/style.css";

async function startGame(): Promise<void> {
  try {
    const [level, towerGroundLevel] = await Promise.all([
      loadLevel("/levels/example.json"),
      loadLevel("/levels/tower-ground.json"),
    ]);
    initGameApp({
      campaign: new CampaignSession(createExampleCampaign(level, towerGroundLevel)),
      container: document.body,
    });
  } catch (error) {
    console.error("Unable to start the game", error);
    document.body.textContent = "Unable to load the game level.";
  }
}

void startGame();

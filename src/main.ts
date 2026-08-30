import { initGameApp } from "@/app/gameApp/initGameApp";
import { loadLevel } from "@/app/gameApp/loadLevel";
import { CampaignSession } from "@/game/campaign/CampaignSession";
import { createExampleCampaign } from "@/game/campaign/createExampleCampaign";
import "@/style.css";

async function startGame(): Promise<void> {
  try {
    const level = await loadLevel("/levels/example.json");
    initGameApp({
      campaign: new CampaignSession(createExampleCampaign(level)),
      container: document.body,
    });
  } catch (error) {
    console.error("Unable to start the game", error);
    document.body.textContent = "Unable to load the game level.";
  }
}

void startGame();

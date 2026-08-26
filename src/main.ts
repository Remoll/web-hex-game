import { initGameApp } from "@/app/gameApp/initGameApp";
import { loadLevel } from "@/app/gameApp/loadLevel";
import "@/style.css";

async function startGame(): Promise<void> {
  try {
    const level = await loadLevel("/levels/example.json");
    initGameApp({ level, container: document.body });
  } catch (error) {
    console.error("Unable to start the game", error);
    document.body.textContent = "Unable to load the game level.";
  }
}

void startGame();

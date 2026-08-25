import { GameApp, type GameAppOptions } from "@/app/gameApp/GameApp";

export function initGameApp(options: GameAppOptions): GameApp {
  return new GameApp(options);
}

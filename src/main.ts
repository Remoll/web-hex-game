import { initGameApp } from "@/app/gameApp/initGameApp";
import exampleMap from "@/game/levels/example.json";

initGameApp({ map: exampleMap, container: document.body });

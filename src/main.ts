import "./style.css";
import { Router } from "./router/Router";
import { StartScreen } from "./screens/StartScreen";
import { ControlsScreen } from "./screens/ControlsScreen";
import { RecordsScreen } from "./screens/RecordsScreen";
import { GameScreen } from "./screens/GameScreen";

const app = document.querySelector<HTMLDivElement>("#app")!;
const router = new Router(app);

router.register("start", () => new StartScreen(router));
router.register("controls", () => new ControlsScreen(router));
router.register("records", () => new RecordsScreen(router));
router.register("game", () => new GameScreen(router));

router.go("start");

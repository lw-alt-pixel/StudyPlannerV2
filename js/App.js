// js/App.js
import { store } from './State.js';
import { uiManager } from './UIManager.js';
import { timerUI } from './TimerUI.js';
import { themeManager } from './ThemeManager.js';
import { canvasUI } from './CanvasUI.js'; // <-- NEW

console.log("🚀 App.js is connected!");

// Start the Managers
uiManager.init();
timerUI.init();
themeManager.init();
canvasUI.init(); // <-- NEW: Start the Infinite Canvas

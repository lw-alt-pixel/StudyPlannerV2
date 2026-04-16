// js/App.js
import { store } from './State.js';
import { uiManager } from './UIManager.js';
import { timerUI } from './TimerUI.js'; // <-- NEW

console.log("🚀 App.js is connected!");

// Start the Managers
uiManager.init();
timerUI.init(); // <-- NEW: Start listening for timer events

// js/App.js
import { store } from './State.js';
import { uiManager } from './UIManager.js';
import { timerUI } from './TimerUI.js';
import { themeManager } from './ThemeManager.js'; // <-- NEW

console.log("🚀 App.js is connected!");

// Start the Managers
uiManager.init();
timerUI.init();
themeManager.init(); // <-- NEW: Start the Stylist

// Let's test the ThemeManager by changing the color after 2 seconds!
setTimeout(() => {
    store.update('theme', t => ({ ...t, appBgColor: '#e0e7ff' })); // Changes to a soft indigo
}, 2000);

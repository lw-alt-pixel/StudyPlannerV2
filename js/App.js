import { store } from './State.js';
import { uiManager } from './UIManager.js';
import { timerUI } from './TimerUI.js';
import { themeManager } from './ThemeManager.js';
import { canvasUI } from './CanvasUI.js';
import { blockManager } from './BlockManager.js'; 
import { statsUI } from './StatsUI.js'; 

document.addEventListener('DOMContentLoaded', () => {
    uiManager.init();
    timerUI.init();
    themeManager.init();
    canvasUI.init();
    blockManager.init(); 
    statsUI.init(); 
});

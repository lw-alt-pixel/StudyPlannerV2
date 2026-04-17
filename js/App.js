// js/App.js
import { store } from './State.js';
import { uiManager } from './UIManager.js';
import { timerUI } from './TimerUI.js';
import { themeManager } from './ThemeManager.js';
import { canvasUI } from './CanvasUI.js';
import { blockManager } from './BlockManager.js'; 
import { statsUI } from './StatsUI.js'; 
import { examManager } from './ExamManager.js';
import { settingsManager } from './SettingsManager.js'; // NEW
import { floatingWidgetManager } from './FloatingWidgetManager.js'; // NEW

document.addEventListener('DOMContentLoaded', () => {
    uiManager.init();
    timerUI.init();
    themeManager.init();
    canvasUI.init();
    blockManager.init(); 
    statsUI.init(); 
    examManager.init();
    settingsManager.init(); // NEW
    floatingWidgetManager.init(); // NEW
});

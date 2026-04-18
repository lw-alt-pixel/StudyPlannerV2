// js/App.js
import { store, audioDB } from './State.js';
import { uiManager } from './UIManager.js';
import { timerUI } from './TimerUI.js';
import { themeManager } from './ThemeManager.js';
import { canvasUI } from './CanvasUI.js';
import { blockManager } from './BlockManager.js'; 
import { statsUI } from './StatsUI.js'; 
import { examManager } from './ExamManager.js';
import { settingsManager } from './SettingsManager.js';
import { floatingWidgetManager } from './FloatingWidgetManager.js';
import { audioEngine } from './AudioEngine.js'; 
import { marathonEngine } from './MarathonEngine.js'; 

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Init Audio Database for Custom MP3s
    try { if(audioDB) await audioDB.init(); } catch (e) { console.warn("Audio DB init failed", e); }

    // 2. Safe Bootloader (Prevents chain-reaction crashes)
    const safeInit = (module, name) => {
        if (!module) return;
        try { 
            if (typeof module.init === 'function') module.init(); 
            console.log(`✅ ${name} loaded.`);
        } catch(e) { 
            console.error(`❌ Fatal Error in ${name}:`, e); 
        }
    };

    // 3. Boot True Engines
    safeInit(uiManager, 'UIManager');
    safeInit(themeManager, 'ThemeManager');
    safeInit(audioEngine, 'AudioEngine');
    safeInit(settingsManager, 'SettingsManager');
    safeInit(timerUI, 'TimerUI');
    safeInit(canvasUI, 'CanvasUI');
    safeInit(blockManager, 'BlockManager');
    safeInit(statsUI, 'StatsUI');
    safeInit(examManager, 'ExamManager');
    safeInit(floatingWidgetManager, 'FloatingWidgetManager');
    safeInit(marathonEngine, 'MarathonEngine');
});

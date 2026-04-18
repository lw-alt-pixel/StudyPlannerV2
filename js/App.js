// js/App.js
import { store, audioDB } from './State.js';
import { audioEngine } from './AudioEngine.js';
import { timerEngine } from './TimerEngine.js';
import { settingsManager } from './SettingsManager.js';
import { timerUI } from './TimerUI.js';
import { canvasUI } from './CanvasUI.js';
import { calendarUI } from './CalendarUI.js';
import { analyticsUI } from './AnalyticsUI.js';

// Attempt dynamic imports for optional managers to prevent crash if they were renamed
let blockManager, examManager, marathonEngine;
try { blockManager = (await import('./BlockManager.js')).blockManager; } catch(e){}
try { examManager = (await import('./ExamManager.js')).examManager; } catch(e){}
try { marathonEngine = (await import('./MarathonEngine.js')).marathonEngine; } catch(e){}

document.addEventListener('DOMContentLoaded', async () => {
    
    // 1. Init Audio Database
    try { if(audioDB) await audioDB.init(); } catch (e) { console.warn("Audio DB init failed", e); }

    // 2. Safe Initialization Function (Prevents app-wide crashes)
    const safeInit = (module, name) => {
        if (!module) return;
        try { 
            if (typeof module.init === 'function') module.init(); 
            console.log(`✅ ${name} loaded.`);
        } catch(e) { 
            console.error(`❌ Fatal Error in ${name}:`, e); 
        }
    };

    // 3. Boot Engines
    safeInit(audioEngine, 'AudioEngine');
    safeInit(settingsManager, 'SettingsManager');
    safeInit(timerUI, 'TimerUI');
    safeInit(canvasUI, 'CanvasUI');
    safeInit(calendarUI, 'CalendarUI');
    safeInit(analyticsUI, 'AnalyticsUI');
    
    safeInit(blockManager, 'BlockManager');
    safeInit(examManager, 'ExamManager');
    safeInit(marathonEngine, 'MarathonEngine');

    // 4. Robust Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab');
            if (!targetId) return;

            // Toggle Button Styles
            tabBtns.forEach(b => {
                b.classList.remove('text-blue-600', 'border-blue-600');
                b.classList.add('text-gray-400', 'border-transparent');
            });
            btn.classList.add('text-blue-600', 'border-blue-600');
            btn.classList.remove('text-gray-400', 'border-transparent');

            // Toggle Content Visibility
            tabContents.forEach(content => {
                if (content.id === targetId) {
                    content.classList.remove('hidden');
                } else {
                    content.classList.add('hidden');
                }
            });

            // Refresh specific canvas bounds when opened
            if (targetId === 'canvas' && canvasUI) canvasUI.updateTransform();
        });
    });

    // 5. Global Fallback Bindings
    document.getElementById('loginTabBtn')?.addEventListener('click', () => {
        document.getElementById('loginModal')?.classList.remove('hidden');
    });
    document.getElementById('closeLoginModal')?.addEventListener('click', () => {
        document.getElementById('loginModal')?.classList.add('hidden');
    });
    
    document.getElementById('fallbackSettingsBtn')?.addEventListener('click', () => {
        document.getElementById('settingsPanel')?.classList.remove('translate-x-full');
        document.getElementById('settingsOverlay')?.classList.remove('hidden');
    });
});

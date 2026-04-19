// js/App.js
import { adminUI } from './AdminUI.js';
import { store, audioDB } from './State.js';
import { uiManager } from './UIManager.js';
import { timerUI } from './TimerUI.js';
import { themeManager } from './ThemeManager.js';
import { canvasUI } from './CanvasUI.js';
import { calendarUI } from './CalendarUI.js'; // 🚨 NEW IMPORT!
import { blockManager } from './BlockManager.js'; 
import { statsUI } from './StatsUI.js'; 
import { examManager } from './ExamManager.js';
import { settingsManager } from './SettingsManager.js';
import { floatingWidgetManager } from './FloatingWidgetManager.js';
import { audioEngine } from './AudioEngine.js'; 
import { marathonEngine } from './MarathonEngine.js'; 

document.addEventListener('DOMContentLoaded', async () => {
    try { if(audioDB) await audioDB.init(); } catch (e) { console.warn("Audio DB init failed", e); }

    uiManager.init();
    timerUI.init();
    themeManager.init();
    canvasUI.init();
    calendarUI.init(); // 🚨 NEW INIT!
    blockManager.init(); 
    statsUI.init(); 
    examManager.init();
    settingsManager.init(); 
    floatingWidgetManager.init();
    audioEngine.init(); 
    marathonEngine.init();
    // 🚨 GLOBAL ADMIN & SECURITY BOUNCER
    store.subscribe('userProfile', (profile) => {
        if (!profile) return;

        // 1. Check for Ban Hammer
        if (profile.status === 'suspended') {
            document.getElementById('bannedOverlay')?.classList.remove('hidden');
            document.getElementById('bannedOverlay')?.classList.add('flex');
            // Disable interactions
            document.body.style.pointerEvents = 'none';
            document.getElementById('bannedOverlay').style.pointerEvents = 'auto';
            return;
        } else {
            document.getElementById('bannedOverlay')?.classList.add('hidden');
            document.getElementById('bannedOverlay')?.classList.remove('flex');
            document.body.style.pointerEvents = 'auto';
        }

        // 2. Check for God Mode (Admin)
        // REPLACE WITH YOUR ACTUAL EMAIL!
        const adminEmail = "luke.wong.1120@gmail.com"; 
        
        if (profile.email === adminEmail) {
            document.getElementById('openAdminDashboardBtn')?.classList.remove('hidden');
        } else {
            document.getElementById('openAdminDashboardBtn')?.classList.add('hidden');
        }
    });
    // 🚨 GLOBAL BROADCAST BANNER CONTROLLER
    store.subscribe('broadcast', (broadcastData) => {
        const banner = document.getElementById('globalBroadcastBanner');
        const textEl = document.getElementById('globalBroadcastText');
        
        if (!banner || !textEl) return;

        // If there is an active broadcast, slide it down
        if (broadcastData && broadcastData.active && broadcastData.message) {
            textEl.innerText = broadcastData.message;
            banner.classList.remove('hidden');
            
            // Small delay to allow display:block to render before transitioning transform
            setTimeout(() => {
                banner.classList.remove('-translate-y-full');
            }, 50);
            
            // Adjust the app header down so the banner doesn't cover the title
            document.getElementById('appHeader').style.marginTop = '40px';
        } else {
            // Hide it
            banner.classList.add('-translate-y-full');
            setTimeout(() => {
                banner.classList.add('hidden');
            }, 300); // Wait for transition to finish
            
            document.getElementById('appHeader').style.marginTop = '0px';
        }
    });

    // 🚨 FIX 3: Universal "Click Outside to Close Modal" Listener
    document.addEventListener('click', (e) => {
        // If the user clicks exactly on the dark background overlay wrapper...
        if (e.target.classList.contains('bg-gray-900/50') || e.target.classList.contains('bg-gray-900/60')) {
            e.target.classList.add('hidden'); // Hide the modal!
        }
    });
});

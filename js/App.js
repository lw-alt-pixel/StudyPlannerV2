// js/App.js
// Add these to your top imports in App.js:
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { adminUI } from './AdminUI.js';
import { db, store, audioDB } from './State.js';
import { uiManager } from './UIManager.js';
import { timerUI } from './TimerUI.js';
import { themeManager } from './ThemeManager.js';
import { canvasUI } from './CanvasUI.js';
import { calendarUI } from './CalendarUI.js'; 
import { blockManager } from './BlockManager.js'; 
import { statsUI } from './StatsUI.js'; 
import { examManager } from './ExamManager.js';
import { settingsManager } from './SettingsManager.js';
import { floatingWidgetManager } from './FloatingWidgetManager.js';
import { audioEngine } from './AudioEngine.js'; 
import { marathonEngine } from './MarathonEngine.js'; 
import { goalManager } from './GoalManager.js';

document.addEventListener('DOMContentLoaded', async () => {
    try { if(audioDB) await audioDB.init(); } catch (e) { console.warn("Audio DB init failed", e); }

    uiManager.init();
    timerUI.init();
    themeManager.init();
    canvasUI.init();
    calendarUI.init(); 
    blockManager.init(); 
    statsUI.init(); 
    examManager.init();
    settingsManager.init(); 
    floatingWidgetManager.init();
    audioEngine.init(); 
    marathonEngine.init();
    adminUI.init();
    goalManager.init(); // 🚨 BOOT UP THE GOAL ENGINE!
// 🚨 REAL-TIME GLOBAL BROADCAST LISTENER
    const broadcastRef = doc(db, 'server', 'broadcast');
    let broadcastExpiryTimer = null;

    onSnapshot(broadcastRef, (snap) => {
        const banner = document.getElementById('globalBroadcastBanner');
        const minIcon = document.getElementById('minimizedBroadcastIcon');
        const textEl = document.getElementById('globalBroadcastText');
        
        if (!banner || !minIcon || !textEl) return;

        if (snap.exists()) {
            const data = snap.data();
            const now = Date.now();
            
            if (data.message && (!data.expiryTime || data.expiryTime > now)) {
                // Active Broadcast Detected!
                textEl.innerText = data.message;
                
                // Show banner, hide minimized icon
                banner.classList.remove('hidden', '-translate-y-full');
                banner.classList.add('translate-y-0');
                minIcon.classList.add('hidden');
                
                // Handle Auto-Expiry Timer
                if (broadcastExpiryTimer) clearTimeout(broadcastExpiryTimer);
                if (data.expiryTime) {
                    broadcastExpiryTimer = setTimeout(() => {
                        banner.classList.remove('translate-y-0');
                        banner.classList.add('-translate-y-full');
                        minIcon.classList.add('hidden');
                    }, data.expiryTime - now);
                }
            } else {
                // Expired or cleared by Admin
                banner.classList.remove('translate-y-0');
                banner.classList.add('-translate-y-full');
                minIcon.classList.add('hidden');
            }
        }
    });

    // 🚨 BROADCAST MINIMIZE / MAXIMIZE LOGIC
    document.getElementById('minimizeBroadcastBtn')?.addEventListener('click', () => {
        const banner = document.getElementById('globalBroadcastBanner');
        const minIcon = document.getElementById('minimizedBroadcastIcon');
        banner.classList.remove('translate-y-0');
        banner.classList.add('-translate-y-full');
        setTimeout(() => minIcon.classList.remove('hidden'), 300); // Wait for slide animation
    });

    document.getElementById('minimizedBroadcastIcon')?.addEventListener('click', () => {
        const banner = document.getElementById('globalBroadcastBanner');
        const minIcon = document.getElementById('minimizedBroadcastIcon');
        minIcon.classList.add('hidden');
        banner.classList.remove('hidden', '-translate-y-full');
        banner.classList.add('translate-y-0');
    });
    // 🚨 UPDATE LOGS (WHAT'S NEW) CONTROLLER
    store.subscribe('updateLogs', (logs) => {
        if (!logs || logs.length === 0) return;
        
        const seenLogs = JSON.parse(localStorage.getItem('seenUpdateLogs') || '[]');
        const badge = document.getElementById('updateLogsBadge');
        
        // Check if there is any log the user hasn't seen yet
        const hasUnseen = logs.some(log => !seenLogs.includes(log.id));
        if (hasUnseen && badge) {
            badge.classList.remove('hidden');
        } else if (badge) {
            badge.classList.add('hidden');
        }

        // Render the modal list
        const container = document.getElementById('updateLogsListContainer');
        if (container) {
            container.innerHTML = '';
            logs.forEach(log => {
                const dateStr = new Date(log.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                container.innerHTML += `
                    <div class="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
                        <div class="flex justify-between items-start mb-3">
                            <h3 class="text-lg font-black text-gray-800 leading-tight">${log.title}</h3>
                            <span class="text-[10px] font-black text-teal-600 bg-teal-50 px-2 py-1 rounded-full uppercase tracking-widest whitespace-nowrap ml-3">${dateStr}</span>
                        </div>
                        <p class="text-sm text-gray-600 font-medium whitespace-pre-wrap">${log.message}</p>
                    </div>
                `;
            });
        }
    });

    document.getElementById('openUpdateLogsBtn')?.addEventListener('click', () => {
        document.getElementById('updateLogsModal')?.classList.remove('hidden');
        document.getElementById('updateLogsModal')?.classList.add('flex');
        
        // Mark all as seen!
        const logs = store.state.updateLogs || [];
        const ids = logs.map(l => l.id);
        localStorage.setItem('seenUpdateLogs', JSON.stringify(ids));
        document.getElementById('updateLogsBadge')?.classList.add('hidden');
    });

    document.getElementById('closeUpdateLogsModalBtn')?.addEventListener('click', () => {
        document.getElementById('updateLogsModal')?.classList.remove('flex');
        document.getElementById('updateLogsModal')?.classList.add('hidden');
    });

   // 🚨 GLOBAL ADMIN & SECURITY BOUNCER
    store.subscribe('userProfile', (profile) => {
        if (!profile) return;

        // Check if timed ban expired
        let currentStatus = profile.status;
        if (profile.banUntil && new Date(profile.banUntil) < new Date()) {
            currentStatus = 'active'; // Ban expired naturally!
        }

        // 1. Check for Full Suspension
        if (currentStatus === 'suspended') {
            document.getElementById('bannedOverlay')?.classList.remove('hidden');
            document.getElementById('bannedOverlay')?.classList.add('flex');
            document.body.style.pointerEvents = 'none';
            document.getElementById('bannedOverlay').style.pointerEvents = 'auto';
            return;
        } else {
            document.getElementById('bannedOverlay')?.classList.add('hidden');
            document.getElementById('bannedOverlay')?.classList.remove('flex');
            document.body.style.pointerEvents = 'auto';
        }

        // 2. Check for Read-Only Mode
        if (currentStatus === 'readonly') {
            let roStyle = document.getElementById('readonly-css');
            if (!roStyle) {
                roStyle = document.createElement('style');
                roStyle.id = 'readonly-css';
                // This CSS physically hides all edit/delete buttons while keeping the Timer usable
                roStyle.innerHTML = `
                    #openAddBlockModal, .delete-row-btn, #saveEditBlock,
                    #createNewGoalBtn, .fa-trash, .fa-times, #pushBackTimerBtn,
                    #openExamModalBtn, #openMarathonModalBtn {
                        display: none !important;
                    }
                `;
                document.head.appendChild(roStyle);
                setTimeout(() => alert("⚠️ Your account is restricted to Read-Only Mode due to a violation. You can study existing blocks but cannot create new ones."), 500);
            }
        } else {
            document.getElementById('readonly-css')?.remove();
        }

        // 3. Admin Immunity Check
        // 🚨 REPLACE THIS WITH YOUR ACTUAL ADMIN EMAIL!!
        const MASTER_ADMIN_EMAIL = "luke.wong.1120@gmail.com"; 
        
        if (profile.email === MASTER_ADMIN_EMAIL) {
            document.getElementById('openAdminDashboardBtn')?.classList.remove('hidden');
        } else {
            document.getElementById('openAdminDashboardBtn')?.classList.add('hidden');
        }
    });
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('bg-gray-900/50') || e.target.classList.contains('bg-gray-900/60')) {
            e.target.classList.add('hidden'); 
        }
    });
});

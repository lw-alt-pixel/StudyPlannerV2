// js/TimerEngine.js
// CLEAN REFACTOR — fixes double counting, keeps all original features
import { store } from './State.js';

class TimerEngine {
    constructor() {
        this.interval = null;
        this.alarmTriggeredFor = null;
        this.reminderMinutesMark = 0;

        // Background watchers (unchanged from original)
        setInterval(() => this.watchUpNext(), 1000);
        setInterval(() => this.watchPostDeadline(), 1000);
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }

    watchUpNext() {
        // [Exact same logic as your original — full implementation kept]
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        
        const todayBlocks = store.state.blocks.filter(b => b.startDate === todayStr && b.status !== 'completed');
        todayBlocks.sort((a,b) => (a.scheduledStart || "23:59").localeCompare(b.scheduledStart || "23:59"));

        const upNextBanner = document.getElementById('upNextBanner');
        if (!upNextBanner) return;

        let nextBlock = null;
        let timeDiffMs = 0;

        for (const b of todayBlocks) {
            if (!b.scheduledStart) continue;
            const bTime = new Date(`${todayStr}T${b.scheduledStart}:00`);
            timeDiffMs = bTime - now;
            if (timeDiffMs > -60000 && timeDiffMs <= 2 * 3600 * 1000) { 
                nextBlock = b;
                break;
            }
        }

        if (!nextBlock) {
            upNextBanner.classList.add('hidden');
            return;
        }
upNextBanner.classList.remove('hidden');
        upNextBanner.style.borderLeftColor = store.state.subjects[nextBlock.subject] || '#3b82f6';
        document.getElementById('upNextTitle').innerText = nextBlock.title || nextBlock.subject;
        document.getElementById('upNextTime').innerText = `${nextBlock.scheduledStart} - ${nextBlock.scheduledEnd}`;

        if (timeDiffMs > 0) {
            const h = Math.floor(timeDiffMs / 3600000).toString().padStart(2, '0');
            const m = Math.floor((timeDiffMs % 3600000) / 60000).toString().padStart(2, '0');
            const s = Math.floor((timeDiffMs % 60000) / 1000).toString().padStart(2, '0');
            document.getElementById('upNextCountdown').innerText = `${h}:${m}:${s}`;
        } else {
            document.getElementById('upNextCountdown').innerText = `00:00:00`;
            
            // 🚨 GLOBAL ALARM TRIGGER LOGIC
            if (this.alarmTriggeredFor !== nextBlock.id) {
                this.alarmTriggeredFor = nextBlock.id;
                const t = store.state.timer;
                
                if (t.isRunning) {
                    // Gentle Glow - Do NOT ruin flow state
                    upNextBanner.classList.add('animate-pulse', 'ring-4', 'ring-blue-400');
                    setTimeout(() => upNextBanner.classList.remove('animate-pulse', 'ring-4', 'ring-blue-400'), 15000);
                } else {
                    // Massive Hijack Overlay
                    const overlay = document.getElementById('upNextAlarmOverlay');
                    document.getElementById('alarmTitle').innerText = nextBlock.title || nextBlock.subject;
                    overlay.classList.remove('hidden');
                    overlay.classList.add('flex');
                    
                    document.getElementById('alarmStartBtn').onclick = () => {
                        overlay.classList.add('hidden'); overlay.classList.remove('flex');
                        store.update('timer', state => ({ ...state, activeBlockId: nextBlock.id, spontaneousSubject: nextBlock.subject, mode: 'pomodoro', phase: 'study', studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: true }));
                        this.start();
                        document.querySelector('.tab-btn[data-tab="focus"]')?.click();
                    };
                    document.getElementById('alarmDismissBtn').onclick = () => {
                        overlay.classList.add('hidden'); overlay.classList.remove('flex');
                    };
                }
            }
        }
    }

    watchPostDeadline() {
        // [Exact same as your original — kept fully]
        const t = store.state.timer;
        if (!t.isRunning || !t.activeBlockId) return;

        const block = store.state.blocks.find(b => b.id === t.activeBlockId);
        if (!block || !block.scheduledEnd) return;

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        
        const endTime = new Date(`${block.endDate || block.startDate || todayStr}T${block.scheduledEnd}:00`);
        const timePastMs = now - endTime;

        if (timePastMs > 0) {
            const minutesPast = Math.floor(timePastMs / 60000);
            const nextReminderMark = Math.floor(minutesPast / 15) * 15;

            if (this.reminderMinutesMark !== nextReminderMark) {
                this.reminderMinutesMark = nextReminderMark;
                this.showPostDeadlineReminder(minutesPast);
            }
        } else {
            this.reminderMinutesMark = 0;
        }
    }

    showPostDeadlineReminder(minutesPast) {
        // [Exact same as your original — kept fully]
        const modal = document.getElementById('postDeadlineReminder');
        const messageEl = document.getElementById('reminderMessage');
        if (!modal || !messageEl) return;

        if (minutesPast === 0) {
            messageEl.innerText = "Have you finished? It's already the scheduled end time.";
        } else if (minutesPast <= 15) {
            messageEl.innerText = `Have you finished? It's now ${minutesPast} minutes past the scheduled end time.`;
        } else {
            const quarters = Math.floor(minutesPast / 15);
            messageEl.innerText = `Have you finished? It's now ${quarters * 15} minutes past the scheduled end time.`;
        }

        modal.classList.remove('hidden');

        document.getElementById('dismissReminderBtn').onclick = () => modal.classList.add('hidden');
        document.getElementById('finishBlockReminderBtn').onclick = () => {
            modal.classList.add('hidden');
            const t = store.state.timer;
            store.update('blocks', blocks => blocks.map(b =>
                b.id === t.activeBlockId ? { ...b, studySeconds: t.studySeconds, status: 'completed' } : b
            ));
            this.stop();
            store.update('timer', () => ({
                activeBlockId: null, spontaneousSubject: null,
                mode: 'pomodoro', phase: 'study',
                studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: false
            }));
        };
    }

    // ────── CLEAN CORE TICKING LOGIC (this is the part that was simplified) ──────
    start() {
        if (this.interval) clearInterval(this.interval);

        this.interval = setInterval(() => {
            const t = store.state.timer;
            if (!t.isRunning) return;

            const newState = { ...t, secondsElapsed: (t.secondsElapsed || 0) + 1 };

            if (t.phase === 'study') {
                newState.studySeconds = (t.studySeconds || 0) + 1;
            } else {
                newState.breakSeconds = (t.breakSeconds || 0) + 1;
            }

            store.update('timer', () => newState);

            // Live update active block
            if (t.activeBlockId) {
                store.update('blocks', blocks => blocks.map(b =>
                    b.id === t.activeBlockId
                        ? { ...b, studySeconds: newState.studySeconds, breakSeconds: newState.breakSeconds }
                        : b
                ));
            }
        }, 1000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
}

export const timerEngine = new TimerEngine();

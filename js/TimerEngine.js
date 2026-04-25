// js/TimerEngine.js
import { store } from './State.js';

class TimerEngine {
    constructor() {
        this.interval = null;
        this.alarmTriggeredFor = null;
        this.reminderMinutesMark = 0;
        
        // 🚨 NEW: Keeps track of exact system time
        this.lastTickTime = 0; 

        setInterval(() => this.watchUpNext(), 1000);
        setInterval(() => this.watchPostDeadline(), 1000);
    }

    getChinaTime() { 
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); 
    }

    watchUpNext() {
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
            
            if (this.alarmTriggeredFor !== nextBlock.id) {
                this.alarmTriggeredFor = nextBlock.id;
                const t = store.state.timer;
                
                if (t.isRunning) {
                    upNextBanner.classList.add('animate-pulse', 'ring-4', 'ring-blue-400');
                    setTimeout(() => upNextBanner.classList.remove('animate-pulse', 'ring-4', 'ring-blue-400'), 15000);
                } else {
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

   start() {
        if (this.interval) clearInterval(this.interval);

        const pStudySec = (store.state.settings.pStudy || 25) * 60;
        const pBreakSec = (store.state.settings.pBreak || 5) * 60;

        // 🚨 Sync the engine to the exact millisecond the user clicked "Start"
        this.lastTickTime = Date.now(); 

        // 🚨 Run 4 times a second. This ensures the UI snaps exactly on the second rollover!
        this.interval = setInterval(() => {
            const t = store.state.timer;
            if (!t.isRunning) return;

            const now = Date.now();
            const deltaMs = now - this.lastTickTime;

            // Wait until exactly 1 full real-world second has passed
            if (deltaMs >= 1000) {
                // Calculate EXACTLY how many seconds passed. 
                // If the browser tab went to sleep, this will instantly catch up! (e.g., 15 seconds)
                const secondsPassed = Math.floor(deltaMs / 1000);
                
                // Move our system clock reference forward
                this.lastTickTime += (secondsPassed * 1000); 

                const newState = { ...t, secondsElapsed: (t.secondsElapsed || 0) + secondsPassed };

                if (t.phase === 'study') {
                    const oldSecs = t.studySeconds || 0;
                    newState.studySeconds = oldSecs + secondsPassed;
                    
                    // SEAMLESS HYBRID: Calculate if we crossed a Pomodoro boundary
                    const oldCycles = Math.floor(oldSecs / pStudySec);
                    const newCycles = Math.floor(newState.studySeconds / pStudySec);

                    if (t.mode === 'pomodoro' && newCycles > oldCycles) {
                        newState.phase = 'break'; 
                        if(this.playTransitionChime) this.playTransitionChime();
                    }
                } else {
                    const oldSecs = t.breakSeconds || 0;
                    newState.breakSeconds = oldSecs + secondsPassed;
                    
                    const oldCycles = Math.floor(oldSecs / pBreakSec);
                    const newCycles = Math.floor(newState.breakSeconds / pBreakSec);

                    if (t.mode === 'pomodoro' && newCycles > oldCycles) {
                        newState.phase = 'study'; 
                        if(this.playTransitionChime) this.playTransitionChime();
                    }
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
            }
        }, 250); 
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    playTransitionChime() {
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(600, audioCtx.currentTime);
            gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
            osc.connect(gain).connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 1);
        } catch(e) {}
    }
}

export const timerEngine = new TimerEngine();

// js/TimerEngine.js
import { store } from './State.js';

class TimerEngine {
    constructor() {
        this.interval = null;
        this.alarmTriggeredFor = null; // Prevents the alarm from spamming
        // 🚨 Start the intelligent background scanner immediately
        setInterval(() => this.watchUpNext(), 1000); 
    }

    watchUpNext() {
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
        
        // Scan today's blocks and sort them chronologically
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
            
            // If the block is within 2 hours, OR it started within the last 59 seconds
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

    start() {
        if (this.interval) clearInterval(this.interval);
        
        this.interval = setInterval(() => {
            const t = store.state.timer;
            const sSettings = store.state.settings;
            if (!t.isRunning) return; 
            
            const s = t.studySeconds || 0;
            const b = t.breakSeconds || 0;
            const e = t.secondsElapsed || 0;
            
            let newPhase = t.phase;
            let newS = t.phase === 'study' ? s + 1 : s;
            let newB = t.phase === 'break' ? b + 1 : b;

            if (t.mode === 'pomodoro') {
                const pStudySecs = (sSettings.pStudy || 25) * 60;
                const pBreakSecs = (sSettings.pBreak || 5) * 60;

                if (t.phase === 'study' && newS > 0 && newS % pStudySecs === 0) {
                    newPhase = 'break';
                    this.playTransitionChime();
                } else if (t.phase === 'break' && newB > 0 && newB % pBreakSecs === 0) {
                    newPhase = 'study';
                    this.playTransitionChime();
                }
            }
            
            const newTimerState = {
                ...t,
                phase: newPhase,
                studySeconds: newS,
                breakSeconds: newB,
                secondsElapsed: e + 1
            };
            
            store.update('timer', () => newTimerState);

            if (t.activeBlockId) {
                store.update('blocks', blocks => blocks.map(block => 
                    block.id === t.activeBlockId 
                        ? { ...block, studySeconds: newS, breakSeconds: newB }
                        : block
                ));
            }
        }, 1000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }

    playTransitionChime() {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator(); 
        const gain = audioCtx.createGain();
        osc.type = 'bell';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(); osc.stop(audioCtx.currentTime + 1);
    }
}
export const timerEngine = new TimerEngine();

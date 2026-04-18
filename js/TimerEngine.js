// js/TimerEngine.js
import { store } from './State.js';

class TimerEngine {
    constructor() {
        this.interval = null;
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

            // 🚨 POMODORO AUTO-SWITCH ENGINE (IGNORED IN STOPWATCH MODE)
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

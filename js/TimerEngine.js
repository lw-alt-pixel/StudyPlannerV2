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
            if (!t.isRunning) return; // Safety check
            
            // 1. Calculate new time safely (fallback to 0 so we never get NaN)
            const s = t.studySeconds || 0;
            const b = t.breakSeconds || 0;
            const e = t.secondsElapsed || 0;
            
            const newTimerState = {
                ...t,
                studySeconds: t.phase === 'study' ? s + 1 : s,
                breakSeconds: t.phase === 'break' ? b + 1 : b,
                secondsElapsed: e + 1
            };
            
            // 2. Update the Timer
            store.update('timer', () => newTimerState);

            // 3. LIVE SYNC: Automatically save this time to the active block so the canvas updates!
            if (t.activeBlockId) {
                store.update('blocks', blocks => blocks.map(block => 
                    block.id === t.activeBlockId 
                        ? { ...block, studySeconds: newTimerState.studySeconds, breakSeconds: newTimerState.breakSeconds }
                        : block
                ));
            }
        }, 1000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
    }
}

export const timerEngine = new TimerEngine();

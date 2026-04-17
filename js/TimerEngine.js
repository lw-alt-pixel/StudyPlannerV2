// js/TimerEngine.js
import { store } from './State.js';

class TimerEngine {
    constructor() {
        this.interval = null;
    }

    start() {
        // Prevent multiple intervals running at once (fixing old bugs!)
        if (this.interval) clearInterval(this.interval);
        
        // Tell the Brain the timer is running
        store.update('timer', t => ({ ...t, activeType: 'RUNNING' }));

        // Start the heartbeat
        this.interval = setInterval(() => {
            store.update('timer', t => ({
                ...t,
                secondsElapsed: t.secondsElapsed + 1
            }));
        }, 1000);
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        store.update('timer', t => ({ ...t, activeType: null }));
    }
}

export const timerEngine = new TimerEngine();


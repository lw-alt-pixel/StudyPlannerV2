// js/TimerUI.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';

class TimerUI {
    init() {
        this.bindEvents();

        // Listen to the Brain! Whenever the timer ticks, update the screen.
        store.subscribe('timer', (timerState) => {
            this.render(timerState);
        });
    }

    bindEvents() {
        document.getElementById('startTimerBtn')?.addEventListener('click', () => {
            timerEngine.start();
        });

        document.getElementById('stopTimerBtn')?.addEventListener('click', () => {
            timerEngine.stop();
        });
    }

    render(timerState) {
        const display = document.getElementById('timerDisplay');
        if (!display) return;

        // Format seconds into MM:SS
        const m = Math.floor(timerState.secondsElapsed / 60).toString().padStart(2, '0');
        const s = (timerState.secondsElapsed % 60).toString().padStart(2, '0');
        
        display.textContent = `${m}:${s}`;
        
        // Optional: Change display color if running
        if (timerState.activeType === 'RUNNING') {
            display.classList.replace('text-gray-700', 'text-blue-600');
        } else {
            display.classList.replace('text-blue-600', 'text-gray-700');
        }
    }
}

export const timerUI = new TimerUI();

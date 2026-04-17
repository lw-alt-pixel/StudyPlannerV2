// js/TimerUI.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';

class TimerUI {
    constructor() {
        this.pStudy = 25 * 60; // 25 minutes
        this.pBreak = 5 * 60;  // 5 minutes
    }

    init() {
        this.display = document.getElementById('timerDisplay');
        this.toggleBtn = document.getElementById('toggleTimerBtn');
        this.switchPhaseBtn = document.getElementById('switchPhaseBtn');
        this.modeStopwatchBtn = document.getElementById('modeStopwatch');
        this.modePomodoroBtn = document.getElementById('modePomodoro');
        this.phaseIndicator = document.getElementById('phaseIndicator');

        if (!this.display) return;

        this.bindEvents();
        // Listen to Brain changes to update numbers
        store.subscribe('timer', () => this.updateUI());
        this.updateUI(); 
    }

    bindEvents() {
        this.toggleBtn.addEventListener('click', () => {
            const { isRunning } = store.state.timer;
            if (!isRunning) {
                store.update('timer', t => ({ ...t, isRunning: true }));
                timerEngine.start();
            } else {
                store.update('timer', t => ({ ...t, isRunning: false }));
                timerEngine.stop();
            }
        });

        this.switchPhaseBtn.addEventListener('click', () => {
            const { phase } = store.state.timer;
            store.update('timer', t => ({ ...t, phase: phase === 'study' ? 'break' : 'study' }));
        });

        this.modeStopwatchBtn.addEventListener('click', () => store.update('timer', t => ({ ...t, mode: 'stopwatch' })));
        this.modePomodoroBtn.addEventListener('click', () => store.update('timer', t => ({ ...t, mode: 'pomodoro' })));
    }

    updateUI() {
        // Fallback to 0 to completely prevent NaN math
        const { isRunning, mode, phase, studySeconds = 0, breakSeconds = 0, activeBlockId } = store.state.timer;

        this.phaseIndicator.innerText = phase === 'study' ? 'STUDY PHASE' : 'BREAK PHASE';
        this.phaseIndicator.className = phase === 'study' 
            ? 'absolute top-4 bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider'
            : 'absolute top-4 bg-green-100 text-green-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider';

        this.toggleBtn.innerText = isRunning ? 'PAUSE' : 'START';
        this.toggleBtn.className = isRunning 
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all'
            : 'bg-green-500 hover:bg-green-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all';

        // NEW: Fix the Take Break / Resume Study Button Text & Color
        this.switchPhaseBtn.innerText = phase === 'study' ? 'TAKE BREAK' : 'RESUME STUDY';
        this.switchPhaseBtn.className = phase === 'study'
            ? 'bg-indigo-500 hover:bg-indigo-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all'
            : 'bg-orange-500 hover:bg-orange-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all';

        let displaySeconds = 0;
        if (mode === 'stopwatch') {
            displaySeconds = phase === 'study' ? studySeconds : breakSeconds; 
        } else {
            if (phase === 'study') {
                displaySeconds = this.pStudy - (studySeconds % this.pStudy);
                if (displaySeconds === this.pStudy && studySeconds > 0) displaySeconds = 0;
            } else {
                displaySeconds = this.pBreak - (breakSeconds % this.pBreak);
                if (displaySeconds === this.pBreak && breakSeconds > 0) displaySeconds = 0;
            }
        }

        // FIX: The crash that made blocks disappear! Safely check if activeBlock exists.
        const titleEl = document.querySelector('#focus h2');
        if (titleEl) {
            if (activeBlockId) {
                const activeBlock = store.state.blocks.find(b => b.id === activeBlockId);
                titleEl.innerHTML = `🎯 Focus Mode: <span class="text-blue-600">${activeBlock ? activeBlock.title : 'Active Block'}</span>`;
            } else {
                titleEl.innerHTML = `🎯 Focus Mode: <span class="text-gray-400">No block active</span>`;
            }
        }

        // Format Time perfectly
        if (isNaN(displaySeconds) || displaySeconds < 0) displaySeconds = 0;
        const m = Math.floor(displaySeconds / 60).toString().padStart(2, '0');
        const s = (displaySeconds % 60).toString().padStart(2, '0');
        this.display.innerText = `${m}:${s}`;
    }
}

export const timerUI = new TimerUI();

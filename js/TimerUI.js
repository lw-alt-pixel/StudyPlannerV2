// js/TimerUI.js
import { store } from './State.js';

class TimerUI {
    constructor() {
        this.interval = null;
        this.pomodoroDuration = 25 * 60; 
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
        this.updateUI(); 

        // NEW: Save data to the block if the user accidentally closes the browser!
        window.addEventListener('beforeunload', () => this.saveTimeToBlock());
    }

    // NEW: Function to safely push the final time to the block
    saveTimeToBlock() {
        const { activeBlockId, studySeconds, breakSeconds } = store.state.timer;
        if (!activeBlockId) return;
        
        store.update('blocks', oldBlocks => {
            return oldBlocks.map(b => 
                b.id === activeBlockId ? { ...b, studySeconds, breakSeconds } : b
            );
        });
    }

    bindEvents() {
        this.toggleBtn.addEventListener('click', () => {
            const { isRunning } = store.state.timer;
            store.update('timer', t => ({ ...t, isRunning: !isRunning }));
            
            if (!isRunning) this.startTimer();
            else this.stopTimer();
        });

        this.switchPhaseBtn.addEventListener('click', () => {
            this.saveTimeToBlock(); // Save before switching!
            
            const { phase } = store.state.timer;
            const newPhase = phase === 'study' ? 'break' : 'study';
            
            store.update('timer', t => ({ 
                ...t, 
                phase: newPhase,
                studySeconds: newPhase === 'study' ? 0 : t.studySeconds, 
                breakSeconds: newPhase === 'break' ? 0 : t.breakSeconds,
                isRunning: false 
            }));
            
            this.stopTimer();
        });

        this.modeStopwatchBtn.addEventListener('click', () => {
            store.update('timer', t => ({ ...t, mode: 'stopwatch' }));
            this.updateUI();
        });
        
        this.modePomodoroBtn.addEventListener('click', () => {
            store.update('timer', t => ({ ...t, mode: 'pomodoro' }));
            this.updateUI();
        });
    }

    startTimer() {
        this.updateUI();
        
        this.interval = setInterval(() => {
            const { phase, mode, activeBlockId, studySeconds, breakSeconds } = store.state.timer;
            if (!activeBlockId) return;

            if (mode === 'pomodoro' && phase === 'study' && studySeconds >= this.pomodoroDuration) {
                this.stopTimer();
                store.update('timer', t => ({ ...t, isRunning: false }));
                alert("🎯 Pomodoro complete! Great focus. Time for a break.");
                return;
            }

            // ONLY update the internal Timer memory, NOT the global blocks array
            store.update('timer', t => ({
                ...t,
                studySeconds: phase === 'study' ? t.studySeconds + 1 : t.studySeconds,
                breakSeconds: phase === 'break' ? t.breakSeconds + 1 : t.breakSeconds
            }));
            
            this.updateUI();
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.interval);
        this.saveTimeToBlock(); // Save only when pausing!
        this.updateUI();
    }

    formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    updateUI() {
        const { mode, phase, studySeconds, breakSeconds, isRunning, activeBlockId } = store.state.timer;

        if (mode === 'stopwatch') {
            this.modeStopwatchBtn.className = 'px-4 py-1 rounded shadow bg-white text-gray-800 font-bold text-sm transition-all';
            this.modePomodoroBtn.className = 'px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:bg-gray-300';
        } else {
            this.modePomodoroBtn.className = 'px-4 py-1 rounded shadow bg-white text-gray-800 font-bold text-sm transition-all';
            this.modeStopwatchBtn.className = 'px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:bg-gray-300';
        }

        if (phase === 'study') {
            this.phaseIndicator.textContent = 'Study Phase';
            this.phaseIndicator.className = 'absolute top-4 bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider transition-colors';
            this.switchPhaseBtn.textContent = 'TAKE BREAK';
            this.switchPhaseBtn.className = 'bg-indigo-500 hover:bg-indigo-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all';
        } else {
            this.phaseIndicator.textContent = 'Break Phase';
            this.phaseIndicator.className = 'absolute top-4 bg-green-100 text-green-800 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider transition-colors';
            this.switchPhaseBtn.textContent = 'BACK TO WORK';
            this.switchPhaseBtn.className = 'bg-blue-500 hover:bg-blue-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all';
        }

        this.toggleBtn.textContent = isRunning ? 'PAUSE' : 'START';
        this.toggleBtn.className = isRunning 
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all'
            : 'bg-green-500 hover:bg-green-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all';

        let displaySeconds = 0;
        if (phase === 'break') {
            displaySeconds = breakSeconds; 
        } else {
            if (mode === 'stopwatch') displaySeconds = studySeconds;
            else displaySeconds = Math.max(0, this.pomodoroDuration - studySeconds); 
        }

        const activeBlock = store.state.blocks.find(b => b.id === activeBlockId);
        if (activeBlock) {
            const titleEl = document.querySelector('#focus h2');
            if (titleEl) titleEl.innerHTML = `🎯 Focus Mode: <span class="text-blue-600">${activeBlock.title}</span>`;
        }

        this.display.textContent = this.formatTime(displaySeconds);
    }
}

export const timerUI = new TimerUI();

// js/TimerUI.js
import { store } from './State.js';

class TimerUI {
    constructor() {
        this.interval = null;
        // 25 minutes in seconds for a standard Pomodoro
        this.pomodoroDuration = 25 * 60; 
    }

    init() {
        // Grab all our UI elements from the HTML
        this.display = document.getElementById('timerDisplay');
        this.toggleBtn = document.getElementById('toggleTimerBtn');
        this.switchPhaseBtn = document.getElementById('switchPhaseBtn');
        this.modeStopwatchBtn = document.getElementById('modeStopwatch');
        this.modePomodoroBtn = document.getElementById('modePomodoro');
        this.phaseIndicator = document.getElementById('phaseIndicator');

        if (!this.display) return;

        this.bindEvents();
        this.updateUI(); // Run once to set the initial colors and numbers
    }

    bindEvents() {
        // 1. START / PAUSE Button
        this.toggleBtn.addEventListener('click', () => {
            const { isRunning } = store.state.timer;
            store.update('timer', t => ({ ...t, isRunning: !isRunning }));
            
            if (!isRunning) {
                this.startTimer();
            } else {
                this.stopTimer();
            }
        });

        // 2. SWITCH PHASE (Study <--> Break)
        this.switchPhaseBtn.addEventListener('click', () => {
            const { phase } = store.state.timer;
            const newPhase = phase === 'study' ? 'break' : 'study';
            
            store.update('timer', t => ({ 
                ...t, 
                phase: newPhase,
                // Reset the time for the new phase so it starts at 00:00
                studySeconds: newPhase === 'study' ? 0 : t.studySeconds, 
                breakSeconds: newPhase === 'break' ? 0 : t.breakSeconds,
                isRunning: false // Automatically pause when switching phases
            }));
            
            this.stopTimer();
            this.updateUI();
        });

        // 3. TOGGLE MODES
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
        
        // Run this math exactly once every 1000 milliseconds (1 second)
        this.interval = setInterval(() => {
            const { phase, mode, studySeconds } = store.state.timer;
            
            // Auto-stop Pomodoro when it hits 25 minutes
            if (mode === 'pomodoro' && phase === 'study' && studySeconds >= this.pomodoroDuration) {
                this.stopTimer();
                store.update('timer', t => ({ ...t, isRunning: false }));
                alert("🎯 Pomodoro complete! Great focus. Time for a break.");
                return;
            }

            // Tell the Brain to add 1 second to whichever phase we are in
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
        this.updateUI();
    }

    // Turns raw seconds (e.g., 65) into a nice digital format (01:05)
    formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    updateUI() {
        const { mode, phase, studySeconds, breakSeconds, isRunning } = store.state.timer;

        // Visuals: Mode Switcher
        if (mode === 'stopwatch') {
            this.modeStopwatchBtn.className = 'px-4 py-1 rounded shadow bg-white text-gray-800 font-bold text-sm transition-all';
            this.modePomodoroBtn.className = 'px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:bg-gray-300';
        } else {
            this.modePomodoroBtn.className = 'px-4 py-1 rounded shadow bg-white text-gray-800 font-bold text-sm transition-all';
            this.modeStopwatchBtn.className = 'px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:bg-gray-300';
        }

        // Visuals: Phase Colors and Button Text
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

        // Visuals: Start/Pause Button Colors
        this.toggleBtn.textContent = isRunning ? 'PAUSE' : 'START';
        this.toggleBtn.className = isRunning 
            ? 'bg-yellow-500 hover:bg-yellow-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all'
            : 'bg-green-500 hover:bg-green-600 text-white w-32 py-3 rounded-lg font-bold shadow-md transition-all';

        // THE MAGIC: Calculate what numbers to actually show on the screen
        let displaySeconds = 0;
        if (phase === 'break') {
            // Breaks ALWAYS count up, no matter the mode
            displaySeconds = breakSeconds;
        } else {
            // Study Phase
            if (mode === 'stopwatch') {
                displaySeconds = studySeconds; // Count up
            } else {
                displaySeconds = Math.max(0, this.pomodoroDuration - studySeconds); // Count down from 25:00
            }
        }

        // Send the final numbers to the screen
        this.display.textContent = this.formatTime(displaySeconds);
    }
}

export const timerUI = new TimerUI();

// js/TimerUI.js
import { store } from './State.js';

class TimerUI {
    constructor() {
        this.interval = null;
        this.pStudy = 25 * 60; // 25 minutes in seconds
        this.pBreak = 5 * 60;  // 5 minutes in seconds
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
        window.addEventListener('beforeunload', () => this.saveTimeToBlock());
    }

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
        // 1. START / PAUSE
        this.toggleBtn.addEventListener('click', () => {
            const { isRunning } = store.state.timer;
            store.update('timer', t => ({ ...t, isRunning: !isRunning }));
            
            if (!isRunning) this.startTimer();
            else this.stopTimer();
        });

        // 2. SWITCH PHASE (Now with Auto-Start and No Zero-Resets!)
        this.switchPhaseBtn.addEventListener('click', () => {
            this.saveTimeToBlock(); 
            
            const { phase, isRunning } = store.state.timer;
            const newPhase = phase === 'study' ? 'break' : 'study';
            
            store.update('timer', t => ({ 
                ...t, 
                phase: newPhase,
                isRunning: true // USER FIX: Instantly start counting!
                // Notice we completely removed the code that resets time to 0
            }));
            
            // Force the engine to start if it was paused
            if (!isRunning) this.startTimer(); 
            else this.updateUI();
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
        clearInterval(this.interval); // Prevent accidental double-speed glitches
        
        this.interval = setInterval(() => {
            let { phase, mode, activeBlockId, studySeconds, breakSeconds } = store.state.timer;
            if (!activeBlockId) return;

            // 1. Always add time to the underlying stopwatch
            if (phase === 'study') studySeconds += 1;
            else breakSeconds += 1;

            // 2. USER FIX: Pomodoro Auto-Transition Logic!
            if (mode === 'pomodoro') {
                // If study time perfectly divides by 25 mins (e.g., hits 25m, 50m, 75m)
                if (phase === 'study' && studySeconds > 0 && studySeconds % this.pStudy === 0) {
                    phase = 'break';
                    this.playBeep();
                    alert("🎯 25 Minutes complete! Auto-switching to Break Phase.");
                } 
                // If break time perfectly divides by 5 mins (e.g., hits 5m, 10m)
                else if (phase === 'break' && breakSeconds > 0 && breakSeconds % this.pBreak === 0) {
                    phase = 'study';
                    this.playBeep();
                    alert("⏰ Break is over! Auto-switching back to work.");
                }
            }

            // Save the state
            store.update('timer', t => ({ ...t, studySeconds, breakSeconds, phase }));
            this.updateUI();
        }, 1000);
    }

    stopTimer() {
        clearInterval(this.interval);
        this.saveTimeToBlock(); 
        this.updateUI();
    }

    // A tiny invisible sound player for when phases auto-switch
    playBeep() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.connect(ctx.destination);
            osc.frequency.value = 800;
            osc.start(); osc.stop(ctx.currentTime + 0.3);
        } catch(e) {}
    }

    formatTime(totalSeconds) {
        const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
        const s = (totalSeconds % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    updateUI() {
        const { mode, phase, studySeconds, breakSeconds, isRunning, activeBlockId } = store.state.timer;

        // Visuals: Custom Button Text based on User request
        if (this.modeStopwatchBtn) this.modeStopwatchBtn.textContent = "Pause Pomodoro";
        if (this.modePomodoroBtn) this.modePomodoroBtn.textContent = "Apply Pomodoro";

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

        // THE MAGIC: Modulo Math allows Pomodoro to seamlessly lay over Stopwatch
        let displaySeconds = 0;
        
        if (mode === 'stopwatch') {
            // Stopwatch just shows total time
            displaySeconds = phase === 'study' ? studySeconds : breakSeconds; 
        } else {
            // Pomodoro loops beautifully based on your total time!
            if (phase === 'study') {
                displaySeconds = this.pStudy - (studySeconds % this.pStudy);
                if (displaySeconds === this.pStudy && studySeconds > 0) displaySeconds = 0;
            } else {
                displaySeconds = this.pBreak - (breakSeconds % this.pBreak);
                if (displaySeconds === this.pBreak && breakSeconds > 0) displaySeconds = 0;
            }
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

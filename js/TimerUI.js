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
        
        // The Master Clock Interval
        this.interval = setInterval(() => {
            const { phase, mode, activeBlockId } = store.state.timer;
            
            // If we don't have an active block selected, do nothing.
            if (!activeBlockId) return;

            // Find the specific block in our blocks array
            store.update('blocks', oldBlocks => {
                return oldBlocks.map(b => {
                    if (b.id === activeBlockId) {
                        // Ensure it has tracking variables
                        let studySecs = b.studySeconds || 0;
                        let breakSecs = b.breakSeconds || 0;

                        // Auto-stop Pomodoro when it hits 25 minutes (1500 seconds)
                        if (mode === 'pomodoro' && phase === 'study' && studySecs >= this.pomodoroDuration) {
                            this.stopTimer();
                            store.update('timer', t => ({ ...t, isRunning: false }));
                            alert("🎯 Pomodoro complete! Great focus. Time for a break.");
                            return b;
                        }

                        // INJECT the time directly into the block's data!
                        if (phase === 'study') {
                            return { ...b, studySeconds: studySecs + 1 };
                        } else {
                            return { ...b, breakSeconds: breakSecs + 1 };
                        }
                    }
                    return b;
                });
            });
            
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
        // THE MAGIC: Calculate what numbers to actually show on the screen
        let displaySeconds = 0;
        
        // Find our active block to get its specific time data
        const activeBlock = store.state.blocks.find(b => b.id === store.state.timer.activeBlockId);
        
        if (activeBlock) {
            const currentStudySecs = activeBlock.studySeconds || 0;
            const currentBreakSecs = activeBlock.breakSeconds || 0;

            if (phase === 'break') {
                displaySeconds = currentBreakSecs; // Break always counts up
            } else {
                if (mode === 'stopwatch') {
                    displaySeconds = currentStudySecs; // Count up
                } else {
                    displaySeconds = Math.max(0, this.pomodoroDuration - currentStudySecs); // Count down
                }
            }
            
            // Update the title on the Focus screen so we know what we are studying!
            const titleEl = document.querySelector('#focus h2');
            if (titleEl) titleEl.innerHTML = `🎯 Focus Mode: <span class="text-blue-600">${activeBlock.title}</span>`;
        }

    
        this.display.textContent = this.formatTime(displaySeconds);
    }

export const timerUI = new TimerUI();

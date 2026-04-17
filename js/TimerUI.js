// js/TimerUI.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';

class TimerUI {
    init() {
        this.display = document.getElementById('timerDisplay');
        this.toggleBtn = document.getElementById('toggleTimerBtn');
        this.switchPhaseBtn = document.getElementById('switchPhaseBtn');
        this.modeStopwatchBtn = document.getElementById('modeStopwatch');
        this.modePomodoroBtn = document.getElementById('modePomodoro');
        this.phaseIndicator = document.getElementById('phaseIndicator');
        this.spontaneousSubjectSelect = document.getElementById('focusSpontaneousSubject');
        this.finishTimerBtn = document.getElementById('finishTimerBtn');

        if (!this.display) return;

        store.subscribe('settings', (s) => { this.pStudy = s.pStudy * 60; this.pBreak = s.pBreak * 60; this.updateUI(); });
        this.pStudy = store.state.settings.pStudy * 60; 
        this.pBreak = store.state.settings.pBreak * 60;

        store.subscribe('subjects', () => this.populateSubjects());
        this.populateSubjects();

        this.bindEvents();
        store.subscribe('timer', () => this.updateUI());
        this.updateUI(); 
    }

    populateSubjects() {
        if (!this.spontaneousSubjectSelect) return;
        this.spontaneousSubjectSelect.innerHTML = '';
        Object.keys(store.state.subjects).forEach(s => {
            this.spontaneousSubjectSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }

    bindEvents() {
        // Toggle Timer (Supports Spontaneous Sessions now!)
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

        // NEW: The Global "Finish & Save" button!
        this.finishTimerBtn?.addEventListener('click', () => {
            const t = store.state.timer;
            if (t.isRunning) timerEngine.stop();
            
            const totalSecs = t.studySeconds + t.breakSeconds;
            if (totalSecs > 0) {
                const actualEnd = Date.now();
                const actualStart = actualEnd - (totalSecs * 1000);
                
                if (t.activeBlockId) {
                    // Update existing block
                    store.update('blocks', blocks => blocks.map(b => 
                        b.id === t.activeBlockId ? { ...b, actualEnd: actualEnd, status: 'completed' } : b
                    ));
                } else {
                    // Inject Spontaneous Block onto Calendar!
                    const sub = this.spontaneousSubjectSelect.value || 'Other';
                    const dStart = new Date(actualStart);
                    const startDateStr = `${dStart.getFullYear()}-${String(dStart.getMonth()+1).padStart(2,'0')}-${String(dStart.getDate()).padStart(2,'0')}`;
                    const startMins = dStart.getHours() * 60 + dStart.getMinutes();
                    
                    const dEnd = new Date(actualEnd);
                    const endDateStr = `${dEnd.getFullYear()}-${String(dEnd.getMonth()+1).padStart(2,'0')}-${String(dEnd.getDate()).padStart(2,'0')}`;
                    const endMins = dEnd.getHours() * 60 + dEnd.getMinutes();
                    const formatTime = (mins) => `${String(Math.floor(mins/60)).padStart(2,'0')}:${String(mins%60).padStart(2,'0')}`;

                    const newBlock = {
                        id: Date.now(), subject: sub, title: `Unscheduled Session`,
                        startDate: startDateStr, scheduledStart: formatTime(startMins), 
                        endDate: endDateStr, scheduledEnd: formatTime(endMins),
                        actualStart: actualStart, actualEnd: actualEnd,
                        status: 'completed', studySeconds: t.studySeconds, breakSeconds: t.breakSeconds
                    };
                    store.update('blocks', old => [...old, newBlock]);
                }
            }
            
            // Reset the brain
            store.update('timer', () => ({
                activeBlockId: null, mode: store.state.timer.mode, phase: 'study', isRunning: false,
                studySeconds: 0, breakSeconds: 0, secondsElapsed: 0 
            }));
        });
    }

    updateUI() {
        const t = store.state.timer;

        this.phaseIndicator.innerText = t.phase === 'study' ? 'STUDY PHASE' : 'BREAK PHASE';
        this.phaseIndicator.className = t.phase === 'study' 
            ? 'absolute top-4 bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider'
            : 'absolute top-4 bg-green-100 text-green-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider';

        this.toggleBtn.innerText = t.isRunning ? 'PAUSE' : 'START';
        this.switchPhaseBtn.innerText = t.phase === 'study' ? 'TAKE BREAK' : 'RESUME STUDY';

        let displaySeconds = 0;
        if (t.mode === 'stopwatch') {
            displaySeconds = t.phase === 'study' ? t.studySeconds : t.breakSeconds; 
        } else {
            if (t.phase === 'study') {
                displaySeconds = this.pStudy - (t.studySeconds % this.pStudy);
                if (displaySeconds === this.pStudy && t.studySeconds > 0) displaySeconds = 0;
            } else {
                displaySeconds = this.pBreak - (t.breakSeconds % this.pBreak);
                if (displaySeconds === this.pBreak && t.breakSeconds > 0) displaySeconds = 0;
            }
        }

        const titleEl = document.querySelector('#focus h2');
        if (titleEl) {
            if (t.activeBlockId) {
                const activeBlock = store.state.blocks.find(b => b.id === t.activeBlockId);
                titleEl.innerHTML = `🎯 Focus Mode: <span class="text-blue-600">${activeBlock ? activeBlock.title : 'Active Block'}</span>`;
                // Lock spontaneous dropdown to active block subject
                if (this.spontaneousSubjectSelect && activeBlock) {
                    this.spontaneousSubjectSelect.value = activeBlock.subject;
                    this.spontaneousSubjectSelect.disabled = true;
                }
            } else {
                titleEl.innerHTML = `🎯 Focus Mode: <span class="text-gray-400">Spontaneous Session</span>`;
                // Unlock spontaneous dropdown
                if (this.spontaneousSubjectSelect) this.spontaneousSubjectSelect.disabled = false;
            }
        }

        if (isNaN(displaySeconds) || displaySeconds < 0) displaySeconds = 0;
        const m = Math.floor(displaySeconds / 60).toString().padStart(2, '0');
        const s = (displaySeconds % 60).toString().padStart(2, '0');
        this.display.innerText = `${m}:${s}`;

        if (t.mode === 'stopwatch') {
            this.modeStopwatchBtn.className = "px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all";
            this.modePomodoroBtn.className = "px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
        } else {
            this.modePomodoroBtn.className = "px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all";
            this.modeStopwatchBtn.className = "px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
        }
    }
}
export const timerUI = new TimerUI();

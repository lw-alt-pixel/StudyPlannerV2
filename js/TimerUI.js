// js/TimerUI.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';
import { blockManager } from './BlockManager.js';

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
        this.pushBackBtn = document.getElementById('pushBackTimerBtn');

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
        this.toggleBtn.addEventListener('click', () => {
            const isRunning = store.state.timer.isRunning;
            store.update('timer', t => ({ ...t, isRunning: !isRunning }));
            if (!isRunning) timerEngine.start();
            else timerEngine.stop();
        });

        // 🚨 Manual override simply flips the phase without breaking the loop!
        this.switchPhaseBtn.addEventListener('click', () => {
            const t = store.state.timer;
            const newPhase = t.phase === 'study' ? 'break' : 'study';
            store.update('timer', state => ({ ...state, phase: newPhase }));
        });

        this.modeStopwatchBtn.addEventListener('click', () => store.update('timer', t => ({ ...t, mode: 'stopwatch' })));
        this.modePomodoroBtn.addEventListener('click', () => store.update('timer', t => ({ ...t, mode: 'pomodoro' })));

        this.finishTimerBtn.addEventListener('click', () => {
            timerEngine.stop();
            const t = store.state.timer;
            if (t.activeBlockId) {
                store.update('blocks', blocks => blocks.map(b => b.id === t.activeBlockId ? { ...b, status: 'completed', actualEnd: new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }) } : b));
            }
            store.update('timer', () => ({ ...store.state.timer, isRunning: false, activeBlockId: null, studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, phase: 'study' }));
        });

        this.pushBackBtn?.addEventListener('click', () => {
            const t = store.state.timer;
            if(!t.activeBlockId) return alert("You must be running a scheduled block to use Push Back.");
            blockManager.openPushBackModal(t.activeBlockId);
        });

        this.spontaneousSubjectSelect?.addEventListener('change', (e) => {
            const t = store.state.timer;
            if (!t.activeBlockId) {
                store.update('timer', state => ({ ...state, spontaneousSubject: e.target.value }));
            }
        });
    }

    updateUI() {
        const t = store.state.timer;
        const theme = store.state.theme;

        this.toggleBtn.innerHTML = t.isRunning ? '<i class="fas fa-pause"></i> Pause' : '<i class="fas fa-play"></i> Start';
        this.toggleBtn.style.backgroundColor = theme.actionColor || '#2563eb';

        this.switchPhaseBtn.innerHTML = t.phase === 'study' ? '<i class="fas fa-coffee"></i> Take Break' : '<i class="fas fa-book"></i> Resume Study';
        this.switchPhaseBtn.className = t.phase === 'study' 
            ? "flex-1 px-4 py-3 rounded-xl font-black text-sm text-amber-700 bg-amber-100 hover:bg-amber-200 shadow-sm transition-all"
            : "flex-1 px-4 py-3 rounded-xl font-black text-sm text-blue-700 bg-blue-100 hover:bg-blue-200 shadow-sm transition-all";

        this.phaseIndicator.innerText = t.phase === 'study' ? '🧠 Focus Phase' : '☕ Break Phase';
        this.phaseIndicator.className = t.phase === 'study' ? "text-xs font-black uppercase tracking-widest text-blue-600 mb-2" : "text-xs font-black uppercase tracking-widest text-amber-600 mb-2";

        let displaySeconds = 0;

        // 🚨 NEW: Modulo (%) Math for infinite visual looping!
        if (t.mode === 'pomodoro') {
            if (t.phase === 'study') {
                // E.g. 25 mins - (TotalTime % 25 mins)
                displaySeconds = this.pStudy - (t.studySeconds % this.pStudy);
                if (displaySeconds === this.pStudy && t.studySeconds > 0) displaySeconds = 0;
            } else {
                displaySeconds = this.pBreak - (t.breakSeconds % this.pBreak);
                if (displaySeconds === this.pBreak && t.breakSeconds > 0) displaySeconds = 0;
            }
        } else {
            displaySeconds = t.secondsElapsed;
        }

        const titleEl = document.getElementById('focusBlockTitle');
        if (titleEl) {
            if (t.activeBlockId) {
                const activeBlock = store.state.blocks.find(b => b.id === t.activeBlockId);
                titleEl.innerHTML = `🎯 Focus Mode: <span class="text-blue-600">${activeBlock ? activeBlock.title : 'Active Block'}</span>`;
                if (this.spontaneousSubjectSelect && activeBlock) {
                    this.spontaneousSubjectSelect.value = activeBlock.subject;
                    this.spontaneousSubjectSelect.disabled = true;
                }
            } else {
                titleEl.innerHTML = `🎯 Focus Mode: <span class="text-gray-400">Spontaneous Session</span>`;
                if (this.spontaneousSubjectSelect) this.spontaneousSubjectSelect.disabled = false;
            }
        }

        if (isNaN(displaySeconds) || displaySeconds < 0) displaySeconds = 0;
        const min = Math.floor(displaySeconds / 60).toString().padStart(2, '0');
        const sec = (displaySeconds % 60).toString().padStart(2, '0');
        this.display.innerText = `${min}:${sec}`;

        if (t.mode === 'stopwatch') {
            this.modeStopwatchBtn.className = "flex-1 md:flex-none px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all";
            this.modePomodoroBtn.className = "flex-1 md:flex-none px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
        } else {
            this.modePomodoroBtn.className = "flex-1 md:flex-none px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all";
            this.modeStopwatchBtn.className = "flex-1 md:flex-none px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
        }
    }
}
export const timerUI = new TimerUI();

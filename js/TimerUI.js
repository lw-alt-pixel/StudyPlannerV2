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
        this.spontaneousSubjectSelect.innerHTML = '<option value="">General (No Subject)</option>';
        Object.keys(store.state.subjects).forEach(s => {
            this.spontaneousSubjectSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });
    }

    bindEvents() {
        this.toggleBtn.addEventListener('click', () => {
            const t = store.state.timer;
            if (t.isRunning) {
                store.update('timer', state => ({ ...state, isRunning: false }));
                timerEngine.stop();
            } else {
                if (!t.activeBlockId && !t.spontaneousSubject) {
                    const sub = this.spontaneousSubjectSelect.value || 'General';
                    store.update('timer', state => ({ ...state, spontaneousSubject: sub }));
                }
                store.update('timer', state => ({ ...state, isRunning: true }));
                timerEngine.start();
            }
        });

        this.switchPhaseBtn.addEventListener('click', () => {
            const t = store.state.timer;
            const newPhase = t.phase === 'study' ? 'break' : 'study';
            store.update('timer', state => ({ ...state, phase: newPhase }));
        });

        this.modeStopwatchBtn.addEventListener('click', () => {
            store.update('timer', t => ({ ...t, mode: 'stopwatch' }));
        });

        this.modePomodoroBtn.addEventListener('click', () => {
            store.update('timer', t => ({ ...t, mode: 'pomodoro' }));
        });

        this.finishTimerBtn.addEventListener('click', () => {
            timerEngine.stop();
            const t = store.state.timer;

            if (t.activeBlockId) {
                store.update('blocks', blocks => blocks.map(b => {
                    if (b.id === t.activeBlockId) {
                        return { ...b, studySeconds: t.studySeconds, status: 'completed' };
                    }
                    return b;
                }));
            } else {
                const now = new Date();
                const pad = n => String(n).padStart(2, '0');
                
                const actualEndStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
                
                const startObj = new Date(now.getTime() - ((t.studySeconds + t.breakSeconds) * 1000));
                const actualStartStr = `${pad(startObj.getHours())}:${pad(startObj.getMinutes())}:${pad(startObj.getSeconds())}`;

                const newSpontaneousBlock = {
                    id: 'spont_' + Date.now(),
                    subject: t.spontaneousSubject || 'General',
                    title: 'Spontaneous Focus',
                    date: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
                    actualStart: actualStartStr,
                    actualEnd: actualEndStr,
                    studySeconds: t.studySeconds,
                    breakSeconds: t.breakSeconds,
                    status: 'completed',
                    remarks: ''
                };
                store.update('blocks', old => [...old, newSpontaneousBlock]);
            }

            store.update('timer', () => ({
                activeBlockId: null, spontaneousSubject: null,
                mode: 'pomodoro', phase: 'study',
                studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: false
            }));
        });
    }

    updateUI() {
        const t = store.state.timer;

        this.toggleBtn.innerText = t.isRunning ? "Pause" : "Start";
        this.toggleBtn.className = t.isRunning 
            ? "flex-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 text-lg"
            : "flex-1 custom-action-btn text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 text-lg";

        this.switchPhaseBtn.innerText = t.phase === 'study' ? "Take Break" : "Start Focus";
        
        this.phaseIndicator.innerText = t.phase === 'study' ? "Focus Time" : "Break Time";
        this.phaseIndicator.className = t.phase === 'study' 
            ? "inline-block px-4 py-1 bg-blue-100 text-theme-action rounded-full text-xs font-black uppercase tracking-wider mb-6 shadow-sm"
            : "inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black uppercase tracking-wider mb-6 shadow-sm";

        let displaySeconds = 0;
        if (t.mode === 'stopwatch') {
            displaySeconds = t.phase === 'study' ? t.studySeconds : t.breakSeconds;
            
            const hrs = Math.floor(displaySeconds / 3600);
            const min = Math.floor((displaySeconds % 3600) / 60).toString().padStart(2, '0');
            const sec = (displaySeconds % 60).toString().padStart(2, '0');
            
            if (hrs > 0) this.display.innerText = `${hrs}:${min}:${sec}`;
            else this.display.innerText = `${min}:${sec}`;

        } else {
            const targetSecs = t.phase === 'study' ? this.pStudy : this.pBreak;
            const elapsed = t.phase === 'study' ? t.studySeconds : t.breakSeconds;
            displaySeconds = targetSecs - (elapsed % targetSecs);
            if (displaySeconds < 0) displaySeconds = 0;
            
            const hrs = Math.floor(displaySeconds / 3600);
            const min = Math.floor((displaySeconds % 3600) / 60).toString().padStart(2, '0');
            const sec = (displaySeconds % 60).toString().padStart(2, '0');
            
            if (hrs > 0) this.display.innerText = `${hrs}:${min}:${sec}`;
            else this.display.innerText = `${min}:${sec}`;
        }

        // 🚨 STRICT POMODORO OVERRIDE LOGIC & THEME FIX
        if (t.mode === 'stopwatch') {
            this.modeStopwatchBtn.className = "flex-1 px-4 py-2 rounded shadow bg-white font-bold text-sm transition-all text-theme-action";
            this.modePomodoroBtn.className = "flex-1 px-4 py-2 rounded text-gray-400 font-bold text-sm transition-all hover:text-gray-600";
            this.switchPhaseBtn.classList.remove('hidden'); // SHOW manual override
        } else {
            this.modePomodoroBtn.className = "flex-1 px-4 py-2 rounded shadow bg-white font-bold text-sm transition-all text-theme-action";
            this.modeStopwatchBtn.className = "flex-1 px-4 py-2 rounded text-gray-400 font-bold text-sm transition-all hover:text-gray-600";
            this.switchPhaseBtn.classList.add('hidden'); // HIDE manual override
        }

        if (t.isRunning || t.studySeconds > 0 || t.breakSeconds > 0) {
            this.finishTimerBtn.classList.remove('hidden');
            if (this.pushBackBtn) this.pushBackBtn.classList.remove('hidden');
            this.spontaneousSubjectSelect.disabled = true;
            this.spontaneousSubjectSelect.classList.add('opacity-50');
        } else {
            this.finishTimerBtn.classList.add('hidden');
            if (this.pushBackBtn) this.pushBackBtn.classList.add('hidden');
            this.spontaneousSubjectSelect.disabled = false;
            this.spontaneousSubjectSelect.classList.remove('opacity-50');
            
            if (t.activeBlockId) {
                const b = store.state.blocks.find(x => x.id === t.activeBlockId);
                if (b) this.spontaneousSubjectSelect.value = b.subject;
            } else {
                this.spontaneousSubjectSelect.value = t.spontaneousSubject || '';
            }
        }
    }
}
export const timerUI = new TimerUI();

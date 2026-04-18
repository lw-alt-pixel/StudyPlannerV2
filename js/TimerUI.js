// js/TimerUI.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';
import { blockManager } from './BlockManager.js'; // Need this for the Push Back modal

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
            if (store.state.timer.isRunning) timerEngine.stop();
            else timerEngine.start();
            store.update('timer', t => ({ ...t, isRunning: !t.isRunning }));
        });

        this.switchPhaseBtn.addEventListener('click', () => {
            store.update('timer', t => ({ ...t, phase: t.phase === 'study' ? 'break' : 'study' }));
        });

        this.modeStopwatchBtn.addEventListener('click', () => store.update('timer', t => ({ ...t, mode: 'stopwatch' })));
        this.modePomodoroBtn.addEventListener('click', () => store.update('timer', t => ({ ...t, mode: 'pomodoro' })));

        // 🚨 PUSH BACK MANUAL TRIGGER
        this.pushBackBtn?.addEventListener('click', () => {
            const t = store.state.timer;
            if (t.activeBlockId) {
                blockManager.openPushBackModal(t.activeBlockId); // Trigger the split engine
            } else {
                alert("You can only push back scheduled blocks. Spontaneous sessions cannot be split.");
            }
        });

        // 🚨 SMART FINISH BUTTON (Checks for early finish)
        this.finishTimerBtn.addEventListener('click', () => {
            const t = store.state.timer;

            if (t.activeBlockId) {
                const b = store.state.blocks.find(x => x.id === t.activeBlockId);
                if (b) {
                    const sObj = new Date(`${b.startDate}T${b.scheduledStart}:00`);
                    const eObj = new Date(`${b.endDate}T${b.scheduledEnd}:00`);
                    const expectedMins = Math.round((eObj - sObj) / 60000);
                    const studiedMins = Math.floor(t.studySeconds / 60);
                    
                    // Intercept early finish!
                    if (expectedMins - studiedMins > 5) {
                        if (confirm(`You scheduled ${expectedMins} mins, but only studied ${studiedMins} mins. Do you want to PUSH BACK the remaining time to another day? \n\n(Click OK to split & push back. Click Cancel to mark the whole block fully complete anyway).`)) {
                            blockManager.openPushBackModal(t.activeBlockId, expectedMins - studiedMins);
                            return; 
                        }
                    }
                }
                
                // Normal Finish
                store.update('blocks', blocks => blocks.map(x => x.id === t.activeBlockId ? { ...x, actualEnd: new Date().getTime(), status: 'completed' } : x));
            } else if (t.studySeconds > 0) {
                const d = new Date();
                const dStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                const newBlock = {
                    id: Date.now(), subject: this.spontaneousSubjectSelect.value, title: "Spontaneous Session",
                    startDate: dStr, scheduledStart: "00:00", endDate: dStr, scheduledEnd: "00:00",
                    actualStart: new Date(d.getTime() - (t.secondsElapsed*1000)).getTime(), actualEnd: d.getTime(),
                    status: 'completed', studySeconds: t.studySeconds, breakSeconds: t.breakSeconds, remarks: ''
                };
                store.update('blocks', old => [...old, newBlock]);
            }
            timerEngine.stop();
            store.update('timer', state => ({ ...state, isRunning: false, activeBlockId: null, studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, phase: 'study' }));
            alert("Session Finished and Saved!");
        });
    }

    updateUI() {
        const t = store.state.timer;
        const m = store.state.marathon;
        if (m && m.active) return;

        this.toggleBtn.innerText = t.isRunning ? 'PAUSE' : 'START';
        this.toggleBtn.classList.toggle('bg-red-500', t.isRunning);
        this.toggleBtn.classList.toggle('hover:bg-red-600', t.isRunning);

        this.phaseIndicator.innerText = t.phase === 'study' ? 'Study Phase' : 'Break Phase';
        this.phaseIndicator.className = t.phase === 'study' ? 'absolute top-4 bg-blue-100 text-blue-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider' : 'absolute top-4 bg-green-100 text-green-700 px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider';
        this.switchPhaseBtn.innerText = t.phase === 'study' ? 'TAKE BREAK' : 'RESUME STUDY';

        if (this.pushBackBtn) {
            if (t.activeBlockId) this.pushBackBtn.classList.remove('hidden');
            else this.pushBackBtn.classList.add('hidden');
        }

        let displaySeconds = 0;
        const titleEl = document.querySelector('#focus h2');

        if (t.mode === 'stopwatch') {
            displaySeconds = t.phase === 'study' ? t.studySeconds : t.breakSeconds;
        } else {
            const limit = t.phase === 'study' ? this.pStudy : this.pBreak;
            const elapsedInPhase = t.phase === 'study' ? t.studySeconds : t.breakSeconds;
            displaySeconds = limit - elapsedInPhase;
            if (displaySeconds <= 0 && t.isRunning) {
                timerEngine.stop();
                store.update('timer', state => ({ ...state, isRunning: false, phase: state.phase === 'study' ? 'break' : 'study' }));
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const osc = audioCtx.createOscillator(); osc.connect(audioCtx.destination);
                osc.start(); osc.stop(audioCtx.currentTime + 0.5); 
                alert(t.phase === 'study' ? "Study session complete! Time for a break." : "Break over! Back to work.");
            }
        }

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

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
        this.spontaneousSubjectSelect.innerHTML = '<option value="">No Subject (General)</option>';
        Object.keys(store.state.subjects).forEach(sub => {
            this.spontaneousSubjectSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
    }

    bindEvents() {
        this.toggleBtn?.addEventListener('click', () => {
            const isRunning = !store.state.timer.isRunning;
            store.update('timer', t => ({ ...t, isRunning }));
            if (isRunning) timerEngine.start(); else timerEngine.stop();
        });

        this.switchPhaseBtn?.addEventListener('click', () => {
            store.update('timer', t => ({ ...t, phase: t.phase === 'study' ? 'break' : 'study' }));
        });

        this.modeStopwatchBtn?.addEventListener('click', () => store.update('timer', t => ({ ...t, mode: 'stopwatch' })));
        this.modePomodoroBtn?.addEventListener('click', () => store.update('timer', t => ({ ...t, mode: 'pomodoro' })));

        this.spontaneousSubjectSelect?.addEventListener('change', (e) => {
            if (!store.state.timer.activeBlockId) {
                store.update('timer', t => ({ ...t, spontaneousSubject: e.target.value }));
            }
        });

        this.finishTimerBtn?.addEventListener('click', () => this.finishSession());
        
        this.pushBackBtn?.addEventListener('click', () => {
            const t = store.state.timer;
            if (!t.activeBlockId) return alert("You are in a spontaneous session. There is no scheduled block to push back!");
            
            store.update('timer', t => ({ ...t, isRunning: false }));
            timerEngine.stop();
            
            blockManager.activePushBackId = t.activeBlockId;
            blockManager.pushBackModal.classList.remove('hidden');
        });
    }

    finishSession() {
        store.update('timer', t => ({ ...t, isRunning: false }));
        timerEngine.stop();
        
        const t = store.state.timer;
        if (t.activeBlockId) {
            store.update('blocks', blocks => blocks.map(b => {
                if (b.id === t.activeBlockId) {
                    return { ...b, status: 'completed', actualEnd: new Date().toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit'}) };
                }
                return b;
            }));
        } else if (t.studySeconds > 60) {
            const newBlock = {
                id: Date.now().toString(),
                title: 'Spontaneous Focus',
                subject: t.spontaneousSubject || 'General',
                date: new Date().toISOString().split('T')[0],
                actualStart: new Date(Date.now() - (t.secondsElapsed * 1000)).toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit'}),
                actualEnd: new Date().toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit'}),
                status: 'completed',
                studySeconds: t.studySeconds,
                breakSeconds: t.breakSeconds,
                remarks: 'Unscheduled session'
            };
            store.update('blocks', b => [...b, newBlock]);
        }

        store.update('timer', () => ({ activeBlockId: null, mode: 'stopwatch', phase: 'study', isRunning: false, studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, spontaneousSubject: null }));
        alert("Session saved successfully!");
    }

    updateUI() {
        const t = store.state.timer;
        const sSettings = store.state.settings;

        this.toggleBtn.innerHTML = t.isRunning ? '⏸️ Pause' : '▶️ Start';
        this.toggleBtn.className = t.isRunning 
            ? "flex-1 md:flex-none px-6 py-3 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 transition-colors"
            : "flex-1 md:flex-none px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-blue-500/30 w-32";

        // 🚨 DYNAMIC UI BADGES FOR STOPWATCH VS POMODORO
        if (t.phase === 'study') {
            this.switchPhaseBtn.innerHTML = '☕ Take Break';
            this.switchPhaseBtn.className = "flex-1 md:flex-none px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors";
            
            if (t.mode === 'stopwatch') {
                this.phaseIndicator.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-gray-500 mr-2 animate-pulse"></span>⏱️ STOPWATCH: FOCUS';
                this.phaseIndicator.className = "absolute top-4 inline-flex items-center px-4 py-1 rounded-full text-xs font-black tracking-widest bg-gray-100 text-gray-600";
            } else {
                this.phaseIndicator.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>🎯 POMODORO: STUDY';
                this.phaseIndicator.className = "absolute top-4 inline-flex items-center px-4 py-1 rounded-full text-xs font-black tracking-widest bg-blue-100 text-blue-800";
            }
        } else {
            this.switchPhaseBtn.innerHTML = '🎯 Resume Focus';
            this.switchPhaseBtn.className = "flex-1 md:flex-none px-6 py-3 bg-white border border-gray-200 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors";
            
            if (t.mode === 'stopwatch') {
                this.phaseIndicator.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-gray-500 mr-2 animate-pulse"></span>⏱️ STOPWATCH: BREAK';
                this.phaseIndicator.className = "absolute top-4 inline-flex items-center px-4 py-1 rounded-full text-xs font-black tracking-widest bg-gray-100 text-gray-600";
            } else {
                this.phaseIndicator.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>☕ POMODORO: BREAK';
                this.phaseIndicator.className = "absolute top-4 inline-flex items-center px-4 py-1 rounded-full text-xs font-black tracking-widest bg-orange-100 text-orange-800";
            }
        }

        const titleEl = document.getElementById('focusSessionTitle');
        if (titleEl) {
            if (t.activeBlockId) {
                const activeBlock = store.state.blocks.find(b => b.id === t.activeBlockId);
                const subColor = activeBlock ? store.state.subjects[activeBlock.subject] || '#3b82f6' : '#3b82f6';
                titleEl.innerHTML = `<span style="color: ${subColor}">●</span> 🎯 Scheduled Block: <span class="text-gray-400">${activeBlock ? activeBlock.title : 'Active Block'}</span>`;
                if (this.spontaneousSubjectSelect && activeBlock) {
                    this.spontaneousSubjectSelect.value = activeBlock.subject;
                    this.spontaneousSubjectSelect.disabled = true;
                }
            } else {
                titleEl.innerHTML = `🎯 Focus Mode: <span class="text-gray-400">Spontaneous Session</span>`;
                if (this.spontaneousSubjectSelect) this.spontaneousSubjectSelect.disabled = false;
            }
        }

        // 🚨 DYNAMIC TIME FORMATTING (HH:MM:SS for Stopwatch, MM:SS for Pomodoro)
        let displaySeconds = 0;
        
        if (t.mode === 'pomodoro') {
            const pStudySecs = (sSettings.pStudy || 25) * 60;
            const pBreakSecs = (sSettings.pBreak || 5) * 60;
            displaySeconds = t.phase === 'study' ? pStudySecs - (t.studySeconds % pStudySecs) : pBreakSecs - (t.breakSeconds % pBreakSecs);
            if (isNaN(displaySeconds) || displaySeconds < 0) displaySeconds = 0;
            
            const min = Math.floor(displaySeconds / 60).toString().padStart(2, '0');
            const sec = (displaySeconds % 60).toString().padStart(2, '0');
            this.display.innerText = `${min}:${sec}`;
            
        } else {
            // Stopwatch Mode - Continually count up the current phase
            displaySeconds = t.phase === 'study' ? t.studySeconds : t.breakSeconds;
            if (isNaN(displaySeconds) || displaySeconds < 0) displaySeconds = 0;
            
            const hrs = Math.floor(displaySeconds / 3600);
            const min = Math.floor((displaySeconds % 3600) / 60).toString().padStart(2, '0');
            const sec = (displaySeconds % 60).toString().padStart(2, '0');
            
            if (hrs > 0) {
                this.display.innerText = `${hrs}:${min}:${sec}`;
            } else {
                this.display.innerText = `${min}:${sec}`;
            }
        }

        if (t.mode === 'stopwatch') {
            this.modeStopwatchBtn.className = "flex-1 md:flex-none px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all text-gray-900";
            this.modePomodoroBtn.className = "flex-1 md:flex-none px-4 py-1 rounded text-gray-400 font-bold text-sm transition-all hover:text-gray-600";
        } else {
            this.modePomodoroBtn.className = "flex-1 md:flex-none px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all text-blue-600";
            this.modeStopwatchBtn.className = "flex-1 md:flex-none px-4 py-1 rounded text-gray-400 font-bold text-sm transition-all hover:text-gray-600";
        }
    }
}
export const timerUI = new TimerUI();

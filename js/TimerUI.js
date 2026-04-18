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
            // 🚨 FIX: Add precise Date strings so Canvas/Calendar can see it!
            const now = new Date();
            const actualStartObj = new Date(now.getTime() - (t.secondsElapsed * 1000));
            
            const dateStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
            const startTimeStr = actualStartObj.toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit'});
            const endTimeStr = now.toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit'});

            const newBlock = {
                id: Date.now().toString(),
                title: 'Spontaneous Focus',
                subject: t.spontaneousSubject || 'General',
                startDate: dateStr,            // Required for Canvas
                endDate: dateStr,              // Required for Canvas
                scheduledStart: startTimeStr,  // Required for Canvas drawing math
                scheduledEnd: endTimeStr,      // Required for Canvas drawing math
                actualStart: startTimeStr,
                actualEnd: endTimeStr,
                status: 'completed',
                studySeconds: t.studySeconds,
                breakSeconds: t.breakSeconds,
                remarks: 'Unscheduled manual session'
            };
            store.update('blocks', b => [...b, newBlock]);
        }

        store.update('timer', () => ({ activeBlockId: null, mode: 'stopwatch', phase: 'study', isRunning: false, studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, spontaneousSubject: null }));
        
        const titleEl = document.getElementById('focusSessionTitle');
        if (titleEl) titleEl.innerText = "🎯 Focus Mode";
        
        alert("Session saved successfully!");
    }

    updateUI() {
        const t = store.state.timer;
        const sSettings = store.state.settings;

        this.toggleBtn.innerHTML = t.isRunning ? '⏸️ Pause' : '▶️ Start';
        this.toggleBtn.className = t.isRunning 
            ? "flex-1 md:flex-none px-6 py-3 bg-red-100 text-red-700 rounded-xl font-bold hover:bg-red-200 transition-colors"
            : "flex-1 md:flex-none px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg hover:shadow-blue-500/30 w-32";

        if (t.phase === 'study') {
            this.switchPhaseBtn.innerHTML = '☕ Take Break';
            this.switchPhaseBtn.className = "flex-1 md:flex-none px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors";
            
            if (t.mode === 'stopwatch') {
                this.phaseIndicator.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-gray-500 mr-2 animate-pulse"></span>⏱️ STOPWATCH: FOCUS';
                this.phaseIndicator.className = "px-6 py-1.5 rounded-full bg-gray-100 text-gray-600 font-black text-sm uppercase tracking-widest mb-6 shadow-sm border border-gray-200";
            } else {
                this.phaseIndicator.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-2 animate-pulse"></span>🎯 POMODORO: STUDY';
                this.phaseIndicator.className = "px-6 py-1.5 rounded-full bg-blue-100 text-blue-800 font-black text-sm uppercase tracking-widest mb-6 shadow-sm border border-blue-200";
            }
        } else {
            this.switchPhaseBtn.innerHTML = '🎯 Resume Focus';
            this.switchPhaseBtn.className = "flex-1 md:flex-none px-6 py-3 bg-white border border-gray-200 text-blue-600 rounded-xl font-bold hover:bg-blue-50 transition-colors";
            
            if (t.mode === 'stopwatch') {
                this.phaseIndicator.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-gray-500 mr-2 animate-pulse"></span>⏱️ STOPWATCH: BREAK';
                this.phaseIndicator.className = "px-6 py-1.5 rounded-full bg-gray-100 text-gray-600 font-black text-sm uppercase tracking-widest mb-6 shadow-sm border border-gray-200";
            } else {
                this.phaseIndicator.innerHTML = '<span class="inline-block w-2 h-2 rounded-full bg-orange-500 mr-2 animate-pulse"></span>☕ POMODORO: BREAK';
                this.phaseIndicator.className = "px-6 py-1.5 rounded-full bg-orange-100 text-orange-800 font-black text-sm uppercase tracking-widest mb-6 shadow-sm border border-orange-200";
            }
        }

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
            this.modeStopwatchBtn.className = "flex-1 px-4 py-2 rounded shadow bg-white font-bold text-sm transition-all text-gray-900";
            this.modePomodoroBtn.className = "flex-1 px-4 py-2 rounded text-gray-400 font-bold text-sm transition-all hover:text-gray-600";
        } else {
            this.modePomodoroBtn.className = "flex-1 px-4 py-2 rounded shadow bg-white font-bold text-sm transition-all text-blue-600";
            this.modeStopwatchBtn.className = "flex-1 px-4 py-2 rounded text-gray-400 font-bold text-sm transition-all hover:text-gray-600";
        }

        if (t.isRunning || t.studySeconds > 0 || t.breakSeconds > 0) {
            this.finishTimerBtn.classList.remove('hidden');
            if (t.activeBlockId) this.pushBackBtn.classList.remove('hidden');
        } else {
            this.finishTimerBtn.classList.add('hidden');
            this.pushBackBtn.classList.add('hidden');
        }
    }
}
export const timerUI = new TimerUI();

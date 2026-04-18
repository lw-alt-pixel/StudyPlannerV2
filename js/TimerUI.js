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
            // 🚨 FIX: SPONTANEOUS SESSION DATA KEYS
            const now = new Date();
            const actualStartObj = new Date(now.getTime() - (t.secondsElapsed * 1000));
            
            const dateStr = now.toISOString().split('T')[0];
            const startTimeStr = actualStartObj.toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit'});
            const endTimeStr = now.toLocaleTimeString('en-US', {hour12:false, hour:'2-digit', minute:'2-digit'});

            const newBlock = {
                id: Date.now().toString(),
                title: 'Spontaneous Focus',
                subject: t.spontaneousSubject || 'General',
                startDate: dateStr,            // 🚨 Added
                endDate: dateStr,              // 🚨 Added
                scheduledStart: startTimeStr,  // 🚨 Added
                scheduledEnd: endTimeStr,      // 🚨 Added
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

        const titleEl = document.getElementById('activeBlockTitle');
        if (titleEl) {
            if (t.activeBlockId) {
                const activeBlock = store.state.blocks.find(b => b.id === t.activeBlockId);
                const subColor = activeBlock ? store.state.subjects[activeBlock.subject] || '#3b82f6' : '#3b82f6';
                titleEl.innerHTML = `<div class="text-sm font-bold text-gray-500 mb-2">🎯 Scheduled Block</div>
                                     <div class="w-full p-3 bg-white border-2 rounded-xl font-bold text-gray-800 shadow-sm text-center truncate" style="border-color: ${subColor}">${activeBlock ? activeBlock.title : 'Active Block'}</div>`;
            } else {
                titleEl.innerHTML = `<div class="text-sm font-bold text-gray-500 mb-2">🎯 Focus Mode: <span class="text-gray-400">Spontaneous Session</span></div>
                                     <select id="focusSpontaneousSubject" class="w-full p-3 bg-white border rounded-xl font-bold text-gray-700 shadow-sm appearance-none text-center"></select>`;
                this.spontaneousSubjectSelect = document.getElementById('focusSpontaneousSubject');
                this.populateSubjects();
                this.bindEvents(); 
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
            this.modeStopwatchBtn.className = "flex-1 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm transition-all shadow-sm";
            this.modePomodoroBtn.className = "flex-1 px-4 py-2 rounded-xl text-gray-500 font-bold text-sm transition-all hover:bg-gray-50";
        } else {
            this.modePomodoroBtn.className = "flex-1 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 font-bold text-sm transition-all shadow-sm";
            this.modeStopwatchBtn.className = "flex-1 px-4 py-2 rounded-xl text-gray-500 font-bold text-sm transition-all hover:bg-gray-50";
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

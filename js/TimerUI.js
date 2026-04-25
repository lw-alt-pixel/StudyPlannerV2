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
        this.continueBtn = document.getElementById('continueTimerBtn');
        this.pushBackBtn = document.getElementById('pushBackTimerBtn');

        if (!this.display) return;

        store.subscribe('settings', (s) => { 
            this.pStudy = (s.pStudy || 25) * 60; 
            this.pBreak = (s.pBreak || 5) * 60; 
            this.updateUI(); 
        });
        
        this.pStudy = (store.state.settings.pStudy || 25) * 60; 
        this.pBreak = (store.state.settings.pBreak || 5) * 60;

        store.subscribe('subjects', () => this.populateSubjects());
        this.populateSubjects();

        this.bindEvents();
        store.subscribe('timer', () => this.updateUI());
        this.updateUI(); 
    }

    populateSubjects() {
        if (!this.spontaneousSubjectSelect) return;
        this.spontaneousSubjectSelect.innerHTML = '<option value="">General (No Subject)</option>';
        const allSubs = store.state.subjects || {};
        const activeMap = store.state.subjectsActive || {};
        Object.keys(allSubs).filter(s => activeMap[s] !== false).forEach(s => {
            this.spontaneousSubjectSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });
        try { import('./SubjectDropdown.js').then(m => m.enhanceSelect(this.spontaneousSubjectSelect)).catch(() => {}); } catch (e) { }
    }

    bindEvents() {
        this.toggleBtn?.addEventListener('click', () => {
            const t = store.state.timer;
            if (t.isRunning) {
                store.update('timer', state => ({ ...state, isRunning: false }));
                timerEngine.stop();
            } else {
                // Initialize session tracking if not present
                if (!t.sessionId) {
                    const sid = 'sess_' + Date.now();
                    store.update('timer', s => ({ ...s, sessionId: sid, sessionAccumulatedSeconds: s.sessionAccumulatedSeconds || 0, sessionIndex: s.sessionIndex || 1 }));
                }

                if (!t.activeBlockId && !t.spontaneousSubject && this.spontaneousSubjectSelect) {
                    const sub = this.spontaneousSubjectSelect.value || 'General';
                    store.update('timer', state => ({ ...state, spontaneousSubject: sub }));
                }
                store.update('timer', state => ({ ...state, isRunning: true }));
                timerEngine.start();
            }
        });

        this.switchPhaseBtn?.addEventListener('click', () => {
            const t = store.state.timer;
            const newPhase = t.phase === 'study' ? 'break' : 'study';
            store.update('timer', state => ({ ...state, phase: newPhase }));
        });

        this.modeStopwatchBtn?.addEventListener('click', () => {
            store.update('timer', t => ({ ...t, mode: 'stopwatch' }));
        });

        this.modePomodoroBtn?.addEventListener('click', () => {
            store.update('timer', t => ({ ...t, mode: 'pomodoro' }));
        });

        // 🚨 The 'applyPomodoroToggle' event listener has been completely removed from here!

        this.finishTimerBtn?.addEventListener('click', () => {
            timerEngine.stop();
            const t = store.state.timer;

            if (t.activeBlockId) {
                // 1. Update the block itself
                store.update('blocks', blocks => blocks.map(b => {
                    if (b.id === t.activeBlockId) {
                        return { ...b, studySeconds: t.studySeconds, status: 'completed', sessionId: t.sessionId || null, sessionSegmentIndex: t.sessionIndex || 1 };
                    }
                    return b;
                }));

                // 2. 🚨 REQ #3: Check if this block was linked to a Syllabus Task, and Auto-Tick it!
                const finishedBlock = store.state.blocks.find(b => b.id === t.activeBlockId);
                if (finishedBlock && finishedBlock.linkedTask) {
                    store.update('goals', goals => {
                        const { goalId, topicId, chapterId, taskId } = finishedBlock.linkedTask;
                        const g = goals.find(x => x.id === goalId);
                        if (!g) return goals;
                        const top = g.topics.find(x => x.id === topicId);
                        const chap = top?.chapters.find(x => x.id === chapterId);
                        const task = chap?.tasks.find(x => x.id === taskId);
                        
                        if (task) task.isCompleted = true; // Auto-tick!
                        return [...goals];
                    });
                }
            } else {
                // ... (Leave your existing Spontaneous block logic below here exactly as is) ...
                const now = new Date();
                const pad = n => String(n).padStart(2, '0');
                const actualEndStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
                const startObj = new Date(now.getTime() - ((t.studySeconds || 0) + (t.breakSeconds || 0)) * 1000);
                const actualStartStr = `${pad(startObj.getHours())}:${pad(startObj.getMinutes())}:${pad(startObj.getSeconds())}`;

                const newSpontaneousBlock = {
                    id: 'spont_' + Date.now(),
                    subject: t.spontaneousSubject || 'General',
                    title: 'Spontaneous Focus',
                    date: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
                    startDate: `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`,
                    actualStart: actualStartStr,
                    actualEnd: actualEndStr,
                    studySeconds: t.studySeconds || 0,
                    breakSeconds: t.breakSeconds || 0,
                    sessionId: t.sessionId || null,
                    sessionSegmentIndex: t.sessionIndex || 1,
                    status: 'completed',
                    remarks: ''
                };
                store.update('blocks', old => [...old, newSpontaneousBlock]);
            }

            // Accumulate session total and advance session index
            const prevAccum = t.sessionAccumulatedSeconds || 0;
            store.update('timer', () => ({
                activeBlockId: null, spontaneousSubject: null,
                mode: 'pomodoro', phase: 'study',
                studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: false,
                sessionAccumulatedSeconds: prevAccum + (t.studySeconds || 0),
                sessionId: t.sessionId || null,
                sessionIndex: (t.sessionIndex || 1) + 1
            }));
        });

        this.continueBtn?.addEventListener('click', () => {
            const t = store.state.timer;
            if (!t.sessionId) {
                const sid = 'sess_' + Date.now();
                store.update('timer', s => ({ ...s, sessionId: sid, sessionAccumulatedSeconds: s.sessionAccumulatedSeconds || 0, sessionIndex: s.sessionIndex || 1 }));
            }
            // Start a fresh segment and resume
            store.update('timer', s => ({ ...s, isRunning: true, studySeconds: 0, breakSeconds: 0, secondsElapsed: 0 }));
            timerEngine.start();
        });
    }
    updateUI() {
        const t = store.state.timer;

        if (this.toggleBtn) {
            this.toggleBtn.innerText = t.isRunning ? "Pause" : "Start";
            this.toggleBtn.className = t.isRunning 
                ? "flex-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 text-lg"
                : "flex-1 custom-action-btn text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 text-lg";
        }

        if (this.switchPhaseBtn) this.switchPhaseBtn.innerText = t.phase === 'study' ? "Take Break" : "Start Focus";
        
        if (this.phaseIndicator) {
            this.phaseIndicator.innerText = t.phase === 'study' ? "Focus Time" : "Break Time";
            this.phaseIndicator.className = t.phase === 'study' 
                ? "inline-block px-4 py-1 bg-blue-100 text-theme-action rounded-full text-xs font-black uppercase tracking-wider mb-6 shadow-sm"
                : "inline-block px-4 py-1 bg-green-100 text-green-700 rounded-full text-xs font-black uppercase tracking-wider mb-6 shadow-sm";
        }

        if (this.display) {
            let displaySeconds = 0;
            if (t.mode === 'stopwatch') {
                displaySeconds = t.phase === 'study' ? t.studySeconds : t.breakSeconds;
            } else {
                const targetSecs = t.phase === 'study' ? this.pStudy : this.pBreak;
                const elapsed = t.phase === 'study' ? t.studySeconds : t.breakSeconds;
                displaySeconds = targetSecs - (elapsed % targetSecs);
                if (displaySeconds < 0) displaySeconds = 0;
            }

            const hrs = Math.floor(displaySeconds / 3600);
            const min = Math.floor((displaySeconds % 3600) / 60).toString().padStart(2, '0');
            const sec = (displaySeconds % 60).toString().padStart(2, '0');
            this.display.innerText = hrs > 0 ? `${hrs}:${min}:${sec}` : `${min}:${sec}`;
        }

        // Session total display
        const sessionTotalEl = document.getElementById('sessionTotalDisplay');
        const acc = t.sessionAccumulatedSeconds || 0;
        if (sessionTotalEl) {
            if (acc > 0 || (t.isRunning && t.sessionId)) {
                const combined = acc + (t.isRunning ? t.studySeconds : 0);
                const h = Math.floor(combined / 3600);
                const m = Math.floor((combined % 3600) / 60);
                const s = combined % 60;
                sessionTotalEl.innerText = `Session total: ${h}h ${m}m ${s}s`;
                sessionTotalEl.classList.remove('hidden');
            } else {
                sessionTotalEl.classList.add('hidden');
            }
        }

        if (this.applyPomodoroToggle) {
            const tSettings = store.state.timerSettings || {};
            this.applyPomodoroToggle.checked = tSettings.applyPomodoro !== false;
        }

        // Mode button styles
        if (t.mode === 'stopwatch') {
            if (this.modeStopwatchBtn) this.modeStopwatchBtn.className = "flex-1 px-4 py-2 rounded shadow bg-white font-bold text-sm transition-all text-theme-action";
            if (this.modePomodoroBtn) this.modePomodoroBtn.className = "flex-1 px-4 py-2 rounded text-gray-400 font-bold text-sm transition-all hover:text-gray-600";
            if (this.switchPhaseBtn) this.switchPhaseBtn.classList.remove('hidden');
        } else {
            if (this.modePomodoroBtn) this.modePomodoroBtn.className = "flex-1 px-4 py-2 rounded shadow bg-white font-bold text-sm transition-all text-theme-action";
            if (this.modeStopwatchBtn) this.modeStopwatchBtn.className = "flex-1 px-4 py-2 rounded text-gray-400 font-bold text-sm transition-all hover:text-gray-600";
            if (this.switchPhaseBtn) this.switchPhaseBtn.classList.add('hidden');
        }

        // Show/hide finish buttons
        if (t.isRunning || t.studySeconds > 0 || t.breakSeconds > 0) {
            if (this.finishTimerBtn) this.finishTimerBtn.classList.remove('hidden');
            if (this.pushBackBtn) this.pushBackBtn.classList.remove('hidden');
            if (this.spontaneousSubjectSelect) {
                this.spontaneousSubjectSelect.disabled = true;
                this.spontaneousSubjectSelect.classList.add('opacity-50');
            }
        } else {
            if (this.finishTimerBtn) this.finishTimerBtn.classList.add('hidden');
            if (this.pushBackBtn) this.pushBackBtn.classList.add('hidden');
            if (this.spontaneousSubjectSelect) {
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
}
export const timerUI = new TimerUI();

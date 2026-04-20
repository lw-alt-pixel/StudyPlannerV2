// js/MarathonEngine.js
import { store } from './State.js';
import { audioEngine } from './AudioEngine.js';

class MarathonEngine {
    init() {
        this.modal = document.getElementById('marathonSetupModal');
        this.builderList = document.getElementById('marathonPhaseBuilderList');
        
        this.checkInModal = document.getElementById('examCheckInModal');
        this.unlockModal = document.getElementById('unlockMockExamModal');
        
        this.masterClockInterval = null;
        
        this.bindEvents();
        this.addPhaseRow('exam'); // Initialize with one exam row

        // If a marathon is already active in state, resume the clock!
        if (store.state.marathon && store.state.marathon.active) {
            this.triggerTunnelVision(true);
            this.startMasterClock();
        }
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }
    formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    formatTime(d) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }

    bindEvents() {
        document.getElementById('openMarathonModalBtn')?.addEventListener('click', () => {
            document.getElementById('marathonStartDate').value = this.formatDate(this.getChinaTime());
            this.modal?.classList.remove('hidden');
        });
        
        document.getElementById('closeMarathonModalBtn')?.addEventListener('click', () => {
            this.modal?.classList.add('hidden');
        });

        // 🚨 Phase Builders
        document.getElementById('addExamPhaseBtn')?.addEventListener('click', () => this.addPhaseRow('exam'));
        document.getElementById('addBreakPhaseBtn')?.addEventListener('click', () => this.addPhaseRow('break'));

        // 🚨 The Lock In Engine
        document.getElementById('lockInMarathonBtn')?.addEventListener('click', () => this.lockInExam());

        // 🚨 Check-In Button
        document.getElementById('performCheckInBtn')?.addEventListener('click', () => {
            const m = store.state.marathon;
            if (!m || !m.active) return;
            
            // Mark the current impending exam as checked in
            const nextExam = m.phases.find(p => p.type === 'exam' && !p.checkedIn);
            if (nextExam) {
                store.update('marathon', state => {
                    const phases = [...state.phases];
                    const idx = phases.findIndex(x => x.id === nextExam.id);
                    if (idx !== -1) phases[idx].checkedIn = true;
                    return { ...state, phases };
                });
            }
            
            this.checkInModal.classList.add('hidden');
        });

        // 🚨 Unlock / Abort Logic
        document.getElementById('cancelUnlockBtn')?.addEventListener('click', () => this.unlockModal.classList.add('hidden'));
        document.getElementById('confirmUnlockBtn')?.addEventListener('click', () => {
            const attempt = document.getElementById('unlockAttemptInput').value;
            const target = store.state.marathon.password;
            if (attempt === target) {
                this.abortMarathon();
            } else {
                alert("Incorrect commitment password. You are still locked in.");
            }
        });
    }

    addPhaseRow(type) {
        if (!this.builderList) return;
        const id = Date.now() + Math.floor(Math.random() * 1000);
        const row = document.createElement('div');
        row.className = `flex items-center gap-2 p-2 rounded-lg border ${type === 'exam' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} phase-row`;
        row.dataset.type = type;
        
        const typeLabel = type === 'exam' ? '<i class="fa fa-file-alt text-red-500 w-4"></i>' : '<i class="fa fa-coffee text-green-500 w-4"></i>';
        
        row.innerHTML = `
            ${typeLabel}
            <input type="text" class="phase-title flex-1 p-1.5 text-xs font-bold border rounded outline-none" placeholder="${type === 'exam' ? 'Exam Title (e.g. Physics Paper 1)' : 'Break'}" value="${type === 'break' ? 'Break' : ''}" ${type === 'break' ? 'readonly' : ''}>
            <input type="number" class="phase-duration w-16 p-1.5 text-xs font-bold border rounded outline-none text-center" placeholder="Mins" min="1">
            <button class="delete-row-btn text-gray-400 hover:text-red-500 px-2"><i class="fa fa-times"></i></button>
        `;
        
        row.querySelector('.delete-row-btn').addEventListener('click', () => row.remove());
        this.builderList.appendChild(row);
    }

    lockInExam() {
        const dateVal = document.getElementById('marathonStartDate').value;
        const timeVal = document.getElementById('marathonStartTime').value;
        const password = document.getElementById('marathonCommitmentPassword').value.trim();

        if (!dateVal || !timeVal) return alert("Please specify the absolute start date and time.");
        if (!password) return alert("You must type a commitment password to lock this in.");

        const rows = Array.from(this.builderList.querySelectorAll('.phase-row'));
        if (rows.length === 0 || rows[0].dataset.type !== 'exam') return alert("You must have at least one phase, and the first phase MUST be an exam.");

        // Stop standard timer to prevent interference
        store.update('timer', t => ({ ...t, isRunning: false }));

        let currentMs = new Date(`${dateVal}T${timeVal}:00`).getTime();
        const phases = [];
        const canvasBlocks = [];

        for (let i = 0; i < rows.length; i++) {
            const type = rows[i].dataset.type;
            const title = rows[i].querySelector('.phase-title').value || `Phase ${i+1}`;
            const durationMins = parseInt(rows[i].querySelector('.phase-duration').value) || 0;
            
            if (durationMins <= 0) return alert(`Phase ${i+1} has an invalid duration.`);

            const endMs = currentMs + (durationMins * 60000);
            const id = 'mock_' + Date.now() + i;

            phases.push({
                id, type, title, startMs: currentMs, endMs: endMs,
                announcedCheckIn: false, announcedStart: false, announcedEnd: false, checkedIn: false
            });

            // Generate the ghost block for Canvas
            canvasBlocks.push({
                id,
                subject: type === 'exam' ? '🚨 MOCK EXAM' : '☕ BREAK',
                title: `[LOCKED] ${title}`,
                date: this.formatDate(new Date(currentMs)),
                scheduledStart: this.formatTime(new Date(currentMs)),
                scheduledEnd: this.formatTime(new Date(endMs)),
                status: 'pending',
                isMockExam: true
            });

            currentMs = endMs; // Chain them tightly
        }

        // Save to state
        store.update('marathon', () => ({ active: true, password, phases }));
        
        // Inject Canvas Blocks
        store.update('blocks', old => [...old, ...canvasBlocks]);

        this.modal.classList.add('hidden');
        alert("Mock Exam Locked In. Godspeed.");
        
        this.triggerTunnelVision(true);
        this.startMasterClock();
    }

    startMasterClock() {
        if (this.masterClockInterval) clearInterval(this.masterClockInterval);
        
        this.masterClockInterval = setInterval(() => {
            const m = store.state.marathon;
            if (!m || !m.active) { clearInterval(this.masterClockInterval); return; }

            const now = Date.now();
            let activePhase = null;
            let isExamFinished = true; // Assume finished unless we find future phases

            // We must update the state array carefully
            const updatedPhases = [...m.phases];
            let stateChanged = false;

            for (let i = 0; i < updatedPhases.length; i++) {
                let p = updatedPhases[i];
                let timeToStart = p.startMs - now;
                let timeToEnd = p.endMs - now;

                if (timeToEnd > 0) isExamFinished = false; // Exam is still ongoing

                // 1. Check-In Window (5 mins before Exam)
                if (timeToStart <= 300000 && timeToStart > 0 && p.type === 'exam') {
                    if (!p.announcedCheckIn) {
                        p.announcedCheckIn = true; stateChanged = true;
                        audioEngine.playExamAnnouncement(`${p.title} check-in starts now.`);
                    }
                    if (!p.checkedIn) this.showCheckInModal(p, timeToStart);
                }

                // 2. Start Trigger
                if (timeToStart <= 0 && timeToEnd > 0) {
                    activePhase = p;
                    if (!p.announcedStart) {
                        p.announcedStart = true; stateChanged = true;
                        if (p.type === 'exam') audioEngine.playExamAnnouncement(`${p.title} begins now.`);
                        else audioEngine.playExamAnnouncement(`Break time starts now.`);
                    }
                    
                    // Penalty Handling: If exam started and they haven't checked in!
                    if (p.type === 'exam' && !p.checkedIn) {
                        this.showCheckInModal(p, timeToStart); // Pass negative time to show late penalty
                    } else {
                        this.checkInModal.classList.add('hidden');
                    }
                }

                // 3. End Trigger
                if (timeToEnd <= 0 && !p.announcedEnd) {
                    p.announcedEnd = true; stateChanged = true;
                    if (p.type === 'exam') audioEngine.playExamAnnouncement(`${p.title} time is up. Stop writing.`);
                }
            }

            if (stateChanged) store.update('marathon', state => ({ ...state, phases: updatedPhases }));

            // 4. Update UI Display
            if (activePhase) {
                const remainingSecs = Math.floor((activePhase.endMs - now) / 1000);
                const mins = String(Math.floor(remainingSecs / 60)).padStart(2, '0');
                const secs = String(remainingSecs % 60).padStart(2, '0');
                
                const display = document.getElementById('timerDisplay');
                if (display) {
                    display.innerText = `${mins}:${secs}`;
                    display.style.color = activePhase.type === 'exam' ? '#1f2937' : '#10b981';
                }
                
                const indicator = document.getElementById('phaseIndicator');
                if (indicator) {
                    indicator.innerText = `[ABSOLUTE CLOCK] ${activePhase.title.toUpperCase()}`;
                    indicator.className = `inline-block px-4 py-1 rounded-full text-xs font-black uppercase tracking-wider mb-6 shadow-sm ${activePhase.type === 'exam' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`;
                }
            } else if (!isExamFinished) {
                // We are in the limbo before the first phase
                document.getElementById('timerDisplay').innerText = "WAIT";
                document.getElementById('phaseIndicator').innerText = "AWAITING START TIME";
            }

            // 5. Exam Completion
            if (isExamFinished) {
                this.abortMarathon(true); // Graceful finish
            }

        }, 1000);
    }

    showCheckInModal(phase, timeToStartMs) {
        this.checkInModal.classList.remove('hidden');
        const titleEl = document.getElementById('checkInTitle');
        const countdownEl = document.getElementById('checkInCountdown');
        
        titleEl.innerText = phase.title;

        if (timeToStartMs > 0) {
            const secs = Math.floor(timeToStartMs / 1000);
            countdownEl.innerText = `- ${String(Math.floor(secs / 60)).padStart(2,'0')}:${String(secs % 60).padStart(2,'0')}`;
            countdownEl.classList.remove('text-red-500'); countdownEl.classList.add('text-yellow-400');
            document.getElementById('performCheckInBtn').innerText = "I AM READY";
        } else {
            // THEY ARE LATE!
            const lateSecs = Math.floor(Math.abs(timeToStartMs) / 1000);
            countdownEl.innerText = `LATE: +${String(Math.floor(lateSecs / 60)).padStart(2,'0')}:${String(lateSecs % 60).padStart(2,'0')}`;
            countdownEl.classList.remove('text-yellow-400'); countdownEl.classList.add('text-red-500');
            document.getElementById('performCheckInBtn').innerText = "ACKNOWLEDGE TIME PENALTY";
        }
    }

    triggerTunnelVision(enable) {
        const elsToHide = ['.tab-btn', '#canvasControls', '#calendarControls', '#globalExamBanner', '.floating-widget', '#appHeader', '#appNav'];
        elsToHide.forEach(sel => document.querySelectorAll(sel).forEach(el => {
            if(enable) el.classList.add('!hidden'); else el.classList.remove('!hidden');
        }));
        
        if (enable) {
            document.querySelector('.tab-btn[data-tab="focus"]')?.click();
            document.getElementById('focus').classList.add('!fixed', '!inset-0', '!z-[9999]', '!rounded-none');
            document.getElementById('standardTimerControls')?.classList.add('hidden');
            
            // Add custom abort button to Focus tab
            if (!document.getElementById('abortMarathonBtn')) {
                const abortBtn = document.createElement('button');
                abortBtn.id = 'abortMarathonBtn';
                abortBtn.className = 'mt-8 px-6 py-2 bg-gray-200 text-gray-500 font-bold rounded-xl hover:bg-red-100 hover:text-red-600 transition-colors text-xs';
                abortBtn.innerText = "Abort Absolute Exam";
                abortBtn.onclick = () => {
                    document.getElementById('unlockTargetPhrase').innerText = `"${store.state.marathon.password}"`;
                    document.getElementById('unlockAttemptInput').value = '';
                    this.unlockModal.classList.remove('hidden');
                };
                document.getElementById('focus').querySelector('.p-8.flex-col').appendChild(abortBtn);
            }
            document.getElementById('abortMarathonBtn').classList.remove('hidden');
        } else {
            document.getElementById('focus').classList.remove('!fixed', '!inset-0', '!z-[9999]', '!rounded-none');
            document.getElementById('standardTimerControls')?.classList.remove('hidden');
            if (document.getElementById('abortMarathonBtn')) document.getElementById('abortMarathonBtn').classList.add('hidden');
            
            const indicator = document.getElementById('phaseIndicator');
            if (indicator) { indicator.innerText = "Focus Time"; indicator.className = "inline-block px-4 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-black uppercase tracking-wider mb-6 shadow-sm"; }
            document.getElementById('timerDisplay').style.color = '#1f2937';
        }
    }

    abortMarathon(graceful = false) {
        clearInterval(this.masterClockInterval);
        
        // Remove the locked mock blocks from the Canvas
        store.update('blocks', old => old.filter(b => !b.isMockExam));
        
        store.update('marathon', () => ({ active: false, phases: [], password: '', currentPhaseIdx: -1 }));
        
        this.unlockModal.classList.add('hidden');
        this.checkInModal.classList.add('hidden');
        this.triggerTunnelVision(false);
        
        if (graceful) {
            alert("🎉 MOCK EXAM COMPLETE. Outstanding endurance!");
        } else {
            alert("Exam aborted. Canvas blocks cleared.");
        }
    }
}
export const marathonEngine = new MarathonEngine();

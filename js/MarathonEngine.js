// js/MarathonEngine.js
import { store } from './State.js';
import { audioEngine } from './AudioEngine.js';

class MarathonEngine {
    init() {
        this.checkInterval = null;
        this.bindEvents();
    }

    bindEvents() {
        document.addEventListener("visibilitychange", () => {
            const m = store.state.marathon;
            if (m.active && document.hidden && !m.isWaitingForCheckIn) {
                // If in an EXAM phase, punish them!
                const currentPhase = m.phases[m.currentPhaseIdx];
                if (currentPhase && currentPhase.type === 'exam') {
                    this.issueStrike();
                }
            }
        });

        document.getElementById('saveMarathonBtn')?.addEventListener('click', () => this.buildSchedule());
        document.getElementById('marathonCheckInBtn')?.addEventListener('click', () => this.checkIn());
        document.getElementById('abortMarathonBtn')?.addEventListener('click', () => {
            if(confirm("Are you sure you want to abort the exam? This will be recorded as a failure.")) this.endMarathon(true);
        });
    }

    buildSchedule() {
        const startTimeStr = document.getElementById('marathonStartTime').value;
        const examMins = parseInt(document.getElementById('marathonExamMins').value) || 120;
        const breakMins = parseInt(document.getElementById('marathonBreakMins').value) || 45;
        const phaseCount = parseInt(document.getElementById('marathonPhaseCount').value) || 2;
        
        if (!startTimeStr) return alert("Please select a start time.");

        const now = new Date();
        const [h, min] = startTimeStr.split(':');
        let scheduleStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(h), parseInt(min), 0);
        
        if (scheduleStart < now) scheduleStart.setDate(scheduleStart.getDate() + 1); // Push to tomorrow if time passed

        const phases = [];
        let currentMarker = new Date(scheduleStart);

        for (let i = 0; i < phaseCount; i++) {
            phases.push({ type: 'exam', start: new Date(currentMarker), end: new Date(currentMarker.getTime() + examMins * 60000) });
            currentMarker = new Date(currentMarker.getTime() + examMins * 60000);
            
            if (i < phaseCount - 1) { // No break after the very last exam
                phases.push({ type: 'break', start: new Date(currentMarker), end: new Date(currentMarker.getTime() + breakMins * 60000) });
                currentMarker = new Date(currentMarker.getTime() + breakMins * 60000);
            }
        }

        store.update('marathon', m => ({
            ...m, active: true, isWaitingForCheckIn: true, strikes: 0, phases: phases, currentPhaseIdx: -1, checkInTime: new Date(scheduleStart.getTime() - 2 * 60000)
        }));

        document.getElementById('marathonSetupModal').classList.add('hidden');
        this.triggerTunnelVision(true);
        this.startEngine();
    }

    checkIn() {
        const m = store.state.marathon;
        if (new Date() < m.checkInTime) return alert("You cannot check in until 2 minutes before the exam starts.");
        
        store.update('marathon', m => ({ ...m, isWaitingForCheckIn: false }));
        document.getElementById('marathonCheckInBtn').classList.add('hidden');
        document.getElementById('marathonStatusText').innerText = "Checked In. Awaiting Start Bell...";
    }

    issueStrike() {
        const m = store.state.marathon;
        const newStrikes = m.strikes + 1;
        store.update('marathon', m => ({ ...m, strikes: newStrikes }));
        
        const overlay = document.getElementById('strikeOverlay');
        const text = document.getElementById('strikeText');
        
        if (newStrikes >= 3) {
            text.innerText = "STRIKE 3. EXAM DISQUALIFIED.";
            overlay.classList.remove('hidden');
            audioEngine.playDoubleBell();
            setTimeout(() => { overlay.classList.add('hidden'); this.endMarathon(true); }, 3000);
        } else {
            text.innerText = `WARNING: EYES ON PAPER. STRIKE ${newStrikes}/3.`;
            overlay.classList.remove('hidden');
            setTimeout(() => overlay.classList.add('hidden'), 3000);
        }
    }

    startEngine() {
        if (this.checkInterval) clearInterval(this.checkInterval);
        this.checkInterval = setInterval(() => this.tick(), 1000);
    }

    tick() {
        const m = store.state.marathon;
        if (!m.active) return clearInterval(this.checkInterval);

        const now = new Date();

        // Check-in window logic
        if (m.isWaitingForCheckIn) {
            if (now >= m.checkInTime && now < m.phases[0].start) {
                document.getElementById('marathonCheckInBtn').classList.remove('hidden');
                document.getElementById('marathonStatusText').innerText = "CHECK-IN WINDOW OPEN (2 MINS)";
            } else if (now >= m.phases[0].start) {
                alert("You missed the check-in window. Exam voided.");
                this.endMarathon(true);
            }
            return;
        }

        // Phase Logic
        let activeIdx = -1;
        for (let i = 0; i < m.phases.length; i++) {
            if (now >= m.phases[i].start && now < m.phases[i].end) { activeIdx = i; break; }
        }

        if (activeIdx === -1 && now >= m.phases[m.phases.length - 1].end) {
            // Exam completely over
            audioEngine.playDoubleBell();
            audioEngine.playSpeech("Pencils down. The exam has concluded.");
            this.endMarathon(false);
            return;
        }

        if (activeIdx !== -1) {
            const phase = m.phases[activeIdx];
            const timeLeft = Math.floor((phase.end - now) / 1000);
            
            // Phase Transition Detection
            if (activeIdx !== m.currentPhaseIdx) {
                store.update('marathon', m => ({ ...m, currentPhaseIdx: activeIdx }));
                if (phase.type === 'exam') {
                    audioEngine.playSchoolBell();
                    document.getElementById('marathonStatusText').innerText = `EXAM PHASE ${Math.ceil((activeIdx+1)/2)}`;
                } else {
                    audioEngine.playSpeech("Pencils down. Break time has begun.");
                    document.getElementById('marathonStatusText').innerText = `STRICT BREAK PHASE`;
                }
            }

            // Update Timer Display
            const min = Math.floor(timeLeft / 60).toString().padStart(2, '0');
            const sec = (timeLeft % 60).toString().padStart(2, '0');
            document.getElementById('timerDisplay').innerText = `${min}:${sec}`;

            // 5 Minute Break Warning!
            if (phase.type === 'break' && timeLeft === 300 && !m.warned5Min) {
                audioEngine.playDidaDida();
                setTimeout(() => audioEngine.playSpeech("The exam is beginning in about 5 minutes. Please return to your seat."), 1500);
                store.update('marathon', m => ({ ...m, warned5Min: true }));
            } else if (phase.type === 'exam') {
                store.update('marathon', m => ({ ...m, warned5Min: false })); // Reset for next break
            }
        }
    }

    triggerTunnelVision(enable) {
        const elsToHide = ['.tab-btn', '#canvasControls', '#calendarControls', '#globalExamBanner', '.floating-widget'];
        elsToHide.forEach(sel => document.querySelectorAll(sel).forEach(el => {
            if(enable) el.classList.add('!hidden'); else el.classList.remove('!hidden');
        }));
        
        if (enable) {
            document.querySelector('[data-tab="focus"]')?.click();
            document.getElementById('focus').classList.add('!fixed', '!inset-0', '!z-[9999]', '!rounded-none');
            document.getElementById('standardTimerControls').classList.add('hidden');
            document.getElementById('marathonControls').classList.remove('hidden');
        } else {
            document.getElementById('focus').classList.remove('!fixed', '!inset-0', '!z-[9999]', '!rounded-none');
            document.getElementById('standardTimerControls').classList.remove('hidden');
            document.getElementById('marathonControls').classList.add('hidden');
        }
    }

    endMarathon(failed) {
        clearInterval(this.checkInterval);
        store.update('marathon', m => ({ ...m, active: false, isWaitingForCheckIn: false, currentPhaseIdx: -1 }));
        this.triggerTunnelVision(false);
        if(!failed) alert("Marathon Completed Successfully! Great endurance!");
        document.getElementById('timerDisplay').innerText = "00:00";
    }
}
export const marathonEngine = new MarathonEngine();

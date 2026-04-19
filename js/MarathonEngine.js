// js/MarathonEngine.js
import { store } from './State.js';

class MarathonEngine {
    init() {
        this.checkInterval = null;
        this.phaseCountInput = document.getElementById('marathonPhaseCount');
        this.phaseListContainer = document.getElementById('marathonPhaseList');
        this.modal = document.getElementById('marathonSetupModal');
        
        this.bindEvents();
        
        if (this.phaseCountInput && this.phaseListContainer) {
            this.renderPhaseInputs();
        }
    }

    bindEvents() {
        document.getElementById('openMarathonModalBtn')?.addEventListener('click', () => {
            this.modal?.classList.remove('hidden');
        });
        
        document.getElementById('closeMarathonModalBtn')?.addEventListener('click', () => {
            this.modal?.classList.add('hidden');
        });

        this.phaseCountInput?.addEventListener('input', () => this.renderPhaseInputs());

        // 🚨 THE FIX: Properly harvesting dynamic inputs and Locking In
        document.getElementById('lockInMarathonBtn')?.addEventListener('click', () => {
            const count = parseInt(this.phaseCountInput.value) || 1;
            const newPhases = [];
            
            for (let i = 0; i < count; i++) {
                const minInput = document.getElementById(`marathonPhase_${i}`);
                if (!minInput) continue;
                
                const minutes = parseInt(minInput.value) || 0;
                if (minutes > 0) {
                    newPhases.push({ type: 'exam', durationSecs: minutes * 60 });
                    // Automatically add a 5-minute break between exams, unless it's the last one
                    if (i < count - 1) {
                        newPhases.push({ type: 'break', durationSecs: 5 * 60 }); 
                    }
                }
            }

            if (newPhases.length === 0) {
                alert("Please enter at least one valid duration.");
                return;
            }

            store.update('marathon', () => ({
                active: true,
                phases: newPhases,
                currentPhaseIdx: 0,
                strikes: 0,
                isWaitingForCheckIn: true 
            }));

            this.modal?.classList.add('hidden');
            this.triggerTunnelVision(true);
            this.startNextPhase();
        });
    }

    renderPhaseInputs() {
        if (!this.phaseListContainer) return;
        this.phaseListContainer.innerHTML = '';
        const count = parseInt(this.phaseCountInput.value) || 1;
        
        for (let i = 0; i < count; i++) {
            const div = document.createElement('div');
            div.className = "flex items-center gap-4 bg-gray-50 p-3 rounded-lg border border-gray-200";
            div.innerHTML = `
                <div class="font-bold text-gray-600 w-24">Phase ${i + 1}</div>
                <input type="number" id="marathonPhase_${i}" min="1" max="300" class="flex-1 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:border-red-500" placeholder="Minutes">
            `;
            this.phaseListContainer.appendChild(div);
        }
    }

    triggerTunnelVision(enable) {
        const elsToHide = ['.tab-btn', '#canvasControls', '#calendarControls', '#globalExamBanner', '.floating-widget'];
        elsToHide.forEach(sel => document.querySelectorAll(sel).forEach(el => {
            if(enable) el.classList.add('!hidden'); else el.classList.remove('!hidden');
        }));
        
        if (enable) {
            document.querySelector('.tab-btn[data-tab="focus"]')?.click();
            document.getElementById('focus').classList.add('!fixed', '!inset-0', '!z-[9999]', '!rounded-none');
            document.getElementById('standardTimerControls')?.classList.add('hidden');
            document.getElementById('marathonControls')?.classList.remove('hidden');
        } else {
            document.getElementById('focus').classList.remove('!fixed', '!inset-0', '!z-[9999]', '!rounded-none');
            document.getElementById('standardTimerControls')?.classList.remove('hidden');
            document.getElementById('marathonControls')?.classList.add('hidden');
        }
    }

    startNextPhase() {} // Stubbed to prevent errors, TimerEngine handles countdown
    issueStrike() {} // Stubbed
}
export const marathonEngine = new MarathonEngine();

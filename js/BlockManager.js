// js/BlockManager.js
import { store } from './State.js';

class BlockManager {
    init() {
        this.bindEvents();
    }

    bindEvents() {
        // --- ADD BLOCK LOGIC ---
        document.getElementById('saveNewBlock')?.addEventListener('click', () => {
            const subject = document.getElementById('newBlockSubject').value;
            const title = document.getElementById('newBlockTitle').value || 'Study Session';
            const sD = document.getElementById('newBlockStartDate').value;
            const sT = document.getElementById('newBlockStart').value;
            const eD = document.getElementById('newBlockEndDate').value;
            const eT = document.getElementById('newBlockEnd').value;
            
            let finalSub = subject;
            if(subject === 'custom') {
                finalSub = document.getElementById('newBlockCustomName').value || 'Custom';
                const color = document.getElementById('newBlockCustomColor').value;
                store.update('subjects', s => ({...s, [finalSub]: color}));
            }

            const newBlock = {
                id: Date.now().toString(),
                subject: finalSub, title: title,
                startDate: sD, scheduledStart: sT,
                endDate: eD, scheduledEnd: eT,
                status: 'pending', studySeconds: 0, breakSeconds: 0, remarks: ''
            };

            store.update('blocks', b => [...b, newBlock]);
            document.getElementById('addBlockModal').classList.add('hidden');
        });

        document.getElementById('cancelAddBlock')?.addEventListener('click', () => {
            document.getElementById('addBlockModal').classList.add('hidden');
        });

        // --- EDIT BLOCK LOGIC (The Core Update) ---
        document.getElementById('saveEditBlock')?.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (!id) return;

            const title = document.getElementById('editBlockTitle')?.value;
            const schedStartD = document.getElementById('editBlockSchedStartDate')?.value;
            const schedStartT = document.getElementById('editBlockSchedStart')?.value;
            const schedEndD = document.getElementById('editBlockSchedEndDate')?.value;
            const schedEndT = document.getElementById('editBlockSchedEnd')?.value;
            
            const realStart = document.getElementById('editBlockRealStart')?.value;
            const realEnd = document.getElementById('editBlockRealEnd')?.value;
            const studyMins = parseInt(document.getElementById('editBlockStudyMins')?.value);
            const remarks = document.getElementById('editBlockRemarks')?.value;

            store.update('blocks', blocks => blocks.map(b => {
                if (b.id === id) {
                    const t = store.state.timer;
                    const isActiveAndRunning = (t.activeBlockId === b.id && t.isRunning);
                    
                    let newStudySeconds = b.studySeconds;
                    let newActualStart = b.actualStart;
                    let newActualEnd = b.actualEnd;
                    let newStatus = b.status;

                    // 🚨 COLLISION PROTECTION: Only update Real Time/Analytics if the Timer is NOT running
                    if (!isActiveAndRunning) {
                        if (!isNaN(studyMins)) {
                            newStudySeconds = studyMins * 60;
                            // If they logged time, mark it as completed
                            if (newStudySeconds > 0 && b.status !== 'completed') {
                                newStatus = 'completed';
                            }
                        }
                        if (realStart) newActualStart = realStart;
                        if (realEnd) newActualEnd = realEnd;
                    }

                    return {
                        ...b,
                        title: title !== undefined ? title : b.title,
                        startDate: schedStartD || b.startDate,
                        endDate: schedEndD || b.endDate,
                        scheduledStart: schedStartT || b.scheduledStart,
                        scheduledEnd: schedEndT || b.scheduledEnd,
                        actualStart: newActualStart,
                        actualEnd: newActualEnd,
                        studySeconds: newStudySeconds,
                        remarks: remarks !== undefined ? remarks : b.remarks,
                        status: newStatus
                    };
                }
                return b;
            }));

            document.getElementById('editBlockModal')?.classList.add('hidden');
        });

        document.getElementById('cancelEditBlock')?.addEventListener('click', () => {
            document.getElementById('editBlockModal')?.classList.add('hidden');
        });

        document.getElementById('deleteEditBlock')?.addEventListener('click', () => {
            const btn = document.getElementById('saveEditBlock');
            if (btn && btn.dataset.id) {
                if (confirm("Are you sure you want to delete this block?")) {
                    store.update('blocks', blocks => blocks.filter(b => b.id !== btn.dataset.id));
                    document.getElementById('editBlockModal')?.classList.add('hidden');
                }
            }
        });
    }
}
export const blockManager = new BlockManager();

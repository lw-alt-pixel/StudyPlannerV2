// js/BlockManager.js
import { store } from './State.js';

class BlockManager {
    init() {
        // 🚨 Restored all missing references so the App doesn't crash on boot!
        this.modal = document.getElementById('addBlockModal');
        this.editModal = document.getElementById('editBlockModal');
        this.bulkModal = document.getElementById('bulkScheduleModal');
        this.pushBackModal = document.getElementById('pushBackModal');
        
        this.subjectInput = document.getElementById('newBlockSubject');
        this.customSubjectDiv = document.getElementById('newBlockCustomSubjectDiv');
        this.customNameInput = document.getElementById('newBlockCustomName');
        this.customColorInput = document.getElementById('newBlockCustomColor');
        
        this.activePushBackId = null;
        this.lastBulkBatchId = null;

        store.subscribe('subjects', () => this.populateSubjects());
        this.populateSubjects();
        this.bindEvents();
    }

    populateSubjects() {
        if (!this.subjectInput) return; 
        const subs = store.state.subjects;
        this.subjectInput.innerHTML = '';
        Object.keys(subs).forEach(s => {
            this.subjectInput.innerHTML += `<option value="${s}">${s}</option>`;
        });
        this.subjectInput.innerHTML += `<option value="custom">+ Add Custom Subject</option>`;
    }

    bindEvents() {
        this.subjectInput?.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                this.customSubjectDiv.classList.remove('hidden'); this.customSubjectDiv.classList.add('flex');
            } else {
                this.customSubjectDiv.classList.add('hidden'); this.customSubjectDiv.classList.remove('flex');
            }
        });

        // Modals Toggles
        document.getElementById('openAddBlockModalHeader')?.addEventListener('click', () => this.modal?.classList.remove('hidden'));
        document.getElementById('openAddBlockModal')?.addEventListener('click', () => this.modal?.classList.remove('hidden'));
        document.getElementById('fallbackAddBlockBtn')?.addEventListener('click', () => this.modal?.classList.remove('hidden'));
        document.getElementById('cancelAddBlock')?.addEventListener('click', () => this.modal?.classList.add('hidden'));

        // Save New Block
        document.getElementById('saveNewBlock')?.addEventListener('click', () => {
            const subject = this.subjectInput.value;
            const title = document.getElementById('newBlockTitle').value || 'Study Session';
            const sD = document.getElementById('newBlockStartDate').value;
            const sT = document.getElementById('newBlockStart').value;
            const eD = document.getElementById('newBlockEndDate').value;
            const eT = document.getElementById('newBlockEnd').value;
            
            let finalSub = subject;
            if (subject === 'custom') {
                finalSub = this.customNameInput.value || 'Custom';
                const color = this.customColorInput.value;
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
            this.modal?.classList.add('hidden');
        });

        // 🚨 EDIT BLOCK LOGIC (The Analytics Override Engine)
        document.getElementById('saveEditBlock')?.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            if (!id) return;

            const title = document.getElementById('editBlockTitle')?.value;
            const schedStartD = document.getElementById('editBlockSchedStartDate')?.value;
            const schedStartT = document.getElementById('editBlockSchedStart')?.value;
            const schedEndD = document.getElementById('editBlockSchedEndDate')?.value;
            const schedEndT = document.getElementById('editBlockSchedEnd')?.value;
            
            const studyMins = parseInt(document.getElementById('editBlockStudyMins')?.value);
            const remarks = document.getElementById('editBlockRemarks')?.value;

            store.update('blocks', blocks => blocks.map(b => {
                if (b.id === id) {
                    const t = store.state.timer;
                    const isActiveAndRunning = (t.activeBlockId === b.id && t.isRunning);
                    
                    let newStudySeconds = b.studySeconds;
                    let newStatus = b.status;

                    // Only update Analytics if the Timer is NOT actively running for this block!
                    if (!isActiveAndRunning && !isNaN(studyMins)) {
                        newStudySeconds = studyMins * 60;
                        if (newStudySeconds > 0 && b.status !== 'completed') {
                            newStatus = 'completed'; // Auto-complete if they added time
                        }
                    }

                    return {
                        ...b,
                        title: title !== undefined ? title : b.title,
                        startDate: schedStartD || b.startDate,
                        endDate: schedEndD || b.endDate,
                        scheduledStart: schedStartT || b.scheduledStart,
                        scheduledEnd: schedEndT || b.scheduledEnd,
                        studySeconds: newStudySeconds,
                        remarks: remarks !== undefined ? remarks : b.remarks,
                        status: newStatus
                    };
                }
                return b;
            }));

            this.editModal?.classList.add('hidden');
        });

        document.getElementById('cancelEditBlock')?.addEventListener('click', () => this.editModal?.classList.add('hidden'));

        document.getElementById('deleteEditBlock')?.addEventListener('click', () => {
            const btn = document.getElementById('saveEditBlock');
            if (btn && btn.dataset.id) {
                if (confirm("Are you sure you want to delete this block?")) {
                    store.update('blocks', blocks => blocks.filter(b => b.id !== btn.dataset.id));
                    this.editModal?.classList.add('hidden');
                }
            }
        });

        // Restored Bulk & PushBack UI triggers so no buttons throw errors
        document.getElementById('openBulkModalBtn')?.addEventListener('click', () => this.bulkModal?.classList.remove('hidden'));
        document.getElementById('cancelBulkBtn')?.addEventListener('click', () => this.bulkModal?.classList.add('hidden'));
        
        document.getElementById('cancelPushBackBtn')?.addEventListener('click', () => {
            this.pushBackModal?.classList.add('hidden');
            this.activePushBackId = null;
        });
    }
}
export const blockManager = new BlockManager();

// js/BlockManager.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';

class BlockManager {
    init() {
        this.modal = document.getElementById('addBlockModal');
        this.subjectInput = document.getElementById('newBlockSubject');
        this.customSubjectDiv = document.getElementById('newBlockCustomSubjectDiv');
        this.customNameInput = document.getElementById('newBlockCustomName');
        this.customColorInput = document.getElementById('newBlockCustomColor');
        this.titleInput = document.getElementById('newBlockTitle');
        this.startDateInput = document.getElementById('newBlockStartDate');
        this.startInput = document.getElementById('newBlockStart');
        this.endDateInput = document.getElementById('newBlockEndDate');
        this.endInput = document.getElementById('newBlockEnd');
        
        this.editModal = document.getElementById('editBlockModal');
        this.editBlockId = null;

        // NEW MODALS
        this.bulkModal = document.getElementById('bulkScheduleModal');
        this.pushBackModal = document.getElementById('pushBackModal');
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
        // --- ADD BLOCK LOGIC ---
        this.subjectInput?.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                this.customSubjectDiv.classList.remove('hidden'); this.customSubjectDiv.classList.add('flex');
            } else {
                this.customSubjectDiv.classList.add('hidden'); this.customSubjectDiv.classList.remove('flex');
            }
        });

        document.getElementById('openAddBlockModalHeader')?.addEventListener('click', () => this.modal?.classList.remove('hidden'));
        document.getElementById('openAddBlockModal')?.addEventListener('click', () => this.modal?.classList.remove('hidden'));
        document.getElementById('fallbackAddBlockBtn')?.addEventListener('click', () => this.modal?.classList.remove('hidden'));
        document.getElementById('cancelAddBlock')?.addEventListener('click', () => this.modal?.classList.add('hidden'));

        document.getElementById('saveNewBlock')?.addEventListener('click', () => {
            const subject = this.subjectInput.value;
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
            this.modal?.classList.add('hidden');
        });

        // --- EDIT BLOCK LOGIC (The Analytics Override Engine) ---
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

                    // 🚨 COLLISION PROTECTION: Only update Analytics if Timer is NOT running
                    if (!isActiveAndRunning && !isNaN(studyMins)) {
                        newStudySeconds = studyMins * 60;
                        if (newStudySeconds > 0 && b.status !== 'completed') {
                            newStatus = 'completed'; // Auto-complete if they added logged time
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

        document.getElementById('cancelEditBlock')?.addEventListener('click', () => {
            this.editModal?.classList.add('hidden');
        });

        document.getElementById('deleteEditBlock')?.addEventListener('click', () => {
            const btn = document.getElementById('saveEditBlock');
            if (btn && btn.dataset.id) {
                if (confirm("Are you sure you want to delete this block?")) {
                    store.update('blocks', blocks => blocks.filter(b => b.id !== btn.dataset.id));
                    this.editModal?.classList.add('hidden');
                }
            }
        });

        // --- BULK SCHEDULE LOGIC ---
        document.getElementById('openBulkModalBtn')?.addEventListener('click', () => {
            this.bulkModal?.classList.remove('hidden');
        });
        document.getElementById('cancelBulkBtn')?.addEventListener('click', () => {
            this.bulkModal?.classList.add('hidden');
        });
        document.getElementById('generateBulkBtn')?.addEventListener('click', () => {
            this.generateBulkSchedule();
        });
        document.getElementById('undoBulkBtn')?.addEventListener('click', () => {
            this.undoBulkSchedule();
        });

        // --- PUSH BACK LOGIC ---
        document.getElementById('cancelPushBackBtn')?.addEventListener('click', () => {
            this.pushBackModal?.classList.add('hidden');
            this.activePushBackId = null;
        });
        document.getElementById('confirmPushBackBtn')?.addEventListener('click', () => {
            this.pushBackBlocks();
        });
    }

    generateBulkSchedule() {
        const subject = document.getElementById('bulkSubject')?.value || 'General';
        const title = document.getElementById('bulkTitle')?.value || 'Study Session';
        const date = document.getElementById('bulkDate')?.value;
        const startT = document.getElementById('bulkStartTime')?.value;
        const endT = document.getElementById('bulkEndTime')?.value;
        
        const studyMins = parseInt(document.getElementById('bulkStudy')?.value) || 50;
        const breakMins = parseInt(document.getElementById('bulkBreak')?.value) || 10;
        
        const hasLunch = document.getElementById('bulkHasLunch')?.checked;
        const lunchTime = document.getElementById('bulkLunchTime')?.value || '12:00';
        const lunchDuration = parseInt(document.getElementById('bulkLunchDuration')?.value) || 60;

        if (!date || !startT || !endT) return alert("Please fill all required bulk fields.");

        const startObj = new Date(`${date}T${startT}:00`);
        const endObj = new Date(`${date}T${endT}:00`);
        
        let lunchStartObj = null;
        let lunchEndObj = null;
        if (hasLunch) {
            lunchStartObj = new Date(`${date}T${lunchTime}:00`);
            lunchEndObj = new Date(lunchStartObj.getTime() + lunchDuration * 60000);
        }

        let current = new Date(startObj);
        const batchId = Date.now().toString();
        const newGhostBlocks = [];
        let generated = 0;

        while (current < endObj) {
            // Check lunch collision
            if (hasLunch && current >= lunchStartObj && current < lunchEndObj) {
                current = new Date(lunchEndObj);
                continue;
            }

            let blockEnd = new Date(current.getTime() + studyMins * 60000);
            
            if (hasLunch && current < lunchStartObj && blockEnd > lunchStartObj) {
                blockEnd = new Date(lunchStartObj);
            }

            if (blockEnd > endObj) {
                blockEnd = endObj;
            }

            const durationMins = (blockEnd - current) / 60000;
            if (durationMins >= 5) {
                newGhostBlocks.push({
                    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                    subject: subject,
                    title: title,
                    startDate: current.toISOString().split('T')[0],
                    scheduledStart: current.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), 
                    endDate: blockEnd.toISOString().split('T')[0], 
                    scheduledEnd: blockEnd.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                    actualStart: null, actualEnd: null, status: 'pending', studySeconds: 0, breakSeconds: 0, remarks: '',
                    batchId: batchId // Used for UNDO
                });
                generated++;
            }

            // Move pointer forward (Study + Break)
            current = new Date(current.getTime() + (studyMins + breakMins) * 60000);
        }

        if (generated > 0) {
            this.lastBulkBatchId = batchId;
            store.update('blocks', old => [...old, ...newGhostBlocks]);
            document.getElementById('undoBulkBtn')?.classList.remove('hidden');
            alert(`Successfully generated ${generated} ghost blocks!`);
        } else {
            alert("Could not find any empty slots in that time range!");
        }
        this.bulkModal?.classList.add('hidden');
    }

    undoBulkSchedule() {
        if (!this.lastBulkBatchId) return;
        if (confirm("Remove the last bulk-generated blocks?")) {
            store.update('blocks', b => b.filter(x => x.batchId !== this.lastBulkBatchId));
            this.lastBulkBatchId = null;
            document.getElementById('undoBulkBtn')?.classList.add('hidden');
        }
    }

    pushBackBlocks() {
        const mins = parseInt(document.getElementById('pushBackMins')?.value);
        if (!mins || isNaN(mins) || !this.activePushBackId) return;

        const targetBlock = store.state.blocks.find(b => b.id === this.activePushBackId);
        if (!targetBlock) return;

        const pushDateStr = targetBlock.startDate;
        const pushStart = new Date(`${targetBlock.startDate}T${targetBlock.scheduledStart}:00`);

        store.update('blocks', blocks => {
            return blocks.map(b => {
                if (b.startDate === pushDateStr) {
                    const bStart = new Date(`${b.startDate}T${b.scheduledStart}:00`);
                    const bEnd = new Date(`${b.endDate}T${b.scheduledEnd}:00`);
                    
                    if (bStart >= pushStart) {
                        const newStart = new Date(bStart.getTime() + mins * 60000);
                        const newEnd = new Date(bEnd.getTime() + mins * 60000);
                        
                        return {
                            ...b,
                            scheduledStart: newStart.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                            scheduledEnd: newEnd.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                            startDate: newStart.toISOString().split('T')[0],
                            endDate: newEnd.toISOString().split('T')[0]
                        };
                    }
                }
                return b;
            });
        });

        this.pushBackModal?.classList.add('hidden');
        this.activePushBackId = null;
        alert(`Pushed back remaining blocks by ${mins} minutes!`);
    }
}
export const blockManager = new BlockManager();

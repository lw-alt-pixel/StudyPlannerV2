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

        // NEW: Sub-Tab Modals for Add Block
        this.tabSingle = document.getElementById('tabSingleBlock');
        this.tabBulk = document.getElementById('tabBulkBlock');
        this.singleForm = document.getElementById('singleBlockForm');
        this.bulkForm = document.getElementById('bulkBlockForm');

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
        const bulkSub = document.getElementById('bulkTargetSubject');
        if (bulkSub) bulkSub.innerHTML = '';
        
        Object.keys(subs).forEach(s => {
            this.subjectInput.innerHTML += `<option value="${s}">${s}</option>`;
            if(bulkSub) bulkSub.innerHTML += `<option value="${s}">${s}</option>`;
        });
        this.subjectInput.innerHTML += `<option value="custom">+ Add Custom Subject</option>`;
    }

    bindEvents() {
        // 🚨 SUB-TAB LOGIC
        this.tabSingle?.addEventListener('click', () => {
            this.tabSingle.className = "px-3 py-1 rounded bg-white shadow-sm font-black text-xs text-blue-600 transition-colors";
            this.tabBulk.className = "px-3 py-1 rounded font-bold text-xs text-gray-500 hover:text-gray-800 transition-colors";
            this.singleForm?.classList.remove('hidden');
            this.bulkForm?.classList.add('hidden');
        });
        
        this.tabBulk?.addEventListener('click', () => {
            this.tabBulk.className = "px-3 py-1 rounded bg-white shadow-sm font-black text-xs text-blue-600 transition-colors";
            this.tabSingle.className = "px-3 py-1 rounded font-bold text-xs text-gray-500 hover:text-gray-800 transition-colors";
            this.bulkForm?.classList.remove('hidden');
            this.singleForm?.classList.add('hidden');
        });

        // 🚨 CANCEL CLOSES THE ENTIRE UNIFIED MODAL
        document.getElementById('cancelAddBlock')?.addEventListener('click', () => this.modal?.classList.add('hidden'));
        document.getElementById('cancelBulkSchedule')?.addEventListener('click', () => this.modal?.classList.add('hidden'));

        this.subjectInput?.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                this.customSubjectDiv.classList.remove('hidden'); this.customSubjectDiv.classList.add('flex');
            } else {
                this.customSubjectDiv.classList.add('hidden'); this.customSubjectDiv.classList.remove('flex');
            }
        });

        document.getElementById('saveNewBlock')?.addEventListener('click', () => this.saveBlock());
        document.getElementById('cancelEditBlock')?.addEventListener('click', () => { this.editModal?.classList.add('hidden'); this.editBlockId = null; });
        document.getElementById('saveEditBlock')?.addEventListener('click', (e) => this.saveEditBlock(e.target.dataset.id));
        
        document.getElementById('saveBulkSchedule')?.addEventListener('click', () => this.generateBulkBlocks());
        document.getElementById('undoBulkBtn')?.addEventListener('click', () => this.undoLastBulk());

        document.getElementById('cancelPushBackBtn')?.addEventListener('click', () => this.pushBackModal?.classList.add('hidden'));
        document.getElementById('confirmPushBackBtn')?.addEventListener('click', () => this.confirmPushBack());
    }

    saveBlock() {
        const title = this.titleInput.value;
        let subject = this.subjectInput.value;
        if(subject === 'custom') {
            subject = this.customNameInput.value || 'Custom';
            const color = this.customColorInput.value;
            store.update('subjects', s => ({...s, [subject]: color}));
        }

        const date = this.startDateInput.value;
        const start = this.startInput.value;
        const end = this.endInput.value;

        if (!subject || !date || !start || !end) return alert("Please fill all required fields!");

        const newBlock = {
            id: 'block_' + Date.now(),
            subject, title, startDate: date, endDate: this.endDateInput.value || date,
            scheduledStart: start, scheduledEnd: end,
            status: 'pending', studySeconds: 0, breakSeconds: 0, remarks: ''
        };

        store.update('blocks', blocks => [...blocks, newBlock]);
        this.modal.classList.add('hidden');
        this.titleInput.value = '';
    }

    saveEditBlock(id) {
        const t = store.state.timer;
        const b = store.state.blocks.find(x => x.id === id);
        if (!b) return;

        const updated = {
            title: document.getElementById('editBlockTitle').value,
            startDate: document.getElementById('editBlockSchedStartDate').value,
            scheduledStart: document.getElementById('editBlockSchedStart').value,
            endDate: document.getElementById('editBlockSchedEndDate').value,
            scheduledEnd: document.getElementById('editBlockSchedEnd').value,
            remarks: document.getElementById('editBlockRemarks').value
        };

        const studyInput = document.getElementById('editBlockStudyMins');
        if (studyInput && !studyInput.disabled && studyInput.value !== "") {
            updated.studySeconds = parseInt(studyInput.value) * 60;
            if (updated.studySeconds > 0) updated.status = 'completed';
        }

        if (t.activeBlockId === id && t.isRunning) {
            store.update('timer', state => ({ ...state, spontaneousSubject: b.subject }));
        }

        store.update('blocks', blocks => blocks.map(x => x.id === id ? { ...x, ...updated } : x));
        this.editModal.classList.add('hidden');
    }

    generateBulkBlocks() {
        const subject = document.getElementById('bulkTargetSubject').value;
        const startDate = document.getElementById('bulkStartDate').value;
        const endDate = document.getElementById('bulkEndDate').value;
        const startTime = document.getElementById('bulkStartTime').value;
        const endTime = document.getElementById('bulkEndTime').value;
        const intervalMins = parseInt(document.getElementById('bulkInterval').value);

        if (!subject || !startDate || !endDate || !startTime || !endTime || !intervalMins) {
            return alert("Please fill out all bulk schedule fields.");
        }

        const startDt = new Date(`${startDate}T00:00:00`);
        const endDt = new Date(`${endDate}T00:00:00`);
        if (endDt < startDt) return alert("End date must be after start date.");

        const batchId = 'batch_' + Date.now();
        const newBlocks = [];
        const formatT = d => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;

        for (let d = new Date(startDt); d <= endDt; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            let currentStart = new Date(`${dateStr}T${startTime}:00`);
            const dailyEnd = new Date(`${dateStr}T${endTime}:00`);

            while (currentStart < dailyEnd) {
                const blockEnd = new Date(currentStart.getTime() + intervalMins * 60000);
                if (blockEnd > dailyEnd) break; 

                newBlocks.push({
                    id: 'block_' + Date.now() + Math.random().toString(36).substr(2, 5),
                    batchId: batchId,
                    subject: subject,
                    title: 'Routine Focus',
                    startDate: dateStr,
                    endDate: dateStr,
                    scheduledStart: formatT(currentStart),
                    scheduledEnd: formatT(blockEnd),
                    status: 'pending', studySeconds: 0, breakSeconds: 0, remarks: ''
                });

                currentStart = blockEnd;
            }
        }

        if (newBlocks.length === 0) return alert("No blocks could be generated with those settings.");

        store.update('blocks', old => [...old, ...newBlocks]);
        this.lastBulkBatchId = batchId;
        document.getElementById('undoBulkBtn').classList.remove('hidden');
        alert(`Successfully generated ${newBlocks.length} blocks!`);
        this.modal?.classList.add('hidden');
    }

    undoLastBulk() {
        if (!this.lastBulkBatchId) return;
        if (!confirm("Delete all blocks generated in the last bulk operation?")) return;

        store.update('blocks', blocks => blocks.filter(b => b.batchId !== this.lastBulkBatchId));
        this.lastBulkBatchId = null;
        document.getElementById('undoBulkBtn').classList.add('hidden');
        alert("Bulk operation undone.");
    }

    confirmPushBack() {
        const mins = parseInt(document.getElementById('pushBackMins').value);
        if(!mins || mins <= 0) return alert("Enter a valid number of minutes.");

        const t = store.state.timer;
        if(!t.activeBlockId) return alert("No active block to push back from.");

        const targetBlock = store.state.blocks.find(b => b.id === t.activeBlockId);
        if(!targetBlock || !targetBlock.startDate) return;

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

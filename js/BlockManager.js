// js/BlockManager.js
import { store } from './State.js';
import { enhanceSelect } from './SubjectDropdown.js';
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

        this.tabSingle = document.getElementById('tabSingleBlock');
        this.tabBulk = document.getElementById('tabBulkBlock');
        this.singleForm = document.getElementById('singleBlockForm');
        this.bulkForm = document.getElementById('bulkBlockForm');

        this.pushBackModal = document.getElementById('pushBackModal');
        this.lastBulkBatchId = null;

        store.subscribe('subjects', () => this.populateSubjects());
        this.populateSubjects();
        this.bindEvents();
    }

    populateSubjects() {
        if (!this.subjectInput) return; 
        const allSubs = store.state.subjects || {};
        const activeMap = store.state.subjectsActive || {};
        const subs = Object.keys(allSubs).filter(s => activeMap[s] !== false).reduce((acc,k)=>{acc[k]=allSubs[k];return acc;},{ });
        
        this.subjectInput.innerHTML = '';
        const bulkSub = document.getElementById('bulkTargetSubject');
        if (bulkSub) bulkSub.innerHTML = '';

        const setColorForSelect = (sel) => {
            const v = sel.value;
            const color = (subs && subs[v]) ? subs[v] : '';
            if (color) sel.style.backgroundImage = `linear-gradient(to right, ${color} 0 22px, transparent 22px)`;
            else sel.style.backgroundImage = '';
        };

        Object.keys(subs).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; 
            opt.text = s;
            if (subs[s]) opt.dataset.color = subs[s];
            this.subjectInput.appendChild(opt);
            
            if (bulkSub) {
                const opt2 = document.createElement('option'); 
                opt2.value = s; 
                opt2.text = s; 
                if (subs[s]) opt2.dataset.color = subs[s]; 
                bulkSub.appendChild(opt2);
            }
        });

        // Initialize visual chip and replace with enhanced dropdown
        if (this.subjectInput) {
            setColorForSelect(this.subjectInput);
            try { enhanceSelect(this.subjectInput); } catch (e) { }
        }
        if (bulkSub) {
            setColorForSelect(bulkSub);
            try { enhanceSelect(bulkSub); } catch (e) { }
        }
    }

    bindEvents() {
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

        document.getElementById('cancelAddBlock')?.addEventListener('click', () => {
            if (this.modal) {
                this.modal.classList.add('hidden');
                delete this.modal.dataset.lockedSubject;
                delete this.modal.dataset.lockedSubjectValue;
            }
            if (this.subjectInput) this.subjectInput.disabled = false;
        });
        document.getElementById('cancelBulkSchedule')?.addEventListener('click', () => this.modal?.classList.add('hidden'));

        // Subjects are managed in Settings; prevent inline custom creation
        if (this.customSubjectDiv) {
            this.customSubjectDiv.classList.add('hidden');
            this.customSubjectDiv.classList.remove('flex');
        }

        document.getElementById('saveNewBlock')?.addEventListener('click', () => this.saveBlock());
        document.getElementById('cancelEditBlock')?.addEventListener('click', () => { this.editModal?.classList.add('hidden'); this.editBlockId = null; });
        document.getElementById('saveEditBlock')?.addEventListener('click', (e) => this.saveEditBlock(e.target.dataset.id));
        
        document.getElementById('saveBulkSchedule')?.addEventListener('click', () => this.generateBulkBlocks());
        document.getElementById('undoBulkBtn')?.addEventListener('click', () => this.undoLastBulk());

        // 🚨 ADVANCED PUSH BACK (RESCHEDULE) LOGIC
        document.getElementById('pushBackTimerBtn')?.addEventListener('click', () => {
            const t = store.state.timer;
            if(!t.activeBlockId) return alert("You must be running an active scheduled block to reschedule it.");
            
            // Instantly halt the timer!
            store.update('timer', state => ({ ...state, isRunning: false }));
            timerEngine.stop();

            const b = store.state.blocks.find(x => x.id === t.activeBlockId);
            
            // Prefill inputs to make rescheduling fast
            const pad = n => String(n).padStart(2, '0');
            document.getElementById('pushBackDate').value = b.startDate || '';
            document.getElementById('pushBackStart').value = b.scheduledEnd || '';
            
            if (b.scheduledEnd) {
                const [h, m] = b.scheduledEnd.split(':').map(Number);
                let newH = h + 1;
                if (newH > 23) newH = 23;
                document.getElementById('pushBackEnd').value = `${pad(newH)}:${pad(m)}`;
            }

            this.pushBackModal?.classList.remove('hidden');
        });

        document.getElementById('cancelPushBackBtn')?.addEventListener('click', () => {
            this.pushBackModal?.classList.add('hidden');
        });

        document.getElementById('confirmPushBackBtn')?.addEventListener('click', () => this.confirmPushBack());
    }

    saveBlock() {
        const title = this.titleInput.value;
        let subject = this.subjectInput.value;
        // Respect locked subject when modal was opened from a linked goal
        if (this.modal && this.modal.dataset.lockedSubject === 'true') {
            subject = this.modal.dataset.lockedSubjectValue || subject;
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
        // Preserve locked status if modal indicated it
        if (this.modal && this.modal.dataset.lockedSubject === 'true') {
            newBlock.lockedSubject = true;
        }

        store.update('blocks', blocks => [...blocks, newBlock]);
        this.modal.classList.add('hidden');
        this.titleInput.value = '';
        // reset lock and enable select
        if (this.modal) {
            delete this.modal.dataset.lockedSubject;
            delete this.modal.dataset.lockedSubjectValue;
        }
        if (this.subjectInput) this.subjectInput.disabled = false;
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
        const newDate = document.getElementById('pushBackDate').value;
        const newStart = document.getElementById('pushBackStart').value;
        const newEnd = document.getElementById('pushBackEnd').value;
        
        if (!newDate || !newStart || !newEnd) return alert("Please fill out all date and time fields.");

        const t = store.state.timer;
        const b = store.state.blocks.find(x => x.id === t.activeBlockId);
        if (!b) {
            this.pushBackModal?.classList.add('hidden');
            return;
        }

        // 1. Update the original block: Completed + Not Finished + Real Time Recorded
        const updatedOriginal = {
            ...b,
            status: 'completed',
            studySeconds: t.studySeconds,
            breakSeconds: t.breakSeconds,
            title: b.title + " (Not Finished)",
            remarks: b.remarks ? b.remarks + "\n[Rescheduled]" : "[Rescheduled]"
        };

        // 2. Create the clone block for the new Date/Time
        const newBlock = {
            id: 'block_' + Date.now() + Math.random().toString(36).substr(2, 5),
            subject: b.subject,
            title: b.title.replace(" (Not Finished)", "") + " (cont.)",
            startDate: newDate,
            endDate: newDate,
            scheduledStart: newStart,
            scheduledEnd: newEnd,
            status: 'pending',
            studySeconds: 0,
            breakSeconds: 0,
            remarks: ''
        };

        // Save both to state
        store.update('blocks', old => old.map(x => x.id === b.id ? updatedOriginal : x).concat(newBlock));

        // Completely reset the timer!
        store.update('timer', () => ({
            activeBlockId: null, spontaneousSubject: null,
            mode: 'pomodoro', phase: 'study',
            studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: false
        }));

        this.pushBackModal?.classList.add('hidden');
        alert("Block Rescheduled! Current progress saved.");
    }
}
export const blockManager = new BlockManager();

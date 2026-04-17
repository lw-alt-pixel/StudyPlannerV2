// js/BlockManager.js
import { store } from './State.js';

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
        
        // Editor Elements
        this.editModal = document.getElementById('editBlockModal');
        this.editBlockId = null;

        store.subscribe('subjects', () => this.populateSubjects());
        this.populateSubjects();
        this.bindEvents();
    }

    populateSubjects() {
        if (!this.subjectInput) return; 
        const subs = store.state.subjects;
        this.subjectInput.innerHTML = '';
        Object.keys(subs).forEach(sub => {
            this.subjectInput.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
        this.subjectInput.innerHTML += `<option value="Other">📌 Other (New Subject)</option>`;
        
        this.customSubjectDiv?.classList.add('hidden');
        this.customSubjectDiv?.classList.remove('flex');
    }

    getTodayStr() {
        const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
        return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
    }

    openModalWithPreFill(dateStr, timeStr, durationMins = 60) {
        if (!this.modal) return;
        this.modal.classList.remove('hidden');
        if (this.titleInput) this.titleInput.value = ''; 
        if (this.startDateInput) this.startDateInput.value = dateStr;
        if (this.startInput) this.startInput.value = timeStr;
        
        let [h, m] = timeStr.split(':').map(Number);
        let endTotalMins = (h * 60) + m + durationMins;
        let endH = Math.floor(endTotalMins / 60);
        let endM = endTotalMins % 60;
        
        let targetEndDate = new Date(dateStr);
        if (endH >= 24) { endH = endH % 24; targetEndDate.setDate(targetEndDate.getDate() + 1); }
        
        if (this.endDateInput) this.endDateInput.value = targetEndDate.toISOString().split('T')[0];
        if (this.endInput) this.endInput.value = `${endH.toString().padStart(2,'0')}:${endM.toString().padStart(2,'0')}`;
        
        this.titleInput?.focus();
    }

    // NEW: Open the Editor
    openEditModal(blockId) {
        this.editBlockId = blockId;
        const block = store.state.blocks.find(b => b.id === blockId);
        if (!block || !this.editModal) return;

        document.getElementById('editBlockSubject').value = block.subject;
        document.getElementById('editBlockTitle').value = block.title.includes(': ') ? block.title.split(': ')[1] : block.title;
        document.getElementById('editBlockStartDate').value = block.startDate;
        document.getElementById('editBlockStart').value = block.scheduledStart;
        document.getElementById('editBlockEndDate').value = block.endDate;
        document.getElementById('editBlockEnd').value = block.scheduledEnd;
        document.getElementById('editBlockRemarks').value = block.remarks || '';

        const statusEl = document.getElementById('editBlockStatus');
        statusEl.innerText = block.status;
        if (block.status === 'completed') statusEl.className = 'px-2 py-1 text-[10px] font-black uppercase rounded bg-green-100 text-green-700';
        else if (block.status === 'active') statusEl.className = 'px-2 py-1 text-[10px] font-black uppercase rounded bg-blue-100 text-blue-700';
        else statusEl.className = 'px-2 py-1 text-[10px] font-black uppercase rounded bg-gray-200 text-gray-700';

        // Format Real Times safely
        const rStartD = document.getElementById('editBlockRealStartDate'); const rStartT = document.getElementById('editBlockRealStart');
        const rEndD = document.getElementById('editBlockRealEndDate'); const rEndT = document.getElementById('editBlockRealEnd');
        const warning = document.getElementById('editBlockRealWarning');

        const fillRealTime = (ts, elD, elT) => {
            if (!ts) { elD.value = ''; elT.value = ''; return; }
            const d = new Date(ts);
            elD.value = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            elT.value = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        };

        fillRealTime(block.actualStart, rStartD, rStartT);
        fillRealTime(block.actualEnd, rEndD, rEndT);

        // Lock real times if not completed!
        if (block.status === 'completed') {
            rStartD.disabled = false; rStartT.disabled = false; rEndD.disabled = false; rEndT.disabled = false;
            rStartD.classList.remove('opacity-50'); rStartT.classList.remove('opacity-50'); rEndD.classList.remove('opacity-50'); rEndT.classList.remove('opacity-50');
            warning.classList.add('hidden');
        } else {
            rStartD.disabled = true; rStartT.disabled = true; rEndD.disabled = true; rEndT.disabled = true;
            rStartD.classList.add('opacity-50'); rStartT.classList.add('opacity-50'); rEndD.classList.add('opacity-50'); rEndT.classList.add('opacity-50');
            warning.classList.remove('hidden');
        }

        this.editModal.classList.remove('hidden');
    }

    bindEvents() {
        const openHandler = () => this.openModalWithPreFill(this.getTodayStr(), "09:00", 60);
        document.getElementById('openAddBlockModal')?.addEventListener('click', openHandler);
        document.getElementById('openAddBlockModalHeader')?.addEventListener('click', openHandler);

        document.getElementById('cancelAddBlock')?.addEventListener('click', () => { this.modal?.classList.add('hidden'); });

        this.subjectInput?.addEventListener('change', () => {
            if (this.subjectInput.value === 'Other') {
                this.customSubjectDiv?.classList.remove('hidden'); this.customSubjectDiv?.classList.add('flex');
            } else {
                this.customSubjectDiv?.classList.add('hidden'); this.customSubjectDiv?.classList.remove('flex');
            }
        });

        document.getElementById('saveNewBlock')?.addEventListener('click', () => { this.createBlock(); });

        // EDITOR EVENTS
        document.getElementById('cancelEditBlock')?.addEventListener('click', () => { this.editModal?.classList.add('hidden'); });
        document.getElementById('deleteEditBlock')?.addEventListener('click', () => {
            if(confirm("Are you sure you want to delete this block?")) {
                store.update('blocks', old => old.filter(b => b.id !== this.editBlockId));
                this.editModal?.classList.add('hidden');
            }
        });
        document.getElementById('saveEditBlock')?.addEventListener('click', () => { this.saveEditedBlock(); });
    }

    saveEditedBlock() {
        const block = store.state.blocks.find(b => b.id === this.editBlockId);
        if (!block) return;

        const topic = document.getElementById('editBlockTitle').value.trim();
        const finalTitle = topic ? `${block.subject}: ${topic}` : block.subject;

        const updatedBlock = {
            ...block,
            title: finalTitle,
            startDate: document.getElementById('editBlockStartDate').value,
            scheduledStart: document.getElementById('editBlockStart').value,
            endDate: document.getElementById('editBlockEndDate').value,
            scheduledEnd: document.getElementById('editBlockEnd').value,
            remarks: document.getElementById('editBlockRemarks').value
        };

        // Override Real times if they were manually edited!
        if (block.status === 'completed') {
            const rStartD = document.getElementById('editBlockRealStartDate').value;
            const rStartT = document.getElementById('editBlockRealStart').value;
            const rEndD = document.getElementById('editBlockRealEndDate').value;
            const rEndT = document.getElementById('editBlockRealEnd').value;

            if (rStartD && rStartT) updatedBlock.actualStart = new Date(`${rStartD}T${rStartT}:00`).getTime();
            if (rEndD && rEndT) updatedBlock.actualEnd = new Date(`${rEndD}T${rEndT}:00`).getTime();
        }

        store.update('blocks', blocks => blocks.map(b => b.id === this.editBlockId ? updatedBlock : b));
        this.editModal?.classList.add('hidden');
    }

    createBlock() {
        if (!this.subjectInput) return;

        let finalSubject = this.subjectInput.value;
        if (finalSubject === 'Other') {
            finalSubject = this.customNameInput?.value.trim() || 'Custom Subject';
            const newColor = this.customColorInput?.value || '#3b82f6';
            store.update('subjects', subs => ({...subs, [finalSubject]: newColor}));
        }

        const topic = this.titleInput?.value.trim();
        const finalTitle = topic ? `${finalSubject}: ${topic}` : finalSubject;

        const newBlock = {
            id: Date.now(), subject: finalSubject, title: finalTitle,
            startDate: this.startDateInput?.value, scheduledStart: this.startInput?.value,
            endDate: this.endDateInput?.value, scheduledEnd: this.endInput?.value,
            actualStart: null, actualEnd: null, status: 'pending', studySeconds: 0, breakSeconds: 0, remarks: ''
        };

        store.update('blocks', oldBlocks => [...oldBlocks, newBlock]);
        this.modal?.classList.add('hidden');
    }
}
export const blockManager = new BlockManager();

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
        
        store.subscribe('subjects', () => this.populateSubjects());
        this.populateSubjects();
        this.bindEvents();
    }

    populateSubjects() {
        if (!this.subjectInput) return; // Safety check
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
        if (endH >= 24) {
            endH = endH % 24;
            targetEndDate.setDate(targetEndDate.getDate() + 1);
        }
        
        if (this.endDateInput) this.endDateInput.value = targetEndDate.toISOString().split('T')[0];
        if (this.endInput) this.endInput.value = `${endH.toString().padStart(2,'0')}:${endM.toString().padStart(2,'0')}`;
        
        this.titleInput?.focus();
    }

    bindEvents() {
        const openHandler = () => this.openModalWithPreFill(this.getTodayStr(), "09:00", 60);
        
        // Bulletproof event listeners using ?.
        document.getElementById('openAddBlockModal')?.addEventListener('click', openHandler);
        document.getElementById('openAddBlockModalHeader')?.addEventListener('click', openHandler);

        document.getElementById('cancelAddBlock')?.addEventListener('click', () => {
            this.modal?.classList.add('hidden');
        });

        this.subjectInput?.addEventListener('change', () => {
            if (this.subjectInput.value === 'Other') {
                this.customSubjectDiv?.classList.remove('hidden');
                this.customSubjectDiv?.classList.add('flex');
            } else {
                this.customSubjectDiv?.classList.add('hidden');
                this.customSubjectDiv?.classList.remove('flex');
            }
        });

        document.getElementById('saveNewBlock')?.addEventListener('click', () => {
            this.createBlock();
        });
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
            id: Date.now(),
            subject: finalSubject, 
            title: finalTitle,
            startDate: this.startDateInput?.value,
            scheduledStart: this.startInput?.value,
            endDate: this.endDateInput?.value,
            scheduledEnd: this.endInput?.value,
            actualStart: null,
            actualEnd: null,
            status: 'pending',
            studySeconds: 0,
            breakSeconds: 0
        };

        store.update('blocks', oldBlocks => [...oldBlocks, newBlock]);
        this.modal?.classList.add('hidden');
    }
}
export const blockManager = new BlockManager();

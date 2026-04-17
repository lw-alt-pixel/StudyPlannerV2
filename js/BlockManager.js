// js/BlockManager.js
import { store } from './State.js';

class BlockManager {
    init() {
        this.modal = document.getElementById('addBlockModal');
        this.subjectInput = document.getElementById('newBlockSubject');
        this.titleInput = document.getElementById('newBlockTitle');
        this.colorInput = document.getElementById('newBlockColor');
        
        this.startDateInput = document.getElementById('newBlockStartDate');
        this.startInput = document.getElementById('newBlockStart');
        this.endDateInput = document.getElementById('newBlockEndDate');
        this.endInput = document.getElementById('newBlockEnd');
        
        this.bindEvents();
    }

    getTodayStr() {
        const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
        return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
    }

    // UPGRADED: Now accepts `durationMins` to dynamically calculate the End Time!
    openModalWithPreFill(dateStr, timeStr, durationMins = 60) {
        this.modal.classList.remove('hidden');
        this.titleInput.value = ''; 
        
        this.startDateInput.value = dateStr;
        this.startInput.value = timeStr;
        
        // Calculate exact End Time based on the zoom duration
        let [h, m] = timeStr.split(':').map(Number);
        let endTotalMins = (h * 60) + m + durationMins;
        
        let endDateObj = new Date(dateStr);
        if (endTotalMins >= 1440) { // Rollover past midnight!
            endTotalMins -= 1440;
            endDateObj.setDate(endDateObj.getDate() + 1);
        }
        
        this.endDateInput.value = endDateObj.toISOString().split('T')[0];
        
        let endH = Math.floor(endTotalMins / 60);
        let endM = endTotalMins % 60;
        this.endInput.value = `${endH.toString().padStart(2,'0')}:${endM.toString().padStart(2,'0')}`;
        
        this.titleInput.focus();
    }

    bindEvents() {
        const openHandler = () => this.openModalWithPreFill(this.getTodayStr(), "09:00", 60);
        document.getElementById('openAddBlockModal')?.addEventListener('click', openHandler);
        document.getElementById('openAddBlockModalHeader')?.addEventListener('click', openHandler);

        document.getElementById('cancelAddBlock')?.addEventListener('click', () => {
            this.modal.classList.add('hidden');
        });

        document.getElementById('saveNewBlock')?.addEventListener('click', () => {
            this.createBlock();
        });
    }

    createBlock() {
        const subject = this.subjectInput.value;
        const topic = this.titleInput.value.trim();
        const finalTitle = topic ? `${subject}: ${topic}` : subject;

        const newBlock = {
            id: Date.now(),
            subject: subject, 
            title: finalTitle,
            color: this.colorInput.value,
            startDate: this.startDateInput.value,
            scheduledStart: this.startInput.value,
            endDate: this.endDateInput.value,
            scheduledEnd: this.endInput.value,
            actualStart: null,
            actualEnd: null,
            status: 'pending',
            studySeconds: 0,
            breakSeconds: 0
        };

        store.update('blocks', oldBlocks => [...oldBlocks, newBlock]);
        this.modal.classList.add('hidden');
    }
}

export const blockManager = new BlockManager();

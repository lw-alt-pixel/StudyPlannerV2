// js/BlockManager.js
import { store } from './State.js';

class BlockManager {
    init() {
        this.modal = document.getElementById('addBlockModal');
        this.titleInput = document.getElementById('newBlockTitle');
        this.colorInput = document.getElementById('newBlockColor');
        
        this.startDateInput = document.getElementById('newBlockStartDate');
        this.startInput = document.getElementById('newBlockStart');
        this.endDateInput = document.getElementById('newBlockEndDate');
        this.endInput = document.getElementById('newBlockEnd');
        
        this.bindEvents();
    }

    // Helper to get Today in YYYY-MM-DD for China Time
    getTodayStr() {
        const d = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
        return `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
    }

    // NEW: Called by CanvasUI when you click the grid!
    openModalWithPreFill(dateStr, timeStr) {
        this.modal.classList.remove('hidden');
        this.titleInput.value = ''; 
        
        this.startDateInput.value = dateStr;
        this.startInput.value = timeStr;
        
        // Default end time to 1 hour later
        this.endDateInput.value = dateStr;
        let [h, m] = timeStr.split(':').map(Number);
        h = (h + 1) % 24;
        if (h === 0) { // Rolled over midnight
            let d = new Date(dateStr);
            d.setDate(d.getDate() + 1);
            this.endDateInput.value = d.toISOString().split('T')[0];
        }
        this.endInput.value = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
        
        this.titleInput.focus();
    }

    bindEvents() {
        // Standard Add Block Buttons
        const openHandler = () => this.openModalWithPreFill(this.getTodayStr(), "09:00");
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
        const newBlock = {
            id: Date.now(),
            title: this.titleInput.value.trim() || 'New Study Block',
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

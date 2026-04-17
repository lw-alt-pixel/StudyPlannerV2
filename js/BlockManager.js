// js/BlockManager.js
import { store } from './State.js';

class BlockManager {
    init() {
        this.modal = document.getElementById('addBlockModal');
        this.titleInput = document.getElementById('newBlockTitle');
        this.colorInput = document.getElementById('newBlockColor');
        this.startInput = document.getElementById('newBlockStart');
        this.endInput = document.getElementById('newBlockEnd');
        
        this.bindEvents();
    }

    bindEvents() {
        // FIX: Find ALL Add Block buttons (header and floating) and activate them
        document.querySelectorAll('#openAddBlockModal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.modal.classList.remove('hidden');
                this.titleInput.value = ''; 
                this.titleInput.focus();
            });
        });

        document.getElementById('cancelAddBlock')?.addEventListener('click', () => {
            this.modal.classList.add('hidden');
        });

        document.getElementById('saveNewBlock')?.addEventListener('click', () => {
            this.createBlock();
        });
    }

    createBlock() {
        const title = this.titleInput.value.trim() || 'New Study Block';
        const color = this.colorInput.value;
        const start = this.startInput.value || "09:00";
        const end = this.endInput.value || "10:00";
        
        const newBlock = {
            id: Date.now(),
            title: title,
            color: color,
            dayOffset: 0, 
            scheduledStart: start,
            scheduledEnd: end,
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

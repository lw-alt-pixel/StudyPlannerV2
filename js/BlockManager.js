// js/BlockManager.js
import { store } from './State.js';

class BlockManager {
    init() {
        this.modal = document.getElementById('addBlockModal');
        this.titleInput = document.getElementById('newBlockTitle');
        this.colorInput = document.getElementById('newBlockColor');
        
        this.bindEvents();
    }

    bindEvents() {
        // Open Modal
        document.getElementById('openAddBlockModal')?.addEventListener('click', () => {
            this.modal.classList.remove('hidden');
            this.titleInput.value = ''; // clear old text
            this.titleInput.focus();
        });

        // Close Modal
        document.getElementById('cancelAddBlock')?.addEventListener('click', () => {
            this.modal.classList.add('hidden');
        });

        // Save New Block
        document.getElementById('saveNewBlock')?.addEventListener('click', () => {
            this.createBlock();
        });
    }

    createBlock() {
        const title = this.titleInput.value.trim() || 'New Study Block';
        const color = this.colorInput.value;
        
        // Create a unique ID based on the current timestamp
        const newId = Date.now();

        const newBlock = {
            id: newId,
            title: title,
            color: color,
            x: 200, // Default drop location on screen
            y: 200,
            w: 150, // Default width
            h: 80   // Default height
        };

        // Tell the Brain to add this to our list of blocks!
        store.update('blocks', oldBlocks => [...oldBlocks, newBlock]);

        // Hide the modal
        this.modal.classList.add('hidden');
    }
}

export const blockManager = new BlockManager();

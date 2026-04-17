// js/CanvasUI.js
import { store } from './State.js';

class CanvasUI {
    constructor() {
        this.panX = 0; this.panY = 0; this.scale = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0;
        this.isDraggingBlock = false; this.draggedBlock = null;
        this.draggedBlockId = null; this.blockStartX = 0; this.blockStartY = 0;
        this.originalBlockX = 0; this.originalBlockY = 0;
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.canvas = document.getElementById('infinite-canvas');
        this.blocksLayer = document.getElementById('blocks-layer');
        
        if (!this.container || !this.canvas) return;
        this.bindEvents();
        store.subscribe('blocks', (blocks) => this.renderBlocks(blocks));
        this.renderBlocks(store.state.blocks);
    }

    bindEvents() {
        this.container.addEventListener('pointerdown', (e) => {
            // 1. Delete Button
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const blockId = parseInt(deleteBtn.dataset.id);
                store.update('blocks', oldBlocks => oldBlocks.filter(b => b.id !== blockId));
                return; 
            }

            // 2. Play Button
            const playBtn = e.target.closest('.play-btn');
            if (playBtn) {
                const blockId = parseInt(playBtn.dataset.id);
                const activeBlock = store.state.blocks.find(b => b.id === blockId);
                
                if (activeBlock) {
                    // Load the block's exact time into the Timer
                    store.update('timer', t => ({
                        ...t,
                        activeBlockId: blockId,
                        studySeconds: activeBlock.studySeconds || 0,
                        breakSeconds: activeBlock.breakSeconds || 0
                    }));
                }

                const focusTabBtn = document.querySelector('[data-tab="focus"]');
                if (focusTabBtn) focusTabBtn.click();
                return; 
            }

            // 3. Dragging the Block
            const blockEl = e.target.closest('.ypt-block');
            if (blockEl) {
                this.isDraggingBlock = true;
                this.draggedBlock = blockEl;
                this.draggedBlockId = parseInt(blockEl.dataset.id);
                this.blockStartX = e.clientX;
                this.blockStartY = e.clientY;
                this.originalBlockX = parseFloat(blockEl.style.left);
                this.originalBlockY = parseFloat(blockEl.style.top);
                
                blockEl.style.zIndex = '100';
                blockEl.classList.add('shadow-2xl', 'opacity-90');
                e.stopPropagation(); 
            } else {
                // 4. Panning the Canvas
                this.isPanning = true;
                this.startX = e.clientX - this.panX;
                this.startY = e.clientY - this.panY;
                this.container.classList.remove('cursor-grab');
                this.container.classList.add('cursor-grabbing');
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (this.isDraggingBlock && this.draggedBlock) {
                const dx = (e.clientX - this.blockStartX) / this.scale;
                const dy = (e.clientY - this.blockStartY) / this.scale;
                this.draggedBlock.style.left = `${this.originalBlockX + dx}px`;
                this.draggedBlock.style.top = `${this.originalBlockY + dy}px`;
            } else if (this.isPanning) {
                this.panX = e.clientX - this.startX;
                this.panY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.isDraggingBlock && this.draggedBlock) {
                this.draggedBlock.classList.remove('shadow-2xl', 'opacity-90');
                this.draggedBlock.style.zIndex = '';
                
                const finalX = parseFloat(this.draggedBlock.style.left);
                const finalY = parseFloat(this.draggedBlock.style.top);
                const blockId = this.draggedBlockId;

                store.update('blocks', oldBlocks => {
                    return oldBlocks.map(b => b.id === blockId ? { ...b, x: finalX, y: finalY } : b);
                });

                this.isDraggingBlock = false;
                this.draggedBlock = null;
            }
            if (this.isPanning) {
                this.isPanning = false;
                this.container.classList.remove('cursor-grabbing');
                this.container.classList.add('cursor-grab');
            }
        });

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault(); 
            const delta = e.deltaY > 0 ? -0.05 : 0.05;
            this.scale = Math.min(Math.max(0.5, this.scale + delta), 2);
            this.updateTransform();
        }, { passive: false });
    }

    updateTransform() {
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }

    renderBlocks(blocks) {
        if (!this.blocksLayer) return;
        this.blocksLayer.innerHTML = ''; 

        (blocks || []).forEach(b => {
            const el = document.createElement('div');
            el.dataset.id = b.id; 
            
            // Cleaned up the layout so buttons don't block the drag area
            el.className = 'ypt-block absolute rounded-xl shadow-lg p-3 text-white font-bold cursor-pointer transition-transform hover:scale-105 pointer-events-auto flex flex-col justify-center items-center';
            el.style.left = `${b.x}px`;
            el.style.top = `${b.y}px`;
            el.style.width = `${b.w}px`;
            el.style.height = `${b.h}px`;
            el.style.backgroundColor = b.color;
            
            el.innerHTML = `
                <button class="delete-btn absolute -top-2 -right-2 bg-red-500 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black shadow-md z-[60] transition-transform hover:scale-125" data-id="${b.id}">X</button>
                <span class="text-sm shadow-sm pointer-events-none">${b.title}</span>
                <button class="play-btn absolute bottom-2 right-2 text-white opacity-80 hover:opacity-100 hover:text-blue-200 z-[60] p-2" data-id="${b.id}"><i class="fas fa-play"></i></button>
            `;
            this.blocksLayer.appendChild(el);
        });
    }
}

export const canvasUI = new CanvasUI();

// js/CanvasUI.js
import { store } from './State.js';

class CanvasUI {
    constructor() {
        // Camera state
        this.panX = 0;
        this.panY = 0;
        this.scale = 1;
        this.isPanning = false;
        this.startX = 0;
        this.startY = 0;

        // Block Dragging state
        this.isDraggingBlock = false;
        this.draggedBlock = null;
        this.draggedBlockId = null;
        this.blockStartX = 0;
        this.blockStartY = 0;
        this.originalBlockX = 0;
        this.originalBlockY = 0;
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.canvas = document.getElementById('infinite-canvas');
        this.blocksLayer = document.getElementById('blocks-layer');
        
        if (!this.container || !this.canvas) return;

        this.bindEvents();
        
        // Listen to the Brain for any block updates
        store.subscribe('blocks', (blocks) => {
            this.renderBlocks(blocks);
        });

        // Load initial blocks
        this.renderBlocks(store.state.blocks);
    }

    bindEvents() {
        // 1. POINTER DOWN: Decide if we are panning or dragging a block
        this.container.addEventListener('pointerdown', (e) => {
            const blockEl = e.target.closest('.ypt-block');
            
            if (blockEl) {
                // START DRAGGING A BLOCK
                this.isDraggingBlock = true;
                this.draggedBlock = blockEl;
                this.draggedBlockId = parseInt(blockEl.dataset.id);
                
                // Record where the mouse started
                this.blockStartX = e.clientX;
                this.blockStartY = e.clientY;
                
                // Record where the block started
                this.originalBlockX = parseFloat(blockEl.style.left);
                this.originalBlockY = parseFloat(blockEl.style.top);
                
                // Visual pop effect
                blockEl.style.zIndex = '100';
                blockEl.classList.add('shadow-2xl', 'opacity-90');
                
                // Stop the canvas from taking the click
                e.stopPropagation(); 
            } else {
                // START PANNING THE CANVAS
                this.isPanning = true;
                this.startX = e.clientX - this.panX;
                this.startY = e.clientY - this.panY;
                
                this.container.classList.remove('cursor-grab');
                this.container.classList.add('cursor-grabbing');
            }
        });

        // 2. POINTER MOVE: Move either the block or the canvas
        window.addEventListener('pointermove', (e) => {
            if (this.isDraggingBlock && this.draggedBlock) {
                // Move the Block
                // We divide by `this.scale` so the block moves exactly with your mouse even if zoomed in/out!
                const dx = (e.clientX - this.blockStartX) / this.scale;
                const dy = (e.clientY - this.blockStartY) / this.scale;
                
                const newX = this.originalBlockX + dx;
                const newY = this.originalBlockY + dy;
                
                // Update HTML instantly for smooth 60fps movement
                this.draggedBlock.style.left = `${newX}px`;
                this.draggedBlock.style.top = `${newY}px`;
            } 
            else if (this.isPanning) {
                // Move the Canvas Camera
                this.panX = e.clientX - this.startX;
                this.panY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        // 3. POINTER UP: Drop the block or stop panning
        window.addEventListener('pointerup', () => {
            if (this.isDraggingBlock && this.draggedBlock) {
                // DROP THE BLOCK
                this.draggedBlock.classList.remove('shadow-2xl', 'opacity-90');
                this.draggedBlock.style.zIndex = '';
                
                const finalX = parseFloat(this.draggedBlock.style.left);
                const finalY = parseFloat(this.draggedBlock.style.top);
                const blockId = this.draggedBlockId;

                // Tell the Brain to permanently save the new location!
                store.update('blocks', oldBlocks => {
                    return oldBlocks.map(b => b.id === blockId ? { ...b, x: finalX, y: finalY } : b);
                });

                this.isDraggingBlock = false;
                this.draggedBlock = null;
            }

            if (this.isPanning) {
                // STOP PANNING
                this.isPanning = false;
                if (this.container) {
                    this.container.classList.remove('cursor-grabbing');
                    this.container.classList.add('cursor-grab');
                }
            }
        });

        // 4. ZOOMING
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault(); 
            const zoomIntensity = 0.05;
            const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
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

        const safeBlocks = blocks || [];

        safeBlocks.forEach(b => {
            const el = document.createElement('div');
            // We store the ID in the dataset so we know which one we clicked!
            el.dataset.id = b.id; 
            
            el.className = 'ypt-block absolute rounded-xl shadow-lg p-3 text-white font-bold cursor-pointer transition-transform hover:scale-105 pointer-events-auto flex flex-col justify-between';
            el.style.left = `${b.x}px`;
            el.style.top = `${b.y}px`;
            el.style.width = `${b.w}px`;
            el.style.height = `${b.h}px`;
            el.style.backgroundColor = b.color;
            
            el.innerHTML = `
                <span class="text-sm shadow-sm">${b.title}</span>
                <span class="text-xs opacity-75 text-right"><i class="fas fa-play"></i></span>
            `;
            
            this.blocksLayer.appendChild(el);
        });
    }
}

export const canvasUI = new CanvasUI();

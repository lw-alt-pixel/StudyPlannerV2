// js/CanvasUI.js
import { store } from './State.js';

class CanvasUI {
    constructor() {
        this.panX = 0;
        this.panY = 0;
        this.scale = 1;
        this.isDragging = false;
        this.startX = 0;
        this.startY = 0;
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.canvas = document.getElementById('infinite-canvas');
        this.blocksLayer = document.getElementById('blocks-layer');
        
        if (!this.container || !this.canvas) return;

        this.bindPanAndZoom();
        
        // Listen to the Brain for any block updates (Add/Delete/Move)
        store.subscribe('blocks', (blocks) => {
            this.renderBlocks(blocks);
        });

        // Load initial blocks
        this.renderBlocks(store.state.blocks);
    }

    bindPanAndZoom() {
        // 1. Start Panning
        this.container.addEventListener('pointerdown', (e) => {
            // Ignore if clicking on a study block (we will handle drag-and-drop later)
            if (e.target.closest('.ypt-block')) return;
            
            this.isDragging = true;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            
            this.container.classList.remove('cursor-grab');
            this.container.classList.add('cursor-grabbing');
        });

        // 2. Pan Movement
        window.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            
            // Calculate new position
            this.panX = e.clientX - this.startX;
            this.panY = e.clientY - this.startY;
            
            // Apply using hardware-accelerated CSS
            this.updateTransform();
        });

        // 3. Stop Panning
        window.addEventListener('pointerup', () => {
            this.isDragging = false;
            if (this.container) {
                this.container.classList.remove('cursor-grabbing');
                this.container.classList.add('cursor-grab');
            }
        });

        // 4. Zooming
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault(); // Stop page from scrolling
            
            const zoomIntensity = 0.05;
            const delta = e.deltaY > 0 ? -zoomIntensity : zoomIntensity;
            
            // Limit zoom out to 0.5x, zoom in to 2x
            this.scale = Math.min(Math.max(0.5, this.scale + delta), 2);
            this.updateTransform();
        }, { passive: false });
    }

    updateTransform() {
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }

    const safeBlocks = blocks || []; 

        if (!this.blocksLayer) return;
        this.blocksLayer.innerHTML = ''; 

        // And change this line to use safeBlocks:
        const displayBlocks = safeBlocks.length > 0 ? safeBlocks : [
            { id: 1, title: 'Math Study', x: 200, y: 150, w: 200, h: 100, color: '#3b82f6' },
            { id: 2, title: 'Break', x: 450, y: 150, w: 100, h: 50, color: '#10b981' }
        ];
        displayBlocks.forEach(b => {
            const el = document.createElement('div');
            // Adding pointer-events-auto so we can interact with them later
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

// js/CanvasUI.js
import { store } from './State.js';

class CanvasUI {
    constructor() {
        this.panX = 100000 + 10; 
        this.panY = -480; // Start canvas focused at 08:00 AM
        this.zoom = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0;
        
        this.pxPerHour = 60; // 60 pixels = 1 hour (1px = 1 min)
        this.dayWidth = 180;
        this.root = document.documentElement;
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.daysLayer = document.getElementById('canvas-days');
        this.timesLayer = document.getElementById('canvas-times');
        
        if (!this.container) return;

        // Upgrade the background grid to show 1-hour and 15-min intervals
        init() {
        this.container = document.getElementById('canvas-container');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.daysLayer = document.getElementById('canvas-days');
        this.timesLayer = document.getElementById('canvas-times');
        
        if (!this.container) return;

        // ALL CSS STYLING WAS REMOVED FROM HERE! It now lives purely in styles.css.

        this.drawGridLabels();
        this.bindEvents();
        this.updateTransform();
        
        store.subscribe('blocks', (blocks) => this.renderBlocks(blocks));
        this.renderBlocks(store.state.blocks);
    }

        this.drawGridLabels();
        this.bindEvents();
        this.updateTransform();
        
        store.subscribe('blocks', (blocks) => this.renderBlocks(blocks));
        this.renderBlocks(store.state.blocks);
    }

    drawGridLabels() {
        this.timesLayer.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const timeEl = document.createElement('div');
            timeEl.className = 'absolute w-full text-center border-t border-gray-200/50 pt-1';
            timeEl.style.top = `calc(${i * this.pxPerHour}px * var(--zoom))`;
            timeEl.innerText = `${i.toString().padStart(2, '0')}:00`;
            this.timesLayer.appendChild(timeEl);
        }

        this.daysLayer.innerHTML = '';
        for (let i = -5; i <= 15; i++) {
            const dayEl = document.createElement('div');
            dayEl.className = 'absolute text-center border-l border-gray-300 pl-2 bg-white/50 backdrop-blur';
            dayEl.style.left = `calc(100000px + ${i * this.dayWidth}px)`;
            dayEl.style.width = `${this.dayWidth}px`;
            dayEl.innerText = i === 0 ? "⭐ Today" : `Day ${i}`;
            this.daysLayer.appendChild(dayEl);
        }
    }

    updateTransform() {
        this.root.style.setProperty('--pan-x', `${this.panX}px`);
        this.root.style.setProperty('--pan-y', `${this.panY}px`);
        this.root.style.setProperty('--zoom', this.zoom);
    }

    // --- THE AUDIT ENGINE (CHINA TIME) ---
    getChinaTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    }

    getAuditMessage(scheduledStr, actualTimestamp, type) {
        if (!actualTimestamp || !scheduledStr) return "";
        
        const actual = new Date(actualTimestamp);
        const [schH, schM] = scheduledStr.split(':').map(Number);
        
        const scheduled = new Date(actual); 
        scheduled.setHours(schH, schM, 0, 0);

        const diffMins = Math.round((actual - scheduled) / 60000); // Difference in minutes
        
        if (Math.abs(diffMins) <= 2) return `<span class="text-green-300 font-bold">${type} on time</span>`;
        if (diffMins > 0) return `<span class="text-red-300 font-bold">${type} late by ${diffMins}m</span>`;
        return `<span class="text-blue-300 font-bold">${type} early by ${Math.abs(diffMins)}m</span>`;
    }

    bindEvents() {
        this.container.addEventListener('pointerdown', (e) => {
            // 1. PLAY BUTTON: Starts Session & Switches Tab
            const playBtn = e.target.closest('.play-btn');
            if (playBtn) {
                const blockId = parseInt(playBtn.dataset.id);
                store.update('blocks', blocks => blocks.map(b => 
                    b.id === blockId ? { ...b, actualStart: this.getChinaTime().getTime(), status: 'active' } : b
                ));
                store.update('timer', t => ({ ...t, activeBlockId: blockId, isRunning: true }));
                
                document.querySelector('[data-tab="focus"]')?.click();
                return;
            }

            // 2. FINISH BUTTON: Ends Session
            const finishBtn = e.target.closest('.finish-btn');
            if (finishBtn) {
                const blockId = parseInt(finishBtn.dataset.id);
                store.update('blocks', blocks => blocks.map(b => 
                    b.id === blockId ? { ...b, actualEnd: this.getChinaTime().getTime(), status: 'completed' } : b
                ));
                store.update('timer', t => ({ ...t, isRunning: false, activeBlockId: null }));
                return;
            }

            // 3. CANVAS PANNING
            if (!e.target.closest('.ypt-block')) {
                this.isPanning = true;
                this.startX = e.clientX - this.panX;
                this.startY = e.clientY - this.panY;
                this.container.classList.add('cursor-grabbing');
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (this.isPanning) {
                this.panX = e.clientX - this.startX;
                this.panY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        window.addEventListener('pointerup', () => {
            this.isPanning = false;
            this.container.classList.remove('cursor-grabbing');
        });

        // ZOOMING WITH SCROLL WHEEL
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoom = Math.min(Math.max(0.5, this.zoom + delta), 2.5);
            } else {
                this.panX -= e.deltaX;
                this.panY -= e.deltaY;
            }
            this.updateTransform();
        }, { passive: false });
    }

    renderBlocks(blocks) {
        if (!this.blocksLayer) return;
        this.blocksLayer.innerHTML = ''; 

        blocks.forEach(b => {
            const el = document.createElement('div');
            
            // MATH: Convert HH:MM to Pixels on Grid (1px = 1 min)
            let topPx = 0, heightPx = 60;
            if (b.scheduledStart && b.scheduledEnd) {
                const [sH, sM] = b.scheduledStart.split(':').map(Number);
                const [eH, eM] = b.scheduledEnd.split(':').map(Number);
                topPx = (sH * 60) + sM;
                heightPx = ((eH * 60) + eM) - topPx;
            }
            const leftPx = 100000 + ((b.dayOffset || 0) * this.dayWidth);

            el.className = `ypt-block absolute rounded-lg p-2 text-white shadow-lg flex flex-col justify-between transition-all ${b.status === 'completed' ? 'opacity-60 grayscale' : ''}`;
            el.style.left = `${leftPx + 5}px`;
            el.style.width = `${this.dayWidth - 10}px`; 
            el.style.top = `calc(${topPx}px * var(--zoom))`;
            el.style.height = `calc(${heightPx}px * var(--zoom))`;
            el.style.backgroundColor = b.color || '#3b82f6';
            el.style.border = '1px solid rgba(255,255,255,0.4)';

            // AUDIT LABELS
            const startAudit = this.getAuditMessage(b.scheduledStart, b.actualStart, "Started");
            const endAudit = this.getAuditMessage(b.scheduledEnd, b.actualEnd, "Finished");
            
            // LOGGED TIME DISPLAY
            const totalSecs = (b.studySeconds || 0) + (b.breakSeconds || 0); // Include break or just study based on preference
            const m = Math.floor(totalSecs / 60);
            const s = totalSecs % 60;

            // DYNAMIC BUTTONS
            let actionHtml = '';
            if (b.status === 'completed') {
                actionHtml = `<div class="text-center text-[10px] bg-black/20 rounded py-1 font-bold">✅ Completed</div>`;
            } else if (b.status === 'active') {
                actionHtml = `<button class="finish-btn bg-red-500 hover:bg-red-600 rounded text-[10px] font-bold py-1 w-full pointer-events-auto" data-id="${b.id}">🏁 FINISH SESSION</button>`;
            } else {
                actionHtml = `<button class="play-btn bg-white/30 hover:bg-white/50 rounded text-[10px] font-bold py-1 w-full flex justify-center items-center gap-1 pointer-events-auto" data-id="${b.id}"><i class="fas fa-play"></i> START NOW</button>`;
            }

            el.innerHTML = `
                <div class="pointer-events-none z-10 flex-1 overflow-hidden">
                    <div class="font-bold text-xs truncate border-b border-white/30 pb-1">${b.title}</div>
                    
                    <div class="flex flex-col gap-1 text-[9px] bg-black/10 rounded p-1 mt-1">
                        <div>📅 Sch: ${b.scheduledStart} - ${b.scheduledEnd}</div>
                        ${b.actualStart ? `<div>▶ ${startAudit}</div>` : ''}
                        ${b.actualEnd ? `<div>🏁 ${endAudit}</div>` : ''}
                    </div>
                </div>

                <div class="mt-1 z-10 shrink-0">
                    <div class="text-[10px] font-mono font-bold bg-black/30 rounded py-1 text-center mb-1">
                        ⏱️ Logged: ${m}m ${s}s
                    </div>
                    ${actionHtml}
                </div>
            `;
            this.blocksLayer.appendChild(el);
        });
    }
}

export const canvasUI = new CanvasUI();

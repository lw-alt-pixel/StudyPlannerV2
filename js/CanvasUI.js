// js/CanvasUI.js
import { store } from './State.js';

class CanvasUI {
    constructor() {
        this.panX = 0; this.panY = 0; this.zoom = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0;
        
        // Match your original variables
        this.pxPerHour = 60; 
        this.dayWidth = 180;
        this.root = document.documentElement;
        
        // Base Reference Date (Start of the grid)
        this.baseDate = new Date();
        this.baseDate.setHours(0,0,0,0);
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.daysLayer = document.getElementById('canvas-days');
        this.timesLayer = document.getElementById('canvas-times');
        
        if (!this.container) return;

        this.drawGridLabels();
        this.bindEvents();
        
        store.subscribe('blocks', (blocks) => this.renderBlocks(blocks));
        
        // Center on "Today" and "9 AM" by default
        this.panX = 100000 + 10; // Offset from the -100000px center
        this.panY = -(9 * this.pxPerHour); 
        this.updateTransform();
        
        this.renderBlocks(store.state.blocks);
    }

    drawGridLabels() {
        // Draw Time Sidebar (00:00 to 23:00)
        this.timesLayer.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const timeEl = document.createElement('div');
            timeEl.className = 'absolute w-full text-center';
            timeEl.style.top = `calc(${i * this.pxPerHour}px * var(--zoom))`;
            timeEl.innerText = `${i.toString().padStart(2, '0')}:00`;
            this.timesLayer.appendChild(timeEl);
        }

        // Draw Day Headers (-10 days to +30 days)
        this.daysLayer.innerHTML = '';
        for (let i = -10; i <= 30; i++) {
            const targetDate = new Date(this.baseDate);
            targetDate.setDate(targetDate.getDate() + i);
            
            const dayEl = document.createElement('div');
            dayEl.className = 'absolute text-center border-l border-gray-300 pl-2';
            dayEl.style.left = `calc(100000px + ${i * this.dayWidth}px)`;
            dayEl.style.width = `${this.dayWidth}px`;
            
            let label = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            if (i === 0) label = "⭐ Today";
            if (i === 1) label = "Tomorrow";
            
            dayEl.innerText = label;
            this.daysLayer.appendChild(dayEl);
        }
    }

    // Helper: Get exact China Standard Time (UTC+8)
    getChinaTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    }

    // Master Audit Logic (Checks if early/late/on time)
    getAuditMessage(scheduledTimeStr, actualTimestamp, type) {
        if (!actualTimestamp || !scheduledTimeStr) return "";
        
        const actual = new Date(actualTimestamp);
        const [schH, schM] = scheduledTimeStr.split(':').map(Number);
        
        const scheduled = new Date(actual); // Compare on the same day it happened
        scheduled.setHours(schH, schM, 0, 0);

        const diffMins = Math.round((actual - scheduled) / 60000);
        
        if (Math.abs(diffMins) <= 2) return `<span class="text-green-300 font-bold">${type} on time</span>`;
        if (diffMins > 0) return `<span class="text-red-300 font-bold">${type} late by ${diffMins}m</span>`;
        return `<span class="text-blue-300 font-bold">${type} early by ${Math.abs(diffMins)}m</span>`;
    }

    bindEvents() {
        // --- CREATE BLOCK BUTTON ---
        const addBtn = document.getElementById('addBlockBtn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const title = prompt("Block Title:", "Study Math"); if(!title) return;
                const start = prompt("Scheduled Start (HH:MM):", "09:00"); if(!start) return;
                const end = prompt("Scheduled End (HH:MM):", "10:30"); if(!end) return;

                const newBlock = {
                    id: Date.now(),
                    title: title,
                    color: '#3b82f6',
                    dayOffset: 0, // 0 = Today
                    scheduledStart: start,
                    scheduledEnd: end,
                    actualStart: null,
                    actualEnd: null,
                    status: 'pending',
                    studySeconds: 0,
                    breakSeconds: 0
                };
                store.update('blocks', old => [...old, newBlock]);
            });
        }

        // --- CANVAS INTERACTIONS ---
        this.container.addEventListener('pointerdown', (e) => {
            const playBtn = e.target.closest('.play-btn');
            const finishBtn = e.target.closest('.finish-btn');
            
            if (playBtn) {
                const blockId = parseInt(playBtn.dataset.id);
                // 1. Record China Time Start
                store.update('blocks', old => old.map(b => 
                    b.id === blockId ? { ...b, actualStart: this.getChinaTime().getTime(), status: 'active' } : b
                ));
                // 2. Start Timer
                store.update('timer', t => ({ ...t, activeBlockId: blockId, isRunning: true }));
                // 3. Switch Tab
                document.querySelector('[data-tab="focus"]').click();
                return;
            }

            if (finishBtn) {
                const blockId = parseInt(finishBtn.dataset.id);
                // 1. Record China Time End
                store.update('blocks', old => old.map(b => 
                    b.id === blockId ? { ...b, actualEnd: this.getChinaTime().getTime(), status: 'completed' } : b
                ));
                // 2. Stop Timer
                store.update('timer', t => ({ ...t, isRunning: false, activeBlockId: null }));
                return;
            }

            // Canvas Panning
            if (!e.target.closest('.ypt-block')) {
                this.isPanning = true;
                this.startX = e.clientX - this.panX;
                this.startY = e.clientY - this.panY;
                this.container.classList.remove('cursor-grab');
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
            this.container.classList.add('cursor-grab');
            this.container.classList.remove('cursor-grabbing');
        });

        // Zooming Support
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoom = Math.min(Math.max(0.5, this.zoom + delta), 3);
            } else {
                this.panX -= e.deltaX;
                this.panY -= e.deltaY;
            }
            this.updateTransform();
        }, { passive: false });
    }

    updateTransform() {
        this.root.style.setProperty('--pan-x', `${this.panX}px`);
        this.root.style.setProperty('--pan-y', `${this.panY}px`);
        this.root.style.setProperty('--zoom', this.zoom);
    }

    // Math: Convert HH:MM to exact pixels from the top
    timeToPixels(timeStr) {
        if (!timeStr) return 0;
        const [h, m] = timeStr.split(':').map(Number);
        return (h * 60) + m; 
    }

    formatTime(totalSecs) {
        const h = Math.floor(totalSecs / 3600);
        const m = Math.floor((totalSecs % 3600) / 60);
        const s = totalSecs % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}m ${s}s`;
    }

    renderBlocks(blocks) {
        if (!this.blocksLayer) return;
        this.blocksLayer.innerHTML = ''; 

        (blocks || []).forEach(b => {
            const el = document.createElement('div');
            
            // 1. Calculate Grid Placement based on TIME
            const topPx = this.timeToPixels(b.scheduledStart);
            const bottomPx = this.timeToPixels(b.scheduledEnd);
            const heightPx = bottomPx - topPx;
            
            // X position is offset from center based on Days (+0 for Today)
            const leftPx = 100000 + (b.dayOffset * this.dayWidth);

            el.className = `ypt-block absolute rounded-lg p-2 text-white shadow-lg overflow-hidden flex flex-col justify-between transition-all ${b.status === 'completed' ? 'opacity-60 grayscale' : ''}`;
            el.style.left = `${leftPx + 5}px`;
            el.style.width = `${this.dayWidth - 10}px`; // Fit inside the day column
            el.style.top = `calc(${topPx}px * var(--zoom))`;
            el.style.height = `calc(${heightPx}px * var(--zoom))`;
            el.style.backgroundColor = b.color;
            el.style.border = '1px solid rgba(255,255,255,0.4)';

            // 2. Audit Messages
            const startLabel = this.getAuditMessage(b.scheduledStart, b.actualStart, "Started") || `Sch: ${b.scheduledStart}`;
            const endLabel = this.getAuditMessage(b.scheduledEnd, b.actualEnd, "Finished") || `Sch: ${b.scheduledEnd}`;
            
            const totalRecordedSecs = (b.studySeconds || 0) + (b.breakSeconds || 0);

            // 3. Action Buttons
            let btnHtml = '';
            if (b.status === 'completed') {
                btnHtml = `<div class="text-center text-[10px] bg-black/20 rounded py-1 mt-1">✅ Session Done</div>`;
            } else if (b.status === 'active') {
                btnHtml = `<button class="finish-btn bg-red-500 hover:bg-red-600 rounded text-[10px] font-bold py-1 px-2 w-full mt-1 transition-colors pointer-events-auto" data-id="${b.id}">🏁 FINISH SESSION</button>`;
            } else {
                btnHtml = `<button class="play-btn bg-white/30 hover:bg-white/50 rounded text-[10px] font-bold py-1 px-2 w-full mt-1 transition-colors pointer-events-auto flex justify-center items-center gap-1" data-id="${b.id}"><i class="fas fa-play"></i> START NOW</button>`;
            }

            el.innerHTML = `
                <div class="flex-1 pointer-events-none z-10">
                    <div class="font-bold text-xs truncate border-b border-white/30 pb-1 mb-1 shadow-sm">${b.title}</div>
                    
                    <div class="flex flex-col gap-1 text-[9px] bg-black/10 rounded p-1">
                        <div>⏳ ${startLabel}</div>
                        ${b.actualStart ? `<div>🏁 ${endLabel}</div>` : ''}
                    </div>
                </div>

                <div class="mt-1 z-10">
                    <div class="text-[10px] font-mono font-bold bg-black/30 rounded py-1 text-center w-full mb-1">
                        ⏱️ Logged: ${this.formatTime(totalRecordedSecs)}
                    </div>
                    ${btnHtml}
                </div>
            `;
            this.blocksLayer.appendChild(el);
        });
    }
}

export const canvasUI = new CanvasUI();

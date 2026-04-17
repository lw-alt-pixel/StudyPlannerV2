// js/CanvasUI.js
import { store } from './State.js';

class CanvasUI {
    constructor() {
        this.panX = 10; 
        this.panY = -480; 
        this.zoom = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0;
        this.pxPerHour = 60; 
        this.dayWidth = 180;
        this.root = document.documentElement;
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.daysLayer = document.getElementById('canvas-days');
        this.timesLayer = document.getElementById('canvas-times');
        
        if (!this.container) return;

        // 1. Create the Real-Time "NOW" Highlight Line
        this.currentTimeLine = document.createElement('div');
        this.currentTimeLine.className = 'absolute left-0 w-[200000px] border-t-2 border-red-500 z-50 pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)] transition-all';
        this.currentTimeLine.innerHTML = `<div class="bg-red-500 text-white text-[10px] px-2 font-bold rounded-r-full absolute -top-2.5 shadow-md">NOW</div>`;
        this.blocksLayer.appendChild(this.currentTimeLine);
        
        setInterval(() => this.updateCurrentTimeLine(), 60000); // Check every minute
        this.updateCurrentTimeLine();

        this.drawGridLabels();
        this.bindEvents();
        this.enforceBoundsAndUpdate();
        
        store.subscribe('blocks', (blocks) => this.renderBlocks(blocks));
        this.renderBlocks(store.state.blocks);
    }

    getChinaTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    }

    updateCurrentTimeLine() {
        const now = this.getChinaTime();
        const minsFromMidnight = (now.getHours() * 60) + now.getMinutes();
        this.currentTimeLine.style.top = `calc(${minsFromMidnight}px * var(--zoom))`;
    }

    drawGridLabels() {
        this.timesLayer.innerHTML = '';
        for (let i = 0; i <= 24; i++) {
            // 1-Hour Lines
            let hEl = document.createElement('div');
            hEl.className = 'absolute w-full text-center border-t border-gray-300 pt-1 text-gray-600 font-bold';
            hEl.style.top = `calc(${i * 60}px * var(--zoom))`;
            hEl.innerText = `${i.toString().padStart(2, '0')}:00`;
            this.timesLayer.appendChild(hEl);

            if (i === 24) continue; // Don't draw fractions past midnight

            // 30-Minute Lines
            let m30 = document.createElement('div');
            m30.className = 'absolute w-full text-center text-gray-400 font-medium text-[10px] time-label-fraction time-label-30';
            m30.style.top = `calc(${(i * 60) + 30}px * var(--zoom) - 6px)`;
            m30.innerText = `${i.toString().padStart(2, '0')}:30`;
            this.timesLayer.appendChild(m30);

            // 15-Minute Lines
            [15, 45].forEach(min => {
                let m15 = document.createElement('div');
                m15.className = 'absolute w-full text-center text-gray-300 font-normal text-[9px] time-label-fraction time-label-15';
                m15.style.top = `calc(${(i * 60) + min}px * var(--zoom) - 6px)`;
                m15.innerText = `${i.toString().padStart(2, '0')}:${min}`;
                this.timesLayer.appendChild(m15);
            });
        }

        // REAL DATES!
        this.daysLayer.innerHTML = '';
        const today = this.getChinaTime();
        
        for (let i = -5; i <= 15; i++) {
            let targetDate = new Date(today);
            targetDate.setDate(today.getDate() + i);
            
            const dateStr = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const dayEl = document.createElement('div');
            dayEl.className = 'absolute text-center border-l border-gray-300 pl-2 bg-white/80 backdrop-blur';
            dayEl.style.left = `calc(100000px + ${i * this.dayWidth}px)`;
            dayEl.style.width = `${this.dayWidth}px`;
            
            dayEl.innerHTML = i === 0 ? `<span class="text-blue-600 font-black">⭐ Today</span> <br/> <span class="text-[10px] text-gray-500">${dateStr}</span>` 
                                      : `<span class="text-gray-700">${dateStr}</span>`;
            this.daysLayer.appendChild(dayEl);
        }
    }

    enforceBoundsAndUpdate() {
        // 1. Zoom Logic for Grid Fidelity
        if (this.zoom >= 2) {
            this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)');
            this.root.style.setProperty('--grid-15', 'rgba(0,0,0,0.03)');
            this.container.classList.add('show-15-mins', 'show-30-mins');
        } else if (this.zoom >= 1.5) {
            this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)');
            this.root.style.setProperty('--grid-15', 'transparent');
            this.container.classList.add('show-30-mins');
            this.container.classList.remove('show-15-mins');
        } else {
            this.root.style.setProperty('--grid-30', 'transparent');
            this.root.style.setProperty('--grid-15', 'transparent');
            this.container.classList.remove('show-30-mins', 'show-15-mins');
        }

        // 2. Y-Axis Bounds (No escaping 00:00 to 24:00!)
        const canvasHeight = 24 * 60 * this.zoom;
        const viewHeight = this.container.clientHeight;
        const minPanY = Math.min(0, viewHeight - canvasHeight - 48); // 48 is header padding
        
        this.panY = Math.max(minPanY, Math.min(0, this.panY));

        this.root.style.setProperty('--pan-x', `${this.panX}px`);
        this.root.style.setProperty('--pan-y', `${this.panY}px`);
        this.root.style.setProperty('--zoom', this.zoom);
    }

    getAuditMessage(scheduledStr, actualTimestamp, type) {
        if (!actualTimestamp || !scheduledStr) return "";
        const actual = new Date(actualTimestamp);
        const [schH, schM] = scheduledStr.split(':').map(Number);
        const scheduled = new Date(actual); 
        scheduled.setHours(schH, schM, 0, 0);
        const diffMins = Math.round((actual - scheduled) / 60000); 
        
        if (Math.abs(diffMins) <= 2) return `<span class="text-green-300 font-bold">${type} on time</span>`;
        if (diffMins > 0) return `<span class="text-red-300 font-bold">${type} late by ${diffMins}m</span>`;
        return `<span class="text-blue-300 font-bold">${type} early by ${Math.abs(diffMins)}m</span>`;
    }

    bindEvents() {
        this.container.addEventListener('pointerdown', (e) => {
            const btn = e.target.closest('button');
            if (btn && btn.classList.contains('play-btn')) {
                const id = parseInt(btn.dataset.id);
                store.update('blocks', blocks => blocks.map(b => b.id === id ? { ...b, actualStart: this.getChinaTime().getTime(), status: 'active' } : b));
                store.update('timer', t => ({ ...t, activeBlockId: id, isRunning: true }));
                document.querySelector('[data-tab="focus"]')?.click();
                return;
            }
            if (btn && btn.classList.contains('finish-btn')) {
                const id = parseInt(btn.dataset.id);
                store.update('blocks', blocks => blocks.map(b => b.id === id ? { ...b, actualEnd: this.getChinaTime().getTime(), status: 'completed' } : b));
                store.update('timer', t => ({ ...t, isRunning: false, activeBlockId: null }));
                return;
            }

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
                this.enforceBoundsAndUpdate();
            }
        });

        window.addEventListener('pointerup', () => {
            this.isPanning = false;
            this.container.classList.remove('cursor-grabbing');
        });

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoom = Math.min(Math.max(0.7, this.zoom + delta), 3); // Max zoom 3x
            } else {
                this.panX -= e.deltaX;
                this.panY -= e.deltaY;
            }
            this.enforceBoundsAndUpdate();
        }, { passive: false });
    }

    renderBlocks(blocks) {
        if (!this.blocksLayer) return;
        // Keep the NOW line, delete only blocks
        Array.from(this.blocksLayer.children).forEach(child => {
            if (child !== this.currentTimeLine) child.remove();
        });

        blocks.forEach(b => {
            const el = document.createElement('div');
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

            const startAudit = this.getAuditMessage(b.scheduledStart, b.actualStart, "Started");
            const endAudit = this.getAuditMessage(b.scheduledEnd, b.actualEnd, "Finished");
            const totalSecs = (b.studySeconds || 0) + (b.breakSeconds || 0); 

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
                        <div>📅 ${b.scheduledStart} - ${b.scheduledEnd}</div>
                        ${b.actualStart ? `<div>▶ ${startAudit}</div>` : ''}
                        ${b.actualEnd ? `<div>🏁 ${endAudit}</div>` : ''}
                    </div>
                </div>
                <div class="mt-1 z-10 shrink-0">
                    <div class="text-[10px] font-mono font-bold bg-black/30 rounded py-1 text-center mb-1">
                        ⏱️ Logged: ${Math.floor(totalSecs / 60)}m ${totalSecs % 60}s
                    </div>
                    ${actionHtml}
                </div>
            `;
            this.blocksLayer.appendChild(el);
        });
    }
}

export const canvasUI = new CanvasUI();

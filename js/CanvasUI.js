// js/CanvasUI.js
import { store } from './State.js';
import { blockManager } from './BlockManager.js';
import { timerEngine } from './TimerEngine.js';

class CanvasUI {
    constructor() {
        this.panX = 10; 
        this.panY = -480; 
        this.zoom = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0;
        this.hasDragged = false; // Track if the user dragged or just clicked
        
        this.pxPerHour = 60; 
        this.dayWidth = 180;
        this.root = document.documentElement;
        
        // Lock the "Center" of the grid to Today at Midnight (China Time)
        this.baseDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
        this.baseDate.setHours(0,0,0,0);
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.daysLayer = document.getElementById('canvas-days');
        this.timesLayer = document.getElementById('canvas-times');
        
        if (!this.container) return;

        // The Red "NOW" Line
        this.currentTimeLine = document.createElement('div');
        this.currentTimeLine.className = 'absolute left-0 w-[200000px] border-t-2 border-red-500 z-[40] pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)] transition-all';
        this.currentTimeLine.innerHTML = `<div class="bg-red-500 text-white text-[10px] px-2 font-bold rounded-r-full absolute -top-2.5 shadow-md">NOW</div>`;
        this.blocksLayer.appendChild(this.currentTimeLine);
        
        setInterval(() => this.updateCurrentTimeLine(), 60000); 
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
            let hEl = document.createElement('div');
            hEl.className = 'absolute w-full text-center border-t border-gray-300 pt-1 text-gray-600 font-bold';
            hEl.style.top = `calc(${i * 60}px * var(--zoom))`;
            hEl.innerText = `${i.toString().padStart(2, '0')}:00`;
            this.timesLayer.appendChild(hEl);

            if (i === 24) continue;
            let m30 = document.createElement('div');
            m30.className = 'absolute w-full text-center text-gray-400 font-medium text-[10px] time-label-fraction time-label-30';
            m30.style.top = `calc(${(i * 60) + 30}px * var(--zoom) - 6px)`;
            m30.innerText = `${i.toString().padStart(2, '0')}:30`;
            this.timesLayer.appendChild(m30);

            [15, 45].forEach(min => {
                let m15 = document.createElement('div');
                m15.className = 'absolute w-full text-center text-gray-300 font-normal text-[9px] time-label-fraction time-label-15';
                m15.style.top = `calc(${(i * 60) + min}px * var(--zoom) - 6px)`;
                m15.innerText = `${i.toString().padStart(2, '0')}:${min}`;
                this.timesLayer.appendChild(m15);
            });
        }

        // Generate Dates based on center
        this.daysLayer.innerHTML = '';
        for (let i = -30; i <= 60; i++) {
            let targetDate = new Date(this.baseDate);
            targetDate.setDate(this.baseDate.getDate() + i);
            
            const dateStr = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const dayEl = document.createElement('div');
            dayEl.className = 'absolute text-center border-l border-gray-300 pl-2 bg-white/80 backdrop-blur';
            dayEl.style.left = `calc(100000px + ${i * this.dayWidth}px)`;
            dayEl.style.width = `${this.dayWidth}px`;
            
            dayEl.innerHTML = i === 0 ? `<span class="text-blue-600 font-black">⭐ Today</span> <br/> <span class="text-[10px] text-gray-500">${dateStr}</span>` 
                                      : `<span class="text-gray-700 font-bold">${dateStr}</span>`;
            this.daysLayer.appendChild(dayEl);
        }
    }

    enforceBoundsAndUpdate() {
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

        const canvasHeight = 24 * 60 * this.zoom;
        const viewHeight = this.container.clientHeight;
        const minPanY = Math.min(0, viewHeight - canvasHeight - 48); 
        this.panY = Math.max(minPanY, Math.min(0, this.panY));

        this.root.style.setProperty('--pan-x', `${this.panX}px`);
        this.root.style.setProperty('--pan-y', `${this.panY}px`);
        this.root.style.setProperty('--zoom', this.zoom);
    }

    bindEvents() {
        // --- HEADER BUTTON NAVIGATION ---
        document.getElementById('prevDaysBtn')?.addEventListener('click', () => { this.panX += this.dayWidth * 3; this.enforceBoundsAndUpdate(); });
        document.getElementById('nextDaysBtn')?.addEventListener('click', () => { this.panX -= this.dayWidth * 3; this.enforceBoundsAndUpdate(); });
        document.getElementById('centerTodayBtn')?.addEventListener('click', () => { 
            this.panX = 10; 
            this.updateCurrentTimeLine(); 
            this.panY = -(parseFloat(this.currentTimeLine.style.top) || 480) + 200; // Center camera on red line
            this.enforceBoundsAndUpdate(); 
        });

        // --- GRID INTERACTION ---
        this.container.addEventListener('pointerdown', (e) => {
            this.hasDragged = false; // Reset drag tracker
            
            // 1. DELETE BUTTON (Kill Ghosts instantly)
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.id);
                store.update('blocks', old => old.filter(b => b.id !== id));
                return;
            }

            // 1. PLAY BUTTON
            // We use 'clickedBtn' here to guarantee it doesn't conflict with anything else!
            const clickedBtn = e.target.closest('button');
            
            if (clickedBtn && clickedBtn.classList.contains('play-btn')) {
                const id = parseInt(clickedBtn.dataset.id);
                const block = store.state.blocks.find(b => b.id === id);
                
                // Keep existing start time if resuming, otherwise stamp new China Time
                const startTime = block.actualStart || this.getChinaTime().getTime();
                
                store.update('blocks', blocks => blocks.map(b => b.id === id ? { ...b, actualStart: startTime, status: 'active' } : b));
                
                store.update('timer', t => ({ 
                    ...t, 
                    activeBlockId: id, 
                    isRunning: true,
                    studySeconds: block.studySeconds || 0,
                    breakSeconds: block.breakSeconds || 0,
                    secondsElapsed: block.studySeconds || 0
                }));

                timerEngine.start(); // <-- Turn on the engine!
                
                document.querySelector('[data-tab="focus"]')?.click();
                return;
            }

            // 2. FINISH BUTTON
            if (clickedBtn && clickedBtn.classList.contains('finish-btn')) {
                const id = parseInt(clickedBtn.dataset.id);
                
                store.update('blocks', blocks => blocks.map(b => b.id === id ? { ...b, actualEnd: this.getChinaTime().getTime(), status: 'completed' } : b));
                
                store.update('timer', t => ({ ...t, isRunning: false, activeBlockId: null }));
                
                timerEngine.stop(); // <-- Turn off the engine!
                return;
            }

        window.addEventListener('pointermove', (e) => {
            if (this.isPanning) {
                this.hasDragged = true; // User is moving the mouse
                this.panX = e.clientX - this.startX;
                this.panY = e.clientY - this.startY;
                this.enforceBoundsAndUpdate();
            }
        });

       window.addEventListener('pointerup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.classList.remove('cursor-grabbing');
                
                // CLICK-TO-ADD LOGIC!
                if (!this.hasDragged && !e.target.closest('.ypt-block')) {
                    const rect = this.container.getBoundingClientRect();
                    const clickX = e.clientX - rect.left - 64; 
                    const clickY = e.clientY - rect.top - 48;  
                    
                    const gridX = (clickX - this.panX) / this.zoom;
                    const gridY = (clickY - this.panY) / this.zoom;

                    const dayOffset = Math.floor((gridX - 100000) / this.dayWidth);
                    let clickedDate = new Date(this.baseDate);
                    clickedDate.setDate(this.baseDate.getDate() + dayOffset);
                    const dateStr = clickedDate.toISOString().split('T')[0];

                    // --- SMART SNAPPING LOGIC ---
                    let snapInterval = 60; // Default 1 hour
                    if (this.zoom >= 2.0) snapInterval = 15; // Zoom Level 2: 15 mins
                    else if (this.zoom >= 1.5) snapInterval = 30; // Zoom Level 1: 30 mins

                    let totalMins = Math.floor(gridY);
                    
                    // We use Math.floor so clicking *inside* the 14:30 box snaps to 14:30, not 15:00
                    totalMins = Math.floor(totalMins / snapInterval) * snapInterval;
                    
                    // Clamp to boundaries
                    if(totalMins < 0) totalMins = 0; 
                    if(totalMins > 1440 - snapInterval) totalMins = 1440 - snapInterval; 

                    const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
                    const m = (totalMins % 60).toString().padStart(2, '0');
                    const timeStr = `${h}:${m}`;

                    // Open the Modal pre-filled with the exact Start Time AND Duration!
                    blockManager.openModalWithPreFill(dateStr, timeStr, snapInterval);
                }
            }
        });
        // DAMPENED SCROLLING (Slower tracking)
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoom = Math.min(Math.max(0.7, this.zoom + delta), 3);
            } else {
                this.panX -= (e.deltaX * 0.5); // Dampen left/right
                this.panY -= (e.deltaY * 0.5); // Dampen up/down
            }
            this.enforceBoundsAndUpdate();
        }, { passive: false });
    }

    renderBlocks(blocks) {
        if (!this.blocksLayer) return;
        Array.from(this.blocksLayer.children).forEach(child => {
            if (child !== this.currentTimeLine) child.remove();
        });

        blocks.forEach(b => {
            // Must have dates and times to render
            if(!b.startDate || !b.scheduledStart || !b.endDate || !b.scheduledEnd) return;

            const el = document.createElement('div');
            
            // MATH: Convert string Dates back to absolute Time to find height
            const startStr = `${b.startDate}T${b.scheduledStart}:00`;
            const endStr = `${b.endDate}T${b.scheduledEnd}:00`;
            
            const startObj = new Date(startStr);
            const endObj = new Date(endStr);
            
            // Difference in days from the BaseDate (Today)
            const dayOffset = Math.floor((startObj.setHours(0,0,0,0) - this.baseDate.getTime()) / 86400000);
            
            // Calculate Top Px relative to midnight of its start date
            const [sH, sM] = b.scheduledStart.split(':').map(Number);
            const topPx = (sH * 60) + sM;
            
            // Calculate total duration in minutes (Handles OVERNIGHT automatically!)
            const startObjReal = new Date(startStr);
            let durationMins = (endObj - startObjReal) / 60000;
            if (durationMins <= 0) durationMins = 60; // Fallback if dates are messed up

            const leftPx = 100000 + (dayOffset * this.dayWidth);

            // FIXING THE THIN BLOCKS: 0 border, tiny padding, hidden overflow.
            el.className = `ypt-block absolute rounded-lg text-white shadow-lg flex flex-col justify-between transition-all ${b.status === 'completed' ? 'opacity-60 grayscale' : ''}`;
            el.style.left = `${leftPx + 4}px`;
            el.style.width = `${this.dayWidth - 8}px`; 
            el.style.top = `calc(${topPx}px * var(--zoom))`;
            el.style.height = `calc(${durationMins}px * var(--zoom))`;
            el.style.backgroundColor = b.color || '#3b82f6';
            el.style.padding = '4px 6px';
            el.style.overflow = 'hidden';

            const totalSecs = (b.studySeconds || 0) + (b.breakSeconds || 0); 
            
            // Button Logic
            let actionHtml = '';
            if (b.status === 'completed') {
                actionHtml = `<div class="text-center text-[9px] bg-black/20 rounded py-0.5 mt-1 font-bold">✅ Done</div>`;
            } else if (b.status === 'active') {
                actionHtml = `<button class="finish-btn bg-red-500 hover:bg-red-600 rounded text-[9px] font-bold py-0.5 w-full mt-1 pointer-events-auto" data-id="${b.id}">🏁 FINISH</button>`;
            } else {
                actionHtml = `<button class="play-btn bg-white/30 hover:bg-white/50 rounded text-[9px] font-bold py-0.5 w-full mt-1 flex justify-center items-center pointer-events-auto" data-id="${b.id}">▶ START</button>`;
            }

            el.innerHTML = `
                <button class="delete-btn absolute top-1 right-1 bg-red-600 hover:bg-red-800 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black pointer-events-auto shadow-md transition-transform hover:scale-125 z-50" data-id="${b.id}">X</button>
                
                <div class="pointer-events-none z-10 flex-1 flex flex-col min-h-0">
                    <div class="font-bold text-xs truncate drop-shadow-md pr-4">${b.title}</div>
                    <div class="text-[9px] opacity-90 drop-shadow-md leading-tight">${b.scheduledStart} - ${b.scheduledEnd}</div>
                </div>
                
                <div class="mt-auto z-10 shrink-0">
                    ${totalSecs > 0 ? `<div class="text-[9px] font-mono font-bold bg-black/30 rounded px-1 text-center mb-0.5">⏱️ ${Math.floor(totalSecs/60)}m ${totalSecs%60}s</div>` : ''}
                    ${actionHtml}
                </div>
            `;
            this.blocksLayer.appendChild(el);
        });
    }
}

export const canvasUI = new CanvasUI();

// js/CanvasUI.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';

class CanvasUI {
    constructor() {
        this.panX = 10; this.panY = 0; this.zoom = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0; this.hasDragged = false; 
        
        this.activePointers = new Map();
        this.initialPinchDistance = null; this.initialPinchZoom = null; this.pinchCenterY = null;
        
        this.currentZoomTier = 60; 
        this.pxPerHour = 60; this.dayWidth = 180;
        this.phantomPxPerHour = 180; 
        
        this.offsetX = 60; 
        this.offsetY = 50; 
        this.root = document.documentElement;
        
        this.baseDate = this.getChinaTime(); this.baseDate.setHours(0,0,0,0);
        
        this.isSelecting = false;
        this.selectStartCol = 0;
        this.selectStartAbsMin = 0; 
        this.selectEndAbsMin = 0;
        this.autoPanVector = { x: 0, y: 0 };
        this.lastPointer = { x: 0, y: 0 };
        this.isAutoPanning = false;
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }
    formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

    getMinsFromY(y) {
        const mainH = 24 * this.pxPerHour * this.zoom;
        if (y <= mainH) return (y / (this.pxPerHour * this.zoom)) * 60;
        let excessMins = ((y - mainH) / this.phantomPxPerHour) * 60;
        return Math.min(1440 + excessMins, 1440 + 300); 
    }

    getYFromMins(mins) {
        const mainH = 24 * this.pxPerHour * this.zoom;
        if (mins <= 1440) return (mins / 60) * this.pxPerHour * this.zoom;
        return mainH + ((mins - 1440) / 60) * this.phantomPxPerHour;
    }

    getSnappedLocal(m) {
        if (m < 1440) return Math.round(m / this.currentZoomTier) * this.currentZoomTier;
        return 1440 + Math.round((m - 1440) / 15) * 15;
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.layer = document.getElementById('canvas-layer');
        this.gridBg = document.getElementById('canvas-grid');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.timeLabels = document.getElementById('canvas-times');
        this.daysHeader = document.getElementById('canvas-days');
        
        // 🚨 NEW: Reference to the dynamic month label in the controls bar
        this.canvasMonthLabel = document.getElementById('canvasMonthLabel');

        const upNext = document.getElementById('upNextBanner');
        if (upNext && !document.getElementById('dailyAgendaContainer')) {
            const agenda = document.createElement('div');
            agenda.id = 'dailyAgendaContainer';
            agenda.className = 'mx-4 mb-4 space-y-2 z-40 relative';
            upNext.parentNode.insertBefore(agenda, upNext.nextSibling);
            this.dailyAgendaContainer = agenda;
        }

        if (this.container) {
            if (this.gridBg) this.container.appendChild(this.gridBg);
            if (this.blocksLayer) this.container.appendChild(this.blocksLayer);
            if (this.layer) this.container.appendChild(this.layer);
            if (this.timeLabels) this.container.appendChild(this.timeLabels);
            if (this.daysHeader) this.container.appendChild(this.daysHeader);
        }

        if (this.daysHeader) {
            this.daysHeader.style.position = 'absolute';
            this.daysHeader.style.top = '0px'; this.daysHeader.style.left = '0px';
            this.daysHeader.style.width = '100%'; this.daysHeader.style.height = '50px'; 
            this.daysHeader.style.zIndex = '100'; this.daysHeader.style.pointerEvents = 'none';
        }
        if (this.timeLabels) {
            this.timeLabels.style.position = 'absolute';
            this.timeLabels.style.top = '0px'; this.timeLabels.style.left = '0px';
            this.timeLabels.style.width = '60px'; this.timeLabels.style.height = '100%';
            this.timeLabels.style.zIndex = '100'; this.timeLabels.style.pointerEvents = 'none';
        }

        if (!document.getElementById('drag-selection-layer')) {
            const layerBox = document.createElement('div');
            layerBox.id = 'drag-selection-layer';
            layerBox.className = 'absolute top-0 left-0 w-full h-full pointer-events-none z-40';
            if(this.layer) this.layer.appendChild(layerBox);
        }
        
        if (!document.getElementById('phantom-layer')) {
            const pLayer = document.createElement('div');
            pLayer.id = 'phantom-layer';
            // 🚨 FIX 1: z-[150] pierces perfectly through the white time-labels bar!
            pLayer.className = 'absolute top-0 left-0 w-full h-full pointer-events-none z-[150] opacity-90';
            if(this.layer) this.layer.appendChild(pLayer);
        }

        if (!document.getElementById('block-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'block-tooltip';
            tooltip.className = 'fixed z-[9999] pointer-events-none bg-gray-900/95 backdrop-blur-sm text-white rounded-xl shadow-2xl p-4 min-w-[200px] transition-opacity duration-150 opacity-0 border border-gray-700';
            tooltip.style.top = '0px'; tooltip.style.left = '0px';
            document.body.appendChild(tooltip);
        }

        this.bindEvents();
        this.initTimelineDropdown(); // 🚨 NEW
        if (this.container) {
            this.updateTransform();
            this.renderHeaders();
            this.renderBlocks();
        }

        store.subscribe('blocks', () => {
            if (this.container && !this.container.classList.contains('hidden')) {
                this.renderBlocks();
            }
        });
    }
// 🚨 NEW: Initialize Timeline Dropdown
initTimelineDropdown() {
    const toggleBtn = document.getElementById('toggleTimelineBtn');
    const container = document.getElementById('todayTimelineContainer');
    if (!toggleBtn || !container) return;

    toggleBtn.addEventListener('click', () => {
        container.classList.toggle('hidden');
        const icon = toggleBtn.querySelector('i');
        if (container.classList.contains('hidden')) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        } else {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
            this.renderTimelineList();
        }
    });
    
    // Render timeline whenever blocks change
    store.subscribe('blocks', () => {
        if (!container.classList.contains('hidden')) {
            this.renderTimelineList();
        }
    });
}

renderTimelineList() {
    const now = this.getChinaTime();
    const pad = n => String(n).padStart(2, '0');
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}`;
    
    const allBlocks = store.state.blocks.filter(b => b.startDate === todayStr);
    allBlocks.sort((a, b) => (a.scheduledStart || "00:00").localeCompare(b.scheduledStart || "00:00"));
    
    const timelineList = document.getElementById('timelineList');
    if (!timelineList) return;
    timelineList.innerHTML = '';

    const completedBlocks = allBlocks.filter(b => b.status === 'completed');
    const pendingBlocks = allBlocks.filter(b => b.status !== 'completed');

    // Render pending blocks first
    pendingBlocks.forEach(b => {
        const el = this.createTimelineItem(b, todayStr, now);
        timelineList.appendChild(el);
    });

    // Group completed blocks by sessionId (if present) for better readability
    if (completedBlocks.length > 0) {
        const collapsibleDiv = document.createElement('div');
        collapsibleDiv.className = 'border-t border-gray-200 pt-2 mt-2';

        // Build groups: sessionId -> array
        const groups = {};
        const noSession = [];
        completedBlocks.forEach(b => {
            if (b.sessionId) {
                if (!groups[b.sessionId]) groups[b.sessionId] = [];
                groups[b.sessionId].push(b);
            } else noSession.push(b);
        });

        // Render ungrouped completed blocks (no session)
        if (noSession.length > 0) {
            const header = document.createElement('div');
            header.className = 'text-xs font-black text-gray-500 mt-2 mb-1';
            header.innerText = 'Completed (single)';
            collapsibleDiv.appendChild(header);
            noSession.forEach(b => collapsibleDiv.appendChild(this.createTimelineItem(b, todayStr, now, true)));
        }

        // Render session groups
        Object.keys(groups).forEach(sid => {
            const segs = groups[sid];
            // Calculate group total seconds
            const totalSecs = segs.reduce((acc, x) => acc + (x.studySeconds || 0), 0);

            const groupHeader = document.createElement('div');
            groupHeader.className = 'bg-gray-50 p-2 rounded-lg mb-2 border border-gray-100 flex items-center justify-between gap-2';
            const title = document.createElement('div');
            title.className = 'text-sm font-black text-gray-800';
            title.innerText = `Session: ${sid} — ${Math.floor(totalSecs/3600)}h ${Math.floor((totalSecs%3600)/60)}m ${totalSecs%60}s`;

            const toggleBtn = document.createElement('button');
            toggleBtn.className = 'text-xs font-bold text-gray-500 px-2 py-1 rounded';
            toggleBtn.innerText = 'Show segments';

            const segContainer = document.createElement('div');
            segContainer.className = 'hidden space-y-2 mt-2';
            segs.forEach(b => segContainer.appendChild(this.createTimelineItem(b, todayStr, now, true)));

            toggleBtn.addEventListener('click', () => {
                segContainer.classList.toggle('hidden');
                toggleBtn.innerText = segContainer.classList.contains('hidden') ? 'Show segments' : 'Hide segments';
            });

            groupHeader.appendChild(title);
            groupHeader.appendChild(toggleBtn);
            collapsibleDiv.appendChild(groupHeader);
            collapsibleDiv.appendChild(segContainer);
        });

        timelineList.appendChild(collapsibleDiv);
    }
}

createTimelineItem(block, todayStr, now, isCompleted = false) {
    const subColor = store.state.subjects[block.subject] || '#3b82f6';
    const bTime = new Date(`${todayStr}T${block.scheduledStart}:00`);
    const isUpNext = !isCompleted && bTime <= now && new Date(`${todayStr}T${block.scheduledEnd}:00`) > now;
    
    const el = document.createElement('div');
    el.className = `relative flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
        isCompleted 
            ? 'bg-gray-50 border-gray-200 opacity-60' 
            : isUpNext
            ? 'bg-blue-50 border-blue-300 border-l-4 ring-1 ring-blue-200'
            : 'bg-white border-gray-200 hover:bg-gray-50'
    }`;
    
    const timeStr = `${block.scheduledStart} - ${block.scheduledEnd}`;
    const statusBadge = isCompleted 
        ? '<span class="text-[10px] font-black text-green-600 bg-green-100 px-2 py-0.5 rounded">✓ Done</span>'
        : isUpNext
        ? '<span class="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded">⏰ Now</span>'
        : '';
    const sessionBadge = block.sessionId ? `<span class="text-[10px] font-black text-gray-700 bg-gray-100 px-2 py-0.5 rounded">Seg ${block.sessionSegmentIndex || 1}</span>` : '';
    
    el.innerHTML = `
        <div class="w-1 h-8 rounded-full" style="background-color: ${subColor}"></div>
        <div class="flex-1 min-w-0">
            <div class="text-xs font-black text-gray-500 uppercase">${timeStr}</div>
            <div class="text-sm font-bold text-gray-800 truncate">${block.title || block.subject}</div>
        </div>
        <div class="flex items-center gap-2 shrink-0">
            ${statusBadge}
            ${sessionBadge}
            ${!isCompleted ? `<button class="run-btn text-xs font-bold text-blue-600 hover:text-blue-700 px-2 py-1"><i class="fa fa-play mr-1"></i>Start</button>` : ''}
        </div>
    `;
    
    if (!isCompleted) {
        el.querySelector('.run-btn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            store.update('timer', t => ({ ...t, activeBlockId: block.id, spontaneousSubject: block.subject, mode: 'pomodoro', phase: 'study', studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: true }));
            timerEngine.start();
            document.querySelector('.tab-btn[data-tab="focus"]')?.click();
        });
    }
    
    return el;
}
    toggleFullscreen(enable) {
        const header = document.getElementById('appHeader');
        const nav = document.getElementById('appNav');
        const banner = document.getElementById('upNextBanner');
        const scheduleTab = document.getElementById('schedule');
        const controlsBar = document.getElementById('scheduleControlsBar');
        const exitBtn = document.getElementById('exitFullscreenBtn');

        if (enable) {
            header?.classList.add('hidden'); nav?.classList.add('hidden'); 
            if (banner) banner.style.setProperty('display', 'none', 'important');
            
            scheduleTab?.classList.add('!fixed', '!inset-0', '!z-[9999]');
            
            document.getElementById('prevDaysBtn')?.classList.add('hidden');
            document.getElementById('nextDaysBtn')?.classList.add('hidden');
            document.getElementById('fullscreenCanvasBtn')?.classList.add('hidden');
            if (this.canvasMonthLabel) this.canvasMonthLabel.classList.add('hidden');
            
            const addToggleCluster = controlsBar?.querySelector('.items-center');
            if (addToggleCluster) addToggleCluster.classList.add('hidden');

            controlsBar?.classList.add('!bg-transparent', '!border-none', '!shadow-none', 'pointer-events-none');
            document.getElementById('centerTodayBtn')?.classList.add('pointer-events-auto', 'bg-white', 'shadow-md');
            
            exitBtn?.classList.remove('hidden');
            this.setZoom(2);
        } else {
            header?.classList.remove('hidden'); nav?.classList.remove('hidden'); 
            if (banner) banner.style.removeProperty('display');
            
            scheduleTab?.classList.remove('!fixed', '!inset-0', '!z-[9999]');
            
            document.getElementById('prevDaysBtn')?.classList.remove('hidden');
            document.getElementById('nextDaysBtn')?.classList.remove('hidden');
            document.getElementById('fullscreenCanvasBtn')?.classList.remove('hidden');
            if (this.canvasMonthLabel) this.canvasMonthLabel.classList.remove('hidden');
            
            const addToggleCluster = controlsBar?.querySelector('.items-center');
            if (addToggleCluster) addToggleCluster.classList.remove('hidden');

            controlsBar?.classList.remove('!bg-transparent', '!border-none', '!shadow-none', 'pointer-events-none');
            document.getElementById('centerTodayBtn')?.classList.remove('pointer-events-auto', 'bg-white', 'shadow-md');
            
            exitBtn?.classList.add('hidden');
        }
        this.updateTransform();
    }

    autoPanLoop() {
        if (!this.isSelecting) {
            this.isAutoPanning = false;
            return;
        }
        
        if (this.autoPanVector.x !== 0 || this.autoPanVector.y !== 0) {
            this.panX += this.autoPanVector.x;
            this.panY += this.autoPanVector.y;
            this.updateSelection(this.lastPointer.x, this.lastPointer.y);
        }
        
        requestAnimationFrame(() => this.autoPanLoop());
    }

    updateSelection(clientX, clientY) {
        const containerRect = this.container.getBoundingClientRect();
        const canvasY = clientY - containerRect.top - this.panY - this.offsetY;
        
        let localMins = this.getMinsFromY(canvasY);
        let endAbs = this.selectStartCol * 1440 + this.getSnappedLocal(localMins);
        
        if (endAbs <= this.selectStartAbsMin) endAbs = this.selectStartAbsMin + (localMins > 1440 ? 15 : this.currentZoomTier);
        this.selectEndAbsMin = endAbs;
        
        this.updateTransform(); 
        this.renderSelectionBox();
        this.renderPhantomGrid();
    }

    // 🚨 NEW: Math engine to cleanly jump by exactly 1 month
    jumpToMonth(offset) {
        const leftEdgeDays = Math.round(-this.panX / this.dayWidth);
        const currentDate = new Date(this.baseDate.getTime() + (leftEdgeDays * 86400000));
        
        let newMonth = currentDate.getMonth() + offset;
        let newYear = currentDate.getFullYear();
        
        // Target perfectly to the 1st of the designated month
        const targetDate = new Date(newYear, newMonth, 1);
        targetDate.setHours(0,0,0,0);
        
        const diffTime = targetDate.getTime() - this.baseDate.getTime();
        const diffDays = Math.round(diffTime / 86400000);
        
        // Lock panX directly so that the 1st touches the exact left edge (+10 padding so we don't clip the line)
        this.panX = -diffDays * this.dayWidth + 10; 
        
        this.updateTransform();
        this.renderHeaders();
        this.renderBlocks();
    }

    bindEvents() {
        document.getElementById('fullscreenCanvasBtn')?.addEventListener('click', () => this.toggleFullscreen(true));
        document.getElementById('exitFullscreenBtn')?.addEventListener('click', () => this.toggleFullscreen(false));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.toggleFullscreen(false); });

        document.getElementById('canvasZoomIn')?.addEventListener('click', () => this.setZoom(this.zoom * 1.5));
        document.getElementById('canvasZoomOut')?.addEventListener('click', () => this.setZoom(this.zoom / 1.5));
        document.getElementById('canvasZoomReset')?.addEventListener('click', () => this.setZoom(1));
        document.getElementById('centerTodayBtn')?.addEventListener('click', () => this.centerOnToday());

        // 🚨 FIX 2: Connect buttons to the new Jump Engine!
        document.getElementById('prevDaysBtn')?.addEventListener('click', () => this.jumpToMonth(-1));
        document.getElementById('nextDaysBtn')?.addEventListener('click', () => this.jumpToMonth(1));
        
        document.getElementById('viewCanvasBtn')?.addEventListener('click', () => {
            this.container?.classList.remove('hidden'); this.container?.classList.add('block');
            document.getElementById('calendar-container')?.classList.add('hidden'); document.getElementById('calendar-container')?.classList.remove('flex');
            document.getElementById('canvasControls')?.classList.remove('hidden'); document.getElementById('canvasControls')?.classList.add('flex');
            document.getElementById('calendarControls')?.classList.add('hidden'); document.getElementById('calendarControls')?.classList.remove('flex');
            
            const vcBtn = document.getElementById('viewCanvasBtn'); if (vcBtn) vcBtn.className = "px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all text-theme-action";
            const vcalBtn = document.getElementById('viewCalendarBtn'); if(vcalBtn) vcalBtn.className = "px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
        });

        if (!this.container) return;

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const zoomFactor = e.deltaY < 0 ? 1.05 : 0.95;
                this.setZoom(this.zoom * zoomFactor, e.clientX, e.clientY);
            } else {
                this.panX -= e.deltaX; this.panY -= e.deltaY;
                this.updateTransform();
            }
        }, { passive: false });

        this.container.addEventListener('pointerdown', (e) => {
            this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.activePointers.size === 2) {
                const pts = Array.from(this.activePointers.values());
                this.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                this.initialPinchZoom = this.zoom;
                this.pinchCenterY = (pts[0].y + pts[1].y) / 2;
                return;
            }

            if (e.target.closest('.ypt-block') || e.target.closest('.action-btn')) return;
            
            if (e.shiftKey) { 
                this.isSelecting = true;
                this.container.style.cursor = 'crosshair';
                this.lastPointer = { x: e.clientX, y: e.clientY };
                
                const containerRect = this.container.getBoundingClientRect();
                const canvasX = e.clientX - containerRect.left - this.panX - this.offsetX;
                const canvasY = e.clientY - containerRect.top - this.panY - this.offsetY;
                
                this.selectStartCol = Math.floor(canvasX / this.dayWidth);
                const localMins = this.getMinsFromY(canvasY);
                
                this.selectStartAbsMin = this.selectStartCol * 1440 + this.getSnappedLocal(localMins);
                this.selectEndAbsMin = this.selectStartAbsMin + this.currentZoomTier;
                
                if (!this.isAutoPanning) {
                    this.isAutoPanning = true;
                    this.autoPanLoop();
                }
                
                this.renderSelectionBox();
                return; 
            }

            this.isPanning = true; this.hasDragged = false;
            this.startX = e.clientX - this.panX; this.startY = e.clientY - this.panY;
            this.pointerDownTime = Date.now();
        });

        window.addEventListener('pointermove', (e) => {
            if (this.activePointers.has(e.pointerId)) this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (this.activePointers.size === 2) {
                const pts = Array.from(this.activePointers.values());
                const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                const scale = dist / this.initialPinchDistance;
                this.setZoom(this.initialPinchZoom * scale, null, this.pinchCenterY);
                return;
            }

            if (this.isSelecting) {
                this.lastPointer = { x: e.clientX, y: e.clientY };
                
                const rect = this.container.getBoundingClientRect();
                const margin = 50; 
                let dx = 0; let dy = 0;
                
                if (e.clientX < rect.left + margin) dx = 6;
                else if (e.clientX > rect.right - margin) dx = -6;
                
                if (e.clientY < rect.top + this.offsetY + margin) dy = 6;
                else if (e.clientY > rect.bottom - margin) dy = -6;
                
                this.autoPanVector = { x: dx, y: dy };
                this.updateSelection(e.clientX, e.clientY);
                return;
            }

            if (this.isPanning) {
                const dx = e.clientX - this.startX - this.panX; const dy = e.clientY - this.startY - this.panY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasDragged = true;
                this.panX = e.clientX - this.startX; this.panY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        window.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
    }

    renderPhantomGrid() {
        const pLayer = document.getElementById('phantom-layer');
        if (!pLayer) return;
        
        if (!this.isSelecting) {
            pLayer.innerHTML = '';
            return;
        }

        const localEndMin = Math.max(this.selectStartAbsMin, this.selectEndAbsMin) - (this.selectStartCol * 1440);
        if (localEndMin <= 1440) {
            pLayer.innerHTML = '';
            return;
        }

        const leftPx = this.selectStartCol * this.dayWidth;
        const topPx = this.getYFromMins(1440); 
        const heightPx = this.getYFromMins(1740) - topPx; 
        
        let html = '';
        
        html += `
            <div class="absolute border-x border-b border-purple-300 border-dashed bg-purple-100/40" 
                 style="left: ${leftPx}px; top: ${topPx}px; width: ${this.dayWidth}px; height: ${heightPx}px;">
                <div class="text-center text-[10px] font-black text-purple-600 mt-2 tracking-widest uppercase bg-white/70 py-1 rounded mx-2 shadow-sm">Next Day (Phantom)</div>
            </div>
        `;

        for (let m = 0; m <= 300; m += 15) {
            const y = this.getYFromMins(1440 + m);
            const isHour = m % 60 === 0;
            const opacity = isHour ? 'opacity-60' : 'opacity-20';
            
            html += `<div class="absolute border-t border-purple-300 border-dashed w-full ${opacity}" style="left: ${leftPx}px; top: ${y}px; width: ${this.dayWidth}px;"></div>`;
            
            if (isHour) {
                let hr = m / 60;
                html += `<div class="absolute text-[10px] font-bold text-purple-500 right-2 -translate-y-1/2 opacity-100 drop-shadow-sm bg-white px-1 rounded-sm" style="left: ${leftPx - 45}px; top: ${y}px; width: 40px; text-align: right;">${String(hr).padStart(2, '0')}:00</div>`;
            } else {
                 let hr = Math.floor(m / 60);
                 let min = m % 60;
                 html += `<div class="absolute text-[8px] font-medium text-purple-400 right-2 -translate-y-1/2 opacity-90 bg-white px-1 rounded-sm drop-shadow-sm" style="left: ${leftPx - 45}px; top: ${y}px; width: 40px; text-align: right;">${String(hr).padStart(2, '0')}:${min}</div>`;
            }
        }
        
        pLayer.innerHTML = html;
    }

    renderSelectionBox() {
        const layer = document.getElementById('drag-selection-layer');
        if (!layer) return;
        layer.innerHTML = '';
        
        const startAbs = Math.min(this.selectStartAbsMin, this.selectEndAbsMin);
        const endAbs = Math.max(this.selectStartAbsMin, this.selectEndAbsMin);
        
        const col = this.selectStartCol;
        const localStartMin = startAbs - (col * 1440);
        const localEndMin = endAbs - (col * 1440);
        
        const topPx = this.getYFromMins(localStartMin);
        const heightPx = this.getYFromMins(localEndMin) - topPx;
        const leftPx = col * this.dayWidth;
        
        const box = document.createElement('div');
        box.className = 'absolute bg-blue-500/40 border-2 border-blue-600 rounded backdrop-blur-[1px] pointer-events-none shadow-inner z-50';
        box.style.left = `${leftPx}px`;
        box.style.top = `${topPx}px`;
        box.style.width = `${this.dayWidth - 4}px`;
        box.style.height = `${heightPx}px`;
        layer.appendChild(box);
    }

    handlePointerUp(e) {
        this.activePointers.delete(e.pointerId);

        if (this.isSelecting) {
            this.isSelecting = false;
            this.autoPanVector = { x: 0, y: 0 };
            this.container.style.cursor = 'grab';
            
            const selLayer = document.getElementById('drag-selection-layer');
            const phanLayer = document.getElementById('phantom-layer');
            if (selLayer) selLayer.innerHTML = '';
            if (phanLayer) phanLayer.innerHTML = ''; 
            
            let startAbs = this.selectStartAbsMin;
            let endAbs = this.selectEndAbsMin;
            if (startAbs > endAbs) { let t = startAbs; startAbs = endAbs; endAbs = t; }

            let sCol = this.selectStartCol;
            let sMin = startAbs - (sCol * 1440);
            
            let eCol = this.selectStartCol;
            let eMin = endAbs - (sCol * 1440);
            
            if (eMin > 1440) { 
                eCol += Math.floor(eMin / 1440); 
                eMin %= 1440; 
            } else if (eMin === 1440) {
                eCol += 1;
                eMin = 0;
            }
            
            this.updateTransform();
            this.openAddBlockModal(sCol, sMin, eCol, eMin);
            
        } else if (this.isPanning) {
            this.isPanning = false;
            const duration = Date.now() - this.pointerDownTime;
            if (!this.hasDragged && duration < 500 && !e.target.closest('.ypt-block')) {
                const containerRect = this.container.getBoundingClientRect();
                const canvasX = e.clientX - containerRect.left - this.panX - this.offsetX;
                const canvasY = e.clientY - containerRect.top - this.panY - this.offsetY;
                
                if (canvasX < 0 || canvasY < 0) return;

                const startCol = Math.floor(canvasX / this.dayWidth);
                const localMins = this.getMinsFromY(canvasY);
                const snappedLocal = this.getSnappedLocal(localMins);

                let eCol = startCol;
                let eMin = snappedLocal + this.currentZoomTier;
                if (eMin > 1440) { eCol += 1; eMin %= 1440; }

                this.openAddBlockModal(startCol, snappedLocal, eCol, eMin);
            }
        }
    }

    openEditModal(blockId) {
        const b = store.state.blocks.find(x => x.id === blockId);
        if (!b) return;

        const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

        safeSet('editBlockSubject', b.subject || ''); safeSet('editBlockTitle', b.title || '');
        safeSet('editBlockSchedStartDate', b.startDate || b.date || '');
        safeSet('editBlockSchedStart', b.scheduledStart ? b.scheduledStart.split(':').slice(0, 2).join(':') : "");
        safeSet('editBlockSchedEndDate', b.endDate || b.startDate || b.date || '');
        safeSet('editBlockSchedEnd', b.scheduledEnd ? b.scheduledEnd.split(':').slice(0, 2).join(':') : "");
        safeSet('editBlockRemarks', b.remarks || '');

        const studyMins = document.getElementById('editBlockStudyMins');
        const studySecs = document.getElementById('editBlockStudySecs');
        if (studyMins && studySecs) {
            const total = b.studySeconds || 0;
            studyMins.value = Math.floor(total / 60);
            studySecs.value = total % 60;
        }

        const t = store.state.timer;
        const warningEl = document.getElementById('editBlockRealWarning');

        if (t.activeBlockId === b.id && t.isRunning) {
            if(studyMins) { studyMins.disabled = true; studyMins.classList.add('opacity-50'); }
            if(studySecs) { studySecs.disabled = true; studySecs.classList.add('opacity-50'); }
            if(warningEl) { warningEl.innerText = "⚠️ Real time cannot be edited while running."; warningEl.classList.remove('hidden'); }
        } else {
            if(studyMins) { studyMins.disabled = false; studyMins.classList.remove('opacity-50'); }
            if(studySecs) { studySecs.disabled = false; studySecs.classList.remove('opacity-50'); }
            if(warningEl) warningEl.classList.add('hidden');
        }

        const saveBtn = document.getElementById('saveEditBlock');
        if (saveBtn) saveBtn.dataset.id = b.id;
        document.getElementById('editBlockModal')?.classList.remove('hidden');
    }

    openAddBlockModal(startCol, startMin, endCol, endMin) {
        const targetStartDate = new Date(this.baseDate.getTime() + (startCol * 86400000));
        let targetEndDate = new Date(this.baseDate.getTime() + (endCol * 86400000));
        
        const pad = n => String(n).padStart(2, '0');
        let sH = Math.floor(startMin/60); let sM = startMin%60;
        let eH = Math.floor(endMin/60); let eM = endMin%60;

        const sDateInput = document.getElementById('newBlockStartDate');
        if(sDateInput) {
            sDateInput.value = this.formatDate(targetStartDate);
            const eb = document.getElementById('newBlockEndDate'); if (eb) eb.value = this.formatDate(targetEndDate);
            const st = document.getElementById('newBlockStart'); if (st) st.value = `${pad(sH)}:${pad(sM)}`;
            const ed = document.getElementById('newBlockEnd'); if (ed) ed.value = `${pad(eH)}:${pad(eM)}`;
            
            document.getElementById('addBlockModal')?.classList.remove('hidden');
        }
    }

    centerOnToday() {
        this.baseDate = this.getChinaTime(); this.baseDate.setHours(0,0,0,0);
        this.panX = 10; this.panY = 0; this.zoom = 1; this.currentZoomTier = 60;
        this.updateTransform(); this.renderHeaders(); this.renderBlocks();
    }

    setZoom(newZoom, mouseX, mouseY) {
        if (newZoom < 0.5) newZoom = 0.5; if (newZoom > 4) newZoom = 4;
        if (!mouseY) mouseY = this.container ? this.container.clientHeight / 2 : 0;

        const containerRect = this.container ? this.container.getBoundingClientRect() : { top: 0 };
        const yInContainer = mouseY - containerRect.top - this.offsetY;
        const timeAtCursor = (yInContainer - this.panY) / (this.pxPerHour * this.zoom);

        this.zoom = newZoom;
        this.panY = yInContainer - (timeAtCursor * (this.pxPerHour * this.zoom));

        if (this.zoom >= 2) this.currentZoomTier = 15;
        else if (this.zoom >= 1) this.currentZoomTier = 30;
        else this.currentZoomTier = 60;

        this.updateTransform(); this.renderHeaders(); this.renderBlocks();
    }

    updateTransform() {
        if (!this.container) return;
        
        let extraHeight = 0;
        if (this.isSelecting) {
            const localEndMin = this.selectEndAbsMin - (this.selectStartCol * 1440);
            if (localEndMin > 1440) {
                extraHeight = this.getYFromMins(1740) - this.getYFromMins(1440) + 100; 
            }
        }
        
        const totalHeight = this.getYFromMins(1440) + extraHeight;
        const viewportHeight = this.container.clientHeight - this.offsetY; 

        if (this.panY > 0) this.panY = 0; 
        const minPanY = -(totalHeight - viewportHeight);
        if (totalHeight > viewportHeight) { if (this.panY < minPanY) this.panY = minPanY; } else this.panY = 0;

        this.root.style.setProperty('--pan-x', `${this.panX}px`);
        this.root.style.setProperty('--pan-y', `${this.panY}px`);
        this.root.style.setProperty('--zoom', this.zoom);

        if (this.daysHeader) this.daysHeader.style.transform = `translateX(${this.panX + this.offsetX}px)`;
        if (this.timeLabels) this.timeLabels.style.transform = `translateY(${this.panY + this.offsetY}px)`;

        const transformStr = `translate(${this.panX + this.offsetX}px, ${this.panY + this.offsetY}px)`;
        if (this.gridBg) this.gridBg.style.transform = transformStr;
        if (this.blocksLayer) this.blocksLayer.style.transform = transformStr;
        if (this.layer) this.layer.style.transform = transformStr;

        if (this.currentZoomTier === 15) {
            this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)'); this.root.style.setProperty('--grid-15', 'rgba(0,0,0,0.04)');
        } else if (this.currentZoomTier === 30) {
            this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)'); this.root.style.setProperty('--grid-15', 'transparent');
        } else {
            this.root.style.setProperty('--grid-30', 'transparent'); this.root.style.setProperty('--grid-15', 'transparent');
        }

        // 🚨 NEW: Dynamic Month Label Tracker!
        if (this.canvasMonthLabel) {
            const leftEdgeDays = Math.round(-this.panX / this.dayWidth);
            const currentDate = new Date(this.baseDate.getTime() + (leftEdgeDays * 86400000));
            this.canvasMonthLabel.innerText = currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
    }

    renderHeaders() {
        if (!this.daysHeader || !this.timeLabels) return;
        this.daysHeader.innerHTML = ''; this.timeLabels.innerHTML = '';
        
        for (let i = -100; i <= 100; i++) {
            const d = new Date(this.baseDate.getTime() + (i * 86400000));
            const isToday = i === 0;
            const bgClass = isToday ? 'bg-blue-100 text-blue-700 rounded shadow-sm px-2 py-1' : 'text-gray-600 bg-white/95 shadow-sm border border-gray-200/50 rounded-full px-3 py-1 backdrop-blur-md';
            
            const leftPx = i * this.dayWidth;
            this.daysHeader.innerHTML += `
                <div class="absolute flex items-center justify-center pointer-events-auto" style="left: ${leftPx}px; width: ${this.dayWidth}px; top: 0px; height: ${this.offsetY}px;">
                    <span class="inline-block text-xs font-bold ${bgClass}">${d.toLocaleDateString('en-US', {weekday:'short', month:'numeric', day:'numeric'})}</span>
                </div>
            `;
        }

        for (let h = 0; h <= 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                if (h === 24 && m > 0) continue; 
                const topPx = (h + m/60) * this.pxPerHour * this.zoom;
                let visibility = 'opacity-0 hidden';
                let fontClass = 'text-[10px] font-bold text-gray-400';
                
                if (m === 0) { visibility = 'opacity-100 block'; fontClass = 'text-xs font-black text-gray-600'; } 
                else if (m === 30 && this.currentZoomTier <= 30) visibility = 'opacity-100 block';
                else if ((m === 15 || m === 45) && this.currentZoomTier === 15) visibility = 'opacity-100 block';

                if (visibility.includes('block')) {
                    this.timeLabels.innerHTML += `<div class="absolute right-2 text-right ${fontClass} ${visibility} -translate-y-1/2" style="top: ${topPx}px; width: ${this.offsetX - 8}px;">${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}</div>`;
                }
            }
        }
    }

    renderBlocks() {
        if (!this.blocksLayer) return;
        this.blocksLayer.innerHTML = '';
        const blocks = store.state.blocks;
        const tooltip = document.getElementById('block-tooltip');
        const now = this.getChinaTime();
        
        blocks.forEach(b => {
            try {
                const bDateStr = b.startDate || b.date;
                const rawStart = b.scheduledStart || b.actualStart;
                const rawEnd = b.scheduledEnd || b.actualEnd;
                if (!bDateStr || !rawStart || !rawEnd) return; 

                const cleanTime = (t) => t.split(':').slice(0, 2).join(':');
                const sTime = cleanTime(rawStart); const eTime = cleanTime(rawEnd);

                const bStart = new Date(`${bDateStr}T${sTime}:00`);
                const bEnd = new Date(`${b.endDate || bDateStr}T${eTime}:00`);
                
                const isActive = store.state.timer?.activeBlockId === b.id;
                let opacityClass = 'opacity-95'; let borderClass = '';
                const isPast = now > bEnd;

                if (b.status === 'completed') { opacityClass = 'opacity-50'; }
                else if (isActive) { opacityClass = 'opacity-100'; borderClass = 'ring-4 ring-yellow-400 z-30'; }
                else if (isPast) { opacityClass = 'opacity-70 grayscale'; borderClass = 'border-2 border-red-500 border-dashed'; }

                let currentStart = new Date(bStart);
                while (currentStart < bEnd) {
                    let endOfDay = new Date(currentStart);
                    endOfDay.setHours(24, 0, 0, 0); 
                    
                    let chunkEnd = new Date(Math.min(bEnd.getTime(), endOfDay.getTime()));
                    let durationMins = (chunkEnd - currentStart) / 60000;
                    if (durationMins <= 0) break;
                    
                    const diffDays = Math.round((new Date(currentStart).setHours(0,0,0,0) - this.baseDate.getTime()) / 86400000);
                    
                    const leftPx = diffDays * this.dayWidth;
                    const topPx = ((currentStart.getHours() * 60) + currentStart.getMinutes()) / 60 * this.pxPerHour * this.zoom;
                    const heightPx = (durationMins / 60) * this.pxPerHour * this.zoom;

                    const el = document.createElement('div');
                    el.className = `ypt-block absolute rounded p-1 shadow-sm text-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow pointer-events-auto ${opacityClass} ${borderClass}`;
                    el.style.left = `${leftPx + 2}px`; el.style.top = `${topPx}px`;
                    el.style.width = `${this.dayWidth - 4}px`; el.style.height = `${heightPx}px`;
                    el.style.backgroundColor = store.state.subjects[b.subject] || '#3b82f6';
                    el.dataset.id = b.id;
                    
                    let contentHtml = '';
                    if (heightPx < 30) contentHtml = `<div class="font-bold text-[9px] truncate">${b.subject} - ${b.title || 'Focus'}</div>`;
                    else contentHtml = `<div class="font-bold text-[9px] truncate uppercase">${b.subject}</div><div class="font-bold text-[10px] truncate">${b.title || 'Focus'}</div>`;

                    el.innerHTML = `
                        <button class="delete-btn absolute top-1 right-1 bg-red-600/80 hover:bg-red-700 text-white rounded px-1.5 py-0.5 text-[8px] font-black z-20 action-btn">X</button>
                        ${(b.status !== 'completed' && !isActive) ? `<button class="run-btn absolute bottom-1 right-1 bg-white text-gray-800 hover:bg-gray-100 rounded px-1.5 py-0.5 text-[9px] font-black z-20 shadow-md action-btn">▶️</button>` : ''}
                        <div class="pointer-events-none z-10 flex flex-col h-full">${contentHtml}</div>
                    `;

                    el.querySelector('.delete-btn')?.addEventListener('pointerdown', (e) => {
                        e.stopPropagation();
                        if (confirm(`Delete block?`)) store.update('blocks', old => old.filter(x => x.id !== b.id));
                    });
                    
                    el.querySelector('.run-btn')?.addEventListener('pointerdown', (e) => {
                        e.stopPropagation();
                        store.update('timer', t => ({ ...t, activeBlockId: b.id, spontaneousSubject: b.subject, mode: 'pomodoro', phase: 'study', studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: true }));
                        timerEngine.start(); document.querySelector('.tab-btn[data-tab="focus"]')?.click();
                    });

                    if (b.status !== 'completed' && !isActive) {
                        let isDraggingBlock = false;
                        let dragStartX, dragStartY, initialLeft, initialTop;
                        let hasBlockDragged = false;
                        
                        const chunkOriginalCol = diffDays;
                        const chunkOriginalMin = currentStart.getHours() * 60 + currentStart.getMinutes();

                        el.addEventListener('pointerdown', (e) => {
                            if (e.target.closest('.action-btn')) return;
                            e.stopPropagation(); 
                            
                            isDraggingBlock = true; hasBlockDragged = false;
                            dragStartX = e.clientX; dragStartY = e.clientY;
                            initialLeft = parseFloat(el.style.left); initialTop = parseFloat(el.style.top);
                            
                            el.setPointerCapture(e.pointerId);
                            el.classList.add('z-[100]', 'opacity-80', 'scale-105');
                        });

                        el.addEventListener('pointermove', (e) => {
                            if (!isDraggingBlock) return;
                            const dx = e.clientX - dragStartX; const dy = e.clientY - dragStartY;
                            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasBlockDragged = true;
                            el.style.left = `${initialLeft + dx}px`; el.style.top = `${initialTop + dy}px`;
                        });

                        el.addEventListener('pointerup', (e) => {
                            if (!isDraggingBlock) return;
                            isDraggingBlock = false;
                            el.releasePointerCapture(e.pointerId);
                            el.classList.remove('z-[100]', 'opacity-80', 'scale-105');

                            if (!hasBlockDragged) {
                                this.openEditModal(b.id);
                                return;
                            }

                            const finalLeft = parseFloat(el.style.left);
                            const finalTop = parseFloat(el.style.top);

                            const newColOffset = Math.round((finalLeft - 2) / this.dayWidth);
                            const newMinOffset = Math.round((finalTop / (this.pxPerHour * this.zoom)) * 60);

                            const deltaMins = (newColOffset * 1440 + newMinOffset) - (chunkOriginalCol * 1440 + chunkOriginalMin);

                            const newBStart = new Date(bStart.getTime() + deltaMins * 60000);
                            const newBEnd = new Date(bEnd.getTime() + deltaMins * 60000);
                            const pad = n => String(n).padStart(2, '0');

                            store.update('blocks', old => old.map(x => x.id === b.id ? { 
                                ...x, 
                                startDate: this.formatDate(newBStart), 
                                endDate: this.formatDate(newBEnd),
                                scheduledStart: `${pad(newBStart.getHours())}:${pad(newBStart.getMinutes())}`, 
                                scheduledEnd: `${pad(newBEnd.getHours())}:${pad(newBEnd.getMinutes())}` 
                            } : x));
                        });
                    } else {
                        el.addEventListener('pointerdown', (e) => {
                            if (e.target.closest('.action-btn')) return;
                            e.stopPropagation();
                            this.openEditModal(b.id);
                        });
                    }

                    el.addEventListener('mouseenter', () => {
                        if(tooltip) {
                            tooltip.innerHTML = `<div class="text-[10px] font-black text-gray-400">${b.subject}</div><div class="text-base font-bold">${b.title || 'Focus'}</div><div class="text-xs text-blue-300">${sTime} - ${eTime}</div>`;
                            tooltip.style.opacity = '1';
                        }
                    });
                    el.addEventListener('mousemove', (e) => { if(tooltip) tooltip.style.transform = `translate(${e.clientX + 15}px, ${e.clientY + 15}px)`; });
                    el.addEventListener('mouseleave', () => { if(tooltip) tooltip.style.opacity = '0'; });

                    this.blocksLayer.appendChild(el);
                    currentStart = chunkEnd; 
                }
            } catch (err) {
                console.warn("Failed to render a block, but app is safe.", err);
            }
        });
    }
}
export const canvasUI = new CanvasUI();

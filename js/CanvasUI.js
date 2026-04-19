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
        
        this.offsetX = 60; 
        this.offsetY = 50; 
        this.root = document.documentElement;
        
        this.baseDate = this.getChinaTime(); this.baseDate.setHours(0,0,0,0);
        this.isSelecting = false;
        this.selectStartX = 0; this.selectStartMin = 0; this.selectColIndex = 0;
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }
    formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

    init() {
        this.container = document.getElementById('canvas-container');
        this.layer = document.getElementById('canvas-layer');
        this.gridBg = document.getElementById('canvas-grid');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.timeLabels = document.getElementById('canvas-times');
        this.daysHeader = document.getElementById('canvas-days');

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

        if (this.layer && !document.getElementById('drag-selection-box')) {
            const box = document.createElement('div');
            box.id = 'drag-selection-box';
            box.className = 'hidden absolute bg-blue-500/30 border-2 border-blue-600 rounded pointer-events-none z-40 backdrop-blur-[1px] transition-none';
            this.layer.appendChild(box);
        }

        this.bindEvents();

        if (this.container) {
            this.updateTransform();
            this.renderHeaders();
            this.renderBlocks();
        }
        this.renderDailyAgenda();

        store.subscribe('blocks', () => {
            if (this.container) this.renderBlocks();
            this.renderDailyAgenda();
        });
        store.subscribe('activeTab', () => this.renderDailyAgenda());
    }

    // 🚨 FIX 8: ZEN FULLSCREEN LOGIC
    toggleFullscreen(enable) {
        const header = document.getElementById('appHeader');
        const nav = document.getElementById('appNav');
        const banner = document.getElementById('upNextBanner');
        const scheduleTab = document.getElementById('schedule');
        const controlsBar = document.getElementById('scheduleControlsBar');
        const exitBtn = document.getElementById('exitFullscreenBtn');

        if (enable) {
            header?.classList.add('hidden'); nav?.classList.add('hidden'); banner?.classList.add('hidden');
            scheduleTab?.classList.add('!fixed', '!inset-0', '!z-[9999]');
            
            // Hide extraneous UI in the controls bar
            document.getElementById('prevDaysBtn')?.classList.add('hidden');
            document.getElementById('nextDaysBtn')?.classList.add('hidden');
            document.getElementById('fullscreenCanvasBtn')?.classList.add('hidden');
            
            // Hide the Add/Canvas/Calendar toggle cluster
            const addToggleCluster = controlsBar?.querySelector('.items-center');
            if (addToggleCluster) addToggleCluster.classList.add('hidden');

            controlsBar?.classList.add('!bg-transparent', '!border-none', '!shadow-none', 'pointer-events-none');
            
            // Make surviving buttons clickable again
            document.getElementById('centerTodayBtn')?.classList.add('pointer-events-auto', 'bg-white', 'shadow-md');
            
            exitBtn?.classList.remove('hidden');
            
            // Auto snap to 15min zoom
            this.setZoom(2);
        } else {
            header?.classList.remove('hidden'); nav?.classList.remove('hidden'); banner?.classList.remove('hidden');
            scheduleTab?.classList.remove('!fixed', '!inset-0', '!z-[9999]');
            
            document.getElementById('prevDaysBtn')?.classList.remove('hidden');
            document.getElementById('nextDaysBtn')?.classList.remove('hidden');
            document.getElementById('fullscreenCanvasBtn')?.classList.remove('hidden');
            
            const addToggleCluster = controlsBar?.querySelector('.items-center');
            if (addToggleCluster) addToggleCluster.classList.remove('hidden');

            controlsBar?.classList.remove('!bg-transparent', '!border-none', '!shadow-none', 'pointer-events-none');
            document.getElementById('centerTodayBtn')?.classList.remove('pointer-events-auto', 'bg-white', 'shadow-md');
            
            exitBtn?.classList.add('hidden');
        }
        this.updateTransform();
    }

    bindEvents() {
        document.getElementById('fullscreenCanvasBtn')?.addEventListener('click', () => this.toggleFullscreen(true));
        document.getElementById('exitFullscreenBtn')?.addEventListener('click', () => this.toggleFullscreen(false));
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.toggleFullscreen(false); });

        document.getElementById('canvasZoomIn')?.addEventListener('click', () => this.setZoom(this.zoom * 1.5));
        document.getElementById('canvasZoomOut')?.addEventListener('click', () => this.setZoom(this.zoom / 1.5));
        document.getElementById('canvasZoomReset')?.addEventListener('click', () => this.setZoom(1));
        document.getElementById('centerTodayBtn')?.addEventListener('click', () => this.centerOnToday());

        document.getElementById('prevDaysBtn')?.addEventListener('click', () => { this.panX += this.dayWidth * 3; this.updateTransform(); });
        document.getElementById('nextDaysBtn')?.addEventListener('click', () => { this.panX -= this.dayWidth * 3; this.updateTransform(); });
        
        document.getElementById('viewCanvasBtn')?.addEventListener('click', () => {
            this.container?.classList.remove('hidden'); this.container?.classList.add('block');
            document.getElementById('calendar-container')?.classList.add('hidden'); document.getElementById('calendar-container')?.classList.remove('flex');
            document.getElementById('canvasControls')?.classList.remove('hidden'); document.getElementById('canvasControls')?.classList.add('flex');
            document.getElementById('calendarControls')?.classList.add('hidden'); document.getElementById('calendarControls')?.classList.remove('flex');
        });

        if (!this.container) return;

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
            if (e.shiftKey) { this.startSelection(e); return; }

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
                const containerRect = this.container.getBoundingClientRect();
                const canvasY = e.clientY - containerRect.top - this.panY - this.offsetY;
                const rawMin = (canvasY / (this.pxPerHour * this.zoom)) * 60;
                let currentMin = Math.round(rawMin / this.currentZoomTier) * this.currentZoomTier;
                if (currentMin <= this.selectStartMin) currentMin = this.selectStartMin + this.currentZoomTier;
                const box = document.getElementById('drag-selection-box');
                if (box) box.style.height = `${((currentMin - this.selectStartMin) / 60) * this.pxPerHour * this.zoom}px`;
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

    startSelection(e) {
        this.isSelecting = true;
        this.container.style.cursor = 'crosshair';

        const containerRect = this.container.getBoundingClientRect();
        const canvasX = e.clientX - containerRect.left - this.panX - this.offsetX;
        const canvasY = e.clientY - containerRect.top - this.panY - this.offsetY;
        
        this.selectColIndex = Math.floor(canvasX / this.dayWidth); 
        const rawMin = (canvasY / (this.pxPerHour * this.zoom)) * 60;
        this.selectStartMin = Math.floor(rawMin / this.currentZoomTier) * this.currentZoomTier;
        
        const box = document.getElementById('drag-selection-box');
        if (box) {
            box.classList.remove('hidden');
            box.style.left = `${this.selectColIndex * this.dayWidth}px`;
            box.style.top = `${(this.selectStartMin / 60) * this.pxPerHour * this.zoom}px`;
            box.style.width = `${this.dayWidth - 4}px`;
            box.style.height = `${(this.currentZoomTier / 60) * this.pxPerHour * this.zoom}px`;
        }
    }

    handlePointerUp(e) {
        this.activePointers.delete(e.pointerId);

        if (this.isSelecting) {
            this.isSelecting = false;
            this.container.style.cursor = 'grab';
            const box = document.getElementById('drag-selection-box');
            if (box) box.classList.add('hidden');
            
            const boxHeight = box ? parseFloat(box.style.height) : 0;
            const durationMins = (boxHeight / (this.pxPerHour * this.zoom)) * 60;
            const endMin = this.selectStartMin + Math.round(durationMins);
            this.openAddBlockModal(this.selectColIndex, this.selectStartMin, endMin);
            
        } else if (this.isPanning) {
            this.isPanning = false;
            const duration = Date.now() - this.pointerDownTime;
            if (!this.hasDragged && duration < 500 && !e.target.closest('.ypt-block')) {
                const containerRect = this.container.getBoundingClientRect();
                const canvasX = e.clientX - containerRect.left - this.panX - this.offsetX;
                const canvasY = e.clientY - containerRect.top - this.panY - this.offsetY;
                
                if (canvasX < 0 || canvasY < 0) return;

                const colIdx = Math.floor(canvasX / this.dayWidth);
                const rawMins = (canvasY / (this.pxPerHour * this.zoom)) * 60;
                const snappedMins = Math.floor(rawMins / this.currentZoomTier) * this.currentZoomTier;

                this.openAddBlockModal(colIdx, snappedMins, snappedMins + this.currentZoomTier);
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
        if(studyMins) studyMins.value = b.studySeconds ? Math.floor(b.studySeconds / 60) : 0;

        const t = store.state.timer;
        const warningEl = document.getElementById('editBlockRealWarning');

        if (t.activeBlockId === b.id && t.isRunning) {
            if(studyMins) { studyMins.disabled = true; studyMins.classList.add('opacity-50'); }
            if(warningEl) { warningEl.innerText = "⚠️ Real time cannot be edited while running."; warningEl.classList.remove('hidden'); }
        } else {
            if(studyMins) { studyMins.disabled = false; studyMins.classList.remove('opacity-50'); }
            if(warningEl) warningEl.classList.add('hidden');
        }

        const saveBtn = document.getElementById('saveEditBlock');
        if (saveBtn) saveBtn.dataset.id = b.id;
        document.getElementById('editBlockModal')?.classList.remove('hidden');
    }

    openAddBlockModal(colIdx, startMin, endMin) {
        const targetDate = new Date(this.baseDate.getTime() + (colIdx * 86400000));
        const dateStr = this.formatDate(targetDate);
        const pad = n => String(n).padStart(2, '0');

        const sDateInput = document.getElementById('newBlockStartDate');
        if(sDateInput) {
            sDateInput.value = dateStr;
            const eb = document.getElementById('newBlockEndDate'); if (eb) eb.value = dateStr;
            const st = document.getElementById('newBlockStart'); if (st) st.value = `${pad(Math.floor(startMin/60))}:${pad(startMin%60)}`;
            const ed = document.getElementById('newBlockEnd'); if (ed) ed.value = `${pad(Math.floor(endMin/60))}:${pad(endMin%60)}`;
            
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
        const totalHeight = 24 * this.pxPerHour * this.zoom;
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
    }

    renderDailyAgenda() {
        if (!this.dailyAgendaContainer || store.state.activeTab !== 'schedule') return;
        const todayStr = this.formatDate(this.getChinaTime());
        
        let blocks = store.state.blocks.filter(b => b.startDate === todayStr && b.status !== 'completed');
        blocks.sort((a,b) => (a.scheduledStart || "").localeCompare(b.scheduledStart || ""));

        // 🚨 FIX 6: Filter out the Up-Next duplicate!
        const banner = document.getElementById('upNextBanner');
        if (banner && !banner.classList.contains('hidden') && blocks.length > 0) {
            // Find the closest chronological block that is being shown in the banner
            const nextBlock = blocks.find(b => {
                const bTime = new Date(`${todayStr}T${b.scheduledStart}:00`);
                const diff = bTime - new Date();
                return diff > -60000 && diff <= 2 * 3600 * 1000;
            });
            if (nextBlock) blocks = blocks.filter(b => b.id !== nextBlock.id);
        }

        this.dailyAgendaContainer.innerHTML = '';

        blocks.forEach(b => {
            const subColor = store.state.subjects[b.subject] || '#3b82f6';
            const cleanTime = (t) => t ? t.split(':').slice(0, 2).join(':') : "??:??";
            
            const el = document.createElement('div');
            el.className = "agenda-item flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow relative";
            el.draggable = true; el.dataset.id = b.id;
            
            el.innerHTML = `
                <div class="w-1.5 h-full rounded-full" style="background-color: ${subColor}"></div>
                <div class="flex-1 pointer-events-none pr-16">
                    <div class="text-[10px] font-black text-gray-400 mb-0.5">${cleanTime(b.scheduledStart)} - ${cleanTime(b.scheduledEnd)}</div>
                    <div class="text-sm font-bold text-gray-800 truncate">${b.title || b.subject || 'Focus'}</div>
                </div>
                <div class="text-gray-300 pointer-events-none"><i class="fa fa-grip-lines"></i></div>
            `;

            el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', b.id); e.dataTransfer.effectAllowed = 'move'; setTimeout(() => el.classList.add('opacity-50'), 0); });
            el.addEventListener('dragend', () => el.classList.remove('opacity-50'));
            el.addEventListener('dblclick', () => this.openEditModal(b.id));

            this.dailyAgendaContainer.appendChild(el);
        });

        this.dailyAgendaContainer.addEventListener('dragover', (e) => {
            e.preventDefault(); const dragging = document.querySelector('.opacity-50'); if(!dragging) return;
            const siblings = [...this.dailyAgendaContainer.querySelectorAll('.agenda-item:not(.opacity-50)')];
            const nextSibling = siblings.find(sib => e.clientY <= sib.getBoundingClientRect().top + sib.offsetHeight / 2);
            if(nextSibling) this.dailyAgendaContainer.insertBefore(dragging, nextSibling); else this.dailyAgendaContainer.appendChild(dragging);
        });
        this.dailyAgendaContainer.addEventListener('drop', (e) => { e.preventDefault(); this.recalculateWaterfall(); });
    }

    recalculateWaterfall() {
        const itemEls = [...this.dailyAgendaContainer.querySelectorAll('.agenda-item')];
        const newOrderIds = itemEls.map(el => el.dataset.id);
        const todayStr = this.formatDate(this.getChinaTime());
        
        let cascadeTimeStr = null;
        const updatedBlocks = [...store.state.blocks];

        newOrderIds.forEach(id => {
            const blockIdx = updatedBlocks.findIndex(b => b.id === id);
            if (blockIdx === -1) return;
            const b = updatedBlocks[blockIdx];
            if (!cascadeTimeStr) cascadeTimeStr = b.scheduledStart;

            const s = new Date(`1970-01-01T${b.scheduledStart}:00`);
            const e = new Date(`1970-01-01T${b.scheduledEnd}:00`);
            const durMins = (e - s) / 60000;

            const newS = new Date(`1970-01-01T${cascadeTimeStr}:00`);
            const newE = new Date(newS.getTime() + durMins * 60000);

            const formatT = d => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
            
            updatedBlocks[blockIdx] = { ...b, scheduledStart: formatT(newS), scheduledEnd: formatT(newE) };
            cascadeTimeStr = updatedBlocks[blockIdx].scheduledEnd;
        });
        store.update('blocks', () => updatedBlocks);
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
                const diffDays = Math.round((new Date(bDateStr).setHours(0,0,0,0) - this.baseDate.getTime()) / 86400000);
                
                let durationMins = (bEnd - bStart) / 60000;
                if (durationMins <= 0) durationMins = 5; 
                
                const leftPx = diffDays * this.dayWidth;
                const topPx = ((bStart.getHours() * 60) + bStart.getMinutes()) / 60 * this.pxPerHour * this.zoom;
                const heightPx = (durationMins / 60) * this.pxPerHour * this.zoom;

                const isActive = store.state.timer?.activeBlockId === b.id;
                let opacityClass = 'opacity-95'; let borderClass = '';
                const isPast = now > bEnd;

                if (b.status === 'completed') { opacityClass = 'opacity-50'; }
                else if (isActive) { opacityClass = 'opacity-100'; borderClass = 'ring-4 ring-yellow-400'; }
                else if (isPast) { opacityClass = 'opacity-70 grayscale'; borderClass = 'border-2 border-red-500 border-dashed'; }

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
                    <button class="delete-btn absolute top-1 right-1 bg-red-600/80 hover:bg-red-700 text-white rounded px-1.5 py-0.5 text-[8px] font-black z-20 action-btn hidden md:block">X</button>
                    ${(b.status !== 'completed' && !isActive) ? `<button class="run-btn absolute bottom-1 right-1 bg-white text-gray-800 hover:bg-gray-100 rounded px-1.5 py-0.5 text-[9px] font-black z-20 shadow-md action-btn">▶️</button>` : ''}
                    <div class="pointer-events-none z-10 flex flex-col h-full">${contentHtml}</div>
                `;

                // 🚨 FIX 5: Canvas Grid Drag-and-Drop Rescheduling Engine!
                if (b.status !== 'completed' && !isActive) {
                    let isDraggingBlock = false;
                    let dragStartX, dragStartY, initialLeft, initialTop;

                    el.addEventListener('pointerdown', (e) => {
                        if (e.target.closest('.action-btn')) return;
                        e.stopPropagation(); // Stop Canvas Panning!
                        
                        isDraggingBlock = true;
                        dragStartX = e.clientX; dragStartY = e.clientY;
                        initialLeft = parseFloat(el.style.left); initialTop = parseFloat(el.style.top);
                        
                        el.setPointerCapture(e.pointerId);
                        el.classList.add('z-[100]', 'opacity-80', 'scale-105');
                    });

                    el.addEventListener('pointermove', (e) => {
                        if (!isDraggingBlock) return;
                        const dx = e.clientX - dragStartX; const dy = e.clientY - dragStartY;
                        el.style.left = `${initialLeft + dx}px`; el.style.top = `${initialTop + dy}px`;
                    });

                    el.addEventListener('pointerup', (e) => {
                        if (!isDraggingBlock) return;
                        isDraggingBlock = false;
                        el.releasePointerCapture(e.pointerId);
                        el.classList.remove('z-[100]', 'opacity-80', 'scale-105');

                        // Math to convert drop position back to Date & Time!
                        const finalLeft = parseFloat(el.style.left);
                        const finalTop = parseFloat(el.style.top);

                        const colOffset = Math.round((finalLeft - 2) / this.dayWidth);
                        const minOffset = Math.round((finalTop / (this.pxPerHour * this.zoom)) * 60);

                        const newTargetDate = new Date(this.baseDate.getTime() + (colOffset * 86400000));
                        const newDateStr = this.formatDate(newTargetDate);

                        let newH = Math.floor(minOffset / 60); let newM = minOffset % 60;
                        if (newH < 0) { newH = 0; newM = 0; } if (newH > 23) { newH = 23; newM = 59; }

                        const pad = n => String(n).padStart(2, '0');
                        const newStartStr = `${pad(newH)}:${pad(newM)}`;

                        const newEndDateObj = new Date(`${newDateStr}T${newStartStr}:00`);
                        newEndDateObj.setMinutes(newEndDateObj.getMinutes() + durationMins);

                        store.update('blocks', old => old.map(x => x.id === b.id ? { 
                            ...x, 
                            startDate: newDateStr, 
                            endDate: this.formatDate(newEndDateObj),
                            scheduledStart: newStartStr, 
                            scheduledEnd: `${pad(newEndDateObj.getHours())}:${pad(newEndDateObj.getMinutes())}` 
                        } : x));
                    });
                }

                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (e.target.closest('.delete-btn')) { if (confirm(`Delete block?`)) store.update('blocks', old => old.filter(x => x.id !== b.id)); return; }
                    if (e.target.closest('.run-btn')) {
                        store.update('timer', t => ({ ...t, activeBlockId: b.id, spontaneousSubject: b.subject, mode: 'pomodoro', phase: 'study', studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: true }));
                        timerEngine.start(); document.querySelector('.tab-btn[data-tab="focus"]')?.click();
                        return;
                    }
                    // Only open edit modal if we didn't just drag!
                    if (Math.abs(parseFloat(el.style.left) - leftPx) < 5 && Math.abs(parseFloat(el.style.top) - topPx) < 5) {
                        this.openEditModal(b.id);
                    }
                });

                this.blocksLayer.appendChild(el);
            } catch (err) {
                console.warn("Failed to render a block, but app is safe.", err);
            }
        });
    }
}
export const canvasUI = new CanvasUI();

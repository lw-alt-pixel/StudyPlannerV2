// js/CanvasUI.js
import { store } from './State.js';

class CanvasUI {
    constructor() {
        this.panX = 10; this.panY = 0; this.zoom = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0; this.hasDragged = false; 
        
        this.activePointers = new Map();
        this.initialPinchDistance = null; this.initialPinchZoom = null; this.pinchCenterY = null;
        this.hasPinched = false;
        
        this.currentZoomTier = 60; 
        this.pxPerHour = 60; this.dayWidth = 180;
        this.root = document.documentElement;
        
        this.baseDate = this.getChinaTime(); this.baseDate.setHours(0,0,0,0);
        this.currentMonth = new Date(this.baseDate); this.currentMonth.setDate(1); 
        this.currentSlideDate = null;
        
        this.isSelecting = false;
        this.selectStartX = 0; this.selectStartMin = 0; this.selectColIndex = 0;
        this.longPressTimer = null;
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }
    formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

    init() {
        this.container = document.getElementById('canvas-container');
        this.layer = document.getElementById('canvas-layer');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.timeLabels = document.getElementById('canvas-times');
        this.daysHeader = document.getElementById('canvas-days');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.calendarDisplay = document.getElementById('currentMonthLabel');

        if (!document.getElementById('block-tooltip')) {
            const tooltip = document.createElement('div');
            tooltip.id = 'block-tooltip';
            tooltip.className = 'fixed z-[9999] pointer-events-none bg-gray-900/95 backdrop-blur-sm text-white rounded-xl shadow-2xl p-4 min-w-[200px] transition-opacity duration-150 opacity-0 border border-gray-700';
            tooltip.style.top = '0px'; tooltip.style.left = '0px';
            document.body.appendChild(tooltip);
        }

        this.bindEvents();

        if (this.container) {
            this.updateTransform();
            this.renderHeaders();
            this.renderBlocks();
        }
        if (this.calendarGrid) this.renderCalendar();

        store.subscribe('blocks', () => {
            if (this.container) this.renderBlocks();
            if (this.calendarGrid) this.renderCalendar();
            if (this.currentSlideDate) this.renderSlidePanelBlocks(this.currentSlideDate);
        });
    }

    bindEvents() {
        document.getElementById('canvasZoomIn')?.addEventListener('click', () => this.setZoom(this.zoom * 1.5));
        document.getElementById('canvasZoomOut')?.addEventListener('click', () => this.setZoom(this.zoom / 1.5));
        document.getElementById('canvasZoomReset')?.addEventListener('click', () => this.setZoom(1));
        
        if (!this.container) return;

        this.container.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.ypt-block') || e.target.closest('.action-btn')) return;
            if (e.shiftKey) { this.startSelection(e); return; }

            this.isPanning = true; this.hasDragged = false;
            this.startX = e.clientX - this.panX; this.startY = e.clientY - this.panY;
            this.pointerDownTime = Date.now();
        });

        window.addEventListener('pointermove', (e) => {
            if (this.isSelecting) {
                const layerRect = this.layer.getBoundingClientRect();
                const canvasY = e.clientY - layerRect.top;
                const rawMin = (canvasY / (this.pxPerHour * this.zoom)) * 60;
                let currentMin = Math.round(rawMin / this.currentZoomTier) * this.currentZoomTier;
                
                if (currentMin <= this.selectStartMin) currentMin = this.selectStartMin + this.currentZoomTier;
                
                const box = document.getElementById('drag-selection-box');
                if (box) {
                    const durationMins = currentMin - this.selectStartMin;
                    box.style.height = `${(durationMins / 60) * this.pxPerHour * this.zoom}px`;
                }
                return;
            }

            if (this.isPanning) {
                const dx = e.clientX - this.startX - this.panX;
                const dy = e.clientY - this.startY - this.panY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasDragged = true;
                this.panX = e.clientX - this.startX; this.panY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        window.addEventListener('pointerup', (e) => {
            if (this.isSelecting) {
                this.isSelecting = false;
                const box = document.getElementById('drag-selection-box');
                if (box) box.classList.add('hidden');
                
                const durationMins = (parseFloat(box.style.height) / (this.pxPerHour * this.zoom)) * 60;
                const endMin = this.selectStartMin + Math.round(durationMins);
                this.openAddBlockModal(this.selectColIndex, this.selectStartMin, endMin);
            } else if (this.isPanning) {
                this.isPanning = false;
                const duration = Date.now() - this.pointerDownTime;
                if (!this.hasDragged && duration < 500 && !e.target.closest('.ypt-block')) {
                    const layerRect = this.layer.getBoundingClientRect();
                    const canvasY = e.clientY - layerRect.top;
                    const rawMins = (canvasY / (this.pxPerHour * this.zoom)) * 60;
                    const snappedMins = Math.floor(rawMins / this.currentZoomTier) * this.currentZoomTier;
                    this.openAddBlockModal(Math.floor((e.clientX - layerRect.left) / this.dayWidth), snappedMins, snappedMins + this.currentZoomTier);
                }
            }
        });
    }

    startSelection(e) {
        this.isSelecting = true;
        const layerRect = this.layer.getBoundingClientRect();
        this.selectColIndex = Math.floor((e.clientX - layerRect.left) / this.dayWidth); 
        const rawMin = ((e.clientY - layerRect.top) / (this.pxPerHour * this.zoom)) * 60;
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

    openEditModal(blockId) {
        const b = store.state.blocks.find(x => x.id === blockId);
        if (!b) return;

        document.getElementById('editBlockSubject').value = b.subject || '';
        document.getElementById('editBlockTitle').value = b.title || '';
        document.getElementById('editBlockSchedStartDate').value = b.startDate || b.date || '';
        document.getElementById('editBlockSchedStart').value = b.scheduledStart || '';
        document.getElementById('editBlockSchedEndDate').value = b.endDate || b.startDate || b.date || '';
        document.getElementById('editBlockSchedEnd').value = b.scheduledEnd || '';
        document.getElementById('editBlockRemarks').value = b.remarks || '';

        const studyMins = document.getElementById('editBlockStudyMins');
        if(studyMins) studyMins.value = b.studySeconds ? Math.floor(b.studySeconds / 60) : 0;

        const t = store.state.timer;
        const isActiveAndRunning = (t.activeBlockId === b.id && t.isRunning);
        const warningEl = document.getElementById('editBlockRealWarning');

        if (isActiveAndRunning) {
            if(studyMins) { studyMins.disabled = true; studyMins.classList.add('opacity-50', 'cursor-not-allowed'); }
            if(warningEl) { warningEl.innerText = "⚠️ Real time cannot be edited while the timer is actively running. Pause first."; warningEl.classList.remove('hidden'); }
        } else {
            if(studyMins) { studyMins.disabled = false; studyMins.classList.remove('opacity-50', 'cursor-not-allowed'); }
            if(warningEl) warningEl.classList.add('hidden');
        }

        const saveBtn = document.getElementById('saveEditBlock');
        if (saveBtn) saveBtn.dataset.id = b.id;
        document.getElementById('editBlockModal')?.classList.remove('hidden');
    }

    openAddBlockModal(colIdx, startMin, endMin) {
        const targetDate = new Date(this.baseDate.getTime() + (colIdx * 86400000));
        const dateStr = this.formatDate(targetDate);
        const sH = Math.floor(startMin / 60).toString().padStart(2, '0');
        const sM = (startMin % 60).toString().padStart(2, '0');
        const eH = Math.floor(endMin / 60).toString().padStart(2, '0');
        const eM = (endMin % 60).toString().padStart(2, '0');

        const sDateInput = document.getElementById('newBlockStartDate');
        if(sDateInput) {
            sDateInput.value = dateStr;
            document.getElementById('newBlockEndDate').value = dateStr;
            document.getElementById('newBlockStart').value = `${sH}:${sM}`;
            document.getElementById('newBlockEnd').value = `${eH}:${eM}`;
            document.getElementById('addBlockModal').classList.remove('hidden');
        }
    }

    setZoom(newZoom) {
        if (newZoom < 0.5) newZoom = 0.5; if (newZoom > 4) newZoom = 4;
        this.zoom = newZoom;
        if (this.zoom >= 2) this.currentZoomTier = 15;
        else if (this.zoom >= 1) this.currentZoomTier = 30;
        else this.currentZoomTier = 60;
        this.updateTransform(); this.renderHeaders(); this.renderBlocks();
    }

    updateTransform() {
        this.root.style.setProperty('--pan-x', `${this.panX}px`);
        this.root.style.setProperty('--pan-y', `${this.panY}px`);
        this.root.style.setProperty('--zoom', this.zoom);
    }

    renderHeaders() { /* Retained from previous */ }

    renderBlocks() {
        if (!this.blocksLayer) return;
        this.blocksLayer.innerHTML = '';
        const blocks = store.state.blocks;
        const tooltip = document.getElementById('block-tooltip');
        
        blocks.forEach(b => {
            // 🚨 FALLBACK: Ensure old spontaneous blocks don't crash the renderer
            const bDateStr = b.startDate || b.date;
            if (!bDateStr || !b.scheduledStart || !b.scheduledEnd) return; 

            const bStart = new Date(`${bDateStr}T${b.scheduledStart}:00`);
            const bEnd = new Date(`${b.endDate || bDateStr}T${b.scheduledEnd}:00`);
            const diffDays = Math.round((new Date(bDateStr).setHours(0,0,0,0) - this.baseDate.getTime()) / 86400000);
            
            const leftPx = diffDays * this.dayWidth;
            const topPx = ((bStart.getHours() * 60) + bStart.getMinutes()) / 60 * this.pxPerHour * this.zoom;
            const heightPx = ((bEnd - bStart) / 60000) / 60 * this.pxPerHour * this.zoom;

            const el = document.createElement('div');
            el.className = `ypt-block absolute rounded p-1 shadow-sm text-white overflow-hidden cursor-pointer ${b.status === 'completed' ? 'opacity-50' : 'opacity-95'}`;
            el.style.left = `${leftPx + 2}px`; el.style.top = `${topPx}px`;
            el.style.width = `${this.dayWidth - 4}px`; el.style.height = `${heightPx}px`;
            el.style.backgroundColor = store.state.subjects[b.subject] || '#3b82f6';
            
            el.innerHTML = `<div class="pointer-events-none z-10 flex flex-col h-full"><div class="font-bold text-[9px] truncate">${b.title || 'Focus'}</div></div>`;

            el.addEventListener('mouseenter', () => {
                tooltip.innerHTML = `<div class="text-[10px] font-black text-gray-400">${b.subject}</div><div class="text-base font-bold">${b.title}</div><div class="text-xs text-blue-300">${b.scheduledStart} - ${b.scheduledEnd}</div>`;
                tooltip.style.opacity = '1';
            });
            el.addEventListener('mousemove', (e) => { tooltip.style.transform = `translate(${e.clientX + 15}px, ${e.clientY + 15}px)`; });
            el.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
            
            el.addEventListener('click', (e) => {
                e.stopPropagation(); tooltip.style.opacity = '0';
                this.openEditModal(b.id);
            });

            this.blocksLayer.appendChild(el);
        });
    }

    renderCalendar() { /* Retained from previous */ }
    openSlidePanelForDate(dateStr) { /* Retained from previous */ }
    renderSlidePanelBlocks(dateStr) {
        const container = document.getElementById('slidePanelBlocks');
        const blocks = store.state.blocks.filter(b => b.startDate === dateStr || b.date === dateStr);
        container.innerHTML = '';
        blocks.forEach(b => {
            const subColor = store.state.subjects[b.subject] || '#3b82f6';
            container.innerHTML += `
                <div class="agenda-item flex items-center gap-3 p-2 bg-white rounded border shadow-sm cursor-pointer hover:bg-gray-50" data-id="${b.id}">
                    <div class="w-3 h-full rounded-l" style="background-color: ${subColor}"></div>
                    <div class="flex-1"><div class="text-[10px] font-black text-gray-400">${b.scheduledStart} - ${b.scheduledEnd}</div><div class="text-sm font-bold text-gray-800">${b.title}</div></div>
                </div>
            `;
        });
        container.onclick = (e) => {
            const item = e.target.closest('.agenda-item');
            if (item && item.dataset.id) this.openEditModal(item.dataset.id);
        };
    }
    renderSlidePanelDiary(dateStr) { /* Retained from previous */ }
}
export const canvasUI = new CanvasUI();

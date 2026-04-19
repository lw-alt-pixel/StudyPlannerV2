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
        // Essential panning logic retained...
        document.getElementById('canvasZoomIn')?.addEventListener('click', () => this.setZoom(this.zoom * 1.5));
        document.getElementById('canvasZoomOut')?.addEventListener('click', () => this.setZoom(this.zoom / 1.5));
        document.getElementById('canvasZoomReset')?.addEventListener('click', () => this.setZoom(1));
        
        if (!this.container) return;

        this.container.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.ypt-block') || e.target.closest('.action-btn')) return;
            this.isPanning = true; this.hasDragged = false;
            this.startX = e.clientX - this.panX; this.startY = e.clientY - this.panY;
            this.pointerDownTime = Date.now();
        });

        window.addEventListener('pointermove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.startX - this.panX;
                const dy = e.clientY - this.startY - this.panY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasDragged = true;
                this.panX = e.clientX - this.startX; this.panY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        window.addEventListener('pointerup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                const duration = Date.now() - this.pointerDownTime;
                if (!this.hasDragged && duration < 500 && !e.target.closest('.ypt-block')) {
                    // Empty space click scheduling
                }
            }
        });
    }

    // 🚨 NEW: Master Edit Modal Controller
    openEditModal(blockId) {
        const b = store.state.blocks.find(x => x.id === blockId);
        if (!b) return;

        document.getElementById('editBlockSubject').value = b.subject || '';
        document.getElementById('editBlockTitle').value = b.title || '';
        document.getElementById('editBlockSchedStartDate').value = b.startDate || '';
        document.getElementById('editBlockSchedStart').value = b.scheduledStart || '';
        document.getElementById('editBlockSchedEndDate').value = b.endDate || b.startDate || '';
        document.getElementById('editBlockSchedEnd').value = b.scheduledEnd || '';
        document.getElementById('editBlockRemarks').value = b.remarks || '';

        // Pre-fill Real Logged Times
        const realStartD = document.getElementById('editBlockRealStartDate');
        const realStartT = document.getElementById('editBlockRealStart');
        const realEndD = document.getElementById('editBlockRealEndDate');
        const realEndT = document.getElementById('editBlockRealEnd');
        const studyMins = document.getElementById('editBlockStudyMins');

        if(realStartD) realStartD.value = b.startDate || '';
        if(realStartT) realStartT.value = b.actualStart || '';
        if(realEndD) realEndD.value = b.endDate || b.startDate || '';
        if(realEndT) realEndT.value = b.actualEnd || '';
        
        // Convert exact seconds back into estimated minutes for display
        if(studyMins) studyMins.value = b.studySeconds ? Math.floor(b.studySeconds / 60) : 0;

        // 🚨 Collision Safety Check
        const t = store.state.timer;
        const isActiveAndRunning = (t.activeBlockId === b.id && t.isRunning);
        const warningEl = document.getElementById('editBlockRealWarning');
        const realInputs = [realStartD, realStartT, realEndD, realEndT, studyMins];

        if (isActiveAndRunning) {
            realInputs.forEach(el => { if(el) { el.disabled = true; el.classList.add('opacity-50', 'cursor-not-allowed'); } });
            if(warningEl) {
                warningEl.innerText = "⚠️ Real time cannot be edited while the timer is actively running for this block. Pause or Finish the session first.";
                warningEl.classList.remove('hidden');
            }
        } else {
            realInputs.forEach(el => { if(el) { el.disabled = false; el.classList.remove('opacity-50', 'cursor-not-allowed'); } });
            if(warningEl) warningEl.classList.add('hidden');
        }

        const saveBtn = document.getElementById('saveEditBlock');
        if (saveBtn) saveBtn.dataset.id = b.id;
        document.getElementById('editBlockModal')?.classList.remove('hidden');
    }

    renderBlocks() {
        if (!this.blocksLayer) return;
        this.blocksLayer.innerHTML = '';
        const blocks = store.state.blocks;
        const tooltip = document.getElementById('block-tooltip');
        
        blocks.forEach(b => {
            if (!b.startDate || !b.scheduledStart) return;
            const bStart = new Date(`${b.startDate}T${b.scheduledStart}:00`);
            const bEnd = new Date(`${b.endDate}T${b.scheduledEnd}:00`);
            const diffDays = Math.round((new Date(b.startDate).setHours(0,0,0,0) - this.baseDate.getTime()) / 86400000);
            
            const leftPx = diffDays * this.dayWidth;
            const topPx = ((bStart.getHours() * 60) + bStart.getMinutes()) / 60 * this.pxPerHour * this.zoom;
            const heightPx = ((bEnd - bStart) / 60000) / 60 * this.pxPerHour * this.zoom;

            const subColor = store.state.subjects[b.subject] || '#3b82f6';
            const isActive = store.state.timer?.activeBlockId === b.id;
            let opacity = b.status === 'completed' ? 'opacity-50' : 'opacity-95';

            const el = document.createElement('div');
            el.className = `ypt-block absolute rounded p-1 shadow-sm text-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${opacity} ${isActive ? 'ring-4 ring-yellow-400' : ''}`;
            el.style.left = `${leftPx + 2}px`; el.style.top = `${topPx}px`;
            el.style.width = `${this.dayWidth - 4}px`; el.style.height = `${heightPx}px`;
            el.style.backgroundColor = subColor;
            
            el.innerHTML = `<div class="pointer-events-none z-10 flex flex-col h-full"><div class="font-bold text-[9px] truncate">${b.title}</div></div>`;

            // Tooltip & Click Handlers
            el.addEventListener('mouseenter', () => {
                tooltip.innerHTML = `<div class="text-[10px] font-black text-gray-400">${b.subject}</div><div class="text-base font-bold">${b.title}</div><div class="text-xs text-blue-300">${b.scheduledStart} - ${b.scheduledEnd}</div>`;
                tooltip.style.opacity = '1';
            });
            el.addEventListener('mousemove', (e) => { tooltip.style.transform = `translate(${e.clientX + 15}px, ${e.clientY + 15}px)`; });
            el.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
            
            el.addEventListener('click', (e) => {
                e.stopPropagation(); tooltip.style.opacity = '0';
                this.openEditModal(b.id); // 🚨 Opens the new unified modal handler
            });

            this.blocksLayer.appendChild(el);
        });
    }

    renderCalendar() {
        if (!this.calendarGrid) return;
        this.calendarGrid.innerHTML = '';
        const year = this.currentMonth.getFullYear(); const month = this.currentMonth.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const cell = document.createElement('div');
            cell.className = `min-h-[80px] p-1 border rounded-lg bg-white cursor-pointer shadow-sm`;
            cell.innerHTML = `<div class="text-[10px] font-black mb-1 pl-1">${day}</div>`;
            cell.addEventListener('click', () => this.openSlidePanelForDate(dateStr));
            this.calendarGrid.appendChild(cell);
        }
    }

    openSlidePanelForDate(dateStr) {
        this.currentSlideDate = dateStr;
        const panel = document.getElementById('daySlidePanel');
        const overlay = document.getElementById('diaryOverlay');
        if (!panel || !overlay) return;
        this.renderSlidePanelBlocks(dateStr);
        panel.classList.remove('translate-x-full'); overlay.classList.remove('hidden');
    }

    // 🚨 NEW: Interactive Agenda Calendar List
    renderSlidePanelBlocks(dateStr) {
        const container = document.getElementById('slidePanelBlocks');
        const blocks = store.state.blocks.filter(b => b.startDate === dateStr || b.date === dateStr);
        blocks.sort((a, b) => (a.scheduledStart || "00:00").localeCompare(b.scheduledStart || "00:00"));

        container.innerHTML = '';
        if (blocks.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-400 font-bold text-center italic py-4">No blocks scheduled.</div>';
            return;
        }

        blocks.forEach(b => {
            const subColor = store.state.subjects[b.subject] || '#3b82f6';
            const opacity = b.status === 'completed' ? 'opacity-50' : '';
            
            // Notice the new `.agenda-item` class and `data-id` hook
            container.innerHTML += `
                <div class="agenda-item flex items-center gap-3 p-2 bg-white rounded border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors ${opacity}" data-id="${b.id}">
                    <div class="w-3 h-full rounded-l" style="background-color: ${subColor}"></div>
                    <div class="flex-1">
                        <div class="text-[10px] font-black text-gray-400">${b.scheduledStart} - ${b.scheduledEnd}</div>
                        <div class="text-sm font-bold text-gray-800">${b.title}</div>
                    </div>
                    ${b.status === 'completed' ? `<div class="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">✓ ${Math.floor((b.studySeconds||0)/60)}m</div>` : ''}
                </div>
            `;
        });

        // 🚨 Agenda items are now fully clickable and open the modal!
        container.onclick = (e) => {
            const item = e.target.closest('.agenda-item');
            if (item && item.dataset.id) {
                this.openEditModal(item.dataset.id);
            }
        };
    }
}
export const canvasUI = new CanvasUI();

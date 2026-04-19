// js/CanvasUI.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';

class CanvasUI {
    constructor() {
        this.panX = 10; this.panY = -480; this.zoom = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0; this.hasDragged = false; 
        this.isDraggingBlock = false; this.draggedBlockEl = null; this.draggedBlockId = null;
        this.blockOffsetX = 0; this.blockOffsetY = 0; this.hasMovedBlock = false;
        
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
        this.wrapper = document.getElementById('canvas-wrapper');
        this.layer = document.getElementById('canvas-layer');
        this.gridBg = document.getElementById('canvas-grid');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.timeLabels = document.getElementById('canvas-times');
        this.daysHeader = document.getElementById('canvas-days');
        
        this.calendarContainer = document.getElementById('calendar-container');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.calendarDisplay = document.getElementById('currentMonthLabel');

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
        if (this.calendarGrid) this.renderCalendar();

        store.subscribe('blocks', () => {
            if (this.container) this.renderBlocks();
            if (this.calendarGrid) this.renderCalendar();
        });
    }

    bindEvents() {
        document.getElementById('canvasZoomIn')?.addEventListener('click', () => this.setZoom(this.zoom * 1.5));
        document.getElementById('canvasZoomOut')?.addEventListener('click', () => this.setZoom(this.zoom / 1.5));
        document.getElementById('canvasZoomReset')?.addEventListener('click', () => this.setZoom(1));
        document.getElementById('centerTodayBtn')?.addEventListener('click', () => this.centerOnToday());

        document.getElementById('prevDaysBtn')?.addEventListener('click', () => { this.panX += this.dayWidth * 3; this.updateTransform(); });
        document.getElementById('nextDaysBtn')?.addEventListener('click', () => { this.panX -= this.dayWidth * 3; this.updateTransform(); });
        
        document.getElementById('prevMonthBtn')?.addEventListener('click', () => { this.currentMonth.setMonth(this.currentMonth.getMonth() - 1); this.renderCalendar(); });
        document.getElementById('nextMonthBtn')?.addEventListener('click', () => { this.currentMonth.setMonth(this.currentMonth.getMonth() + 1); this.renderCalendar(); });

        document.getElementById('viewCanvasBtn')?.addEventListener('click', () => {
            this.container.classList.remove('hidden'); this.container.classList.add('block');
            this.calendarContainer.classList.add('hidden'); this.calendarContainer.classList.remove('flex');
            document.getElementById('canvasControls').classList.remove('hidden'); document.getElementById('canvasControls').classList.add('flex');
            document.getElementById('calendarControls').classList.add('hidden'); document.getElementById('calendarControls').classList.remove('flex');
        });
        document.getElementById('viewCalendarBtn')?.addEventListener('click', () => {
            this.container.classList.add('hidden'); this.container.classList.remove('block');
            this.calendarContainer.classList.remove('hidden'); this.calendarContainer.classList.add('flex');
            document.getElementById('canvasControls').classList.add('hidden'); document.getElementById('canvasControls').classList.remove('flex');
            document.getElementById('calendarControls').classList.remove('hidden'); document.getElementById('calendarControls').classList.add('flex');
            this.renderCalendar();
        });

        if (!this.container) return;

        this.container.addEventListener('pointerdown', (e) => {
            this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            
            if (this.activePointers.size === 2) {
                const pts = Array.from(this.activePointers.values());
                this.initialPinchDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                this.initialPinchZoom = this.zoom;
                this.pinchCenterY = (pts[0].y + pts[1].y) / 2;
                this.hasPinched = true;
                return;
            }

            if (e.target.closest('.ypt-block') || e.target.closest('.action-btn')) return;

            if (e.shiftKey) {
                this.startSelection(e);
                return;
            }

            this.isPanning = true; this.hasDragged = false;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            this.container.style.cursor = 'grabbing';
            this.pointerDownTime = Date.now();

            if (e.pointerType === 'touch') {
                this.longPressTimer = setTimeout(() => {
                    if (!this.hasDragged && this.isPanning) {
                        this.isPanning = false;
                        if (navigator.vibrate) navigator.vibrate(50);
                        this.startSelection(e);
                    }
                }, 500);
            }
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
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
                    this.hasDragged = true;
                    if (this.longPressTimer) clearTimeout(this.longPressTimer);
                }
                this.panX = e.clientX - this.startX;
                this.panY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        window.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        window.addEventListener('pointercancel', (e) => this.handlePointerUp(e));

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
    }

    startSelection(e) {
        this.isSelecting = true;
        this.container.style.cursor = 'crosshair';
        if (this.longPressTimer) clearTimeout(this.longPressTimer);

        const layerRect = this.layer.getBoundingClientRect();
        const canvasX = e.clientX - layerRect.left;
        const canvasY = e.clientY - layerRect.top;
        
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
        if (this.longPressTimer) clearTimeout(this.longPressTimer);
        this.activePointers.delete(e.pointerId);
        if (this.activePointers.size < 2) this.hasPinched = false;

        if (this.isSelecting) {
            this.isSelecting = false;
            this.container.style.cursor = 'grab';
            const box = document.getElementById('drag-selection-box');
            if (box) box.classList.add('hidden');
            
            const durationMins = (parseFloat(box.style.height) / (this.pxPerHour * this.zoom)) * 60;
            const endMin = this.selectStartMin + Math.round(durationMins);
            this.openAddBlockModal(this.selectColIndex, this.selectStartMin, endMin);
            
        } else if (this.isPanning) {
            this.isPanning = false;
            this.container.style.cursor = 'grab';
            
            const duration = Date.now() - this.pointerDownTime;
            if (!this.hasDragged && duration < 500 && !e.target.closest('.ypt-block')) {
                const layerRect = this.layer.getBoundingClientRect();
                const canvasX = e.clientX - layerRect.left;
                const canvasY = e.clientY - layerRect.top;
                
                const colIdx = Math.floor(canvasX / this.dayWidth);
                const rawMins = (canvasY / (this.pxPerHour * this.zoom)) * 60;
                const snappedMins = Math.floor(rawMins / this.currentZoomTier) * this.currentZoomTier;

                this.openAddBlockModal(colIdx, snappedMins, snappedMins + this.currentZoomTier);
            }
        }
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

    setZoom(newZoom, mouseX, mouseY) {
        if (newZoom < 0.5) newZoom = 0.5; 
        if (newZoom > 4) newZoom = 4;
        
        if (!mouseY) mouseY = this.container.clientHeight / 2;

        const containerRect = this.container.getBoundingClientRect();
        const yInContainer = mouseY - containerRect.top;

        const timeAtCursor = (yInContainer - this.panY) / (this.pxPerHour * this.zoom);

        this.zoom = newZoom;
        this.panY = yInContainer - (timeAtCursor * (this.pxPerHour * this.zoom));

        if (this.zoom >= 2) this.currentZoomTier = 15;
        else if (this.zoom >= 1) this.currentZoomTier = 30;
        else this.currentZoomTier = 60;

        this.updateTransform();
        this.renderHeaders();
        this.renderBlocks();
    }

    updateTransform() {
        this.root.style.setProperty('--pan-x', `${this.panX}px`);
        this.root.style.setProperty('--pan-y', `${this.panY}px`);
        this.root.style.setProperty('--zoom', this.zoom);

        if (this.currentZoomTier === 15) {
            this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)');
            this.root.style.setProperty('--grid-15', 'rgba(0,0,0,0.04)');
        } else if (this.currentZoomTier === 30) {
            this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)');
            this.root.style.setProperty('--grid-15', 'transparent');
        } else {
            this.root.style.setProperty('--grid-30', 'transparent');
            this.root.style.setProperty('--grid-15', 'transparent');
        }
    }

    centerOnToday() {
        this.baseDate = this.getChinaTime(); this.baseDate.setHours(0,0,0,0);
        this.panX = 10; this.panY = -480; this.zoom = 1; this.currentZoomTier = 30;
        this.updateTransform(); this.renderHeaders(); this.renderBlocks();
    }

    renderHeaders() {
        if (!this.daysHeader || !this.timesSidebar) return;
        this.daysHeader.innerHTML = ''; this.timesSidebar.innerHTML = '';
        
        for (let i = -100; i <= 100; i++) {
            const d = new Date(this.baseDate.getTime() + (i * 86400000));
            const isToday = i === 0;
            const leftPx = i * this.dayWidth;
            const bgClass = isToday ? 'bg-blue-100 text-blue-700 rounded shadow-sm px-2 py-1' : 'text-gray-600';
            this.daysHeader.innerHTML += `<div class="absolute text-center" style="left: ${leftPx}px; width: ${this.dayWidth}px; bottom: 4px;"><span class="inline-block ${bgClass}">${d.toLocaleDateString('en-US', {weekday:'short', month:'numeric', day:'numeric'})}</span></div>`;
        }

        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                const topPx = (h + m/60) * this.pxPerHour * this.zoom;
                let visibility = 'opacity-0 hidden';
                let fontClass = 'text-[10px] font-bold text-gray-400';
                
                if (m === 0) {
                    visibility = 'opacity-100 block';
                    fontClass = 'text-xs font-black text-gray-600';
                } else if (m === 30 && this.currentZoomTier <= 30) {
                    visibility = 'opacity-100 block';
                } else if ((m === 15 || m === 45) && this.currentZoomTier === 15) {
                    visibility = 'opacity-100 block';
                }

                if (visibility.includes('block')) {
                    this.timesSidebar.innerHTML += `<div class="absolute w-full text-center ${fontClass} ${visibility}" style="top: ${topPx}px; transform: translateY(-50%);">${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}</div>`;
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
            if (!b.startDate || !b.scheduledStart) return;

            const bStart = new Date(`${b.startDate}T${b.scheduledStart}:00`);
            const bEnd = new Date(`${b.endDate}T${b.scheduledEnd}:00`);
            const diffDays = Math.round((new Date(b.startDate).setHours(0,0,0,0) - this.baseDate.getTime()) / 86400000);
            
            const leftPx = diffDays * this.dayWidth;
            const startMin = (bStart.getHours() * 60) + bStart.getMinutes();
            const topPx = (startMin / 60) * this.pxPerHour * this.zoom;
            
            const durationMins = (bEnd - bStart) / 60000;
            const heightPx = (durationMins / 60) * this.pxPerHour * this.zoom;

            const subColor = store.state.subjects[b.subject] || '#3b82f6';
            const isActive = store.state.timer.activeBlockId === b.id;
            let opacity = 'opacity-95'; let borderStyle = '';
            
            if (b.status === 'completed') { opacity = 'opacity-50'; borderStyle = 'border-l-4 border-black/30'; }
            else if (isActive) { opacity = 'opacity-100 ring-4 ring-yellow-400 animate-pulse'; }
            else if (now > bEnd) { opacity = 'opacity-70 grayscale'; borderStyle = 'border-2 border-red-500 border-dashed'; }

            const el = document.createElement('div');
            el.className = `ypt-block absolute rounded p-1 shadow-sm text-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${opacity} ${borderStyle}`;
            el.style.left = `${leftPx + 2}px`;
            el.style.top = `${topPx}px`;
            el.style.width = `${this.dayWidth - 4}px`;
            el.style.height = `${heightPx}px`;
            el.style.backgroundColor = subColor;
            el.dataset.id = b.id;
            
            let contentHtml = '';
            if (heightPx < 30) contentHtml = `<div class="font-bold text-[9px] truncate">${b.subject} - ${b.title}</div>`;
            else contentHtml = `<div class="font-bold text-[9px] truncate uppercase">${b.subject}</div><div class="font-bold text-[10px] truncate">${b.title}</div>`;

            el.innerHTML = `
                <button class="delete-btn absolute top-1 right-1 bg-red-600/80 text-white rounded px-1.5 py-0.5 text-[8px] font-black z-20 action-btn hidden md:block">X</button>
                <button class="edit-btn absolute top-1 right-6 bg-gray-800/60 text-white rounded px-1 text-[9px] font-bold z-20 action-btn hidden md:block">✎</button>
                <div class="pointer-events-none z-10 flex flex-col h-full">${contentHtml}</div>
            `;

            el.addEventListener('click', (e) => {
                if (e.target.closest('.delete-btn')) { e.stopPropagation(); if (confirm(`Delete block?`)) store.update('blocks', old => old.filter(x => x.id !== b.id)); return; }
                if (e.target.closest('.edit-btn')) {
                    e.stopPropagation(); document.getElementById('saveEditBlock').dataset.id = b.id;
                    document.getElementById('editBlockModal')?.classList.remove('hidden'); return;
                }
            });

            this.blocksLayer.appendChild(el);
        });
    }

    renderCalendar() {
        if (!this.calendarGrid || !this.calendarDisplay) return;
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        this.calendarDisplay.innerText = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        this.calendarGrid.innerHTML = '';
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) this.calendarGrid.innerHTML += `<div class="p-1 border border-transparent"></div>`;

        const blocks = store.state.blocks || [];
        const todayStr = this.formatDate(this.getChinaTime());
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBlocks = blocks.filter(b => b.startDate === dateStr || b.date === dateStr);
            
            let blocksHtml = '';
            dayBlocks.slice(0, 3).forEach(b => {
                const subColor = store.state.subjects[b.subject] || '#3b82f6';
                const isCompleted = b.status === 'completed' ? 'opacity-50 line-through' : '';
                blocksHtml += `<div class="text-[9px] font-bold text-white px-1 py-0.5 rounded mb-0.5 truncate shadow-sm ${isCompleted}" style="background-color: ${subColor}">${b.title || b.subject}</div>`;
            });
            if (dayBlocks.length > 3) blocksHtml += `<div class="text-[9px] text-gray-500 font-bold text-center">+${dayBlocks.length - 3}</div>`;

            const isToday = dateStr === todayStr;
            const bgClass = isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-blue-100';
            const textClass = isToday ? 'text-blue-600' : 'text-gray-500';

            const cell = document.createElement('div');
            cell.className = `min-h-[80px] p-1 border rounded-lg ${bgClass} flex flex-col cursor-pointer transition-colors shadow-sm`;
            cell.innerHTML = `<div class="text-[10px] font-black ${textClass} mb-1 pl-1">${day}</div><div class="flex-1 flex flex-col gap-0.5">${blocksHtml}</div>`;
            
            // 🚨 CORRECTED: Now strictly opens the slide panel
            cell.addEventListener('click', () => {
                this.openSlidePanelForDate(dateStr);
            });
            this.calendarGrid.appendChild(cell);
        }
    }

    openSlidePanel(blockId) {
        if (!blockId) return;
        const b = store.state.blocks.find(x => x.id === blockId);
        if (b) this.openSlidePanelForDate(b.startDate || b.date);
    }

    openSlidePanelForDate(dateStr) {
        this.currentSlideDate = dateStr;
        const panel = document.getElementById('daySlidePanel');
        const overlay = document.getElementById('diaryOverlay');
        if (!panel || !overlay) return;

        const dateObj = new Date(dateStr + "T00:00:00");
        document.getElementById('slidePanelDate').innerText = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        this.renderSlidePanelBlocks(dateStr);
        this.renderSlidePanelDiary(dateStr);

        panel.classList.remove('translate-x-full'); overlay.classList.remove('hidden');
        document.getElementById('closeSlidePanel')?.addEventListener('click', () => { panel.classList.add('translate-x-full'); overlay.classList.add('hidden'); }, {once: true});
        overlay.addEventListener('click', () => { panel.classList.add('translate-x-full'); overlay.classList.add('hidden'); }, {once: true});
    }

    renderSlidePanelBlocks(dateStr) {
        const container = document.getElementById('slidePanelBlocks');
        const totalEl = document.getElementById('slidePanelTotalTime');
        const blocks = store.state.blocks.filter(b => b.startDate === dateStr || b.date === dateStr);
        blocks.sort((a, b) => (a.scheduledStart || "00:00").localeCompare(b.scheduledStart || "00:00"));

        let totalSecs = 0; container.innerHTML = '';
        if (blocks.length === 0) container.innerHTML = '<div class="text-xs text-gray-400 font-bold text-center italic py-4">No blocks scheduled.</div>';
        else {
            blocks.forEach(b => {
                if (b.status === 'completed') totalSecs += (b.studySeconds || 0);
                const subColor = store.state.subjects[b.subject] || '#3b82f6';
                const opacity = b.status === 'completed' ? 'opacity-50' : '';
                container.innerHTML += `
                    <div class="flex items-center gap-3 p-2 bg-white rounded border shadow-sm ${opacity}">
                        <div class="w-3 h-full rounded-l" style="background-color: ${subColor}"></div>
                        <div class="flex-1"><div class="text-[10px] font-black text-gray-400">${b.scheduledStart} - ${b.scheduledEnd}</div><div class="text-sm font-bold text-gray-800">${b.title}</div></div>
                        ${b.status === 'completed' ? `<div class="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded">✓ ${Math.floor((b.studySeconds||0)/60)}m</div>` : ''}
                    </div>
                `;
            });
        }
        totalEl.innerText = `${Math.floor(totalSecs / 3600)}h ${Math.floor((totalSecs % 3600) / 60)}m`;
    }

    renderSlidePanelDiary(dateStr) {
        const diaryEl = document.getElementById('slidePanelDiary');
        if (!diaryEl) return;
        diaryEl.value = store.state.diaries[dateStr] || '';
        diaryEl.oninput = (e) => store.update('diaries', d => ({ ...d, [dateStr]: e.target.value }));
    }
}

export const canvasUI = new CanvasUI();

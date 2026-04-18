// js/CanvasUI.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';

class CanvasUI {
    constructor() {
        this.panX = 64; this.panY = -480; this.zoom = 1;
        this.pxPerHour = 60; this.dayWidth = 200; 
        this.isPanning = false; this.startX = 0; this.startY = 0; 
        
        // Interaction states
        this.hasDragged = false;
        this.pointerDownTime = 0;
        
        // Scheduling Selection
        this.selectStartMin = 0; this.selectEndMin = 0;
        this.selectColIndex = 0;

        // Calendar
        this.currentMonthDate = new Date();
        this.currentMonthDate.setDate(1);
        this.baseDate = this.getChinaTime();
        this.baseDate.setHours(0,0,0,0);
    }

    getChinaTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    }

    formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    init() {
        // Timeline Elements
        this.container = document.getElementById('canvas-container');
        this.wrapper = document.getElementById('canvas-wrapper');
        this.gridBg = document.getElementById('canvas-grid');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.timeLabels = document.getElementById('canvas-times');
        this.daysHeader = document.getElementById('canvas-days');
        this.dateDisplay = document.getElementById('canvasDateDisplay');
        
        // Calendar Elements
        this.calendarContainer = document.getElementById('calendar-container');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.calendarDisplay = document.getElementById('currentMonthLabel');

        this.bindEvents();
        
        if (this.container) {
            this.renderGrid();
            this.updateTransform();
            this.renderHeaders();
            this.renderBlocks();
        }
        
        if (this.calendarGrid) {
            this.renderCalendar();
        }

        store.subscribe('blocks', () => {
            if (this.container) this.renderBlocks();
            if (this.calendarGrid) this.renderCalendar();
        });
    }

    bindEvents() {
        // 🚨 CORRECTED ZOOM & PAN BUTTON IDs
        document.getElementById('canvasZoomIn')?.addEventListener('click', () => this.setZoom(this.zoom * 1.2));
        document.getElementById('canvasZoomOut')?.addEventListener('click', () => this.setZoom(this.zoom / 1.2));
        document.getElementById('canvasZoomReset')?.addEventListener('click', () => this.setZoom(1));
        document.getElementById('centerTodayBtn')?.addEventListener('click', () => this.centerOnToday());

        document.getElementById('prevDaysBtn')?.addEventListener('click', () => {
            this.panX += this.dayWidth * 3; this.updateTransform();
        });
        document.getElementById('nextDaysBtn')?.addEventListener('click', () => {
            this.panX -= this.dayWidth * 3; this.updateTransform();
        });

        // View Toggles
        document.getElementById('viewCanvasBtn')?.addEventListener('click', () => {
            this.container.classList.remove('hidden'); this.container.classList.add('block');
            this.calendarContainer.classList.add('hidden'); this.calendarContainer.classList.remove('flex');
            document.getElementById('canvasControls').classList.remove('hidden'); document.getElementById('canvasControls').classList.add('flex');
            document.getElementById('calendarControls').classList.add('hidden'); document.getElementById('calendarControls').classList.remove('flex');
            document.getElementById('viewCanvasBtn').className = "px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all text-blue-600";
            document.getElementById('viewCalendarBtn').className = "px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
            this.updateTransform();
        });
        
        document.getElementById('viewCalendarBtn')?.addEventListener('click', () => {
            this.container.classList.add('hidden'); this.container.classList.remove('block');
            this.calendarContainer.classList.remove('hidden'); this.calendarContainer.classList.add('flex');
            document.getElementById('canvasControls').classList.add('hidden'); document.getElementById('canvasControls').classList.remove('flex');
            document.getElementById('calendarControls').classList.remove('hidden'); document.getElementById('calendarControls').classList.add('flex');
            document.getElementById('viewCalendarBtn').className = "px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all text-blue-600";
            document.getElementById('viewCanvasBtn').className = "px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
            this.renderCalendar();
        });

        // Calendar Nav Controls
        document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
            this.currentMonthDate.setMonth(this.currentMonthDate.getMonth() - 1);
            this.renderCalendar();
        });
        document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
            this.currentMonthDate.setMonth(this.currentMonthDate.getMonth() + 1);
            this.renderCalendar();
        });

        if (!this.container) return;

        // 🚨 CANVAS MOUSE / TOUCH EVENTS
        this.container.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.ypt-block') || e.target.closest('.action-btn')) return; 
            
            this.pointerDownTime = Date.now();
            this.hasDragged = false;
            this.startX = e.clientX - this.panX;
            this.startY = e.clientY - this.panY;
            this.isPanning = true;
            this.container.style.cursor = 'grabbing';
        });

        window.addEventListener('pointermove', (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.startX - this.panX;
                const dy = e.clientY - this.startY - this.panY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasDragged = true;

                this.panX = e.clientX - this.startX;
                this.panY = e.clientY - this.startY;
                this.updateTransform();
            }
        });

        window.addEventListener('pointerup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.style.cursor = 'grab';

                const duration = Date.now() - this.pointerDownTime;
                
                // 🚨 CLICK-TO-SCHEDULE LOGIC RESTORED
                if (!this.hasDragged && duration < 500) {
                    this.handleGridClick(e);
                }
            }
        });

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                this.setZoom(this.zoom * zoomFactor, e.clientX, e.clientY);
            } else {
                this.panX -= e.deltaX; this.panY -= e.deltaY;
                this.updateTransform();
            }
        }, { passive: false });
    }

    // 🚨 DYNAMIC GRID RENDERING (60m / 30m / 15m)
    renderGrid() {
        if (!this.gridBg) return;
        this.gridBg.innerHTML = '';
        
        const startDayOffset = -280; 
        const endDayOffset = 280;
        
        // Draw horizontal time lines
        for (let h = 0; h < 24; h++) {
            for (let m = 0; m < 60; m += 15) {
                const topPx = (h * this.pxPerHour) + ((m / 60) * this.pxPerHour);
                let lineClass = 'border-t absolute w-full left-0 right-0 pointer-events-none';
                
                if (m === 0) {
                    lineClass += ' border-gray-300 border-t-2 z-0'; // 60 min line
                } else if (m === 30) {
                    lineClass += ' border-gray-200 zoom-30-line z-0'; // 30 min line
                } else {
                    lineClass += ' border-gray-100 zoom-15-line z-0'; // 15 min line
                }

                this.gridBg.innerHTML += `<div class="${lineClass}" style="top: ${topPx}px;"></div>`;
            }
        }

        // Draw vertical day lines
        for (let i = startDayOffset; i <= endDayOffset; i++) {
            const leftPx = (i + 280) * this.dayWidth + 64; 
            this.gridBg.innerHTML += `<div class="border-l border-gray-300 absolute h-full top-0 bottom-0 pointer-events-none z-0" style="left: ${leftPx}px;"></div>`;
        }
        
        this.updateZoomVisibility();
    }

    updateZoomVisibility() {
        const lines30 = document.querySelectorAll('.zoom-30-line');
        const lines15 = document.querySelectorAll('.zoom-15-line');
        
        // Dynamic hiding/showing based on zoom level
        lines30.forEach(l => l.style.display = this.zoom >= 0.8 ? 'block' : 'none');
        lines15.forEach(l => l.style.display = this.zoom >= 1.5 ? 'block' : 'none');
    }

    handleGridClick(e) {
        if (e.target.closest('.ypt-block') || e.target.closest('.action-btn')) return;

        const rect = this.container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const canvasX = (mouseX - this.panX) / this.zoom;
        const canvasY = (mouseY - this.panY) / this.zoom;
        
        const colIndex = Math.floor((canvasX - 64) / this.dayWidth);
        const rawMin = (canvasY / this.pxPerHour) * 60;
        
        // Determine schedule snap interval based on zoom
        let snapInterval = 60;
        if (this.zoom >= 1.5) snapInterval = 15;
        else if (this.zoom >= 0.8) snapInterval = 30;

        const startMin = Math.floor(rawMin / snapInterval) * snapInterval;
        const endMin = startMin + snapInterval;

        this.selectColIndex = colIndex;
        this.selectStartMin = startMin;
        this.selectEndMin = endMin;

        this.openModalWithSelection();
    }

    openModalWithSelection() {
        const diffDays = this.selectColIndex - 280;
        const targetDate = new Date(this.baseDate.getTime() + (diffDays * 86400000));
        const dateStr = this.formatDate(targetDate);

        const sH = Math.floor(this.selectStartMin / 60).toString().padStart(2, '0');
        const sM = (this.selectStartMin % 60).toString().padStart(2, '0');
        const eH = Math.floor(this.selectEndMin / 60).toString().padStart(2, '0');
        const eM = (this.selectEndMin % 60).toString().padStart(2, '0');

        const sDateInput = document.getElementById('newBlockStartDate');
        const eDateInput = document.getElementById('newBlockEndDate');
        const sTimeInput = document.getElementById('newBlockStart');
        const eTimeInput = document.getElementById('newBlockEnd');
        
        if(sDateInput) sDateInput.value = dateStr;
        if(eDateInput) eDateInput.value = dateStr;
        if(sTimeInput) sTimeInput.value = `${sH}:${sM}`;
        if(eTimeInput) eTimeInput.value = `${eH}:${eM}`;

        document.getElementById('addBlockModal')?.classList.remove('hidden');
    }

    updateTransform() {
        if (this.gridBg) this.gridBg.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        if (this.blocksLayer) this.blocksLayer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        if (this.timeLabels) this.timeLabels.style.transform = `translateY(${this.panY}px) scaleY(${this.zoom})`;
        if (this.daysHeader) this.daysHeader.style.transform = `translateX(${this.panX}px) scaleX(${this.zoom})`;
    }

    setZoom(newZoom, mouseX, mouseY) {
        if (newZoom < 0.4) newZoom = 0.4;
        if (newZoom > 3) newZoom = 3; 
        
        if (!mouseX) mouseX = this.container ? this.container.clientWidth / 2 : 0;
        if (!mouseY) mouseY = this.container ? this.container.clientHeight / 2 : 0;
        
        const rect = this.container.getBoundingClientRect();
        const x = mouseX - rect.left;
        const y = mouseY - rect.top;

        this.panX = x - ((x - this.panX) * (newZoom / this.zoom));
        this.panY = y - ((y - this.panY) * (newZoom / this.zoom));
        this.zoom = newZoom;
        
        this.updateTransform();
        this.updateZoomVisibility();
        this.renderHeaders();
    }

    centerOnToday() {
        this.baseDate = this.getChinaTime(); 
        this.baseDate.setHours(0,0,0,0);
        this.panX = 64; this.panY = -480; this.zoom = 1;
        this.updateTransform();
        this.updateZoomVisibility();
        this.renderHeaders();
        this.renderBlocks();
    }

    renderHeaders() {
        if (!this.daysHeader || !this.timeLabels) return;
        this.daysHeader.innerHTML = ''; this.timeLabels.innerHTML = '';
        
        for (let i = -280; i <= 280; i++) {
            const d = new Date(this.baseDate.getTime() + (i * 86400000));
            const isToday = i === 0;
            const leftPx = (i + 280) * this.dayWidth + 64;
            const bgClass = isToday ? 'bg-blue-100 text-blue-700 rounded shadow-sm px-2 py-1' : 'text-gray-600';
            this.daysHeader.innerHTML += `
                <div class="absolute text-center" style="left: ${leftPx}px; width: ${this.dayWidth}px; bottom: 4px;">
                    <span class="inline-block ${bgClass}">${d.toLocaleDateString('en-US', {weekday:'short', month:'numeric', day:'numeric'})}</span>
                </div>
            `;
        }

        for (let i = 0; i < 24; i++) {
            const topPx = i * this.pxPerHour;
            this.timeLabels.innerHTML += `
                <div class="absolute w-full text-center text-[10px] font-bold text-gray-500" style="top: ${topPx}px; transform: translateY(-50%);">${String(i).padStart(2,'0')}:00</div>
            `;
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
            
            const colIdx = diffDays + 280;
            const leftPx = (colIdx * this.dayWidth) + 64;
            const startMin = (bStart.getHours() * 60) + bStart.getMinutes();
            const topPx = (startMin / 60) * this.pxPerHour;
            
            const durationMins = (bEnd - bStart) / 60000;
            const heightPx = (durationMins / 60) * this.pxPerHour;

            const subColor = store.state.subjects[b.subject] || '#3b82f6';
            const isActive = store.state.timer.activeBlockId === b.id;
            let opacity = 'opacity-95';
            let borderStyle = '';
            
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
            
            el.innerHTML = `
                <button class="delete-btn absolute top-1 right-1 bg-red-600/80 hover:bg-red-700 text-white rounded px-1.5 py-0.5 text-[8px] font-black z-20 action-btn hidden md:block">X</button>
                <div class="pointer-events-none z-10 flex flex-col h-full">
                    <div class="font-bold text-[10px] truncate drop-shadow-md uppercase text-white/90">${b.subject}</div>
                    <div class="font-bold text-[11px] truncate drop-shadow-md leading-tight">${b.title}</div>
                    <div class="text-[9px] opacity-90 drop-shadow-md mt-auto">${b.scheduledStart} - ${b.scheduledEnd}</div>
                </div>
            `;

            el.addEventListener('click', (e) => {
                if (e.target.closest('.delete-btn')) {
                    e.stopPropagation();
                    if (confirm(`Delete block: ${b.title}?`)) store.update('blocks', old => old.filter(x => x.id !== b.id));
                    return;
                }
                
                document.getElementById('editBlockSubject').value = b.subject;
                document.getElementById('editBlockTitle').value = b.title;
                document.getElementById('editBlockSchedStartDate').value = b.startDate;
                document.getElementById('editBlockSchedStart').value = b.scheduledStart;
                document.getElementById('editBlockSchedEndDate').value = b.endDate;
                document.getElementById('editBlockSchedEnd').value = b.scheduledEnd;
                document.getElementById('editBlockRemarks').value = b.remarks || '';
                
                const saveBtn = document.getElementById('saveEditBlock');
                if (saveBtn) saveBtn.dataset.id = b.id;
                document.getElementById('editBlockModal')?.classList.remove('hidden');
            });

            this.blocksLayer.appendChild(el);
        });
    }

    // --- CALENDAR LOGIC RESTORED ---
    renderCalendar() {
        if (!this.calendarGrid || !this.calendarDisplay) return;
        
        const year = this.currentMonthDate.getFullYear();
        const month = this.currentMonthDate.getMonth();
        
        this.calendarDisplay.innerText = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        this.calendarGrid.innerHTML = '';
        
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            this.calendarGrid.innerHTML += `<div class="p-1 border border-transparent"></div>`;
        }

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
            
            if (dayBlocks.length > 3) {
                blocksHtml += `<div class="text-[9px] text-gray-500 font-bold text-center">+${dayBlocks.length - 3}</div>`;
            }

            const isToday = dateStr === todayStr;
            const bgClass = isToday ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-100 hover:border-blue-100';
            const textClass = isToday ? 'text-blue-600' : 'text-gray-500';

            const cell = document.createElement('div');
            cell.className = `min-h-[80px] p-1 border rounded-lg ${bgClass} flex flex-col cursor-pointer transition-colors shadow-sm`;
            cell.innerHTML = `
                <div class="text-[10px] font-black ${textClass} mb-1 pl-1">${day}</div>
                <div class="flex-1 flex flex-col gap-0.5">${blocksHtml}</div>
            `;
            
            cell.addEventListener('click', () => {
                document.getElementById('calendar-container').classList.add('hidden');
                document.getElementById('canvas-container').classList.remove('hidden');
                document.getElementById('canvas-container').classList.add('block');
                
                document.getElementById('calendarControls').classList.add('hidden');
                document.getElementById('calendarControls').classList.remove('flex');
                document.getElementById('canvasControls').classList.remove('hidden');
                document.getElementById('canvasControls').classList.add('flex');
                
                const targetDate = new Date(dateStr);
                const diffDays = Math.round((targetDate.getTime() - this.baseDate.getTime()) / 86400000);
                this.panX = -((diffDays * this.dayWidth) - (this.container.clientWidth / 2) + (this.dayWidth / 2));
                this.updateTransform();
            });
            
            this.calendarGrid.appendChild(cell);
        }
    }
}
export const canvasUI = new CanvasUI();

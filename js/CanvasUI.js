// js/CanvasUI.js
import { store } from './State.js';

class CanvasUI {
    constructor() {
        this.panX = 0; this.panY = -480; this.zoom = 1;
        this.pxPerHour = 60; this.dayWidth = 200; 
        this.isPanning = false; this.startX = 0; this.startY = 0; 
        
        // DRAG-TO-SELECT VARIABLES
        this.isSelecting = false;
        this.selectStartY = 0; this.selectStartX = 0;
        this.selectStartMin = 0; this.selectEndMin = 0;
        this.selectColIndex = 0;

        // CALENDAR VARIABLES
        this.currentMonthDate = new Date();
        this.currentMonthDate.setDate(1);
    }

    init() {
        // Timeline Elements
        this.container = document.getElementById('canvas-container');
        this.wrapper = document.getElementById('canvas-wrapper');
        this.gridBg = document.getElementById('canvas-grid-bg');
        this.blocksLayer = document.getElementById('canvas-blocks');
        this.timeLabels = document.getElementById('time-labels');
        this.dateDisplay = document.getElementById('canvasDateDisplay');
        this.selectionBox = document.getElementById('drag-selection-box');
        this.selectionLabel = document.getElementById('drag-selection-label');

        // Calendar Elements
        this.calGrid = document.getElementById('calendarGrid');
        this.calDisplay = document.getElementById('calendarWeekDisplay');

        this.baseDate = new Date();
        this.baseDate.setHours(0,0,0,0);
        
        this.bindEvents();
        if(this.container) this.renderGridCSS();
        
        store.subscribe('blocks', () => {
            if(this.container) this.renderBlocks();
            if(this.calGrid) this.renderCalendar();
        });
        
        if(this.container) { this.renderBlocks(); this.updateTransform(); }
        if(this.calGrid) this.renderCalendar();
    }

    bindEvents() {
        // Zooming Controls
        document.getElementById('zoomInBtn')?.addEventListener('click', () => this.setZoom(this.zoom * 1.2));
        document.getElementById('zoomOutBtn')?.addEventListener('click', () => this.setZoom(this.zoom / 1.2));
        document.getElementById('canvasTodayBtn')?.addEventListener('click', () => {
            this.panX = 0; this.panY = -480; this.zoom = 1; this.updateTransform();
        });

        // Calendar Controls
        document.getElementById('prevWeekBtn')?.addEventListener('click', () => {
            this.currentMonthDate.setMonth(this.currentMonthDate.getMonth() - 1);
            this.renderCalendar();
        });
        document.getElementById('nextWeekBtn')?.addEventListener('click', () => {
            this.currentMonthDate.setMonth(this.currentMonthDate.getMonth() + 1);
            this.renderCalendar();
        });

        if (!this.container) return;

        // UNIFIED DRAG CONTROLLER (Panning vs Scheduling)
        this.container.addEventListener('pointerdown', (e) => {
            if (e.target.closest('.scheduled-block')) return; 
            
            const rect = this.container.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            if (e.shiftKey || e.ctrlKey || e.metaKey) {
                this.isSelecting = true;
                this.selectionBox.classList.remove('hidden');
                
                const canvasX = (mouseX - this.panX) / this.zoom;
                const canvasY = (mouseY - this.panY) / this.zoom;
                
                this.selectColIndex = Math.floor((canvasX - 48) / this.dayWidth); 
                this.selectStartX = (this.selectColIndex * this.dayWidth) + 48;
                
                const rawMin = (canvasY / this.pxPerHour) * 60;
                this.selectStartMin = Math.round(rawMin / 5) * 5;
                
                this.updateSelectionBox(this.selectStartMin, this.selectStartMin + 15);
            } else {
                this.isPanning = true;
                this.startX = e.clientX - this.panX;
                this.startY = e.clientY - this.panY;
                this.container.style.cursor = 'grabbing';
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (this.isPanning) {
                this.panX = e.clientX - this.startX;
                this.panY = e.clientY - this.startY;
                this.updateTransform();
            } else if (this.isSelecting) {
                const rect = this.container.getBoundingClientRect();
                const mouseY = e.clientY - rect.top;
                const canvasY = (mouseY - this.panY) / this.zoom;
                
                const rawMin = (canvasY / this.pxPerHour) * 60;
                let currentMin = Math.round(rawMin / 5) * 5;
                
                if (currentMin <= this.selectStartMin) currentMin = this.selectStartMin + 5;
                this.selectEndMin = currentMin;
                this.updateSelectionBox(this.selectStartMin, this.selectEndMin);
            }
        });

        window.addEventListener('pointerup', () => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.style.cursor = 'grab';
            } else if (this.isSelecting) {
                this.isSelecting = false;
                this.selectionBox.classList.add('hidden');
                this.openModalWithSelection();
            }
        });

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey) {
                const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
                this.setZoom(this.zoom * zoomFactor, e.clientX, e.clientY);
            } else {
                this.panX -= e.deltaX; this.panY -= e.deltaY;
                this.updateTransform();
            }
        }, { passive: false });
    }

    // --- TIMELINE LOGIC ---
    renderGridCSS() {
        const theme = store.state.theme;
        const color = theme.bgColor === '#1f2937' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
        this.gridBg.style.backgroundImage = `linear-gradient(to right, ${color} 1px, transparent 1px), linear-gradient(to bottom, ${color} 1px, transparent 1px)`;
        
        let html = '';
        for (let i = 0; i < 24; i++) {
            const hStr = i.toString().padStart(2, '0') + ':00';
            html += `<div class="absolute w-full text-right pr-2" style="top: ${i * this.pxPerHour}px; transform: translateY(-50%)">${hStr}</div>`;
        }
        this.timeLabels.innerHTML = html;
        this.updateTransform();
    }

    updateTransform() {
        this.gridBg.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        this.gridBg.style.backgroundSize = `${this.dayWidth}px ${this.pxPerHour}px`;
        this.blocksLayer.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        this.timeLabels.style.transform = `translateY(${this.panY}px) scaleY(${this.zoom})`;

        const centerCol = Math.floor((-this.panX + (this.container.clientWidth / 2)) / (this.dayWidth * this.zoom));
        const viewingDate = new Date(this.baseDate.getTime() + (centerCol * 86400000));
        if(this.dateDisplay) this.dateDisplay.innerText = viewingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    }

    setZoom(newZoom, mouseX, mouseY) {
        if (newZoom < 0.2) newZoom = 0.2;
        if (newZoom > 4) newZoom = 4; 
        
        if (!mouseX) mouseX = this.container.clientWidth / 2;
        if (!mouseY) mouseY = this.container.clientHeight / 2;
        
        const rect = this.container.getBoundingClientRect();
        const x = mouseX - rect.left;
        const y = mouseY - rect.top;

        this.panX = x - ((x - this.panX) * (newZoom / this.zoom));
        this.panY = y - ((y - this.panY) * (newZoom / this.zoom));
        this.zoom = newZoom;
        this.updateTransform();
    }

    updateSelectionBox(startMin, endMin) {
        const topPx = (startMin / 60) * this.pxPerHour;
        const heightPx = ((endMin - startMin) / 60) * this.pxPerHour;
        
        this.selectionBox.style.transform = `translate(${this.panX + (this.selectStartX * this.zoom)}px, ${this.panY + (topPx * this.zoom)}px)`;
        this.selectionBox.style.width = `${(this.dayWidth - 8) * this.zoom}px`;
        this.selectionBox.style.height = `${heightPx * this.zoom}px`;

        const sH = Math.floor(startMin / 60).toString().padStart(2, '0');
        const sM = (startMin % 60).toString().padStart(2, '0');
        const eH = Math.floor(endMin / 60).toString().padStart(2, '0');
        const eM = (endMin % 60).toString().padStart(2, '0');
        
        this.selectionLabel.innerText = `${sH}:${sM} - ${eH}:${eM}`;
    }

    openModalWithSelection() {
        const targetDate = new Date(this.baseDate.getTime() + (this.selectColIndex * 86400000));
        const dateStr = targetDate.toISOString().split('T')[0];

        const sH = Math.floor(this.selectStartMin / 60).toString().padStart(2, '0');
        const sM = (this.selectStartMin % 60).toString().padStart(2, '0');
        const eH = Math.floor(this.selectEndMin / 60).toString().padStart(2, '0');
        const eM = (this.selectEndMin % 60).toString().padStart(2, '0');

        document.getElementById('newBlockStartDate').value = dateStr;
        document.getElementById('newBlockEndDate').value = dateStr;
        document.getElementById('newBlockStart').value = `${sH}:${sM}`;
        document.getElementById('newBlockEnd').value = `${eH}:${eM}`;

        document.getElementById('addBlockModal').classList.remove('hidden');
    }

    renderBlocks() {
        this.blocksLayer.innerHTML = '';
        const blocks = store.state.blocks;
        
        blocks.forEach(b => {
            if (!b.startDate || !b.scheduledStart) return;

            const bStart = new Date(`${b.startDate}T${b.scheduledStart}:00`);
            const bEnd = new Date(`${b.endDate}T${b.scheduledEnd}:00`);
            
            const diffDays = Math.round((new Date(b.startDate).setHours(0,0,0,0) - this.baseDate.getTime()) / 86400000);
            
            const leftPx = (diffDays * this.dayWidth) + 48; 
            const startMin = (bStart.getHours() * 60) + bStart.getMinutes();
            const topPx = (startMin / 60) * this.pxPerHour;
            
            const durationMins = (bEnd - bStart) / 60000;
            const heightPx = (durationMins / 60) * this.pxPerHour;

            const subColor = store.state.subjects[b.subject] || '#3b82f6';
            const opacity = b.status === 'completed' ? 'opacity-60' : 'opacity-95';

            const el = document.createElement('div');
            el.className = `scheduled-block absolute rounded-md p-1.5 shadow-sm text-white overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${opacity}`;
            el.style.left = `${leftPx + 4}px`;
            el.style.top = `${topPx}px`;
            el.style.width = `${this.dayWidth - 8}px`;
            el.style.height = `${heightPx}px`;
            el.style.backgroundColor = subColor;
            
            el.innerHTML = `
                <div class="text-[10px] font-black uppercase drop-shadow-md truncate leading-tight">${b.subject}</div>
                <div class="text-[11px] font-bold drop-shadow-md truncate">${b.title}</div>
            `;
            
            el.addEventListener('click', () => {
                document.getElementById('editBlockSubject').value = b.subject;
                document.getElementById('editBlockTitle').value = b.title;
                document.getElementById('editBlockSchedStartDate').value = b.startDate;
                document.getElementById('editBlockSchedStart').value = b.scheduledStart;
                document.getElementById('editBlockSchedEndDate').value = b.endDate;
                document.getElementById('editBlockSchedEnd').value = b.scheduledEnd;
                document.getElementById('editBlockRemarks').value = b.remarks || '';
                
                const saveBtn = document.getElementById('saveEditBlock');
                saveBtn.dataset.id = b.id;
                document.getElementById('editBlockModal').classList.remove('hidden');
            });

            this.blocksLayer.appendChild(el);
        });
    }

    // --- CALENDAR LOGIC RESTORED ---
    renderCalendar() {
        if (!this.calGrid) return;
        
        const year = this.currentMonthDate.getFullYear();
        const month = this.currentMonthDate.getMonth();
        
        if (this.calDisplay) {
            this.calDisplay.innerText = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        }

        this.calGrid.innerHTML = '';
        
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        days.forEach(d => {
            this.calGrid.innerHTML += `<div class="text-center font-bold text-gray-400 text-xs py-2">${d}</div>`;
        });

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            this.calGrid.innerHTML += `<div class="p-2 border border-transparent"></div>`;
        }

        const blocks = store.state.blocks || [];
        
        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dayBlocks = blocks.filter(b => b.startDate === dateStr || b.date === dateStr);
            
            let blocksHtml = '';
            dayBlocks.slice(0, 3).forEach(b => {
                const subColor = store.state.subjects[b.subject] || '#3b82f6';
                const isCompleted = b.status === 'completed' ? 'opacity-50 line-through' : '';
                blocksHtml += `<div class="text-[9px] font-bold text-white px-1.5 py-0.5 rounded mb-1 truncate shadow-sm ${isCompleted}" style="background-color: ${subColor}">${b.title || b.subject}</div>`;
            });
            
            if (dayBlocks.length > 3) {
                blocksHtml += `<div class="text-[9px] text-gray-400 font-bold text-center">+${dayBlocks.length - 3} more</div>`;
            }

            const isToday = new Date().toISOString().split('T')[0] === dateStr;
            const bgClass = isToday ? 'bg-blue-50 border-blue-200 shadow-inner' : 'bg-white border-gray-100 hover:border-blue-200';
            const textClass = isToday ? 'text-blue-600' : 'text-gray-600';

            this.calGrid.innerHTML += `
                <div class="min-h-[90px] p-2 border rounded-xl ${bgClass} flex flex-col cursor-pointer transition-colors">
                    <div class="text-xs font-black ${textClass} mb-2">${day}</div>
                    <div class="flex-1 flex flex-col gap-0.5">${blocksHtml}</div>
                </div>
            `;
        }
    }
}
export const canvasUI = new CanvasUI();

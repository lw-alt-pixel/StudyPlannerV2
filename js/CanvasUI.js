// js/CanvasUI.js
import { store } from './State.js';
import { blockManager } from './BlockManager.js';
import { timerEngine } from './TimerEngine.js';

class CanvasUI {
    constructor() {
        this.panX = 10; this.panY = -480; this.zoom = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0; this.hasDragged = false; 
        this.isDraggingBlock = false; this.draggedBlockEl = null; this.draggedBlockId = null;
        this.blockOffsetX = 0; this.blockOffsetY = 0; this.hasMovedBlock = false;
        this.activePointers = new Map();
        this.initialPinchDistance = null;
        this.initialPinchZoom = null;
        this.pinchCenterY = null;
        this.hasPinched = false;
        this.currentZoomTier = 1;
        this.rafPending = false;
        this.pxPerHour = 60; this.dayWidth = 180;
        this.root = document.documentElement;
        this.baseDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
        this.baseDate.setHours(0,0,0,0);
        this.currentMonth = new Date(this.baseDate);
        this.currentMonth.setDate(1); 
        this.currentSlideDate = null;
        
        // 🚨 PRO: DRAG-TO-SELECT VARIABLES
        this.isSelecting = false;
        this.selectStartY = 0; this.selectStartX = 0;
        this.selectStartMin = 0; this.selectEndMin = 0;
        this.selectColIndex = 0;
    }

    init() {
        // Timeline Elements
        this.container = document.getElementById('canvas-container');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.layer = document.getElementById('canvas-layer');
        this.gridBg = document.getElementById('canvas-grid'); // Now acts as the CSS grid background
        this.daysHeader = document.getElementById('canvas-days');
        this.timesSidebar = document.getElementById('canvas-times');
        this.dateDisplay = document.getElementById('canvasDateDisplay');
        
        // Pro Drag-Select UI
        this.selectionBox = document.getElementById('drag-selection-box');
        this.selectionLabel = document.getElementById('drag-selection-label');
        
        // Calendar Elements
        this.calendarContainer = document.getElementById('calendar-container');
        this.calendarGrid = document.getElementById('calendar-grid');
        this.calendarDisplay = document.getElementById('currentMonthLabel');

        this.bindEvents();
        
        // Render Initial States
        if (this.container) {
            this.renderCSSGrid();
            this.updateTransform();
            this.renderHeaders();
        }
        
        if (this.calendarGrid) {
            this.renderCalendar();
        }

        store.subscribe('blocks', () => {
            if (this.container) this.renderBlocks();
            if (this.calendarGrid) this.renderCalendar();
        });
        
        if (this.container) this.renderBlocks();
    }

    getChinaTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    }

    formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    bindEvents() {
        // Zooming Controls
        document.getElementById('canvasZoomIn')?.addEventListener('click', () => this.setZoom(this.zoom * 1.5));
        document.getElementById('canvasZoomOut')?.addEventListener('click', () => this.setZoom(this.zoom / 1.5));
        document.getElementById('canvasZoomReset')?.addEventListener('click', () => this.setZoom(1));
        document.getElementById('centerTodayBtn')?.addEventListener('click', () => this.centerOnToday());

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
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.renderCalendar();
        });
        document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.renderCalendar();
        });

        // Canvas Nav Controls
        document.getElementById('prevDaysBtn')?.addEventListener('click', () => {
            this.panX += this.dayWidth * 3; this.updateTransform();
        });
        document.getElementById('nextDaysBtn')?.addEventListener('click', () => {
            this.panX -= this.dayWidth * 3; this.updateTransform();
        });

        if (!this.container) return;

        // 🚨 PRO: UNIFIED DRAG CONTROLLER (Panning vs Scheduling vs Block Dragging)
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

            if (e.target.closest('.ypt-block')) {
                // Block Dragging Logic
                const blockEl = e.target.closest('.ypt-block');
                if (e.target.closest('.delete-btn') || e.target.closest('.edit-btn') || e.target.closest('.run-btn')) return; 
                this.isDraggingBlock = true; this.hasMovedBlock = false;
                this.draggedBlockEl = blockEl;
                this.draggedBlockId = blockEl.dataset.id;
                const rect = blockEl.getBoundingClientRect();
                const layerRect = this.blocksLayer.getBoundingClientRect();
                this.blockOffsetX = e.clientX - rect.left;
                this.blockOffsetY = e.clientY - rect.top;
                blockEl.classList.add('dragging-block');
                this.container.style.cursor = 'grabbing';
                e.target.setPointerCapture(e.pointerId);
                return;
            }

            if (e.shiftKey || e.ctrlKey || e.metaKey || (e.pointerType === 'touch' && this.isLongPress(e))) {
                // Drag-to-Select Logic
                this.isSelecting = true;
                if (this.selectionBox) this.selectionBox.classList.remove('hidden');
                
                const rect = this.container.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;

                const canvasX = (mouseX - this.panX) / this.zoom;
                const canvasY = (mouseY - this.panY) / this.zoom;
                
                this.selectColIndex = Math.floor((canvasX - 64) / this.dayWidth); // Adjust for label width
                this.selectStartX = (this.selectColIndex * this.dayWidth) + 64;
                
                const rawMin = (canvasY / this.pxPerHour) * 60;
                this.selectStartMin = Math.round(rawMin / 5) * 5;
                
                this.updateSelectionBox(this.selectStartMin, this.selectStartMin + 15);
            } else {
                // Standard Panning Logic
                this.isPanning = true; this.hasDragged = false;
                this.startX = e.clientX - this.panX;
                this.startY = e.clientY - this.panY;
                this.container.style.cursor = 'grabbing';
            }
        });

        this.container.addEventListener('pointermove', (e) => {
            if (this.activePointers.has(e.pointerId)) this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

            if (this.activePointers.size === 2) {
                const pts = Array.from(this.activePointers.values());
                const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                const scale = dist / this.initialPinchDistance;
                this.setZoom(this.initialPinchZoom * scale, this.container.clientWidth / 2, this.pinchCenterY);
                return;
            }

            if (this.isDraggingBlock && this.draggedBlockEl) {
                const layerRect = this.blocksLayer.getBoundingClientRect();
                let newLeft = (e.clientX - layerRect.left - this.blockOffsetX) / this.zoom;
                let newTop = (e.clientY - layerRect.top - this.blockOffsetY) / this.zoom;
                
                const colIdx = Math.round(newLeft / this.dayWidth);
                const snappedLeft = colIdx * this.dayWidth;
                const rawMins = (newTop / this.pxPerHour) * 60;
                const snappedMins = Math.round(rawMins / 5) * 5;
                const snappedTop = (snappedMins / 60) * this.pxPerHour;

                this.draggedBlockEl.style.transform = `translate(${snappedLeft}px, ${snappedTop}px)`;
                this.hasMovedBlock = true;
                return;
            }

            if (this.isSelecting) {
                const rect = this.container.getBoundingClientRect();
                const mouseY = e.clientY - rect.top;
                const canvasY = (mouseY - this.panY) / this.zoom;
                
                const rawMin = (canvasY / this.pxPerHour) * 60;
                let currentMin = Math.round(rawMin / 5) * 5;
                
                if (currentMin <= this.selectStartMin) currentMin = this.selectStartMin + 5;
                this.selectEndMin = currentMin;
                this.updateSelectionBox(this.selectStartMin, this.selectEndMin);
            } else if (this.isPanning) {
                const dx = e.clientX - this.startX - this.panX;
                const dy = e.clientY - this.startY - this.panY;
                if (Math.abs(dx) > 3 || Math.abs(dy) > 3) this.hasDragged = true;
                this.panX = e.clientX - this.startX;
                this.panY = e.clientY - this.startY;
                if (!this.rafPending) {
                    this.rafPending = true;
                    requestAnimationFrame(() => { this.updateTransform(); this.rafPending = false; });
                }
            }
        });

        this.container.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        this.container.addEventListener('pointercancel', (e) => this.handlePointerUp(e));

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

    isLongPress(e) {
        // Implement a basic check or just rely on desktop modifiers for now
        return false;
    }

    handlePointerUp(e) {
        this.activePointers.delete(e.pointerId);
        if (this.activePointers.size < 2) this.hasPinched = false;

        if (this.isDraggingBlock && this.draggedBlockEl) {
            this.isDraggingBlock = false;
            this.draggedBlockEl.classList.remove('dragging-block');
            this.container.style.cursor = 'grab';
            
            if (this.hasMovedBlock) {
                const transform = this.draggedBlockEl.style.transform;
                const match = transform.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
                if (match) {
                    const newLeft = parseFloat(match[1]);
                    const newTop = parseFloat(match[2]);
                    
                    const colIdx = Math.round(newLeft / this.dayWidth);
                    const newDate = new Date(this.baseDate.getTime() + (colIdx * 86400000));
                    
                    const startMins = Math.round((newTop / this.pxPerHour) * 60);
                    const newStartH = Math.floor(startMins / 60).toString().padStart(2, '0');
                    const newStartM = (startMins % 60).toString().padStart(2, '0');
                    
                    const block = store.state.blocks.find(b => b.id === this.draggedBlockId);
                    if (block && block.scheduledStart && block.scheduledEnd) {
                        const oldStart = new Date(`2000-01-01T${block.scheduledStart}:00`);
                        const oldEnd = new Date(`2000-01-01T${block.scheduledEnd}:00`);
                        const durationMins = (oldEnd - oldStart) / 60000;
                        
                        const endMins = startMins + durationMins;
                        const newEndH = Math.floor(endMins / 60).toString().padStart(2, '0');
                        const newEndM = (endMins % 60).toString().padStart(2, '0');

                        store.update('blocks', blocks => blocks.map(b => {
                            if (b.id === this.draggedBlockId) {
                                return { ...b, 
                                    startDate: this.formatDate(newDate), endDate: this.formatDate(newDate),
                                    scheduledStart: `${newStartH}:${newStartM}`, scheduledEnd: `${newEndH}:${newEndM}`
                                };
                            }
                            return b;
                        }));
                    }
                }
            } else if (!e.target.closest('.action-btn')) {
                // If it was just a click, open slide panel
                this.openSlidePanel(this.draggedBlockId);
            }
            this.draggedBlockEl = null; this.draggedBlockId = null;

        } else if (this.isSelecting) {
            this.isSelecting = false;
            if (this.selectionBox) this.selectionBox.classList.add('hidden');
            this.openModalWithSelection();
        } else if (this.isPanning) {
            this.isPanning = false;
            this.container.style.cursor = 'grab';
        }
    }

    // 🚨 PRO: CSS GPU ACCELERATED GRID
    renderCSSGrid() {
        const theme = store.state.theme;
        const color60 = theme.bgColor === '#1f2937' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
        const color15 = theme.bgColor === '#1f2937' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
        
        // Pure CSS gradient grid based on zoom. Removes 10,000 DOM nodes!
        this.gridBg.style.backgroundImage = `
            linear-gradient(to right, ${color60} 1px, transparent 1px),
            linear-gradient(to bottom, ${color60} 1px, transparent 1px),
            linear-gradient(to bottom, ${color15} 1px, transparent 1px)
        `;
        this.updateTransform();
    }

    updateTransform() {
        this.root.style.setProperty('--pan-x', `${this.panX}px`);
        this.root.style.setProperty('--pan-y', `${this.panY}px`);
        this.root.style.setProperty('--zoom', this.zoom);

        // Adjust CSS Grid Background Size dynamically
        if (this.gridBg) {
            this.gridBg.style.backgroundSize = `
                ${this.dayWidth * this.zoom}px ${this.pxPerHour * this.zoom}px,
                ${this.dayWidth * this.zoom}px ${this.pxPerHour * this.zoom}px,
                ${this.dayWidth * this.zoom}px ${(this.pxPerHour * this.zoom) / 4}px
            `;
            this.gridBg.style.backgroundPosition = `${this.panX}px ${this.panY}px`;
        }

        const centerCol = Math.floor((-this.panX + (this.container.clientWidth / 2)) / (this.dayWidth * this.zoom));
        const viewingDate = new Date(this.baseDate.getTime() + (centerCol * 86400000));
        if (this.dateDisplay) this.dateDisplay.innerText = viewingDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
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
        this.renderHeaders();
    }

    centerOnToday() {
        this.baseDate = this.getChinaTime(); this.baseDate.setHours(0,0,0,0);
        this.panX = 10; this.panY = -480; this.zoom = 1;
        this.updateTransform();
        this.renderHeaders();
        this.renderBlocks();
    }

    renderHeaders() {
        if (!this.daysHeader || !this.timesSidebar) return;
        this.daysHeader.innerHTML = ''; this.timesSidebar.innerHTML = '';
        
        const startDayOffset = -280; const endDayOffset = 280;
        for (let i = startDayOffset; i <= endDayOffset; i++) {
            const d = new Date(this.baseDate.getTime() + (i * 86400000));
            const isToday = i === 0;
            const leftPx = (i + 280) * this.dayWidth;
            const bgClass = isToday ? 'bg-blue-100 text-blue-700 rounded shadow-sm px-2 py-1' : 'text-gray-600';
            this.daysHeader.innerHTML += `
                <div class="absolute text-center" style="left: ${leftPx}px; width: ${this.dayWidth}px; bottom: 4px;">
                    <span class="inline-block ${bgClass}">${d.toLocaleDateString('en-US', {weekday:'short', month:'numeric', day:'numeric'})}</span>
                </div>
            `;
        }

        for (let i = 0; i < 24; i++) {
            const topPx = i * this.pxPerHour;
            this.timesSidebar.innerHTML += `
                <div class="absolute w-full text-center" style="top: ${topPx}px; transform: translateY(-50%);">${String(i).padStart(2,'0')}:00</div>
            `;
        }
    }

    // 🚨 PRO: DRAG TO SELECT LOGIC
    updateSelectionBox(startMin, endMin) {
        if (!this.selectionBox || !this.selectionLabel) return;
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
        const dateStr = this.formatDate(targetDate);

        const sH = Math.floor(this.selectStartMin / 60).toString().padStart(2, '0');
        const sM = (this.selectStartMin % 60).toString().padStart(2, '0');
        const eH = Math.floor(this.selectEndMin / 60).toString().padStart(2, '0');
        const eM = (this.selectEndMin % 60).toString().padStart(2, '0');

        // Pre-fill standard modal fields automatically!
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
            const leftPx = colIdx * this.dayWidth;
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
            el.className = `ypt-block absolute rounded p-1 shadow-sm text-white overflow-hidden ${opacity} ${borderStyle}`;
            el.style.left = `${leftPx + 2}px`;
            el.style.top = `${topPx}px`;
            el.style.width = `${this.dayWidth - 4}px`;
            el.style.height = `${heightPx}px`;
            el.style.backgroundColor = subColor;
            el.dataset.id = b.id;
            
            el.innerHTML = `
                <button class="delete-btn absolute top-1 right-1 bg-red-600/80 hover:bg-red-700 text-white rounded px-1.5 py-0.5 text-[8px] font-black z-20 action-btn">X</button>
                <button class="edit-btn absolute top-1 right-6 bg-gray-800/60 hover:bg-gray-900 text-white rounded px-1 text-[9px] font-bold z-20 action-btn">✎</button>
                ${(b.status !== 'completed' && !isActive) ? `<button class="run-btn absolute bottom-1 right-1 bg-white text-gray-800 hover:bg-gray-100 rounded px-1.5 py-0.5 text-[9px] font-black z-20 shadow-md action-btn">▶️ START</button>` : ''}
                
                <div class="pointer-events-none z-10 flex flex-col h-full">
                    <div class="font-bold text-[10px] truncate drop-shadow-md uppercase text-white/90">${b.subject}</div>
                    <div class="font-bold text-[11px] truncate drop-shadow-md leading-tight">${b.title}</div>
                    <div class="text-[9px] opacity-90 drop-shadow-md mt-auto">${b.scheduledStart} - ${b.scheduledEnd}</div>
                </div>
            `;
            
            // Delete button
            el.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm(`Delete block: ${b.title}?`)) store.update('blocks', old => old.filter(x => x.id !== b.id));
            });

            // Edit button
            el.querySelector('.edit-btn').addEventListener('click', (e) => {
                e.stopPropagation();
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

            // Run button
            const runBtn = el.querySelector('.run-btn');
            if (runBtn) {
                runBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const titleEl = document.getElementById('focusSessionTitle');
                    if (titleEl) titleEl.innerText = `🎯 Focusing on: ${b.title}`;
                    store.update('timer', t => ({ ...t, activeBlockId: b.id, spontaneousSubject: b.subject, mode: 'pomodoro', phase: 'study', studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: true }));
                    timerEngine.start();
                    document.querySelector('.tab-btn[data-tab="focus"]')?.click();
                });
            }

            this.blocksLayer.appendChild(el);
        });
    }

    // --- CALENDAR LOGIC ---
    renderCalendar() {
        if (!this.calendarGrid || !this.calendarDisplay) return;
        
        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        
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
            
            cell.addEventListener('click', () => this.openSlidePanelForDate(dateStr));
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

        panel.classList.remove('translate-x-full');
        overlay.classList.remove('hidden');
        
        document.getElementById('closeSlidePanel')?.addEventListener('click', () => {
            panel.classList.add('translate-x-full');
            overlay.classList.add('hidden');
        }, {once: true});
        overlay.addEventListener('click', () => {
            panel.classList.add('translate-x-full');
            overlay.classList.add('hidden');
        }, {once: true});
    }

    renderSlidePanelBlocks(dateStr) {
        const container = document.getElementById('slidePanelBlocks');
        const totalEl = document.getElementById('slidePanelTotalTime');
        if (!container || !totalEl) return;

        const blocks = store.state.blocks.filter(b => b.startDate === dateStr || b.date === dateStr);
        blocks.sort((a, b) => (a.scheduledStart || "00:00").localeCompare(b.scheduledStart || "00:00"));

        let totalSecs = 0;
        container.innerHTML = '';
        
        if (blocks.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-400 font-bold text-center italic py-4">No blocks scheduled for this day.</div>';
        } else {
            blocks.forEach(b => {
                if (b.status === 'completed') totalSecs += (b.studySeconds || 0);
                const subColor = store.state.subjects[b.subject] || '#3b82f6';
                const opacity = b.status === 'completed' ? 'opacity-50' : '';
                container.innerHTML += `
                    <div class="flex items-center gap-3 p-2 bg-white rounded border shadow-sm ${opacity}">
                        <div class="w-3 h-full rounded-l" style="background-color: ${subColor}"></div>
                        <div class="flex-1">
                            <div class="text-[10px] font-black text-gray-400">${b.scheduledStart} - ${b.scheduledEnd}</div>
                            <div class="text-sm font-bold text-gray-800">${b.title}</div>
                        </div>
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
        
        diaryEl.oninput = (e) => {
            store.update('diaries', d => ({ ...d, [dateStr]: e.target.value }));
        };
    }
}

export const canvasUI = new CanvasUI();

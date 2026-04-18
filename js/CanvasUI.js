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
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.daysLayer = document.getElementById('canvas-days');
        this.timesLayer = document.getElementById('canvas-times');
        this.diaryEl = document.getElementById('slidePanelDiary');
        if (!this.container) return;

        this.currentTimeLine = document.createElement('div');
        this.currentTimeLine.className = 'absolute left-0 w-[201600px] border-t-2 border-red-500 z-[40] pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)] transition-all';
        this.currentTimeLine.innerHTML = `<div class="bg-red-500 text-white text-[10px] px-2 font-bold rounded-r-full absolute -top-2.5 shadow-md">NOW</div>`;
        this.blocksLayer.appendChild(this.currentTimeLine);
        
        setInterval(() => this.updateCurrentTimeLine(), 60000); 
        this.updateCurrentTimeLine();
        this.drawGridLabels();
        this.bindEvents();
        this.centerOnCurrentTime();
        
        const repaint = () => { 
            this.renderBlocks(); 
            this.renderMonthCalendar(); 
            this.drawGridLabels(); 
            if (this.currentSlideDate && !document.getElementById('daySlidePanel').classList.contains('translate-x-full')) {
                this.openSlidePanel(this.currentSlideDate);
            }
        };
        store.subscribe('blocks', repaint); store.subscribe('exams', repaint); store.subscribe('subjects', repaint);
        repaint();
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }
    getTodayStr() { const d = this.getChinaTime(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

    centerOnCurrentTime() {
        const now = this.getChinaTime();
        const minsFromMidnight = (now.getHours() * 60) + now.getMinutes();
        const viewHeight = this.container.clientHeight || 700;
        this.panX = 10; 
        this.panY = -(minsFromMidnight * this.zoom) + (viewHeight / 2);
        this.enforceBoundsAndUpdate();
    }

    updateCurrentTimeLine() {
        const now = this.getChinaTime();
        const minsFromMidnight = (now.getHours() * 60) + now.getMinutes();
        this.currentTimeLine.style.top = `calc(${minsFromMidnight}px * var(--zoom))`;
    }

    switchView(viewMode) {
        const canvasView = document.getElementById('canvas-container'); const calView = document.getElementById('calendar-container');
        const canvasCtrl = document.getElementById('canvasControls'); const calCtrl = document.getElementById('calendarControls');
        const btnCanvas = document.getElementById('viewCanvasBtn'); const btnCal = document.getElementById('viewCalendarBtn');

        if (viewMode === 'canvas') {
            canvasView.classList.replace('hidden', 'block'); calView.classList.replace('flex', 'hidden');
            canvasCtrl.classList.replace('hidden', 'flex'); calCtrl.classList.replace('flex', 'hidden');
            btnCanvas.className = "px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all text-blue-600";
            btnCal.className = "px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
        } else {
            canvasView.classList.replace('block', 'hidden'); calView.classList.replace('hidden', 'flex');
            canvasCtrl.classList.replace('flex', 'hidden'); calCtrl.classList.replace('hidden', 'flex');
            btnCal.className = "px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all text-blue-600";
            btnCanvas.className = "px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
            this.renderMonthCalendar();
        }
    }

    drawGridLabels() {
        this.timesLayer.innerHTML = '';
        for (let i = 0; i <= 24; i++) {
            let hEl = document.createElement('div');
            hEl.className = 'absolute w-full text-center border-t border-gray-300 pt-1 text-gray-600 font-bold';
            hEl.style.top = `calc(${i * 60}px * var(--zoom))`; hEl.innerText = `${i.toString().padStart(2, '0')}:00`;
            this.timesLayer.appendChild(hEl);

            if (i === 24) continue;
            let m30 = document.createElement('div');
            m30.className = 'absolute w-full text-center text-gray-400 font-medium text-[10px] time-label-fraction time-label-30';
            m30.style.top = `calc(${(i * 60) + 30}px * var(--zoom) - 6px)`; m30.innerText = `${i.toString().padStart(2, '0')}:30`;
            this.timesLayer.appendChild(m30);

            [15, 45].forEach(min => {
                let m15 = document.createElement('div');
                m15.className = 'absolute w-full text-center text-gray-300 font-normal text-[9px] time-label-fraction time-label-15';
                m15.style.top = `calc(${(i * 60) + min}px * var(--zoom) - 6px)`; m15.innerText = `${i.toString().padStart(2, '0')}:${min}`;
                this.timesLayer.appendChild(m15);
            });

            [5, 10, 20, 25, 35, 40, 50, 55].forEach(min => {
                let m5 = document.createElement('div');
                m5.className = 'absolute w-full text-center text-gray-200 font-normal text-[8px] time-label-fraction time-label-5';
                m5.style.top = `calc(${(i * 60) + min}px * var(--zoom) - 5px)`; m5.innerText = `${i.toString().padStart(2, '0')}:${min.toString().padStart(2,'0')}`;
                this.timesLayer.appendChild(m5);
            });
        }

        const todayStr = this.getTodayStr(); 

        this.daysLayer.innerHTML = '';
        for (let i = -30; i <= 60; i++) {
            let targetDate = new Date(this.baseDate); targetDate.setDate(this.baseDate.getDate() + i);
            const displayStr = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const dateY = targetDate.getFullYear(); const dateM = String(targetDate.getMonth() + 1).padStart(2, '0'); const dateD = String(targetDate.getDate()).padStart(2, '0');
            const exactDateStr = `${dateY}-${dateM}-${dateD}`;
            const dayExams = (store.state.exams || []).filter(e => e.date === exactDateStr);
            const hasExam = dayExams.length > 0;

            const dayEl = document.createElement('div');
            dayEl.className = `absolute text-center border-l border-gray-300 pl-2 backdrop-blur flex flex-col justify-end pb-1 ${hasExam ? 'bg-red-600 border-red-700 shadow-lg z-[60]' : 'bg-white/80'}`;
            dayEl.style.left = `calc(100800px + ${i * this.dayWidth}px)`; dayEl.style.width = `${this.dayWidth}px`; dayEl.style.height = '100%';
            
            let html = '';
            if (hasExam) {
                html = `<span class="text-white font-black text-sm mb-1">${displayStr}</span>`;
                dayExams.forEach(ex => { html += `<div class="text-[9px] bg-red-800 text-white rounded px-1 font-bold w-11/12 mx-auto truncate" title="${ex.title}">🚨 ${ex.time} - ${ex.title}</div>`; });
            } else {
                html = (exactDateStr === todayStr) ? `<span class="text-blue-600 font-black">⭐ Today</span> <br/> <span class="text-[10px] text-gray-500">${displayStr}</span>` : `<span class="text-gray-700 font-bold">${displayStr}</span>`;
            }
            dayEl.innerHTML = html;
            this.daysLayer.appendChild(dayEl);
        }
    }

    enforceBoundsAndUpdate() {
        if (this.zoom < 1) this.zoom = 1;
        let newTier = 1;
        if (this.zoom >= 4) newTier = 4;
        else if (this.zoom >= 2) newTier = 2;
        else if (this.zoom >= 1.5) newTier = 1.5;

        if (this.currentZoomTier !== newTier) {
            this.currentZoomTier = newTier;
            this.root.style.setProperty('--grid-30', 'transparent'); this.root.style.setProperty('--grid-15', 'transparent'); this.root.style.setProperty('--grid-5', 'transparent');
            this.container.classList.remove('show-15-mins', 'show-30-mins', 'show-5-mins');
            
            if (newTier === 4) {
                this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)'); this.root.style.setProperty('--grid-15', 'rgba(0,0,0,0.04)'); this.root.style.setProperty('--grid-5', 'rgba(0,0,0,0.02)');
                this.container.classList.add('show-15-mins', 'show-30-mins', 'show-5-mins');
            } else if (newTier === 2) {
                this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)'); this.root.style.setProperty('--grid-15', 'rgba(0,0,0,0.03)');
                this.container.classList.add('show-15-mins', 'show-30-mins');
            } else if (newTier === 1.5) {
                this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)'); this.container.classList.add('show-30-mins');
            }
        }

        const canvasHeight = 24 * 60 * this.zoom; const viewHeight = this.container.clientHeight || 700; 
        const minPanY = Math.min(0, viewHeight - canvasHeight - 48); this.panY = Math.max(minPanY, Math.min(0, this.panY));

        if (!this.rafPending) {
            this.rafPending = true;
            requestAnimationFrame(() => {
                this.root.style.setProperty('--pan-x', `${this.panX}px`); this.root.style.setProperty('--pan-y', `${this.panY}px`); this.root.style.setProperty('--zoom', this.zoom);
                this.rafPending = false;
            });
        }
    }

    applyZoomWithCenterAnchor(newZoom) {
        const viewHeight = this.container.clientHeight - 48; const centerY = viewHeight / 2;
        const timeAtCenter = (centerY - this.panY) / this.zoom;
        this.zoom = newZoom; this.panY = centerY - (timeAtCenter * this.zoom); this.enforceBoundsAndUpdate();
    }

    bindEvents() {
        document.getElementById('viewCanvasBtn')?.addEventListener('click', () => this.switchView('canvas'));
        document.getElementById('viewCalendarBtn')?.addEventListener('click', () => this.switchView('calendar'));
        document.getElementById('prevMonthBtn')?.addEventListener('click', () => { this.currentMonth.setMonth(this.currentMonth.getMonth() - 1); this.renderMonthCalendar(); });
        document.getElementById('nextMonthBtn')?.addEventListener('click', () => { this.currentMonth.setMonth(this.currentMonth.getMonth() + 1); this.renderMonthCalendar(); });

        document.getElementById('calendar-grid')?.addEventListener('click', (e) => { const dayCard = e.target.closest('[data-date]'); if (dayCard) this.openSlidePanel(dayCard.dataset.date); });

        const closeDiary = () => { document.getElementById('daySlidePanel').classList.add('translate-x-full'); document.getElementById('diaryOverlay')?.classList.add('hidden'); };
        document.getElementById('closeSlidePanel')?.addEventListener('click', closeDiary); document.getElementById('diaryOverlay')?.addEventListener('click', closeDiary);

        document.getElementById('slidePanelBlocks')?.addEventListener('click', (e) => { const blockEl = e.target.closest('.agenda-block-interactive'); if (blockEl && blockEl.dataset.id) blockManager.openEditModal(parseInt(blockEl.dataset.id)); });

        this.diaryEl?.addEventListener('input', (e) => { if (this.currentSlideDate) store.update('diaries', d => ({...d, [this.currentSlideDate]: e.target.value})); });

        document.getElementById('prevDaysBtn')?.addEventListener('click', () => { this.panX += this.dayWidth * 3; this.enforceBoundsAndUpdate(); });
        document.getElementById('nextDaysBtn')?.addEventListener('click', () => { this.panX -= this.dayWidth * 3; this.enforceBoundsAndUpdate(); });
        document.getElementById('centerTodayBtn')?.addEventListener('click', () => { this.centerOnCurrentTime(); });

        const zoomLevels = [1, 1.5, 2, 4, 10, 20];
        document.getElementById('canvasZoomIn')?.addEventListener('click', () => { let nextZoom = zoomLevels.find(z => z > this.zoom) || 20; this.applyZoomWithCenterAnchor(nextZoom); });
        document.getElementById('canvasZoomOut')?.addEventListener('click', () => { let prevZoom = zoomLevels.slice().reverse().find(z => z < this.zoom) || 1; this.applyZoomWithCenterAnchor(prevZoom); });
        document.getElementById('canvasZoomReset')?.addEventListener('click', () => { this.applyZoomWithCenterAnchor(1); });

        this.container.addEventListener('pointerdown', (e) => {
            if (e.target.closest('button')) return;
            this.activePointers.set(e.pointerId, e);

            if (this.activePointers.size === 2 && !this.isDraggingBlock) {
                this.isPanning = false; this.hasPinched = true;
                const pointers = Array.from(this.activePointers.values());
                this.initialPinchDistance = Math.hypot(pointers[0].clientX - pointers[1].clientX, pointers[0].clientY - pointers[1].clientY);
                this.initialPinchZoom = this.zoom;
                const rect = this.container.getBoundingClientRect(); this.pinchCenterY = ((pointers[0].clientY + pointers[1].clientY) / 2) - rect.top - 48;
                return;
            }

            this.hasDragged = false; 
            const blockEl = e.target.closest('.ypt-block');
            if (blockEl) {
                const id = parseInt(blockEl.dataset.id); const block = store.state.blocks.find(b => b.id === id);
                if (block && block.status === 'pending') {
                    this.isDraggingBlock = true; this.draggedBlockEl = blockEl; this.draggedBlockId = id;
                    const rect = blockEl.getBoundingClientRect(); this.blockOffsetX = e.clientX - rect.left; this.blockOffsetY = e.clientY - rect.top;
                    this.hasMovedBlock = false; blockEl.classList.add('dragging-block'); e.stopPropagation();
                    return;
                } else { this.pendingClickBlockId = id; return; }
            }
            this.isPanning = true; this.startX = e.clientX - this.panX; this.startY = e.clientY - this.panY; this.container.classList.add('cursor-grabbing');
        });

        window.addEventListener('pointermove', (e) => {
            if (this.activePointers.has(e.pointerId)) this.activePointers.set(e.pointerId, e);

            if (this.activePointers.size === 2 && !this.isDraggingBlock) {
                const pointers = Array.from(this.activePointers.values());
                const currentDist = Math.hypot(pointers[0].clientX - pointers[1].clientX, pointers[0].clientY - pointers[1].clientY);
                if (this.initialPinchDistance) {
                    const scale = currentDist / this.initialPinchDistance; const newZoom = Math.min(Math.max(1, this.initialPinchZoom * scale), 20);
                    const timeAtCenter = (this.pinchCenterY - this.panY) / this.zoom;
                    this.zoom = newZoom; this.panY = this.pinchCenterY - (timeAtCenter * this.zoom); this.enforceBoundsAndUpdate();
                }
                return;
            }

            if (this.isDraggingBlock && this.draggedBlockEl) {
                this.hasMovedBlock = true; const canvasRect = this.container.getBoundingClientRect();
                const newLeft = (e.clientX - canvasRect.left - 64) - this.panX - this.blockOffsetX; const newTop = (e.clientY - canvasRect.top - 48) - this.panY - this.blockOffsetY;
                this.draggedBlockEl.style.left = `${newLeft}px`; this.draggedBlockEl.style.top = `${newTop}px`;
            } else if (this.isPanning) {
                this.hasDragged = true; this.panX = e.clientX - this.startX; this.panY = e.clientY - this.startY; this.enforceBoundsAndUpdate();
            }
        });

        window.addEventListener('pointerup', (e) => {
            this.activePointers.delete(e.pointerId);
            if (this.activePointers.size === 1 && this.hasPinched) {
                const remaining = Array.from(this.activePointers.values())[0];
                this.startX = remaining.clientX - this.panX; this.startY = remaining.clientY - this.panY; this.isPanning = true; this.initialPinchDistance = null; return;
            }
            if (this.activePointers.size === 0) {
                this.initialPinchDistance = null;
                if (this.hasPinched) { this.hasPinched = false; this.isPanning = false; this.container.classList.remove('cursor-grabbing'); return; }
            }

            if (this.isDraggingBlock) {
                this.isDraggingBlock = false; this.draggedBlockEl.classList.remove('dragging-block');
                if (this.hasMovedBlock) {
                    const leftPx = parseFloat(this.draggedBlockEl.style.left); const topPx = parseFloat(this.draggedBlockEl.style.top) / this.zoom;
                    const dayOffset = Math.round((leftPx - 100800) / this.dayWidth);
                    const targetLocal = new Date(this.baseDate.getFullYear(), this.baseDate.getMonth(), this.baseDate.getDate()); targetLocal.setDate(targetLocal.getDate() + dayOffset);
                    const newDateStr = `${targetLocal.getFullYear()}-${String(targetLocal.getMonth() + 1).padStart(2, '0')}-${String(targetLocal.getDate()).padStart(2, '0')}`;
                    let totalMins = Math.floor(topPx / 5) * 5; if(totalMins < 0) totalMins = 0; if(totalMins > 1435) totalMins = 1435; 
                    const h = Math.floor(totalMins / 60).toString().padStart(2, '0'); const m = (totalMins % 60).toString().padStart(2, '0');
                    const newTimeStr = `${h}:${m}`;

                    if (confirm(`Reschedule block to ${newDateStr} @ ${newTimeStr}?`)) {
                        const block = store.state.blocks.find(b => b.id === this.draggedBlockId);
                        const sObj = new Date(`${block.startDate}T${block.scheduledStart}:00`); const eObj = new Date(`${block.endDate}T${block.scheduledEnd}:00`);
                        const durMins = (eObj - sObj) / 60000;
                        let endTotalMins = totalMins + durMins; let endH = Math.floor(endTotalMins / 60); let endM = endTotalMins % 60; let endD = new Date(newDateStr);
                        if (endH >= 24) { endH = endH % 24; endD.setDate(endD.getDate() + 1); }
                        const newEndStr = `${endD.toISOString().split('T')[0]}`; const newEndTimeStr = `${endH.toString().padStart(2,'0')}:${endM.toString().padStart(2,'0')}`;
                        store.update('blocks', blocks => blocks.map(b => b.id === this.draggedBlockId ? { ...b, startDate: newDateStr, scheduledStart: newTimeStr, endDate: newEndStr, scheduledEnd: newEndTimeStr } : b));
                    } else { this.renderBlocks(); }
                } else { blockManager.openEditModal(this.draggedBlockId); }
                this.draggedBlockEl = null; this.draggedBlockId = null; return;
            }

            if (this.pendingClickBlockId) { blockManager.openEditModal(this.pendingClickBlockId); this.pendingClickBlockId = null; return; }

            if (this.isPanning) {
                this.isPanning = false; this.container.classList.remove('cursor-grabbing');
                if (!this.hasDragged && !e.target.closest('.ypt-block') && !e.target.closest('button')) {
                    const rect = this.container.getBoundingClientRect(); const clickX = e.clientX - rect.left - 64; const clickY = e.clientY - rect.top - 48;  
                    const gridX = (clickX - this.panX); const gridY = (clickY - this.panY) / this.zoom; const dayOffset = Math.floor(gridX / this.dayWidth);
                    const targetLocal = new Date(this.baseDate.getFullYear(), this.baseDate.getMonth(), this.baseDate.getDate()); targetLocal.setDate(targetLocal.getDate() + dayOffset);
                    const dateStr = `${targetLocal.getFullYear()}-${String(targetLocal.getMonth() + 1).padStart(2, '0')}-${String(targetLocal.getDate()).padStart(2, '0')}`;
                    let snapInterval = 60; if (this.zoom >= 4) snapInterval = 5; else if (this.zoom >= 2.0) snapInterval = 15; else if (this.zoom >= 1.5) snapInterval = 30; 
                    let totalMins = Math.floor(gridY); totalMins = Math.floor(totalMins / snapInterval) * snapInterval;
                    if(totalMins < 0) totalMins = 0; if(totalMins > 1440 - snapInterval) totalMins = 1440 - snapInterval; 
                    const h = Math.floor(totalMins / 60).toString().padStart(2, '0'); const m = (totalMins % 60).toString().padStart(2, '0');
                    blockManager.openModalWithPreFill(dateStr, `${h}:${m}`, snapInterval);
                }
            }
        });

        window.addEventListener('pointercancel', (e) => {
            this.activePointers.delete(e.pointerId); this.initialPinchDistance = null; this.hasPinched = false; this.isPanning = false; this.isDraggingBlock = false;
            if(this.draggedBlockEl) this.draggedBlockEl.classList.remove('dragging-block'); this.container.classList.remove('cursor-grabbing');
        });

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const rect = this.container.getBoundingClientRect(); const cursorY = e.clientY - rect.top - 48; const timeUnderCursor = (cursorY - this.panY) / this.zoom;
                const delta = e.deltaY > 0 ? -0.05 : 0.05; this.zoom = Math.min(Math.max(1, this.zoom + delta), 20); this.panY = cursorY - (timeUnderCursor * this.zoom);
            } else { this.panX -= (e.deltaX * 0.5); this.panY -= (e.deltaY * 0.5); }
            this.enforceBoundsAndUpdate();
        }, { passive: false });

        this.blocksLayer.addEventListener('click', (e) => {
            const btn = e.target.closest('button'); if (!btn) return; e.stopPropagation(); 
            const id = parseInt(btn.dataset.id);
            if (btn.classList.contains('delete-btn')) {
                if(confirm("Delete block?")) store.update('blocks', old => old.filter(b => b.id !== id));
            } else if (btn.classList.contains('play-btn')) {
                const block = store.state.blocks.find(b => b.id === id);
                const startTime = block.actualStart || this.getChinaTime().getTime();
                store.update('blocks', blocks => blocks.map(b => b.id === id ? { ...b, actualStart: startTime, status: 'active' } : b));
                store.update('timer', t => ({ ...t, activeBlockId: id, isRunning: true, studySeconds: block.studySeconds || 0, breakSeconds: block.breakSeconds || 0, secondsElapsed: block.studySeconds || 0 }));
                timerEngine.start(); document.querySelector('[data-tab="focus"]')?.click();
            } else if (btn.classList.contains('finish-btn')) {
                // Let TimerUI handle the auto-prompt push back logic safely!
                document.querySelector('[data-tab="focus"]')?.click();
                document.getElementById('finishTimerBtn')?.click(); 
            }
        });
    }

    openSlidePanel(dateStr) {
        this.currentSlideDate = dateStr;
        const panel = document.getElementById('daySlidePanel'); panel.classList.remove('translate-x-full'); document.getElementById('diaryOverlay')?.classList.remove('hidden'); 
        const dObj = new Date(dateStr); document.getElementById('slidePanelDate').innerText = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        if (this.diaryEl) this.diaryEl.value = store.state.diaries[dateStr] || '';
        const dayBlocks = store.state.blocks.filter(b => b.startDate === dateStr); const dayExams = (store.state.exams || []).filter(e => e.date === dateStr);
        let totalSecs = 0; const blocksContainer = document.getElementById('slidePanelBlocks'); blocksContainer.innerHTML = '';

        if (dayExams.length > 0) { dayExams.forEach(ex => { blocksContainer.innerHTML += `<div class="bg-red-600 border border-red-700 p-3 rounded-lg shadow-sm"><div class="font-black text-xs uppercase mb-1 text-white">🚨 EXAM DEADLINE</div><div class="font-bold text-white">${ex.title}</div><div class="text-xs text-red-200 mt-1">Scheduled Time: ${ex.time}</div></div>`; }); }

        if (dayBlocks.length === 0 && dayExams.length === 0) { blocksContainer.innerHTML = `<div class="text-gray-400 text-sm text-center mt-4 font-bold">No tasks scheduled.</div>`;
        } else {
            dayBlocks.sort((a,b) => a.scheduledStart.localeCompare(b.scheduledStart)).forEach(b => {
                totalSecs += (b.studySeconds || 0);
                const statusHtml = b.status === 'completed' ? `<span class="text-green-600 text-[10px] font-black uppercase">✅ Done</span>` : `<span class="text-blue-500 text-[10px] font-black uppercase">▶ Active</span>`;
                const subColor = store.state.subjects[b.subject] || '#3b82f6';
                blocksContainer.innerHTML += `<div class="agenda-block-interactive bg-white border p-3 rounded-lg shadow-sm flex flex-col gap-1 cursor-pointer" style="border-left: 4px solid ${subColor}" data-id="${b.id}"><div class="flex justify-between items-start"><div class="font-bold text-gray-800 text-sm">${b.title}</div>${statusHtml}</div><div class="text-xs font-bold text-gray-500">${b.scheduledStart} - ${b.scheduledEnd}</div>${b.studySeconds > 0 ? `<div class="text-xs font-mono font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded mt-1">Logged: ${Math.floor(b.studySeconds/60)}m</div>` : ''}</div>`;
            });
        }
        document.getElementById('slidePanelTotalTime').innerText = `${Math.floor(totalSecs/3600)}h ${Math.floor((totalSecs%3600)/60)}m`;
    }

    // 🚨 UPDATED: DYNAMIC CALENDAR HEATMAP!
    renderMonthCalendar() {
        const grid = document.getElementById('calendar-grid'); const label = document.getElementById('currentMonthLabel');
        if (!grid) return;

        grid.innerHTML = ''; label.innerText = this.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const year = this.currentMonth.getFullYear(); const month = this.currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) grid.innerHTML += `<div class="bg-gray-100 rounded-lg opacity-50"></div>`;
        const todayStr = this.getTodayStr(); 

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${(month+1).toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
            const dayBlocks = store.state.blocks.filter(b => b.startDate === dateStr);
            const dayExams = (store.state.exams || []).filter(e => e.date === dateStr);
            
            const isToday = dateStr === todayStr; const hasExam = dayExams.length > 0;
            const totalSecs = dayBlocks.reduce((sum, b) => sum + (b.studySeconds || 0), 0);
            const totalHours = totalSecs / 3600;

            // 🎯 NEW: HEATMAP COLOR LOGIC
            let bgClass = 'bg-white border border-gray-200 text-gray-700'; 
            if (hasExam) {
                bgClass = 'bg-red-600 shadow-md border-0 text-white'; 
            } else if (totalHours >= 6) {
                bgClass = 'bg-blue-600 shadow-md border-0 text-white'; // Heavy Study
            } else if (totalHours >= 3) {
                bgClass = 'bg-blue-300 border-0 text-blue-900'; // Medium Study
            } else if (totalHours > 0) {
                bgClass = 'bg-blue-100 border-0 text-blue-800'; // Light Study
            } else if (isToday) { 
                bgClass = 'bg-gray-50 border-2 border-blue-400 text-blue-700'; // Empty Today
            }

            let html = `
                <div class="${bgClass} rounded-lg p-2 cursor-pointer hover:shadow-md transition-all relative overflow-hidden flex flex-col h-24" data-date="${dateStr}">
                    <div class="flex justify-between items-center mb-1"><span class="font-bold">${day}</span></div>
                    <div class="flex-1 flex flex-col gap-1 overflow-hidden">`;
            
            if (hasExam) html += `<div class="bg-red-800 text-white text-[9px] px-1 rounded truncate font-bold shadow-sm">🚨 ${dayExams.length} Exam(s)</div>`;
            if (dayBlocks.length > 0) {
                if (totalSecs > 0) html += `<div class="bg-black/20 text-current text-[9px] px-1 rounded truncate font-bold shadow-sm">⏱️ ${Math.floor(totalSecs/3600)}h ${Math.floor((totalSecs%3600)/60)}m</div>`;
                html += `<div class="bg-white/40 text-current text-[9px] px-1 rounded truncate font-bold shadow-sm">📚 ${dayBlocks.length} Task(s)</div>`;
            }

            html += `</div></div>`;
            grid.insertAdjacentHTML('beforeend', html);
        }
    }

    renderBlocks() {
        const blocks = store.state.blocks; 
        if (!this.blocksLayer) return;
        Array.from(this.blocksLayer.children).forEach(child => { if (child !== this.currentTimeLine) child.remove(); });
        const baseLocal = new Date(this.baseDate.getFullYear(), this.baseDate.getMonth(), this.baseDate.getDate());

        blocks.forEach(b => {
            if(!b.startDate || !b.scheduledStart || !b.endDate || !b.scheduledEnd) return;
            let startObjReal, endObjReal;
            if (b.status === 'completed' && b.actualStart && b.actualEnd) { startObjReal = new Date(b.actualStart); endObjReal = new Date(b.actualEnd);
            } else { startObjReal = new Date(`${b.startDate}T${b.scheduledStart}:00`); endObjReal = new Date(`${b.endDate}T${b.scheduledEnd}:00`); }

            const bDateLocal = new Date(startObjReal.getFullYear(), startObjReal.getMonth(), startObjReal.getDate());
            const dayOffset = Math.round((bDateLocal - baseLocal) / 86400000); const topPx = (startObjReal.getHours() * 60) + startObjReal.getMinutes();
            let durationMins = (endObjReal - startObjReal) / 60000; if (durationMins <= 0) durationMins = 5; 

            const leftPx = 100800 + (dayOffset * this.dayWidth); const subColor = store.state.subjects[b.subject] || '#3b82f6';
            const pixelHeight = durationMins * this.zoom;

            const el = document.createElement('div');
            el.className = `ypt-block absolute rounded-lg text-white shadow-lg flex flex-col justify-between transition-all z-[45] ${b.status === 'completed' ? 'opacity-60 grayscale' : ''}`;
            el.style.left = `${leftPx + 4}px`; el.style.width = `${this.dayWidth - 8}px`; el.style.top = `calc(${topPx}px * var(--zoom))`; el.style.height = `calc(${durationMins}px * var(--zoom))`;
            el.style.backgroundColor = subColor; el.style.padding = '4px 6px'; el.style.overflow = 'hidden'; el.dataset.id = b.id;

            const totalSecs = (b.studySeconds || 0); const displayStart = startObjReal.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false}); const displayEnd = endObjReal.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', hour12: false});
            
            let actionHtml = ''; let actionBtnClass = pixelHeight < 50 ? 'absolute right-1 bottom-1 px-1.5 py-0.5 rounded text-[8px] leading-none' : 'w-full mt-1 py-0.5 rounded text-[9px]';
            let actionText = pixelHeight < 50 ? '▶' : '▶ START'; let finishText = pixelHeight < 50 ? '🏁' : '🏁 FINISH';

            if (b.status === 'completed') { actionHtml = `<div class="text-center text-[9px] bg-black/20 rounded py-0.5 mt-1 font-bold pointer-events-none ${pixelHeight < 50 ? 'hidden' : ''}">✅ Done</div>`;
            } else if (b.status === 'active') { actionHtml = `<button class="finish-btn bg-red-500 hover:bg-red-600 font-bold pointer-events-auto relative z-50 ${actionBtnClass}" data-id="${b.id}">${finishText}</button>`;
            } else { actionHtml = `<button class="play-btn bg-white/30 hover:bg-white/50 font-bold flex justify-center items-center pointer-events-auto relative z-50 ${actionBtnClass}" data-id="${b.id}">${actionText}</button>`; }

            let contentHtml = '';
            if (pixelHeight < 30) { contentHtml = `<div class="pointer-events-none z-10 flex-1 flex items-center min-h-0 pr-6"><div class="font-bold text-[10px] truncate drop-shadow-md w-full leading-tight">${b.title}</div></div>`;
            } else if (pixelHeight < 50) { contentHtml = `<div class="pointer-events-none z-10 flex-1 flex flex-col min-h-0 justify-center pr-6"><div class="font-bold text-[9px] truncate drop-shadow-md uppercase text-white/80 leading-tight">${b.subject || ''}</div><div class="font-bold text-[10px] truncate drop-shadow-md leading-tight">${b.title}</div></div>`;
            } else {
                contentHtml = `<div class="pointer-events-none z-10 flex-1 flex flex-col min-h-0"><div class="font-bold text-[10px] truncate drop-shadow-md pr-4 uppercase text-white/80">${b.subject || ''}</div><div class="font-bold text-xs truncate drop-shadow-md pr-4">${b.title}</div><div class="text-[9px] opacity-90 drop-shadow-md leading-tight mt-0.5">${displayStart} - ${displayEnd}</div></div><div class="mt-auto z-10 shrink-0 pointer-events-none">${totalSecs > 0 ? `<div class="text-[9px] font-mono font-bold bg-black/30 rounded px-1 text-center mb-0.5">⏱️ ${Math.floor(totalSecs/60)}m ${totalSecs%60}s</div>` : ''}</div>`;
            }
            el.innerHTML = `<button class="delete-btn absolute top-1 right-1 bg-red-600 hover:bg-red-800 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black pointer-events-auto shadow-md transition-transform hover:scale-125 z-50" data-id="${b.id}">X</button>${contentHtml}${actionHtml}`;
            this.blocksLayer.appendChild(el);
        });
    }
}
export const canvasUI = new CanvasUI();

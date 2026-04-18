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

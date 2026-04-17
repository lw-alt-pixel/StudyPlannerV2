// js/CanvasUI.js
import { store } from './State.js';
import { blockManager } from './BlockManager.js';
import { timerEngine } from './TimerEngine.js';

class CanvasUI {
    constructor() {
        this.panX = 10; 
        this.panY = -480; 
        this.zoom = 1;
        this.isPanning = false; this.startX = 0; this.startY = 0;
        this.hasDragged = false; 
        
        this.pxPerHour = 60; 
        this.dayWidth = 180;
        this.root = document.documentElement;
        
        this.baseDate = new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
        this.baseDate.setHours(0,0,0,0);
        
        this.currentMonth = new Date(this.baseDate);
        this.currentMonth.setDate(1); 
    }

    init() {
        this.container = document.getElementById('canvas-container');
        this.blocksLayer = document.getElementById('blocks-layer');
        this.daysLayer = document.getElementById('canvas-days');
        this.timesLayer = document.getElementById('canvas-times');
        
        if (!this.container) return;

        this.currentTimeLine = document.createElement('div');
        this.currentTimeLine.className = 'absolute left-0 w-[200000px] border-t-2 border-red-500 z-[40] pointer-events-none shadow-[0_0_8px_rgba(239,68,68,0.6)] transition-all';
        this.currentTimeLine.innerHTML = `<div class="bg-red-500 text-white text-[10px] px-2 font-bold rounded-r-full absolute -top-2.5 shadow-md">NOW</div>`;
        this.blocksLayer.appendChild(this.currentTimeLine);
        
        setInterval(() => this.updateCurrentTimeLine(), 60000); 
        this.updateCurrentTimeLine();

        this.drawGridLabels();
        this.bindEvents();
        this.enforceBoundsAndUpdate();
        
        const repaint = () => { this.renderBlocks(); this.renderMonthCalendar(); };
        store.subscribe('blocks', repaint);
        store.subscribe('exams', repaint);
        store.subscribe('subjects', repaint);
        repaint();
    }

    getChinaTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    }

    updateCurrentTimeLine() {
        const now = this.getChinaTime();
        const minsFromMidnight = (now.getHours() * 60) + now.getMinutes();
        this.currentTimeLine.style.top = `calc(${minsFromMidnight}px * var(--zoom))`;
    }

    switchView(viewMode) {
        const canvasView = document.getElementById('canvas-container');
        const calView = document.getElementById('calendar-container');
        const canvasCtrl = document.getElementById('canvasControls');
        const calCtrl = document.getElementById('calendarControls');
        const btnCanvas = document.getElementById('viewCanvasBtn');
        const btnCal = document.getElementById('viewCalendarBtn');

        if (viewMode === 'canvas') {
            canvasView.classList.replace('hidden', 'block');
            calView.classList.replace('flex', 'hidden');
            canvasCtrl.classList.replace('hidden', 'flex');
            calCtrl.classList.replace('flex', 'hidden');
            
            btnCanvas.className = "px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all text-blue-600";
            btnCal.className = "px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
        } else {
            canvasView.classList.replace('block', 'hidden');
            calView.classList.replace('hidden', 'flex');
            canvasCtrl.classList.replace('flex', 'hidden');
            calCtrl.classList.replace('hidden', 'flex');
            
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
            hEl.style.top = `calc(${i * 60}px * var(--zoom))`;
            hEl.innerText = `${i.toString().padStart(2, '0')}:00`;
            this.timesLayer.appendChild(hEl);

            if (i === 24) continue;
            let m30 = document.createElement('div');
            m30.className = 'absolute w-full text-center text-gray-400 font-medium text-[10px] time-label-fraction time-label-30';
            m30.style.top = `calc(${(i * 60) + 30}px * var(--zoom) - 6px)`;
            m30.innerText = `${i.toString().padStart(2, '0')}:30`;
            this.timesLayer.appendChild(m30);

            [15, 45].forEach(min => {
                let m15 = document.createElement('div');
                m15.className = 'absolute w-full text-center text-gray-300 font-normal text-[9px] time-label-fraction time-label-15';
                m15.style.top = `calc(${(i * 60) + min}px * var(--zoom) - 6px)`;
                m15.innerText = `${i.toString().padStart(2, '0')}:${min}`;
                this.timesLayer.appendChild(m15);
            });
        }

        this.daysLayer.innerHTML = '';
        for (let i = -30; i <= 60; i++) {
            let targetDate = new Date(this.baseDate);
            targetDate.setDate(this.baseDate.getDate() + i);
            const dateStr = targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
            
            const dayEl = document.createElement('div');
            dayEl.className = 'absolute text-center border-l border-gray-300 pl-2 bg-white/80 backdrop-blur';
            dayEl.style.left = `calc(100000px + ${i * this.dayWidth}px)`;
            dayEl.style.width = `${this.dayWidth}px`;
            
            dayEl.innerHTML = i === 0 ? `<span class="text-blue-600 font-black">⭐ Today</span> <br/> <span class="text-[10px] text-gray-500">${dateStr}</span>` 
                                      : `<span class="text-gray-700 font-bold">${dateStr}</span>`;
            this.daysLayer.appendChild(dayEl);
        }
    }

    enforceBoundsAndUpdate() {
        if (this.zoom >= 2) {
            this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)');
            this.root.style.setProperty('--grid-15', 'rgba(0,0,0,0.03)');
            this.container.classList.add('show-15-mins', 'show-30-mins');
        } else if (this.zoom >= 1.5) {
            this.root.style.setProperty('--grid-30', 'rgba(0,0,0,0.06)');
            this.root.style.setProperty('--grid-15', 'transparent');
            this.container.classList.add('show-30-mins');
            this.container.classList.remove('show-15-mins');
        } else {
            this.root.style.setProperty('--grid-30', 'transparent');
            this.root.style.setProperty('--grid-15', 'transparent');
            this.container.classList.remove('show-30-mins', 'show-15-mins');
        }

        const canvasHeight = 24 * 60 * this.zoom;
        const viewHeight = this.container.clientHeight; 
        const minPanY = Math.min(0, viewHeight - canvasHeight - 48); 
        this.panY = Math.max(minPanY, Math.min(0, this.panY));

        this.root.style.setProperty('--pan-x', `${this.panX}px`);
        this.root.style.setProperty('--pan-y', `${this.panY}px`);
        this.root.style.setProperty('--zoom', this.zoom);
    }

    bindEvents() {
        document.getElementById('viewCanvasBtn')?.addEventListener('click', () => this.switchView('canvas'));
        document.getElementById('viewCalendarBtn')?.addEventListener('click', () => this.switchView('calendar'));
        
        document.getElementById('prevMonthBtn')?.addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() - 1);
            this.renderMonthCalendar();
        });
        document.getElementById('nextMonthBtn')?.addEventListener('click', () => {
            this.currentMonth.setMonth(this.currentMonth.getMonth() + 1);
            this.renderMonthCalendar();
        });

        document.getElementById('calendar-grid')?.addEventListener('click', (e) => {
            const dayCard = e.target.closest('[data-date]');
            if (dayCard) this.openSlidePanel(dayCard.dataset.date);
        });
        document.getElementById('closeSlidePanel')?.addEventListener('click', () => {
            document.getElementById('daySlidePanel').classList.add('translate-x-full');
        });

        document.getElementById('prevDaysBtn')?.addEventListener('click', () => { this.panX += this.dayWidth * 3; this.enforceBoundsAndUpdate(); });
        document.getElementById('nextDaysBtn')?.addEventListener('click', () => { this.panX -= this.dayWidth * 3; this.enforceBoundsAndUpdate(); });
        document.getElementById('centerTodayBtn')?.addEventListener('click', () => { 
            this.panX = 10; 
            this.updateCurrentTimeLine(); 
            this.panY = -(parseFloat(this.currentTimeLine.style.top) || 480) + 200; 
            this.enforceBoundsAndUpdate(); 
        });

        this.container.addEventListener('pointerdown', (e) => {
            this.hasDragged = false; 
            
            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                const id = parseInt(deleteBtn.dataset.id);
                store.update('blocks', old => old.filter(b => b.id !== id));
                return;
            }

            const clickedBtn = e.target.closest('button');
            if (clickedBtn && clickedBtn.classList.contains('play-btn')) {
                const id = parseInt(clickedBtn.dataset.id);
                const block = store.state.blocks.find(b => b.id === id);
                const startTime = block.actualStart || this.getChinaTime().getTime();
                
                store.update('blocks', blocks => blocks.map(b => b.id === id ? { ...b, actualStart: startTime, status: 'active' } : b));
                store.update('timer', t => ({ 
                    ...t, activeBlockId: id, isRunning: true, studySeconds: block.studySeconds || 0, breakSeconds: block.breakSeconds || 0, secondsElapsed: block.studySeconds || 0
                }));
                timerEngine.start();
                document.querySelector('[data-tab="focus"]')?.click();
                return;
            }

            if (clickedBtn && clickedBtn.classList.contains('finish-btn')) {
                const id = parseInt(clickedBtn.dataset.id);
                store.update('blocks', blocks => blocks.map(b => b.id === id ? { ...b, actualEnd: this.getChinaTime().getTime(), status: 'completed' } : b));
                store.update('timer', t => ({ ...t, isRunning: false, activeBlockId: null }));
                timerEngine.stop();
                return;
            }

            if (!e.target.closest('.ypt-block')) {
                this.isPanning = true;
                this.startX = e.clientX - this.panX;
                this.startY = e.clientY - this.panY;
                this.container.classList.add('cursor-grabbing');
            }
        });

        window.addEventListener('pointermove', (e) => {
            if (this.isPanning) {
                this.hasDragged = true;
                this.panX = e.clientX - this.startX;
                this.panY = e.clientY - this.startY;
                this.enforceBoundsAndUpdate();
            }
        });

       window.addEventListener('pointerup', (e) => {
            if (this.isPanning) {
                this.isPanning = false;
                this.container.classList.remove('cursor-grabbing');
                
                if (!this.hasDragged && !e.target.closest('.ypt-block')) {
                    const rect = this.container.getBoundingClientRect();
                    const clickX = e.clientX - rect.left - 64; 
                    const clickY = e.clientY - rect.top - 48;  
                    
                    // FIX: REMOVED ZOOM DIVISION FROM X-AXIS MATH!
                    const gridX = (clickX - this.panX); 
                    const gridY = (clickY - this.panY) / this.zoom;

                    const dayOffset = Math.floor((gridX - 100000) / this.dayWidth);
                    
                    // FIX: Pure Date Generation, immune to Timezone jumps!
                    const targetLocal = new Date(this.baseDate.getFullYear(), this.baseDate.getMonth(), this.baseDate.getDate());
                    targetLocal.setDate(targetLocal.getDate() + dayOffset);
                    
                    const dateY = targetLocal.getFullYear();
                    const dateM = String(targetLocal.getMonth() + 1).padStart(2, '0');
                    const dateD = String(targetLocal.getDate()).padStart(2, '0');
                    const dateStr = `${dateY}-${dateM}-${dateD}`;

                    let snapInterval = 60; 
                    if (this.zoom >= 2.0) snapInterval = 15; 
                    else if (this.zoom >= 1.5) snapInterval = 30; 

                    let totalMins = Math.floor(gridY);
                    totalMins = Math.floor(totalMins / snapInterval) * snapInterval;
                    
                    if(totalMins < 0) totalMins = 0; 
                    if(totalMins > 1440 - snapInterval) totalMins = 1440 - snapInterval; 

                    const h = Math.floor(totalMins / 60).toString().padStart(2, '0');
                    const m = (totalMins % 60).toString().padStart(2, '0');
                    
                    blockManager.openModalWithPreFill(dateStr, `${h}:${m}`, snapInterval);
                }
            }
        });

        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey) {
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.zoom = Math.min(Math.max(0.7, this.zoom + delta), 3);
            } else {
                this.panX -= (e.deltaX * 0.5); 
                this.panY -= (e.deltaY * 0.5); 
            }
            this.enforceBoundsAndUpdate();
        }, { passive: false });
    }

    openSlidePanel(dateStr) {
        const panel = document.getElementById('daySlidePanel');
        panel.classList.remove('translate-x-full'); 
        
        const dObj = new Date(dateStr);
        document.getElementById('slidePanelDate').innerText = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

        const dayBlocks = store.state.blocks.filter(b => b.startDate === dateStr);
        const dayExams = (store.state.exams || []).filter(e => e.date === dateStr);

        let totalSecs = 0;
        const blocksContainer = document.getElementById('slidePanelBlocks');
        blocksContainer.innerHTML = '';

        if (dayExams.length > 0) {
            dayExams.forEach(ex => {
                const subColor = store.state.subjects[ex.subject] || '#dc2626';
                blocksContainer.innerHTML += `
                    <div class="bg-white border p-3 rounded-lg shadow-sm" style="border-left: 4px solid ${subColor}">
                        <div class="font-black text-xs uppercase mb-1" style="color: ${subColor}">🚨 EXAM DEADLINE</div>
                        <div class="font-bold text-gray-800">${ex.title}</div>
                        <div class="text-xs text-gray-500 mt-1">Scheduled Time: ${ex.time}</div>
                    </div>
                `;
            });
        }

        if (dayBlocks.length === 0 && dayExams.length === 0) {
            blocksContainer.innerHTML = `<div class="text-gray-400 text-sm text-center mt-4 font-bold">No tasks scheduled.</div>`;
        } else {
            dayBlocks.sort((a,b) => a.scheduledStart.localeCompare(b.scheduledStart)).forEach(b => {
                totalSecs += (b.studySeconds || 0);
                const statusHtml = b.status === 'completed' ? `<span class="text-green-600 text-[10px] font-black uppercase">✅ Done</span>` : `<span class="text-blue-500 text-[10px] font-black uppercase">▶ Active</span>`;
                const subColor = store.state.subjects[b.subject] || '#3b82f6';
                
                blocksContainer.innerHTML += `
                    <div class="bg-white border p-3 rounded-lg shadow-sm flex flex-col gap-1" style="border-left: 4px solid ${subColor}">
                        <div class="flex justify-between items-start">
                            <div class="font-bold text-gray-800 text-sm">${b.title}</div>
                            ${statusHtml}
                        </div>
                        <div class="text-xs font-bold text-gray-500">${b.scheduledStart} - ${b.scheduledEnd}</div>
                        ${b.studySeconds > 0 ? `<div class="text-xs font-mono font-bold text-blue-600 bg-blue-50 w-fit px-2 py-0.5 rounded mt-1">Logged: ${Math.floor(b.studySeconds/60)}m</div>` : ''}
                    </div>
                `;
            });
        }
        document.getElementById('slidePanelTotalTime').innerText = `${Math.floor(totalSecs/3600)}h ${Math.floor((totalSecs%3600)/60)}m`;
    }

    renderMonthCalendar() {
        const grid = document.getElementById('calendar-grid');
        const label = document.getElementById('currentMonthLabel');
        if (!grid) return;

        grid.innerHTML = '';
        label.innerText = this.currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        const year = this.currentMonth.getFullYear();
        const month = this.currentMonth.getMonth();
        const firstDay = new Date(year, month, 1).getDay(); 
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        for (let i = 0; i < firstDay; i++) {
            grid.innerHTML += `<div class="bg-gray-100 rounded-lg opacity-50"></div>`;
        }

        const todayStr = this.getChinaTime().toISOString().split('T')[0];

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${(month+1).toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
            
            const dayBlocks = store.state.blocks.filter(b => b.startDate === dateStr);
            const dayExams = (store.state.exams || []).filter(e => e.date === dateStr);
            
            const isToday = dateStr === todayStr;
            const hasExam = dayExams.length > 0;
            
            let bgClass = 'bg-white border border-gray-200';
            let inlineStyle = '';
            
            if (hasExam) {
                const subColor = store.state.subjects[dayExams[0].subject] || '#dc2626';
                bgClass = 'shadow-md border-0';
                inlineStyle = `background-color: ${subColor}; color: white;`;
            } else if (isToday) {
                bgClass = 'bg-blue-50 border-2 border-blue-400 text-blue-700';
            } else {
                bgClass = 'bg-white border border-gray-200 text-gray-700';
            }

            let html = `
                <div class="${bgClass} rounded-lg p-2 cursor-pointer hover:shadow-md transition-all relative overflow-hidden flex flex-col h-24" style="${inlineStyle}" data-date="${dateStr}">
                    <div class="flex justify-between items-center mb-1">
                        <span class="font-bold">${day}</span>
                    </div>
                    <div class="flex-1 flex flex-col gap-1 overflow-hidden">
            `;
            
            if (hasExam) {
                html += `<div class="bg-black/20 text-white text-[9px] px-1 rounded truncate font-bold shadow-sm">🚨 ${dayExams.length} Exam(s)</div>`;
            }
            
            if (dayBlocks.length > 0) {
                const totalSecs = dayBlocks.reduce((sum, b) => sum + (b.studySeconds || 0), 0);
                if (totalSecs > 0) {
                    html += `<div class="bg-green-100 text-green-800 text-[9px] px-1 rounded truncate font-bold shadow-sm">⏱️ ${Math.floor(totalSecs/3600)}h ${Math.floor((totalSecs%3600)/60)}m</div>`;
                }
                html += `<div class="bg-blue-100 text-blue-800 text-[9px] px-1 rounded truncate font-bold shadow-sm">📚 ${dayBlocks.length} Task(s)</div>`;
            }

            html += `</div></div>`;
            grid.insertAdjacentHTML('beforeend', html);
        }
    }

    renderBlocks() {
        const blocks = store.state.blocks;
        const exams = store.state.exams || [];
        
        if (!this.blocksLayer) return;
        
        Array.from(this.blocksLayer.children).forEach(child => {
            if (child !== this.currentTimeLine) child.remove();
        });

        // FIX: Timezone-immune pure day calculation!
        const baseLocal = new Date(this.baseDate.getFullYear(), this.baseDate.getMonth(), this.baseDate.getDate());

        exams.forEach(ex => {
            if(!ex.date || !ex.time) return;
            
            // Generate perfectly exact Day Offsets matching the grid calculation
            const [eY, eM, eD] = ex.date.split('-').map(Number);
            const exDateLocal = new Date(eY, eM - 1, eD);
            const dayOffset = Math.round((exDateLocal - baseLocal) / 86400000);
            
            const [eH, eM_val] = ex.time.split(':').map(Number);
            const topPx = (eH * 60) + eM_val;
            const leftPx = 100000 + (dayOffset * this.dayWidth);

            const subColor = store.state.subjects[ex.subject] || '#dc2626';

            const lineEl = document.createElement('div');
            lineEl.className = 'absolute border-l-4 z-[30] pointer-events-none drop-shadow-md opacity-80';
            lineEl.style.left = `${leftPx}px`;
            lineEl.style.top = `calc(${topPx}px * var(--zoom))`;
            lineEl.style.height = `calc(1440px * var(--zoom))`; 
            lineEl.style.borderColor = subColor;
            
            lineEl.innerHTML = `
                <div class="absolute top-0 left-2 text-white text-[10px] px-2 py-0.5 rounded font-black whitespace-nowrap" style="background-color: ${subColor}">
                    🚨 EXAM: ${ex.title} @ ${ex.time}
                </div>
            `;
            this.blocksLayer.appendChild(lineEl);
        });

        blocks.forEach(b => {
            if(!b.startDate || !b.scheduledStart || !b.endDate || !b.scheduledEnd) return;

            // Generate perfectly exact Day Offsets matching the grid calculation
            const [bY, bM, bD] = b.startDate.split('-').map(Number);
            const bDateLocal = new Date(bY, bM - 1, bD);
            const dayOffset = Math.round((bDateLocal - baseLocal) / 86400000);
            
            const [sH, sM] = b.scheduledStart.split(':').map(Number);
            const topPx = (sH * 60) + sM;
            
            // Duration relies purely on total time differences, immune to timezones
            const startStr = `${b.startDate}T${b.scheduledStart}:00`;
            const endStr = `${b.endDate}T${b.scheduledEnd}:00`;
            const startObjReal = new Date(startStr);
            const endObjReal = new Date(endStr);
            let durationMins = (endObjReal - startObjReal) / 60000;
            if (durationMins <= 0) durationMins = 60; 

            const leftPx = 100000 + (dayOffset * this.dayWidth);
            const el = document.createElement('div');

            const subColor = store.state.subjects[b.subject] || '#3b82f6';

            el.className = `ypt-block absolute rounded-lg text-white shadow-lg flex flex-col justify-between transition-all ${b.status === 'completed' ? 'opacity-60 grayscale' : ''} z-[35]`;
            el.style.left = `${leftPx + 4}px`;
            el.style.width = `${this.dayWidth - 8}px`; 
            el.style.top = `calc(${topPx}px * var(--zoom))`;
            el.style.height = `calc(${durationMins}px * var(--zoom))`;
            el.style.backgroundColor = subColor;
            el.style.padding = '4px 6px';
            el.style.overflow = 'hidden';

            const totalSecs = (b.studySeconds || 0); 
            
            let actionHtml = '';
            if (b.status === 'completed') {
                actionHtml = `<div class="text-center text-[9px] bg-black/20 rounded py-0.5 mt-1 font-bold">✅ Done</div>`;
            } else if (b.status === 'active') {
                actionHtml = `<button class="finish-btn bg-red-500 hover:bg-red-600 rounded text-[9px] font-bold py-0.5 w-full mt-1 pointer-events-auto" data-id="${b.id}">🏁 FINISH</button>`;
            } else {
                actionHtml = `<button class="play-btn bg-white/30 hover:bg-white/50 rounded text-[9px] font-bold py-0.5 w-full mt-1 flex justify-center items-center pointer-events-auto" data-id="${b.id}">▶ START</button>`;
            }

            el.innerHTML = `
                <button class="delete-btn absolute top-1 right-1 bg-red-600 hover:bg-red-800 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] font-black pointer-events-auto shadow-md transition-transform hover:scale-125 z-50" data-id="${b.id}">X</button>
                <div class="pointer-events-none z-10 flex-1 flex flex-col min-h-0">
                    <div class="font-bold text-[10px] truncate drop-shadow-md pr-4 uppercase text-white/80">${b.subject || ''}</div>
                    <div class="font-bold text-xs truncate drop-shadow-md pr-4">${b.title}</div>
                    <div class="text-[9px] opacity-90 drop-shadow-md leading-tight">${b.scheduledStart} - ${b.scheduledEnd}</div>
                </div>
                <div class="mt-auto z-10 shrink-0">
                    ${totalSecs > 0 ? `<div class="text-[9px] font-mono font-bold bg-black/30 rounded px-1 text-center mb-0.5">⏱️ ${Math.floor(totalSecs/60)}m ${totalSecs%60}s</div>` : ''}
                    ${actionHtml}
                </div>
            `;
            this.blocksLayer.appendChild(el);
        });
    }
}

export const canvasUI = new CanvasUI();

// js/CalendarUI.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';

class CalendarUI {
    init() {
        this.calendarGrid = document.getElementById('calendar-grid');
        this.calendarDisplay = document.getElementById('currentMonthLabel');
        this.calendarContainer = document.getElementById('calendar-container');

        this.baseDate = this.getChinaTime(); this.baseDate.setHours(0,0,0,0);
        this.currentMonth = new Date(this.baseDate); this.currentMonth.setDate(1); 
        this.currentSlideDate = null;

        store.subscribe('blocks', () => {
            if (this.calendarGrid && !this.calendarContainer.classList.contains('hidden')) {
                this.renderCalendar();
            }
            if (this.currentSlideDate) this.renderSlidePanelBlocks(this.currentSlideDate);
        });

        this.bindEvents();
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }
    formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

    bindEvents() {
        document.getElementById('prevMonthBtn')?.addEventListener('click', () => { this.currentMonth.setMonth(this.currentMonth.getMonth() - 1); this.renderCalendar(); });
        document.getElementById('nextMonthBtn')?.addEventListener('click', () => { this.currentMonth.setMonth(this.currentMonth.getMonth() + 1); this.renderCalendar(); });

        document.getElementById('viewCalendarBtn')?.addEventListener('click', () => {
            const vc = document.getElementById('canvas-container'); if(vc) vc.classList.add('hidden');
            this.calendarContainer?.classList.remove('hidden'); this.calendarContainer?.classList.add('flex');
            
            document.getElementById('canvasControls')?.classList.add('hidden'); document.getElementById('canvasControls')?.classList.remove('flex');
            document.getElementById('calendarControls')?.classList.remove('hidden'); document.getElementById('calendarControls')?.classList.add('flex');
            
            document.getElementById('viewCalendarBtn').className = "px-4 py-1 rounded shadow bg-white font-bold text-sm transition-all text-theme-action";
            document.getElementById('viewCanvasBtn').className = "px-4 py-1 rounded text-gray-500 font-bold text-sm transition-all hover:text-gray-700";
            
            this.renderCalendar();
        });

        // Slide panel close handlers
        document.getElementById('closeSlidePanel')?.addEventListener('click', () => {
            const panel = document.getElementById('daySlidePanel');
            const overlay = document.getElementById('diaryOverlay');
            if (panel) panel.classList.add('translate-x-full');
            if (overlay) overlay.classList.add('hidden');
            this.currentSlideDate = null;
        });

        document.getElementById('diaryOverlay')?.addEventListener('click', () => {
            const panel = document.getElementById('daySlidePanel');
            const overlay = document.getElementById('diaryOverlay');
            if (panel) panel.classList.add('translate-x-full');
            if (overlay) overlay.classList.add('hidden');
            this.currentSlideDate = null;
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
            
            cell.addEventListener('click', () => this.openSlidePanelForDate(dateStr));
            this.calendarGrid.appendChild(cell);
        }
    }

    openSlidePanelForDate(dateStr) {
        this.currentSlideDate = dateStr;
        const panel = document.getElementById('daySlidePanel');
        const overlay = document.getElementById('diaryOverlay');
        if (!panel || !overlay) return;

        const dateObj = new Date(dateStr + "T00:00:00");
        const titleEl = document.getElementById('slidePanelDate');
        if(titleEl) titleEl.innerText = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        this.renderSlidePanelBlocks(dateStr);
        this.renderSlidePanelDiary(dateStr);

        panel.classList.remove('translate-x-full'); overlay.classList.remove('hidden');
    }

    renderSlidePanelBlocks(dateStr) {
        const container = document.getElementById('slidePanelBlocks');
        const totalEl = document.getElementById('slidePanelTotalTime');
        if (!container) return;

        const blocks = store.state.blocks.filter(b => b.startDate === dateStr || b.date === dateStr);
        blocks.sort((a, b) => (a.scheduledStart || "00:00").localeCompare(b.scheduledStart || "00:00"));

        let totalSecs = 0; container.innerHTML = '';
        if (blocks.length === 0) container.innerHTML = '<div class="text-xs text-gray-400 font-bold text-center italic py-4">No blocks scheduled.</div>';
        else {
            blocks.forEach(b => {
                if (b.status === 'completed' || b.studySeconds > 0) totalSecs += (b.studySeconds || 0);
                const subColor = store.state.subjects[b.subject] || '#3b82f6';
                const opacity = b.status === 'completed' ? 'opacity-50' : '';
                
                const cleanTime = (t) => t ? t.split(':').slice(0, 2).join(':') : "??:??";
                const sTime = cleanTime(b.scheduledStart || b.actualStart);
                const eTime = cleanTime(b.scheduledEnd || b.actualEnd);

                container.innerHTML += `
                    <div class="agenda-item relative flex items-center gap-3 p-2 bg-white rounded border shadow-sm cursor-pointer hover:bg-gray-50 transition-colors ${opacity}" data-id="${b.id}">
                        <div class="w-3 h-full rounded-l absolute left-0 top-0 bottom-0" style="background-color: ${subColor}"></div>
                        <div class="flex-1 pl-4 pr-16 truncate">
                            <div class="text-[10px] font-black text-gray-400">${sTime} - ${eTime}</div>
                            <div class="text-sm font-bold text-gray-800 truncate">${b.title || b.subject || 'Focus'}</div>
                        </div>
                        ${b.status === 'completed' || b.studySeconds > 0 ? `<div class="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded mr-16">✓ ${Math.floor((b.studySeconds||0)/60)}m</div>` : ''}
                        
                        <button class="run-btn absolute right-10 bg-white text-gray-800 hover:bg-gray-100 rounded px-2 py-1 text-xs font-black shadow border border-gray-200 z-20">▶️</button>
                        <button class="delete-btn absolute right-2 bg-red-100 hover:bg-red-200 text-red-600 rounded px-2 py-1 text-xs font-black z-20">X</button>
                    </div>
                `;
            });
        }
        if (totalEl) totalEl.innerText = `${Math.floor(totalSecs / 3600)}h ${Math.floor((totalSecs % 3600) / 60)}m`;

        container.onclick = (e) => {
            const item = e.target.closest('.agenda-item');
            if (!item || !item.dataset.id) return;
            
            if (e.target.closest('.delete-btn')) {
                e.stopPropagation();
                if (confirm("Delete block?")) store.update('blocks', old => old.filter(x => x.id !== item.dataset.id));
                return;
            }
            if (e.target.closest('.run-btn')) {
                e.stopPropagation();
                const b = store.state.blocks.find(x => x.id === item.dataset.id);
                if(b) {
                    store.update('timer', t => ({ ...t, activeBlockId: b.id, spontaneousSubject: b.subject, mode: 'pomodoro', phase: 'study', studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: true }));
                    timerEngine.start(); document.querySelector('.tab-btn[data-tab="focus"]')?.click();
                    document.getElementById('closeSlidePanel')?.click();
                }
                return;
            }
            // Trigger edit modal globally
            const b = store.state.blocks.find(x => x.id === item.dataset.id);
            if (b) {
                const safeSet = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
                safeSet('editBlockSubject', b.subject || ''); safeSet('editBlockTitle', b.title || '');
                safeSet('editBlockSchedStartDate', b.startDate || b.date || '');
                safeSet('editBlockSchedStart', b.scheduledStart ? b.scheduledStart.split(':').slice(0, 2).join(':') : "");
                safeSet('editBlockSchedEndDate', b.endDate || b.startDate || b.date || '');
                safeSet('editBlockSchedEnd', b.scheduledEnd ? b.scheduledEnd.split(':').slice(0, 2).join(':') : "");
                safeSet('editBlockRemarks', b.remarks || '');
                
                document.getElementById('saveEditBlock').dataset.id = b.id;
                document.getElementById('editBlockModal')?.classList.remove('hidden');
            }
        };
    }

    renderSlidePanelDiary(dateStr) {
        const diaryEl = document.getElementById('slidePanelDiary');
        if (!diaryEl) return;
        diaryEl.value = store.state.diaries[dateStr] || '';
        diaryEl.oninput = (e) => store.update('diaries', d => ({ ...d, [dateStr]: e.target.value }));
    }
}
export const calendarUI = new CalendarUI();

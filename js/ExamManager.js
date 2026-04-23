// js/ExamManager.js
import { store } from './State.js';

class ExamManager {
    init() {
        this.listEl = document.getElementById('examsList');
        this.bannerEl = document.getElementById('globalExamBanner');
        this.bannerText = document.getElementById('bannerText');
        this.modal = document.getElementById('addExamModal');
        
        this.subjectInput = document.getElementById('newExamSubject');

        store.subscribe('subjects', () => this.populateSubjects());
        this.populateSubjects();
        
        this.bindEvents();
        
        store.subscribe('theme', () => this.updateBannerStyle());
        this.updateBannerStyle();

        store.subscribe('exams', () => this.render());
        this.render();

        setInterval(() => this.updateLiveCountdown(), 1000);
    }

    updateBannerStyle() {
        const theme = store.state.theme;
        this.bannerEl.style.backgroundColor = theme.bannerBgColor || '#dc2626';
        this.bannerEl.style.color = theme.bannerTextColor || '#ffffff';
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }

    populateSubjects() {
        if (!this.subjectInput) return;
        const allSubs = store.state.subjects || {};
        const activeMap = store.state.subjectsActive || {};
        const subs = Object.keys(allSubs).filter(s => activeMap[s] !== false).reduce((acc,k)=>{acc[k]=allSubs[k];return acc;},{ });
        this.subjectInput.innerHTML = '';
        Object.keys(subs).forEach(s => {
            const opt = document.createElement('option'); opt.value = s; opt.text = s; if (subs[s]) opt.dataset.color = subs[s]; this.subjectInput.appendChild(opt);
        });
        // Show color chip on select
        const setColor = (sel) => {
            const v = sel.value; const color = (subs && subs[v]) ? subs[v] : '';
            if (color) sel.style.backgroundImage = `linear-gradient(to right, ${color} 0 22px, transparent 22px)`; else sel.style.backgroundImage = '';
        };
        this.subjectInput.addEventListener('change', () => setColor(this.subjectInput));
        setColor(this.subjectInput);
    }

    bindEvents() {
        // Subject must be chosen from existing subjects only.

        document.getElementById('openAddExamBtn')?.addEventListener('click', () => this.modal?.classList.remove('hidden'));
        document.getElementById('cancelAddExam')?.addEventListener('click', () => this.modal?.classList.add('hidden'));

        document.getElementById('saveNewExam')?.addEventListener('click', () => {
            const title = document.getElementById('newExamTitle').value || 'Final Exam';
            const subject = this.subjectInput.value || null;
            const date = document.getElementById('newExamDate').value;
            const time = document.getElementById('newExamTime').value || '09:00';

            if (!date) return alert("Please select a date!");

            const newExam = { id: 'exam_' + Date.now(), title, subject, date, time };
            store.update('exams', ex => [...ex, newExam]);
            this.modal?.classList.add('hidden');
        });
}
    generateEbbinghaus(examId) {
        const ex = store.state.exams.find(e => e.id === examId);
        if(!ex) return;
        
        const examDate = new Date(`${ex.date}T${ex.time}:00`);
        const today = this.getChinaTime();
        
        // Classic Ebbinghaus Intervals: 1, 2, 4, 7, 15, 30 days BEFORE the exam
        const intervals = [1, 2, 4, 7, 15, 30];
        const newBlocks = [];
        
        intervals.forEach(days => {
            const reviewDate = new Date(examDate.getTime() - (days * 86400000));
            if (reviewDate < today) return; // Skip if interval is in the past

            const dateStr = reviewDate.toISOString().split('T')[0];
            
            // 🚨 Generate Real Study Blocks!
            newBlocks.push({
                id: 'ebbinghaus_' + Date.now() + Math.random().toString(36).substr(2, 5),
                subject: ex.subject,
                title: `[Review] ${ex.title}`,
                startDate: dateStr,
                endDate: dateStr,
                scheduledStart: "18:00", // Default to Evening Review
                scheduledEnd: "19:00",
                status: 'pending',
                studySeconds: 0, breakSeconds: 0, remarks: 'Spaced Repetition Generator'
            });
        });

        if(newBlocks.length > 0) {
            store.update('blocks', old => [...old, ...newBlocks]);
            alert(`Successfully injected ${newBlocks.length} Ebbinghaus ghost blocks into your schedule!`);
        } else {
            alert("Exam is too close (or past) to generate future review blocks.");
        }
    }

    render() {
        if (!this.listEl) return;
        this.listEl.innerHTML = '';
        const exams = store.state.exams || [];
        const today = this.getChinaTime(); today.setHours(0,0,0,0);

        exams.forEach(ex => {
            const examDate = new Date(`${ex.date}T${ex.time}:00`);
            const daysLeft = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
            const subColor = store.state.subjects[ex.subject] || '#dc2626';

            let opacityClass = daysLeft < 0 ? 'opacity-50 grayscale' : '';
            let countdownText = daysLeft < 0 ? 'Passed' : daysLeft === 0 ? 'TODAY!' : daysLeft + ' Days';

            const card = document.createElement('div');
            card.className = `bg-white border p-4 rounded-xl shadow-sm relative ${opacityClass}`;
            card.style.borderLeft = `6px solid ${subColor}`;
            
            card.innerHTML = `
                <div class="absolute top-2 right-2 flex gap-2">
                    <button class="ebbinghaus-btn text-[10px] bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-0.5 rounded font-black shadow-sm transition-colors" data-id="${ex.id}">EBBINGHAUS</button>
                    <button class="delete-exam text-gray-400 hover:text-red-600 font-black" data-id="${ex.id}">&times;</button>
                </div>
                <h3 class="text-lg font-black pr-24 truncate" style="color: ${subColor}">${ex.title}</h3>
                <p class="text-sm font-bold text-gray-500 mb-2">${ex.subject}</p>
                <div class="flex justify-between items-end">
                    <div>
                        <div class="text-xs text-gray-400 uppercase font-black">Scheduled</div>
                        <div class="font-mono text-gray-700 font-bold">${ex.date} @ ${ex.time}</div>
                    </div>
                    <div class="bg-red-50 text-red-700 font-black px-3 py-1 rounded-lg text-lg shadow-inner">${countdownText}</div>
                </div>
            `;

            card.querySelector('.delete-exam').onclick = (e) => {
                if(confirm("Delete this exam?")) store.update('exams', old => old.filter(x => x.id !== e.target.dataset.id));
            };
            card.querySelector('.ebbinghaus-btn').onclick = (e) => {
                this.generateEbbinghaus(e.target.dataset.id);
            };

            this.listEl.appendChild(card);
        });
    }

    updateLiveCountdown() {
        if (!this.bannerEl || !this.bannerText) return;
        const exams = store.state.exams || [];
        if (exams.length === 0) { this.bannerEl.classList.add('hidden'); return; }

        const now = this.getChinaTime();
        let closest = null; let minDiff = Infinity;

        exams.forEach(ex => {
            const d = new Date(`${ex.date}T${ex.time}:00`);
            const diff = d - now;
            if (diff > 0 && diff < minDiff) { minDiff = diff; closest = ex; }
        });

        if (!closest) { this.bannerEl.classList.add('hidden'); return; }

        const days = Math.floor(minDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((minDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((minDiff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((minDiff % (1000 * 60)) / 1000);

        this.bannerText.innerText = `${closest.title} IN: ${days}d ${hours}h ${mins}m ${secs}s`;
        this.bannerEl.classList.remove('hidden');
        this.bannerEl.classList.add('flex');
    }
}
export const examManager = new ExamManager();

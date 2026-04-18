// js/ExamManager.js
import { store } from './State.js';

class ExamManager {
    init() {
        this.listEl = document.getElementById('examsList');
        this.bannerEl = document.getElementById('globalExamBanner');
        this.bannerText = document.getElementById('bannerText');
        this.modal = document.getElementById('addExamModal');
        
        this.subjectInput = document.getElementById('newExamSubject');
        this.customSubjectDiv = document.getElementById('newExamCustomSubjectDiv');
        this.customNameInput = document.getElementById('newExamCustomName');
        this.customColorInput = document.getElementById('newExamCustomColor');

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
        const subs = store.state.subjects;
        this.subjectInput.innerHTML = '';
        Object.keys(subs).forEach(sub => {
            this.subjectInput.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
        this.subjectInput.innerHTML += `<option value="Other">📌 Other (New Subject)</option>`;
        
        this.subjectInput.addEventListener('change', (e) => {
            if (e.target.value === 'Other') this.customSubjectDiv.classList.remove('hidden');
            else this.customSubjectDiv.classList.add('hidden');
        });
    }

    bindEvents() {
        document.getElementById('openAddExamBtn')?.addEventListener('click', () => {
            this.customSubjectDiv?.classList.add('hidden');
            this.modal.classList.remove('hidden');
        });
        document.getElementById('cancelAddExam')?.addEventListener('click', () => this.modal.classList.add('hidden'));
        document.getElementById('saveNewExam')?.addEventListener('click', () => this.saveExam());

        this.listEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-exam')) {
                const id = parseInt(e.target.dataset.id);
                store.update('exams', ex => ex.filter(x => x.id !== id));
            }
        });
    }

    // 🚨 EBBINGHAUS ALGORITHM INTEGRATED HERE
    saveExam() {
        let finalSubject = this.subjectInput.value;
        if (finalSubject === 'Other') {
            finalSubject = this.customNameInput?.value.trim() || 'Custom Exam Subject';
            const newColor = this.customColorInput?.value || '#dc2626';
            store.update('subjects', subs => ({...subs, [finalSubject]: newColor}));
        }

        const title = document.getElementById('newExamTitle').value.trim() || 'Final Exam';
        const dateStr = document.getElementById('newExamDate').value;
        const timeStr = document.getElementById('newExamTime').value;

        if (!dateStr || !timeStr) return alert("Please select a date and time!");

        const newExam = { id: Date.now(), subject: finalSubject, title: title, date: dateStr, time: timeStr };
        store.update('exams', old => [...old, newExam]);

        // 🚨 CHECK FOR EBBINGHAUS
        const doEbbinghaus = document.getElementById('newExamEbbinghaus')?.checked;
        if (doEbbinghaus) {
            const today = this.getChinaTime(); today.setHours(0,0,0,0);
            const examDate = new Date(`${dateStr}T00:00:00`);
            
            // Generate standard curve: Day 1, Day 3, Day 7, Day Before
            const intervals = [1, 3, 7];
            const newBlocks = [];
            
            intervals.forEach(days => {
                const rDate = new Date(today.getTime() + days * 86400000);
                if (rDate < examDate) {
                    const rStr = rDate.toISOString().split('T')[0];
                    newBlocks.push(this.createEbbBlock(finalSubject, title, rStr, `Review (Day ${days})`));
                }
            });

            // Always add a "Cram" day the day before
            const cramDate = new Date(examDate.getTime() - 86400000);
            if (cramDate > today) {
                const cramStr = cramDate.toISOString().split('T')[0];
                newBlocks.push(this.createEbbBlock(finalSubject, title, cramStr, "Final Review"));
            }

            if (newBlocks.length > 0) store.update('blocks', old => [...old, ...newBlocks]);
        }

        this.modal.classList.add('hidden');
    }

    createEbbBlock(subject, examTitle, dateStr, topic) {
        return {
            id: Date.now() + Math.floor(Math.random()*10000), 
            subject: subject, title: `Ebbinghaus: ${examTitle} - ${topic}`,
            startDate: dateStr, scheduledStart: "16:00", // Defaults to 4PM
            endDate: dateStr, scheduledEnd: "17:00", // 1 Hour default
            actualStart: null, actualEnd: null, status: 'pending', studySeconds: 0, breakSeconds: 0, remarks: ''
        };
    }

    updateLiveCountdown() {
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

        const d = Math.floor(minDiff / (1000 * 60 * 60 * 24));
        const h = Math.floor((minDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((minDiff % (1000 * 60 * 60)) / (1000 * 60));

        let txt = `UPCOMING EXAM: ${closest.title} in `;
        if (d > 0) txt += `${d}d ${h}h`; else if (h > 0) txt += `${h}h ${m}m`; else txt += `${m}m!!`;

        this.bannerText.innerText = txt;
        this.bannerEl.classList.remove('hidden');
    }

    render() {
        const exams = store.state.exams;
        this.listEl.innerHTML = '';
        const today = this.getChinaTime(); today.setHours(0,0,0,0);

        exams.forEach(ex => {
            const examDate = new Date(`${ex.date}T${ex.time}:00`);
            const daysLeft = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
            const subColor = store.state.subjects[ex.subject] || '#dc2626';

            let opacityClass = daysLeft < 0 ? 'opacity-50 grayscale' : '';
            let countdownText = daysLeft < 0 ? 'Passed' : daysLeft === 0 ? 'TODAY!' : daysLeft + ' Days';

            this.listEl.innerHTML += `
                <div class="bg-white border p-4 rounded-xl shadow-sm relative ${opacityClass}" style="border-left: 6px solid ${subColor}">
                    <button class="delete-exam absolute top-2 right-2 text-gray-400 hover:text-red-600 font-bold" data-id="${ex.id}">&times;</button>
                    <h3 class="text-lg font-black pr-6 truncate" style="color: ${subColor}">${ex.title}</h3>
                    <p class="text-sm font-bold text-gray-500 mb-2">${ex.subject}</p>
                    <div class="flex justify-between items-end">
                        <div>
                            <div class="text-xs text-gray-400 uppercase font-black">Scheduled Date</div>
                            <div class="font-mono text-gray-700 font-bold">${ex.date} @ ${ex.time}</div>
                        </div>
                        <div class="bg-red-50 text-red-700 px-3 py-1 rounded font-black shadow-sm">${countdownText}</div>
                    </div>
                </div>
            `;
        });
    }
}
export const examManager = new ExamManager();

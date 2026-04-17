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
        
        // Listen for Theme Updates to change banner color!
        store.subscribe('theme', () => this.updateBannerStyle());
        this.updateBannerStyle();

        store.subscribe('exams', () => this.render());
        this.render();

        // 1-Second Ticking Clock Engine
        setInterval(() => this.updateLiveCountdown(), 1000);
    }

    updateBannerStyle() {
        const theme = store.state.theme;
        this.bannerEl.style.backgroundColor = theme.bannerBgColor || '#dc2626';
        this.bannerEl.style.color = theme.bannerTextColor || '#ffffff';
    }

    getChinaTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    }

    updateLiveCountdown() {
        const exams = store.state.exams;
        if (!exams || exams.length === 0) {
            this.bannerEl.classList.add('hidden');
            return;
        }

        const now = this.getChinaTime();
        let closestFutureExam = null;
        let minDiff = Infinity;

        exams.forEach(ex => {
            const examDate = new Date(`${ex.date}T${ex.time}:00`);
            const msLeft = examDate - now;
            
            if (msLeft > -86400000 && msLeft < minDiff) { 
                minDiff = msLeft;
                closestFutureExam = { ...ex, msLeft };
            }
        });

        if (closestFutureExam) {
            this.bannerEl.classList.remove('hidden');
            if (closestFutureExam.msLeft < 0) {
                this.bannerText.innerText = `🚨 EXAM IN PROGRESS: ${closestFutureExam.title} 🚨`;
            } else {
                // Calculate precise live time!
                const d = Math.floor(closestFutureExam.msLeft / (1000 * 60 * 60 * 24));
                const h = Math.floor((closestFutureExam.msLeft / (1000 * 60 * 60)) % 24);
                const m = Math.floor((closestFutureExam.msLeft / 1000 / 60) % 60);
                const s = Math.floor((closestFutureExam.msLeft / 1000) % 60);
                
                this.bannerText.innerText = `Next Exam: ${closestFutureExam.title} in ${d} Days : ${h} Hours : ${m} Mins : ${s} Secs`;
            }
        } else {
            this.bannerEl.classList.add('hidden');
        }
    }

    populateSubjects() {
        const subs = store.state.subjects;
        this.subjectInput.innerHTML = '';
        Object.keys(subs).forEach(sub => {
            this.subjectInput.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
        this.subjectInput.innerHTML += `<option value="Other">📌 Other (New Subject)</option>`;
        
        this.customSubjectDiv.classList.add('hidden');
        this.customSubjectDiv.classList.remove('flex');
    }

    bindEvents() {
        document.getElementById('openAddExamBtn')?.addEventListener('click', () => {
            this.modal.classList.remove('hidden');
            this.modal.classList.add('flex'); 
        });
        
        document.getElementById('cancelAddExam')?.addEventListener('click', () => {
            this.modal.classList.add('hidden');
            this.modal.classList.remove('flex');
        });

        this.subjectInput.addEventListener('change', () => {
            if (this.subjectInput.value === 'Other') {
                this.customSubjectDiv.classList.remove('hidden');
                this.customSubjectDiv.classList.add('flex');
            } else {
                this.customSubjectDiv.classList.add('hidden');
                this.customSubjectDiv.classList.remove('flex');
            }
        });

        document.getElementById('saveNewExam')?.addEventListener('click', () => {
            let finalSubject = this.subjectInput.value;
        
            if (finalSubject === 'Other') {
                finalSubject = this.customNameInput.value.trim() || 'Custom Subject';
                const newColor = this.customColorInput.value;
                store.update('subjects', subs => ({...subs, [finalSubject]: newColor}));
            }

            const topic = document.getElementById('newExamTitle').value.trim();
            const finalTitle = topic ? `${finalSubject}: ${topic}` : finalSubject;

            const newExam = {
                id: Date.now(),
                subject: finalSubject,
                title: finalTitle,
                date: document.getElementById('newExamDate').value,
                time: document.getElementById('newExamTime').value || '09:00'
            };
            
            if (!newExam.date) return alert("Please select a date!");
            
            store.update('exams', ex => [...ex, newExam].sort((a,b) => new Date(a.date) - new Date(b.date)));
            
            this.modal.classList.add('hidden');
            this.modal.classList.remove('flex');
            document.getElementById('newExamTitle').value = '';
            document.getElementById('newExamDate').value = '';
        });

        this.listEl.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-exam')) {
                const id = parseInt(e.target.dataset.id);
                store.update('exams', ex => ex.filter(x => x.id !== id));
            }
        });
    }

    render() {
        const exams = store.state.exams;
        this.listEl.innerHTML = '';
        const today = this.getChinaTime();
        today.setHours(0,0,0,0);

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
                    <p class="text-sm font-bold text-gray-500 mt-1">📅 ${ex.date} @ ${ex.time}</p>
                    <div class="mt-4 text-2xl font-black" style="color: ${subColor}">${countdownText}</div>
                </div>
            `;
        });
    }
}
export const examManager = new ExamManager();


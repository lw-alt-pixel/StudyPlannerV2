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
        
        store.subscribe('exams', () => this.render());
        this.render();
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

        // Watch for "Other" selection
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

    getChinaTime() {
        return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"}));
    }

    render() {
        const exams = store.state.exams;
        this.listEl.innerHTML = '';
        const today = this.getChinaTime();
        today.setHours(0,0,0,0);

        let closestFutureExam = null;
        let minDiff = Infinity;

        exams.forEach(ex => {
            const examDate = new Date(`${ex.date}T${ex.time}:00`);
            const daysLeft = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));
            
            if (daysLeft >= 0 && daysLeft < minDiff) {
                minDiff = daysLeft;
                closestFutureExam = { ...ex, daysLeft };
            }

            // Dynamically grab the Subject's assigned color!
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

        // The Global Banner now matches the Exam's Subject color!
        if (closestFutureExam) {
            this.bannerEl.classList.remove('hidden');
            const subColor = store.state.subjects[closestFutureExam.subject] || '#dc2626';
            this.bannerEl.style.backgroundColor = subColor;
            
            this.bannerText.innerText = closestFutureExam.daysLeft === 0 
                ? `🚨 EXAM TODAY: ${closestFutureExam.title} 🚨` 
                : `Next Exam: ${closestFutureExam.title} in ${closestFutureExam.daysLeft} Days`;
        } else {
            this.bannerEl.classList.add('hidden');
        }
    }
}
export const examManager = new ExamManager();

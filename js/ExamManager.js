// js/ExamManager.js
import { store } from './State.js';

class ExamManager {
    init() {
        this.listEl = document.getElementById('examsList');
        this.bannerEl = document.getElementById('globalExamBanner');
        this.bannerText = document.getElementById('bannerText');
        this.modal = document.getElementById('addExamModal');
        
        this.bindEvents();
        
        store.subscribe('exams', () => this.render());
        this.render();
    }

    bindEvents() {
        document.getElementById('openAddExamBtn')?.addEventListener('click', () => {
            this.modal.classList.remove('hidden');
        });
        document.getElementById('cancelAddExam')?.addEventListener('click', () => {
            this.modal.classList.add('hidden');
        });
        document.getElementById('saveNewExam')?.addEventListener('click', () => {
            const newExam = {
                id: Date.now(),
                title: document.getElementById('newExamTitle').value || 'Important Exam',
                date: document.getElementById('newExamDate').value,
                time: document.getElementById('newExamTime').value || '09:00'
            };
            if (!newExam.date) return alert("Please select a date!");
            
            store.update('exams', ex => [...ex, newExam].sort((a,b) => new Date(a.date) - new Date(b.date)));
            this.modal.classList.add('hidden');
        });

        // Delete buttons via event delegation
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
            
            // Find closest exam for banner
            if (daysLeft >= 0 && daysLeft < minDiff) {
                minDiff = daysLeft;
                closestFutureExam = { ...ex, daysLeft };
            }

            // Colors for cards based on urgency
            let cardBg = 'bg-white'; let textCol = 'text-gray-800';
            if (daysLeft < 0) { cardBg = 'bg-gray-200 opacity-60'; } 
            else if (daysLeft <= 3) { cardBg = 'bg-red-50 border-red-200'; textCol = 'text-red-700'; }
            else if (daysLeft <= 7) { cardBg = 'bg-yellow-50 border-yellow-200'; textCol = 'text-yellow-700'; }

            this.listEl.innerHTML += `
                <div class="${cardBg} border p-4 rounded-xl shadow-sm relative">
                    <button class="delete-exam absolute top-2 right-2 text-gray-400 hover:text-red-600 font-bold" data-id="${ex.id}">&times;</button>
                    <h3 class="text-lg font-bold ${textCol} pr-6 truncate">${ex.title}</h3>
                    <p class="text-sm font-bold text-gray-500 mt-1">📅 ${ex.date} @ ${ex.time}</p>
                    <div class="mt-4 text-2xl font-black ${textCol}">${daysLeft < 0 ? 'Passed' : daysLeft === 0 ? 'TODAY!' : daysLeft + ' Days'}</div>
                </div>
            `;
        });

        // Update Banner
        if (closestFutureExam) {
            this.bannerEl.classList.remove('hidden');
            this.bannerText.innerText = closestFutureExam.daysLeft === 0 
                ? `🚨 EXAM TODAY: ${closestFutureExam.title} 🚨` 
                : `Next Exam: ${closestFutureExam.title} in ${closestFutureExam.daysLeft} Days`;
        } else {
            this.bannerEl.classList.add('hidden');
        }
    }
}
export const examManager = new ExamManager();

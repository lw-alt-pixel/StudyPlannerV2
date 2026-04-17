// js/StatsUI.js
import { store } from './State.js';

class StatsUI {
    init() {
        this.dateRangeSelect = document.getElementById('statsDateRange');
        this.customDiv = document.getElementById('customDateInputs');
        this.applyBtn = document.getElementById('applyCustomStats');
        this.startDateInput = document.getElementById('statsStart');
        this.endDateInput = document.getElementById('statsEnd');
        
        this.totalTimeEl = document.getElementById('statsTotalTime');
        this.avgTimeEl = document.getElementById('statsAvgTime');

        this.barChart = null;
        this.pieChart = null;

        this.bindEvents();

        store.subscribe('activeTab', (tab) => {
            if (tab === 'stats') this.calculateAndDraw();
        });
    }

    // FIXED: Correct timezone parser!
    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }
    formatDate(d) {
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    }

    bindEvents() {
        this.dateRangeSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                this.customDiv.classList.remove('hidden');
                this.customDiv.classList.add('flex');
            } else {
                this.customDiv.classList.add('hidden');
                this.customDiv.classList.remove('flex');
                this.calculateAndDraw();
            }
        });

        this.applyBtn.addEventListener('click', () => this.calculateAndDraw());
    }

    calculateAndDraw() {
        const blocks = store.state.blocks;
        const today = this.getChinaTime();
        let start, end;

        if (this.dateRangeSelect.value === 'custom') {
            if (!this.startDateInput.value || !this.endDateInput.value) return;
            start = new Date(this.startDateInput.value);
            end = new Date(this.endDateInput.value);
        } else {
            let days = parseInt(this.dateRangeSelect.value);
            start = new Date(today);
            end = new Date(today);
            if (days > 1) {
                start.setDate(today.getDate() - days + 1);
            }
        }

        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);

        let totalSecs = 0;
        const dailyData = {};
        const subjectData = {};

        blocks.forEach(b => {
            if (b.status !== 'completed' || !b.actualStart) return;
            const bDate = new Date(b.actualStart);
            if (bDate >= start && bDate <= end) {
                const secs = b.studySeconds || 0;
                totalSecs += secs;
                
                // Format directly into robust local string
                const dStr = this.formatDate(bDate);
                dailyData[dStr] = (dailyData[dStr] || 0) + secs;
                
                subjectData[b.subject] = (subjectData[b.subject] || 0) + secs;
            }
        });

        this.totalTimeEl.innerText = `${Math.floor(totalSecs/3600)}h ${Math.floor((totalSecs%3600)/60)}m`;
        
        let totalDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
        if (totalDays === 0) totalDays = 1; // Prevent divide by zero!
        
        const avgSecs = totalSecs / totalDays;
        this.avgTimeEl.innerText = `${Math.floor(avgSecs/3600)}h ${Math.floor((avgSecs%3600)/60)}m`;

        this.drawBarChart(start, end, dailyData, totalDays);
        this.drawPieChart(subjectData);
    }

    drawBarChart(start, end, dailyData, totalDays) {
        const canvas = document.getElementById('trendBarChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (this.barChart) this.barChart.destroy();

        const labels = [];
        const values = [];

        let groupSizeDays = 1;
        if (totalDays > 10 && totalDays <= 70) groupSizeDays = 7;
        else if (totalDays > 70) groupSizeDays = 30;

        let currentDate = new Date(start);
        while (currentDate <= end) {
            let groupLabel = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            let groupSecs = 0;

            for (let i = 0; i < groupSizeDays; i++) {
                if (currentDate > end) break;
                const dStr = this.formatDate(currentDate);
                groupSecs += dailyData[dStr] || 0;
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            labels.push(groupLabel);
            values.push((groupSecs / 3600).toFixed(1)); 
        }

        this.barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Study Hours',
                    data: values,
                    backgroundColor: '#3b82f6',
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
                plugins: { legend: { display: false } }
            }
        });
    }

    drawPieChart(subjectData) {
        const canvas = document.getElementById('subjectPieChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (this.pieChart) this.pieChart.destroy();

        const labels = Object.keys(subjectData);
        const data = labels.map(l => (subjectData[l] / 3600).toFixed(1));
        const bgColors = labels.map(l => store.state.subjects[l] || '#3b82f6');

        if (labels.length === 0) {
            // Empty State
            this.pieChart = new Chart(ctx, {
                type: 'pie',
                data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#e5e7eb'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { display: false } } }
            });
            return;
        }

        this.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: data, backgroundColor: bgColors, borderWidth: 0 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10, weight: 'bold' } } } },
                cutout: '60%'
            }
        });
    }
}
export const statsUI = new StatsUI();

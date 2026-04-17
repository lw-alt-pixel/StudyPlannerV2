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

        // Chart.js instances
        this.barChart = null;
        this.pieChart = null;

        this.bindEvents();

        store.subscribe('activeTab', (tab) => {
            if (tab === 'stats') this.calculateAndDraw();
        });
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }

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
        today.setHours(0,0,0,0);
        
        let startDate = new Date(today);
        let endDate = new Date(today);

        const rangeVal = this.dateRangeSelect.value;
        if (rangeVal === 'custom') {
            if(!this.startDateInput.value || !this.endDateInput.value) return;
            startDate = new Date(this.startDateInput.value);
            endDate = new Date(this.endDateInput.value);
        } else {
            startDate.setDate(today.getDate() - parseInt(rangeVal) + 1);
        }

        // 1. Filter blocks to date range
        let totalSecs = 0;
        const subjectTotals = {};
        const dailyTotals = {};

        blocks.forEach(b => {
            if (!b.startDate || !b.studySeconds) return;
            const bDate = new Date(b.startDate);
            bDate.setHours(0,0,0,0);

            if (bDate >= startDate && bDate <= endDate) {
                totalSecs += b.studySeconds;
                
                // Subject Aggregation
                const sub = b.subject || 'Other';
                subjectTotals[sub] = (subjectTotals[sub] || 0) + b.studySeconds;

                // Daily Aggregation
                dailyTotals[b.startDate] = (dailyTotals[b.startDate] || 0) + b.studySeconds;
            }
        });

        // 2. Update Top Cards
        const totalDays = Math.max(1, Math.ceil((endDate - startDate) / 86400000) + 1);
        const avgSecs = totalSecs / totalDays;
        
        this.totalTimeEl.innerText = `${Math.floor(totalSecs/3600)}h ${Math.floor((totalSecs%3600)/60)}m`;
        this.avgTimeEl.innerText = `${Math.floor(avgSecs/3600)}h ${Math.floor((avgSecs%3600)/60)}m`;

        this.drawPieChart(subjectTotals);
        this.drawBarChart(dailyTotals, startDate, endDate, totalDays);
    }

    drawPieChart(data) {
        const ctx = document.getElementById('subjectPieChart').getContext('2d');
        if (this.pieChart) this.pieChart.destroy(); // Clear old chart

        const labels = Object.keys(data);
        const values = Object.values(data).map(secs => (secs / 3600).toFixed(1)); // Convert to hours

        this.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6b7280'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right' } } }
        });
    }

    drawBarChart(dailyData, start, end, totalDays) {
        const ctx = document.getElementById('trendBarChart').getContext('2d');
        if (this.barChart) this.barChart.destroy();

        const labels = [];
        const values = [];

        // THE MATH: Group into max 10 bars
        let groupSizeDays = 1;
        if (totalDays > 10 && totalDays <= 70) groupSizeDays = 7;
        else if (totalDays > 70) groupSizeDays = 30;

        let currentDate = new Date(start);
        while (currentDate <= end) {
            let groupLabel = currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            let groupSecs = 0;

            // Sum up the group
            for (let i = 0; i < groupSizeDays; i++) {
                if (currentDate > end) break;
                const dStr = currentDate.toISOString().split('T')[0];
                groupSecs += dailyData[dStr] || 0;
                currentDate.setDate(currentDate.getDate() + 1);
            }
            
            labels.push(groupLabel);
            values.push((groupSecs / 3600).toFixed(1)); // Hours
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
}

export const statsUI = new StatsUI();

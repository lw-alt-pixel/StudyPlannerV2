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

        store.subscribe('activeTab', (tab) => { if (tab === 'stats') this.calculateAndDraw(); });
        store.subscribe('blocks', () => { if (store.state.activeTab === 'stats') this.calculateAndDraw(); });
    }

    getChinaTime() { return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Shanghai"})); }
    formatDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

    bindEvents() {
        this.dateRangeSelect?.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                this.customDiv.classList.remove('hidden'); this.customDiv.classList.add('flex');
            } else {
                this.customDiv.classList.add('hidden'); this.customDiv.classList.remove('flex');
                this.calculateAndDraw();
            }
        });
        this.applyBtn?.addEventListener('click', () => this.calculateAndDraw());
    }

    calculateAndDraw() {
        const blocks = store.state.blocks.filter(b => b.status === 'completed' || b.studySeconds > 0);
        const rangeVal = this.dateRangeSelect ? this.dateRangeSelect.value : '1';
        const today = this.getChinaTime(); today.setHours(0,0,0,0);
        
        let filterStart = new Date(today); let filterEnd = new Date(today);

        if (rangeVal === '1') { filterStart.setDate(today.getDate()); }
        else if (rangeVal === '7') { filterStart.setDate(today.getDate() - 6); }
        else if (rangeVal === '30') { filterStart.setDate(today.getDate() - 29); }
        else if (rangeVal === 'custom') {
            if (!this.startDateInput.value || !this.endDateInput.value) return;
            filterStart = new Date(this.startDateInput.value + "T00:00:00");
            filterEnd = new Date(this.endDateInput.value + "T00:00:00");
        }

        let totalSecs = 0;
        let dayMap = {};
        let subjectMap = {};

        // Generate baseline for graph
        for (let d = new Date(filterStart); d <= filterEnd; d.setDate(d.getDate() + 1)) {
            dayMap[this.formatDate(d)] = 0;
        }

        blocks.forEach(b => {
            // 🚨 FIX: Intelligently grab the date, even if it's an old spontaneous block
            const bDateStr = b.startDate || b.date;
            if (!bDateStr) return;

            const bDateObj = new Date(bDateStr + "T00:00:00");
            
            if (bDateObj >= filterStart && bDateObj <= filterEnd) {
                const secs = b.studySeconds || 0;
                totalSecs += secs;
                
                if (dayMap[bDateStr] !== undefined) dayMap[bDateStr] += secs;
                
                const sub = b.subject || 'General';
                if (!subjectMap[sub]) subjectMap[sub] = 0;
                subjectMap[sub] += secs;
            }
        });

        if (this.totalTimeEl) {
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            const s = totalSecs % 60;
            this.totalTimeEl.innerText = `${h}h ${m}m ${s}s`;
        }
        
        const daysDiff = Math.max(1, Math.ceil((filterEnd - filterStart) / (1000 * 60 * 60 * 24)) + 1);
        const avgSecs = totalSecs / daysDiff;
        if (this.avgTimeEl) {
            const ah = Math.floor(avgSecs / 3600);
            const am = Math.floor((avgSecs % 3600) / 60);
            const as_ = Math.floor(avgSecs % 60);
            this.avgTimeEl.innerText = `${ah}h ${am}m ${as_}s`;
        }

        this.drawBarChart(dayMap);
        this.drawPieChart(subjectMap);
    }

    drawBarChart(dayData) {
        const canvas = document.getElementById('trendBarChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (this.barChart) this.barChart.destroy();
        const labels = Object.keys(dayData).map(d => d.slice(5)); // e.g. "04-19"
        const hoursData = Object.values(dayData).map(secs => (secs / 3600));

        const formatHMS = (totalSecs) => {
            totalSecs = Math.round(totalSecs);
            const h = Math.floor(totalSecs / 3600);
            const m = Math.floor((totalSecs % 3600) / 60);
            const s = totalSecs % 60;
            return `${h}h ${m}m ${s}s`;
        };

        this.barChart = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: [{ label: 'Hours', data: hoursData, backgroundColor: '#3b82f6', borderRadius: 4 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Hours' } } },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const hoursVal = context.parsed && context.parsed.y !== undefined ? context.parsed.y : context.parsed || context.raw || 0;
                                const secs = Math.round(hoursVal * 3600);
                                return `${formatHMS(secs)} (${hoursVal.toFixed(2)} h)`;
                            }
                        }
                    }
                }
            }
        });
    }

    drawPieChart(subjectData) {
        const canvas = document.getElementById('subjectPieChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (this.pieChart) this.pieChart.destroy();

        const labels = Object.keys(subjectData);
        const hoursData = labels.map(l => (subjectData[l] / 3600));
        const bgColors = labels.map(l => store.state.subjects[l] || '#3b82f6');

        if (labels.length === 0) {
            this.pieChart = new Chart(ctx, {
                type: 'pie',
                data: { labels: ['No Data'], datasets: [{ data: [1], backgroundColor: ['#e5e7eb'] }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { tooltip: { display: false } } }
            });
            return;
        }

        this.pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: labels, datasets: [{ data: hoursData, backgroundColor: bgColors, borderWidth: 0 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } },
                    tooltip: {
                        callbacks: {
                            label: (context) => {
                                const hoursVal = context.parsed || context.raw || 0;
                                const secs = Math.round(hoursVal * 3600);
                                return `${context.label}: ${formatHMS(secs)} (${hoursVal.toFixed(2)} h)`;
                            }
                        }
                    }
                }
            }
        });
    }
}
export const statsUI = new StatsUI();

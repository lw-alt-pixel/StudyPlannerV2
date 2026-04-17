// js/StatsUI.js
import { store } from './State.js';

class StatsUI {
    init() {
        this.heatmapContainer = document.getElementById('calendarHeatmap');
        this.subjectStatsList = document.getElementById('subjectStatsList');
        this.dailyAvgText = document.getElementById('dailyAvgText');

        if (!this.heatmapContainer) return;

        // Render stats whenever blocks change, or when we click the Stats tab
        store.subscribe('blocks', () => this.renderStats());
        store.subscribe('activeTab', (tab) => {
            if (tab === 'stats') this.renderStats();
        });
    }

    renderStats() {
        const blocks = store.state.blocks;
        
        // --- 1. BUILD SUBJECT ANALYTICS ---
        const subjectTimes = {};
        let totalStudySecsAllTime = 0;

        blocks.forEach(b => {
            if (!b.studySeconds) return;
            const sub = b.subject || 'Other';
            if (!subjectTimes[sub]) subjectTimes[sub] = 0;
            subjectTimes[sub] += b.studySeconds;
            totalStudySecsAllTime += b.studySeconds;
        });

        this.subjectStatsList.innerHTML = '';
        Object.keys(subjectTimes).sort((a,b) => subjectTimes[b] - subjectTimes[a]).forEach(sub => {
            const h = Math.floor(subjectTimes[sub] / 3600);
            const m = Math.floor((subjectTimes[sub] % 3600) / 60);
            this.subjectStatsList.innerHTML += `
                <li class="flex justify-between items-center text-sm font-bold bg-white p-2 rounded shadow-sm">
                    <span>${sub}</span>
                    <span class="text-blue-600">${h}h ${m}m</span>
                </li>`;
        });

        // --- 2. BUILD HEATMAP (Last 28 Days) ---
        this.heatmapContainer.innerHTML = '';
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        // Group study seconds by Date String (YYYY-MM-DD)
        const dailyLogs = {};
        blocks.forEach(b => {
            if (b.studySeconds > 0 && b.startDate) {
                if (!dailyLogs[b.startDate]) dailyLogs[b.startDate] = 0;
                dailyLogs[b.startDate] += b.studySeconds;
            }
        });

        // Generate the last 28 days
        let activeDaysCount = 0;

        for (let i = 27; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            
            const secs = dailyLogs[dateStr] || 0;
            if (secs > 0) activeDaysCount++;

            // Calculate Intensity (0 = gray, 1 = light blue, 4 = dark blue)
            let intensityClass = 'bg-gray-100';
            if (secs > 14400) intensityClass = 'bg-blue-800'; // > 4 hours
            else if (secs > 7200) intensityClass = 'bg-blue-600'; // > 2 hours
            else if (secs > 3600) intensityClass = 'bg-blue-400'; // > 1 hour
            else if (secs > 0) intensityClass = 'bg-blue-200'; // < 1 hour

            const dayDiv = document.createElement('div');
            dayDiv.className = `h-10 rounded-md border flex items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-sm ${intensityClass}`;
            dayDiv.title = `${dateStr}: ${Math.floor(secs/3600)}h ${Math.floor((secs%3600)/60)}m logged`;
            
            // Just show the day number inside the box
            dayDiv.innerHTML = `<span class="text-[10px] font-bold ${secs > 0 ? 'text-white' : 'text-gray-400'}">${d.getDate()}</span>`;
            
            this.heatmapContainer.appendChild(dayDiv);
        }

        // Daily Average
        if (activeDaysCount > 0) {
            const avgSecs = totalStudySecsAllTime / activeDaysCount;
            this.dailyAvgText.innerText = `${Math.floor(avgSecs/3600)}h ${Math.floor((avgSecs%3600)/60)}m`;
        } else {
            this.dailyAvgText.innerText = '0h 0m';
        }
    }
}

export const statsUI = new StatsUI();

// js/SettingsManager.js
import { store } from './State.js';

class SettingsManager {
    init() {
        this.panel = document.getElementById('settingsPanel');
        this.overlay = document.getElementById('settingsOverlay');
        this.subjectList = document.getElementById('settingsSubjectList');
        this.bgMode = document.getElementById('settingsBgMode');
        this.bgColorDiv = document.getElementById('settingsBgColorDiv');
        this.bgImageDiv = document.getElementById('settingsBgImageDiv');
        
        this.bindEvents();
        this.populateForms();
    }

    bindEvents() {
        const closeSettings = () => {
            this.panel?.classList.add('translate-x-full');
            this.overlay?.classList.add('hidden');
        };
        document.getElementById('closeSettingsPanel')?.addEventListener('click', closeSettings);
        this.overlay?.addEventListener('click', closeSettings);

        document.getElementById('fallbackSettingsBtn')?.addEventListener('click', () => {
            this.panel?.classList.remove('translate-x-full');
            this.overlay?.classList.remove('hidden');
        });

        this.bgMode?.addEventListener('change', (e) => {
            if (e.target.value === 'color') { this.bgColorDiv?.classList.remove('hidden'); this.bgImageDiv?.classList.add('hidden'); } 
            else { this.bgColorDiv?.classList.add('hidden'); this.bgImageDiv?.classList.remove('hidden'); }
        });

        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => {
            this.saveSubjects();
            this.saveSettings();
            closeSettings();
        });
    }

    populateForms() {
        const theme = store.state.theme;
        const settings = store.state.settings;
        const audio = store.state.audio;

        if(this.bgMode) this.bgMode.value = theme.bgType || 'color';
        const bgColorEl = document.getElementById('settingsBgColor'); if(bgColorEl) bgColorEl.value = theme.bgColor || '#f3f4f6';
        const bgImgEl = document.getElementById('settingsBgImage'); if(bgImgEl) bgImgEl.value = theme.bgImage || '';
        const actionColEl = document.getElementById('settingsActionColor'); if(actionColEl) actionColEl.value = theme.actionColor || '#2563eb';
        
        const pStudyEl = document.getElementById('settingsPStudy'); if(pStudyEl) pStudyEl.value = settings.pStudy || 25;
        const pBreakEl = document.getElementById('settingsPBreak'); if(pBreakEl) pBreakEl.value = settings.pBreak || 5;

        const audioEnEl = document.getElementById('settingsAudioEnabled'); if(audioEnEl) audioEnEl.checked = audio.enabled;
        const audioVolEl = document.getElementById('settingsAudioVolume'); if(audioVolEl) audioVolEl.value = audio.volume || 50;
        const audioSrcEl = document.getElementById('settingsAudioSource'); if(audioSrcEl) audioSrcEl.value = audio.source || 'zen';
        
        // 🚨 POPULATE NEW BREAK SOURCE
        const audioBreakSrcEl = document.getElementById('settingsAudioBreakSource'); if(audioBreakSrcEl) audioBreakSrcEl.value = audio.breakSource || 'upbeat';

        if (theme.bgType === 'color') { this.bgColorDiv?.classList.remove('hidden'); this.bgImageDiv?.classList.add('hidden'); } 
        else { this.bgColorDiv?.classList.add('hidden'); this.bgImageDiv?.classList.remove('hidden'); }

        this.renderSubjectList();
    }

    renderSubjectList() {
        if (!this.subjectList) return;
        this.subjectList.innerHTML = '';
        Object.entries(store.state.subjects).forEach(([subName, subColor]) => {
            this.subjectList.innerHTML += `
                <div class="flex gap-2 items-center subject-row" data-oldname="${subName}">
                    <input type="text" class="subject-name-input flex-1 p-2 border rounded font-bold text-gray-700 text-sm" value="${subName}">
                    <input type="color" class="subject-color-input w-10 h-10 border rounded cursor-pointer" value="${subColor}">
                </div>
            `;
        });
    }

    saveSubjects() {
        const newSubjectsDict = {}; const renames = []; 
        document.querySelectorAll('.subject-row').forEach(row => {
            const oldName = row.dataset.oldname;
            const newName = row.querySelector('.subject-name-input').value.trim() || oldName;
            const newColor = row.querySelector('.subject-color-input').value;
            newSubjectsDict[newName] = newColor;
            if (oldName !== newName) renames.push({ old: oldName, new: newName });
        });
        store.update('subjects', () => newSubjectsDict);
        if (renames.length > 0) {
            store.update('blocks', blocks => blocks.map(b => { const match = renames.find(r => r.old === b.subject); return match ? { ...b, subject: match.new } : b; }));
            store.update('exams', exams => exams.map(e => { const match = renames.find(r => r.old === e.subject); return match ? { ...e, subject: match.new } : e; }));
        }
    }

    saveSettings() {
        const newTheme = {
            ...store.state.theme,
            bgType: this.bgMode.value,
            bgColor: document.getElementById('settingsBgColor').value,
            bgImage: document.getElementById('settingsBgImage').value,
            actionColor: document.getElementById('settingsActionColor').value
        };
        store.update('theme', () => newTheme);

        const newSettings = {
            ...store.state.settings,
            pStudy: parseInt(document.getElementById('settingsPStudy').value) || 25,
            pBreak: parseInt(document.getElementById('settingsPBreak').value) || 5
        };
        store.update('settings', () => newSettings);

        const newAudio = {
            enabled: document.getElementById('settingsAudioEnabled').checked,
            volume: parseInt(document.getElementById('settingsAudioVolume').value) || 50,
            source: document.getElementById('settingsAudioSource').value,
            // 🚨 SAVE NEW BREAK SOURCE
            breakSource: document.getElementById('settingsAudioBreakSource').value
        };
        store.update('audio', () => newAudio);
    }
}
export const settingsManager = new SettingsManager();

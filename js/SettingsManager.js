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

        // 🚨 NEW AUDIO BINDINGS
        document.getElementById('settingsAudioEnabled')?.addEventListener('change', (e) => store.update('audio', a => ({...a, enabled: e.target.checked})));
        document.getElementById('settingsAudioSource')?.addEventListener('change', (e) => store.update('audio', a => ({...a, source: e.target.value})));
        document.getElementById('settingsAudioVolume')?.addEventListener('input', (e) => store.update('audio', a => ({...a, volume: parseInt(e.target.value)})));
    }

    populateForms() {
        const theme = store.state.theme;
        const s = store.state.settings;
        const audio = store.state.audio;

        this.bgMode.value = theme.bgType || 'color';
        document.getElementById('settingsBgColor').value = theme.bgColor || '#f3f4f6';
        document.getElementById('settingsBgImage').value = theme.bgImage || '';
        document.getElementById('settingsActionColor').value = theme.actionColor || '#2563eb';
        
        document.getElementById('settingsPStudy').value = s.pStudy || 25;
        document.getElementById('settingsPBreak').value = s.pBreak || 5;

        // Populate new audio form
        const aEnabled = document.getElementById('settingsAudioEnabled');
        if(aEnabled) aEnabled.checked = audio.enabled !== false;
        
        const aVolume = document.getElementById('settingsAudioVolume');
        if(aVolume) aVolume.value = audio.volume || 50;

        const aSource = document.getElementById('settingsAudioSource');
        if(aSource) aSource.value = audio.source || 'zen';

        if (this.bgMode.value === 'color') { this.bgColorDiv?.classList.remove('hidden'); this.bgImageDiv?.classList.add('hidden'); } 
        else { this.bgColorDiv?.classList.add('hidden'); this.bgImageDiv?.classList.remove('hidden'); }

        this.renderSubjectList();
    }

    renderSubjectList() {
        if(!this.subjectList) return;
        this.subjectList.innerHTML = '';
        Object.keys(store.state.subjects).forEach(subName => {
            this.subjectList.innerHTML += `
                <div class="flex gap-2 items-center subject-row" data-oldname="${subName}">
                    <input type="text" class="subject-name-input flex-1 p-2 border rounded font-bold text-gray-700 text-sm" value="${subName}">
                    <input type="color" class="subject-color-input w-10 h-10 border rounded cursor-pointer" value="${store.state.subjects[subName]}">
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
    }
}
export const settingsManager = new SettingsManager();

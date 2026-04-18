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

        // 🚨 FIX: THIS BINDS THE BUTTON ON THE ANALYTICS TAB!
        document.getElementById('fallbackSettingsBtn')?.addEventListener('click', () => {
            this.panel?.classList.remove('translate-x-full');
            this.overlay?.classList.remove('hidden');
        });

        this.bgMode?.addEventListener('change', (e) => {
            if (e.target.value === 'color') { this.bgColorDiv?.classList.remove('hidden'); this.bgImageDiv?.classList.add('hidden'); } 
            else { this.bgColorDiv?.classList.add('hidden'); this.bgImageDiv?.classList.remove('hidden'); }
            store.update('theme', t => ({ ...t, bgType: e.target.value }));
        });

        document.getElementById('settingsBgColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, bgColor: e.target.value })));
        document.getElementById('settingsBgImage')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (event) => store.update('theme', t => ({ ...t, bgImage: event.target.result }));
                reader.readAsDataURL(file);
            }
        });

        document.getElementById('settingsTabColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, tabColor: e.target.value })));
        document.getElementById('settingsActionColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, actionColor: e.target.value })));
        document.getElementById('settingsBannerBgColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, bannerBgColor: e.target.value })));
        document.getElementById('settingsBannerTextColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, bannerTextColor: e.target.value })));
        document.getElementById('settingsActionSize')?.addEventListener('change', (e) => store.update('theme', t => ({ ...t, actionSize: e.target.value })));
        document.getElementById('settingsFloatingBtn')?.addEventListener('change', (e) => store.update('theme', t => ({ ...t, floatingBtn: e.target.value })));

        document.getElementById('settingsPStudy')?.addEventListener('input', (e) => store.update('settings', s => ({ ...s, pStudy: parseInt(e.target.value) || 25 })));
        document.getElementById('settingsPBreak')?.addEventListener('input', (e) => store.update('settings', s => ({ ...s, pBreak: parseInt(e.target.value) || 5 })));

        document.getElementById('settingsSaveSubjectsBtn')?.addEventListener('click', () => this.saveSubjects());

        document.getElementById('settingsExportBtn')?.addEventListener('click', () => {
            const data = JSON.stringify(store.state, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'study_planner_backup.json';
            a.click(); URL.revokeObjectURL(url);
        });

        document.getElementById('settingsImportProxyBtn')?.addEventListener('click', () => document.getElementById('settingsImportFile').click());
        document.getElementById('settingsImportFile')?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const imported = JSON.parse(event.target.result);
                    if (imported.blocks) store.update('blocks', () => imported.blocks);
                    if (imported.exams) store.update('exams', () => imported.exams);
                    if (imported.subjects) store.update('subjects', () => imported.subjects);
                    if (imported.theme) store.update('theme', () => imported.theme);
                    if (imported.settings) store.update('settings', () => imported.settings);
                    if (imported.diaries) store.update('diaries', () => imported.diaries);
                    alert("Backup restored successfully!");
                    location.reload();
                } catch (err) { alert("Invalid backup file."); }
            };
            reader.readAsText(file);
        });
    }

    populateForms() {
        const theme = store.state.theme; const settings = store.state.settings;
        if (this.bgMode) this.bgMode.value = theme.bgType || 'color';
        
        const colorDiv = document.getElementById('settingsBgColor'); if(colorDiv) colorDiv.value = theme.bgColor || '#f3f4f6';
        const tabCol = document.getElementById('settingsTabColor'); if(tabCol) tabCol.value = theme.tabColor || '#3b82f6';
        const actCol = document.getElementById('settingsActionColor'); if(actCol) actCol.value = theme.actionColor || '#2563eb';
        const banBg = document.getElementById('settingsBannerBgColor'); if(banBg) banBg.value = theme.bannerBgColor || '#dc2626';
        const banTxt = document.getElementById('settingsBannerTextColor'); if(banTxt) banTxt.value = theme.bannerTextColor || '#ffffff';
        const actSz = document.getElementById('settingsActionSize'); if(actSz) actSz.value = theme.actionSize || 'md';
        const floatSz = document.getElementById('settingsFloatingBtn'); if(floatSz) floatSz.value = theme.floatingBtn || 'md';

        const pStudy = document.getElementById('settingsPStudy'); if(pStudy) pStudy.value = settings.pStudy || 25;
        const pBreak = document.getElementById('settingsPBreak'); if(pBreak) pBreak.value = settings.pBreak || 5;

        if (theme.bgType === 'color') { this.bgColorDiv?.classList.remove('hidden'); this.bgImageDiv?.classList.add('hidden'); } 
        else { this.bgColorDiv?.classList.add('hidden'); this.bgImageDiv?.classList.remove('hidden'); }

        store.subscribe('subjects', () => this.renderSubjectList());
        this.renderSubjectList();
    }

    renderSubjectList() {
        if (!this.subjectList) return;
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
        alert("Subjects saved successfully!");
    }
}
export const settingsManager = new SettingsManager();

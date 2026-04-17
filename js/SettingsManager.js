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
        // 🎯 NEW: CLICK OUTSIDE (OR "X") TO CLOSE PANEL OVERLAYS
        const closeSettings = () => {
            this.panel?.classList.add('translate-x-full');
            this.overlay?.classList.add('hidden');
        };
        document.getElementById('closeSettingsPanel')?.addEventListener('click', closeSettings);
        this.overlay?.addEventListener('click', closeSettings);

        this.bgMode?.addEventListener('change', (e) => {
            if (e.target.value === 'color') { this.bgColorDiv?.classList.remove('hidden'); this.bgImageDiv?.classList.add('hidden'); } 
            else { this.bgColorDiv?.classList.add('hidden'); this.bgImageDiv?.classList.remove('hidden'); }
            store.update('theme', t => ({ ...t, bgType: e.target.value }));
        });

        document.getElementById('settingsBgColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, bgColor: e.target.value })));
        document.getElementById('settingsTabColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, tabColor: e.target.value })));
        document.getElementById('settingsActionColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, actionColor: e.target.value })));
        document.getElementById('settingsActionSize')?.addEventListener('change', (e) => store.update('theme', t => ({ ...t, actionSize: e.target.value })));
        
        // 🎯 NEW: FLOATING BUTTON SETTING
        document.getElementById('settingsFloatingBtn')?.addEventListener('change', (e) => store.update('theme', t => ({ ...t, floatingBtn: e.target.value })));
        
        document.getElementById('settingsBannerBgColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, bannerBgColor: e.target.value })));
        document.getElementById('settingsBannerTextColor')?.addEventListener('input', (e) => store.update('theme', t => ({ ...t, bannerTextColor: e.target.value })));

        document.getElementById('settingsBgImage')?.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
                    const maxW = 1920; let width = img.width; let height = img.height;
                    if (width > maxW) { height = (maxW / width) * height; width = maxW; }
                    canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
                    store.update('theme', t => ({ ...t, bgImage: canvas.toDataURL('image/jpeg', 0.6) }));
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('settingsPStudy')?.addEventListener('change', (e) => store.update('settings', s => ({ ...s, pStudy: parseInt(e.target.value) || 25 })));
        document.getElementById('settingsPBreak')?.addEventListener('change', (e) => store.update('settings', s => ({ ...s, pBreak: parseInt(e.target.value) || 5 })));
        document.getElementById('settingsSaveSubjectsBtn')?.addEventListener('click', () => { this.saveSubjects(); alert("Subject changes saved globally!"); });

        // Cloud Exports
        document.getElementById('settingsExportBtn')?.addEventListener('click', () => {
            const data = { blocks: store.state.blocks, exams: store.state.exams, subjects: store.state.subjects, theme: store.state.theme, settings: store.state.settings, diaries: store.state.diaries };
            const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}); const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `StudyPlanner_Backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url);
        });

        document.getElementById('settingsImportProxyBtn')?.addEventListener('click', () => document.getElementById('settingsImportFile')?.click());
        document.getElementById('settingsImportFile')?.addEventListener('change', (e) => {
            const file = e.target.files[0]; if (!file) return;
            if (!confirm("⚠️ WARNING: Importing will completely overwrite your current planner data. Are you sure you want to continue?")) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                try {
                    const data = JSON.parse(ev.target.result);
                    if (data.blocks) store.update('blocks', () => data.blocks);
                    if (data.exams) store.update('exams', () => data.exams);
                    if (data.subjects) store.update('subjects', () => data.subjects);
                    if (data.theme) store.update('theme', () => data.theme);
                    if (data.settings) store.update('settings', () => data.settings);
                    if (data.diaries) store.update('diaries', () => data.diaries);
                    alert("✅ Import successful! Reloading your planner..."); location.reload();
                } catch(err) { alert("❌ Error: Invalid backup file format."); }
            };
            reader.readAsText(file);
        });
    }

    populateForms() {
        const theme = store.state.theme; const setts = store.state.settings;
        if (this.bgMode) this.bgMode.value = theme.bgType;
        if (theme.bgType === 'color') { this.bgColorDiv?.classList.remove('hidden'); this.bgImageDiv?.classList.add('hidden'); } 
        else { this.bgColorDiv?.classList.add('hidden'); this.bgImageDiv?.classList.remove('hidden'); }

        const safelySetValue = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
        safelySetValue('settingsBgColor', theme.bgColor || '#f3f4f6'); safelySetValue('settingsTabColor', theme.tabColor || '#3b82f6');
        safelySetValue('settingsActionColor', theme.actionColor || '#2563eb'); safelySetValue('settingsActionSize', theme.actionSize || 'md');
        safelySetValue('settingsFloatingBtn', theme.floatingBtn || 'md'); // NEW FLOATING SIZES
        safelySetValue('settingsBannerBgColor', theme.bannerBgColor || '#dc2626'); safelySetValue('settingsBannerTextColor', theme.bannerTextColor || '#ffffff');
        safelySetValue('settingsPStudy', setts.pStudy); safelySetValue('settingsPBreak', setts.pBreak);
        this.renderSubjectsList();
    }

    renderSubjectsList() {
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
    }
}
export const settingsManager = new SettingsManager();


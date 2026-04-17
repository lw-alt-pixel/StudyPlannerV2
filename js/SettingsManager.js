// js/SettingsManager.js
import { store } from './State.js';

class SettingsManager {
    init() {
        this.panel = document.getElementById('settingsPanel');
        this.subjectList = document.getElementById('settingsSubjectList');
        this.bgMode = document.getElementById('settingsBgMode');
        this.bgColorDiv = document.getElementById('settingsBgColorDiv');
        this.bgImageDiv = document.getElementById('settingsBgImageDiv');
        
        this.bindEvents();
        this.populateForms();
    }

    bindEvents() {
        document.getElementById('closeSettingsPanel')?.addEventListener('click', () => {
            this.panel.classList.add('translate-x-full');
        });

        this.bgMode.addEventListener('change', (e) => {
            if (e.target.value === 'color') {
                this.bgColorDiv.classList.remove('hidden');
                this.bgImageDiv.classList.add('hidden');
            } else {
                this.bgColorDiv.classList.add('hidden');
                this.bgImageDiv.classList.remove('hidden');
            }
            store.update('theme', t => ({ ...t, bgType: e.target.value }));
        });

        document.getElementById('settingsBgColor').addEventListener('input', (e) => {
            store.update('theme', t => ({ ...t, bgColor: e.target.value }));
        });
        document.getElementById('settingsTabColor').addEventListener('input', (e) => {
            store.update('theme', t => ({ ...t, tabColor: e.target.value }));
        });
        document.getElementById('settingsActionColor').addEventListener('input', (e) => {
            store.update('theme', t => ({ ...t, actionColor: e.target.value }));
        });
        document.getElementById('settingsActionSize').addEventListener('change', (e) => {
            store.update('theme', t => ({ ...t, actionSize: e.target.value }));
        });

        // NEW: Banner Colors
        document.getElementById('settingsBannerBgColor').addEventListener('input', (e) => {
            store.update('theme', t => ({ ...t, bannerBgColor: e.target.value }));
        });
        document.getElementById('settingsBannerTextColor').addEventListener('input', (e) => {
            store.update('theme', t => ({ ...t, bannerTextColor: e.target.value }));
        });

        document.getElementById('settingsBgImage').addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const maxW = 1920;
                    let width = img.width; let height = img.height;
                    if (width > maxW) { height = (maxW / width) * height; width = maxW; }
                    canvas.width = width; canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.6); 
                    store.update('theme', t => ({ ...t, bgImage: dataUrl }));
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(file);
        });

        document.getElementById('settingsPStudy').addEventListener('change', (e) => {
            store.update('settings', s => ({ ...s, pStudy: parseInt(e.target.value) || 25 }));
        });
        document.getElementById('settingsPBreak').addEventListener('change', (e) => {
            store.update('settings', s => ({ ...s, pBreak: parseInt(e.target.value) || 5 }));
        });

        document.getElementById('settingsSaveSubjectsBtn').addEventListener('click', () => {
            this.saveSubjects();
            alert("Subject changes saved globally!");
        });
    }

    populateForms() {
        const theme = store.state.theme;
        const setts = store.state.settings;

        this.bgMode.value = theme.bgType;
        if (theme.bgType === 'color') {
            this.bgColorDiv.classList.remove('hidden'); this.bgImageDiv.classList.add('hidden');
        } else {
            this.bgColorDiv.classList.add('hidden'); this.bgImageDiv.classList.remove('hidden');
        }

        document.getElementById('settingsBgColor').value = theme.bgColor || '#f3f4f6';
        document.getElementById('settingsTabColor').value = theme.tabColor || '#3b82f6';
        document.getElementById('settingsActionColor').value = theme.actionColor || '#2563eb';
        document.getElementById('settingsActionSize').value = theme.actionSize || 'md';
        
        // NEW: Load Banner Colors
        document.getElementById('settingsBannerBgColor').value = theme.bannerBgColor || '#dc2626';
        document.getElementById('settingsBannerTextColor').value = theme.bannerTextColor || '#ffffff';
        
        document.getElementById('settingsPStudy').value = setts.pStudy;
        document.getElementById('settingsPBreak').value = setts.pBreak;

        this.renderSubjectsList();
    }

    renderSubjectsList() {
        this.subjectList.innerHTML = '';
        const subs = store.state.subjects;
        Object.keys(subs).forEach(subName => {
            this.subjectList.innerHTML += `
                <div class="flex gap-2 items-center subject-row" data-oldname="${subName}">
                    <input type="text" class="subject-name-input flex-1 p-2 border rounded font-bold text-gray-700 text-sm" value="${subName}">
                    <input type="color" class="subject-color-input w-10 h-10 border rounded cursor-pointer" value="${subs[subName]}">
                </div>
            `;
        });
    }

    saveSubjects() {
        const rows = document.querySelectorAll('.subject-row');
        const newSubjectsDict = {};
        const renames = []; 

        rows.forEach(row => {
            const oldName = row.dataset.oldname;
            const newName = row.querySelector('.subject-name-input').value.trim() || oldName;
            const newColor = row.querySelector('.subject-color-input').value;
            
            newSubjectsDict[newName] = newColor;
            if (oldName !== newName) renames.push({ old: oldName, new: newName });
        });

        store.update('subjects', () => newSubjectsDict);

        if (renames.length > 0) {
            store.update('blocks', blocks => blocks.map(b => {
                const match = renames.find(r => r.old === b.subject);
                return match ? { ...b, subject: match.new } : b;
            }));
            store.update('exams', exams => exams.map(e => {
                const match = renames.find(r => r.old === e.subject);
                return match ? { ...e, subject: match.new } : e;
            }));
        }
    }
}
export const settingsManager = new SettingsManager();

// js/SettingsManager.js
import { store, audioDB } from './State.js';

class SettingsManager {
    init() {
        this.panel = document.getElementById('settingsPanel');
        this.overlay = document.getElementById('settingsOverlay');
        this.subjectList = document.getElementById('settingsSubjectList');
        this.bgMode = document.getElementById('settingsBgMode');
        this.bgColorDiv = document.getElementById('settingsBgColorDiv');
        this.bgImageDiv = document.getElementById('settingsBgImageDiv');
        
        this.customAudioUpload = document.getElementById('customAudioUpload');
        this.customAudioList = document.getElementById('customAudioList');
        this.sourceSelect = document.getElementById('settingsAudioSource');
        this.breakSourceSelect = document.getElementById('settingsAudioBreakSource');
        
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

        // 🚨 CUSTOM AUDIO UPLOAD BINDING
        this.customAudioUpload?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 20 * 1024 * 1024) return alert("File too large! Keep under 20MB.");
            
            const track = {
                id: `custom_${Date.now()}`,
                name: file.name,
                blob: file
            };
            
            try {
                await audioDB.save(track);
                alert(`${file.name} saved securely to your local library!`);
                await this.renderCustomAudio();
            } catch (err) {
                console.error("Audio Save Error:", err);
                alert("Failed to save audio. Your browser might be restricting storage.");
            }
        });
    }

    async populateForms() {
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

        if (theme.bgType === 'color') { this.bgColorDiv?.classList.remove('hidden'); this.bgImageDiv?.classList.add('hidden'); } 
        else { this.bgColorDiv?.classList.add('hidden'); this.bgImageDiv?.classList.remove('hidden'); }

        this.renderSubjectList();
        
        // Render Custom Audio Database
        await this.renderCustomAudio();
        
        // Restore Select values after dynamically populating them
        if(this.sourceSelect) this.sourceSelect.value = audio.source || 'lofi';
        if(this.breakSourceSelect) this.breakSourceSelect.value = audio.breakSource || 'upbeat';
    }

    async renderCustomAudio() {
        if (!this.customAudioList || !this.sourceSelect || !this.breakSourceSelect) return;
        
        try {
            const tracks = await audioDB.getAll();
            
            // Render UI List
            this.customAudioList.innerHTML = '';
            if (tracks.length === 0) {
                this.customAudioList.innerHTML = '<div class="text-[10px] text-gray-400 font-bold text-center italic py-2">No custom tracks uploaded yet.</div>';
            }
            
            // Render Dropdowns
            const injectOptions = (selectEl, optgroupLabel) => {
                let optgroup = selectEl.querySelector(`optgroup[label="${optgroupLabel}"]`);
                if (optgroup) optgroup.remove(); // Clear old custom options
                
                if (tracks.length > 0) {
                    optgroup = document.createElement('optgroup');
                    optgroup.label = optgroupLabel;
                    tracks.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.id;
                        opt.textContent = `🎵 ${t.name}`;
                        optgroup.appendChild(opt);
                    });
                    selectEl.appendChild(optgroup);
                }
            };

            injectOptions(this.sourceSelect, "My Uploaded Tracks");
            injectOptions(this.breakSourceSelect, "My Uploaded Tracks");

            // Build UI Elements
            tracks.forEach(t => {
                const row = document.createElement('div');
                row.className = "flex justify-between items-center bg-white p-2 rounded border text-xs shadow-sm";
                row.innerHTML = `
                    <span class="font-bold text-gray-700 truncate mr-2" title="${t.name}">🎵 ${t.name}</span>
                    <button class="delete-audio text-red-500 hover:text-red-700 font-black"><i class="fa-solid fa-trash"></i></button>
                `;
                
                row.querySelector('.delete-audio').addEventListener('click', async () => {
                    if(confirm("Delete this track?")) {
                        await audioDB.delete(t.id);
                        await this.renderCustomAudio();
                    }
                });
                
                this.customAudioList.appendChild(row);
            });

        } catch (e) {
            console.error("Error rendering DB audio", e);
        }
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
            breakSource: document.getElementById('settingsAudioBreakSource').value
        };
        store.update('audio', () => newAudio);
    }
}
export const settingsManager = new SettingsManager();

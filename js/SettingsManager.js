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
        this.bindEmojiSpawner();
    }

    bindEmojiSpawner() {
        document.getElementById('spawnEmojiBtn')?.addEventListener('click', () => {
            const input = document.getElementById('customEmojiInput');
            const sizeInput = document.getElementById('customEmojiSize');
            if (!input) return;
            const emoji = input.value.trim();
            if (!emoji) return;
            
            // 🚨 ADD SIZE CONTROL TO THE STICKER DATA
            const size = sizeInput ? parseFloat(sizeInput.value) : 3;
            
            store.update('header', h => ({
                ...h,
                stickers: [...(h.stickers || []), { emoji, x: 50, y: 50, size: size, id: Date.now().toString() }]
            }));
            input.value = ''; 
        });
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
            if (e.target.value === 'color') { this.bgColorDiv.classList.remove('hidden'); this.bgImageDiv.classList.add('hidden'); }
            else { this.bgColorDiv.classList.add('hidden'); this.bgImageDiv.classList.remove('hidden'); }
        });

        document.getElementById('saveAllSettingsBtn')?.addEventListener('click', () => {
            this.saveAllSettings();
            alert("All Settings Saved Successfully!");
            closeSettings();
        });

        this.customAudioUpload?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            if (file.size > 15 * 1024 * 1024) return alert("File must be under 15MB");
            
            const id = 'custom_' + Date.now();
            await audioDB.save(id, file);
            await this.refreshCustomAudioDropdowns();
            this.sourceSelect.value = id;
            alert("Custom audio uploaded successfully!");
        });
        // 🚨 BIND THE SUPPORT TICKET BUTTON
        document.getElementById('sendSupportTicketBtn')?.addEventListener('click', async () => {
            const msgInput = document.getElementById('supportTicketMsg');
            const msg = msgInput.value.trim();
            const btn = document.getElementById('sendSupportTicketBtn');
            
            if (!msg) {
                alert("Please describe your issue first!");
                return;
            }

            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sending...';
            btn.disabled = true;

            try {
                // Dynamically import the function to avoid circular dependency issues
                const { submitSupportTicket } = await import('./State.js');
                await submitSupportTicket(msg);
                
                msgInput.value = '';
                btn.innerHTML = '<i class="fa fa-check text-green-400"></i> Sent!';
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.disabled = false;
                }, 3000);
            } catch (e) {
                alert("Failed to send message. Please try again.");
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });
    }

    async refreshCustomAudioDropdowns() {
        const ids = await audioDB.getAllIds();
        
        Array.from(this.sourceSelect.options).forEach(opt => { if(opt.value.startsWith('custom_')) opt.remove(); });
        Array.from(this.breakSourceSelect.options).forEach(opt => { if(opt.value.startsWith('custom_')) opt.remove(); });
        this.customAudioList.innerHTML = '';

        ids.forEach(id => {
            const timeStr = new Date(parseInt(id.split('_')[1])).toLocaleString();
            
            const opt1 = new Option(`Custom Audio (${timeStr})`, id);
            const opt2 = new Option(`Custom Audio (${timeStr})`, id);
            this.sourceSelect.add(opt1); this.breakSourceSelect.add(opt2);

            const item = document.createElement('div');
            item.className = 'flex justify-between items-center bg-gray-100 p-2 rounded text-sm mb-1';
            item.innerHTML = `<span>Audio (${timeStr})</span> <button class="text-red-500 font-bold hover:underline delete-audio" data-id="${id}">Delete</button>`;
            this.customAudioList.appendChild(item);
        });

        document.querySelectorAll('.delete-audio').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idToDelete = e.target.dataset.id;
                await audioDB.delete(idToDelete);
                
                if(store.state.audio.source === idToDelete) store.update('audio', a => ({...a, source: 'none'}));
                if(store.state.audio.breakSource === idToDelete) store.update('audio', a => ({...a, breakSource: 'none'}));
                
                await this.refreshCustomAudioDropdowns();
                this.populateForms();
            });
        });
    }

    async populateForms() {
        const subs = store.state.subjects;
        this.subjectList.innerHTML = '';
        Object.keys(subs).forEach(s => {
            this.subjectList.innerHTML += `
                <div class="flex items-center gap-2 mb-2 subject-row">
                    <input type="text" class="sub-name flex-1 border p-1 rounded font-bold text-sm" value="${s}" data-old="${s}">
                    <input type="color" class="sub-color w-8 h-8 rounded border" value="${subs[s]}">
                    <button class="sub-del text-red-500 font-black px-2">&times;</button>
                </div>
            `;
        });

        document.querySelectorAll('.sub-del').forEach(btn => {
            btn.addEventListener('click', (e) => e.target.closest('.subject-row').remove());
        });

        const st = store.state.settings;
        document.getElementById('settingsPStudy').value = st.pStudy;
        document.getElementById('settingsPBreak').value = st.pBreak;

        await this.refreshCustomAudioDropdowns();

        const au = store.state.audio;
        document.getElementById('settingsAudioEnabled').checked = au.enabled;
        document.getElementById('settingsAudioVolume').value = au.volume;
        this.sourceSelect.value = au.source;
        this.breakSourceSelect.value = au.breakSource;

        const th = store.state.theme;
        this.bgMode.value = th.bgType || 'color';
        document.getElementById('settingsBgColor').value = th.bgColor || '#f3f4f6';
        document.getElementById('settingsBgImage').value = th.bgImage || '';
        document.getElementById('settingsActionColor').value = th.actionColor || '#3b82f6';
        
        document.getElementById('settingsActionSize').value = th.actionSize || 'md';
        document.getElementById('settingsFloatingBtn').value = th.floatingBtn || 'md';
        document.getElementById('settingsBannerBg').value = th.bannerBgColor || '#dc2626';
        document.getElementById('settingsBannerText').value = th.bannerTextColor || '#ffffff';

        const hd = store.state.header;
        document.getElementById('settingsAppTitle').value = hd.title || 'Study Planner Pro';
        document.getElementById('settingsHeaderBg').value = hd.bgColor || '#ffffff';
        document.getElementById('settingsHeaderTextColor').value = hd.textColor || '#1f2937';

        this.bgMode.dispatchEvent(new Event('change'));
    }

    saveAllSettings() {
        const renames = []; const newSubs = {};
        document.querySelectorAll('.subject-row').forEach(row => {
            const oldName = row.querySelector('.sub-name').dataset.old;
            const newName = row.querySelector('.sub-name').value.trim();
            const color = row.querySelector('.sub-color').value;
            if (!newName) return;
            newSubs[newName] = color;
            if (oldName !== newName) renames.push({ old: oldName, new: newName });
        });
        store.update('subjects', () => newSubs);
        if (renames.length > 0) {
            store.update('blocks', blocks => blocks.map(b => { const match = renames.find(r => r.old === b.subject); return match ? { ...b, subject: match.new } : b; }));
            store.update('exams', exams => exams.map(e => { const match = renames.find(r => r.old === e.subject); return match ? { ...e, subject: match.new } : e; }));
        }

        store.update('theme', t => ({
            ...t,
            bgType: this.bgMode.value,
            bgColor: document.getElementById('settingsBgColor').value,
            bgImage: document.getElementById('settingsBgImage').value,
            actionColor: document.getElementById('settingsActionColor').value,
            actionSize: document.getElementById('settingsActionSize').value,
            floatingBtn: document.getElementById('settingsFloatingBtn').value,
            bannerBgColor: document.getElementById('settingsBannerBg').value,
            bannerTextColor: document.getElementById('settingsBannerText').value
        }));

        store.update('settings', s => ({
            ...s,
            pStudy: parseInt(document.getElementById('settingsPStudy').value) || 25,
            pBreak: parseInt(document.getElementById('settingsPBreak').value) || 5
        }));

        store.update('audio', a => ({
            enabled: document.getElementById('settingsAudioEnabled').checked,
            volume: parseInt(document.getElementById('settingsAudioVolume').value) || 50,
            source: document.getElementById('settingsAudioSource').value,
            breakSource: document.getElementById('settingsAudioBreakSource').value
        }));

        store.update('header', h => ({
            ...h,
            title: document.getElementById('settingsAppTitle').value || 'Study Planner Pro',
            bgColor: document.getElementById('settingsHeaderBg').value || '#ffffff',
            textColor: document.getElementById('settingsHeaderTextColor').value || '#1f2937'
        }));
    }
}
export const settingsManager = new SettingsManager();

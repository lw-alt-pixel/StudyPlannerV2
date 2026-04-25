// js/SettingsManager.js
import { store, audioDB, fetchUpdateLogs } from './State.js';

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
        this.renderSubjectList();
        this.bindEmojiSpawner();

        // 🚨 Listen for User Tickets to render the History Inbox
        store.subscribe('userTickets', (tickets) => this.renderTicketHistory(tickets));

        // 🚨 NEW: Check for unread updates on load
        this.checkForNewUpdates(); 
    }

    bindEmojiSpawner() {
        document.getElementById('spawnEmojiBtn')?.addEventListener('click', () => {
            const input = document.getElementById('customEmojiInput');
            const sizeInput = document.getElementById('customEmojiSize');
            if (!input) return;
            const emoji = input.value.trim();
            if (!emoji) return;
            
            const size = sizeInput ? parseFloat(sizeInput.value) : 3;
            
            store.update('header', h => {
                const stickers = h.stickers || [];
                stickers.push({ emoji, x: 50, y: 50, id: Date.now(), size });
                return { ...h, stickers };
            });
            input.value = '';
        });
    }

    bindEvents() {
        document.getElementById('closeSettingsPanel')?.addEventListener('click', () => {
            this.panel?.classList.add('translate-x-full');
            this.overlay?.classList.add('hidden');
        });

        this.bgMode?.addEventListener('change', (e) => {
            if (e.target.value === 'color') {
                this.bgColorDiv.classList.remove('hidden'); this.bgColorDiv.classList.add('flex');
                this.bgImageDiv.classList.add('hidden');
            } else {
                this.bgColorDiv.classList.add('hidden'); this.bgColorDiv.classList.remove('flex');
                this.bgImageDiv.classList.remove('hidden');
            }
        });

        this.customAudioUpload?.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file || !audioDB) return;
            try {
                const id = 'local_' + Date.now();
                await audioDB.save(id, file, file.name);
                await this.refreshCustomAudioDropdowns();
                e.target.value = '';
            } catch (err) { console.error("Audio save failed", err); }
        });
// 🚨 NEW: Update Logs Modal Logic
        // 🚨 UPDATED: Update Logs Modal Logic & Notification Dot
       // 🚨 UPGRADED: Update Logs Modal Logic & Shaking Bell
        document.getElementById('viewUpdateLogsBtn')?.addEventListener('click', (e) => {
            // Hide the red dot and stop the shaking animation!
            document.getElementById('updateNotificationDot')?.classList.add('hidden');
            e.currentTarget.classList.remove('animate-bounce');
            
            // Save the exact time they clicked it to their browser
            localStorage.setItem('lastViewedUpdate', Date.now());
            
            this.renderUpdateLogs();
            document.getElementById('updateLogsModal')?.classList.remove('hidden');
        });
        
        document.getElementById('closeUpdateLogsBtn')?.addEventListener('click', () => {
            document.getElementById('updateLogsModal')?.classList.add('hidden');
        });
        // 🚨 SEND TICKET EVENT
        document.getElementById('sendSupportTicketBtn')?.addEventListener('click', async () => {
            const msgInput = document.getElementById('supportTicketMsg');
            const msg = msgInput.value.trim();
            const btn = document.getElementById('sendSupportTicketBtn');
            
            if (!msg) { alert("Please describe your issue first!"); return; };




            
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Sending...';
            btn.disabled = true;

            try {
                const { submitSupportTicket } = await import('./State.js');
                await submitSupportTicket(msg);
                
                msgInput.value = '';
                btn.innerHTML = '<i class="fa fa-check text-green-400"></i> Sent!';
                setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 3000);
            } catch (e) {
                alert("Failed to send message. Please try again.");
                btn.innerHTML = originalText; btn.disabled = false;
            }
        });

        // 🚨 THE MASTER SAVE BUTTON (Now saves Display Name properly)
        document.getElementById('saveAllSettingsBtn')?.addEventListener('click', () => {
            store.update('theme', t => ({
                ...t,
                bgMode: this.bgMode.value,
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
                source: this.sourceSelect.value,
                breakSource: this.breakSourceSelect.value
            }));

            store.update('header', h => ({
                ...h,
                title: document.getElementById('settingsAppTitle').value || 'Study Planner Pro',
                bgColor: document.getElementById('settingsHeaderBg').value || '#ffffff',
                textColor: document.getElementById('settingsHeaderTextColor').value || '#1f2937'
            }));

            // Timer settings
            store.update('timerSettings', ts => ({
                ...(ts || {}),
                applyPomodoro: !!document.getElementById('settingsApplyPomodoro').checked,
                countStudyPhase: !!document.getElementById('settingsCountStudyPhase').checked,
                countBreakPhase: !!document.getElementById('settingsCountBreakPhase').checked
            }));

            // 🚨 SAVE DISPLAY NAME
            const newDisplayName = document.getElementById('settingsDisplayName')?.value.trim();
            if (newDisplayName !== undefined) {
                store.update('userProfile', p => p ? { ...p, displayName: newDisplayName } : p);
            }

            alert("Settings Saved!");
            document.getElementById('closeSettingsPanel')?.click();
        });
    }

    async refreshCustomAudioDropdowns() {
        if (!audioDB) return;
        const ids = await audioDB.getAllIds();
        
        document.querySelectorAll('.custom-local-audio').forEach(el => el.remove());

        const addOptions = (selectEl) => {
            ids.forEach(id => {
                const opt = document.createElement('option');
                opt.value = id; opt.className = 'custom-local-audio';
                opt.text = `Local: Custom Audio (${id.substr(6,4)})`;
                selectEl.appendChild(opt);
            });
        };

        addOptions(this.sourceSelect); addOptions(this.breakSourceSelect);
        this.renderCustomAudioList(ids);
    }

    async renderCustomAudioList(ids) {
        if (!this.customAudioList) return;
        this.customAudioList.innerHTML = '';
        ids.forEach(id => {
            const div = document.createElement('div');
            div.className = "flex justify-between items-center bg-gray-50 p-2 rounded border border-gray-200";
            div.innerHTML = `<span class="text-xs font-bold text-gray-600 truncate">Track ${id.substr(6,4)}</span>
                             <button class="text-red-500 hover:text-red-700 font-bold px-2 py-1"><i class="fa fa-trash"></i></button>`;
            div.querySelector('button').onclick = async () => {
                await audioDB.delete(id); await this.refreshCustomAudioDropdowns();
            };
            this.customAudioList.appendChild(div);
        });
    }

    // 🚨 RENDERS THE TICKETS IN THE SETTINGS PANEL
    renderTicketHistory(tickets) {
        const container = document.getElementById('userSupportHistoryList');
        if (!container) return;
        
        if (!tickets || tickets.length === 0) {
            container.innerHTML = '<div class="text-xs text-gray-400 font-bold text-center mt-4">No previous tickets.</div>';
            return;
        }

        // Sort dynamically so newest is at the top
        const sortedTickets = [...tickets].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        container.innerHTML = '';
        sortedTickets.forEach(t => {
            const el = document.createElement('div');
            el.className = 'p-3 bg-gray-50 border border-gray-200 rounded-xl shadow-sm';
            
            const dateStr = t.timestamp ? new Date(t.timestamp).toLocaleDateString() : 'Unknown Date';
            const isAnswered = t.status === 'answered';
            
            let adminReplyHtml = '';
            if (isAnswered) {
                adminReplyHtml = `
                    <div class="mt-2 p-2 bg-blue-100/50 border border-blue-200 rounded-lg">
                        <div class="text-[9px] font-black text-blue-600 uppercase tracking-widest mb-1"><i class="fa fa-reply mr-1"></i>Admin Reply:</div>
                        <div class="text-xs font-bold text-gray-800">${t.adminResponse}</div>
                    </div>
                `;
            }

            el.innerHTML = `
                <div class="flex justify-between items-center mb-1">
                    <span class="text-[9px] font-black text-gray-400 uppercase tracking-widest">${dateStr}</span>
                    <span class="text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${isAnswered ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${t.status}</span>
                </div>
                <div class="text-xs font-bold text-gray-600 italic">"${t.message}"</div>
                ${adminReplyHtml}
            `;
            container.appendChild(el);
        });
    }
// 🚨 NEW: Fetch and Render the Update Logs
    // 🚨 NEW: Checks if there is a new update the user hasn't seen
    // 🚨 NEW: Checks if there is a new update the user hasn't seen
    async checkForNewUpdates() {
        try {
            const logs = await fetchUpdateLogs();
            if (logs && logs.length > 0) {
                // Get the timestamp of the very newest log
                const latestLogTime = new Date(logs[0].date).getTime();
                // Get the timestamp of the last time the user clicked the Bell
                const lastViewed = localStorage.getItem('lastViewedUpdate') || 0;
                
                // If the update is newer than their last view, show dot & shake!
                if (latestLogTime > lastViewed) {
                    document.getElementById('updateNotificationDot')?.classList.remove('hidden');
                    document.getElementById('viewUpdateLogsBtn')?.classList.add('animate-bounce');
                }
            }
        } catch (e) {
            console.error("Failed to check for updates:", e);
        }
    }
    async renderUpdateLogs() {
        const container = document.getElementById('updateLogsContainer');
        if (!container) return;
        
        // Show loading state
        container.innerHTML = '<div class="text-center py-10 text-gray-400 font-bold flex flex-col items-center"><i class="fa fa-spinner fa-spin text-3xl mb-3 text-blue-500"></i><p>Fetching latest updates...</p></div>';
        
        const logs = await fetchUpdateLogs();
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="text-center py-10 text-gray-400 font-bold"><p>No updates found.</p></div>';
            return;
        }

        // Render the logs beautifully
        container.innerHTML = logs.map(log => `
            <div class="mb-4 bg-gray-50 border border-gray-100 p-5 rounded-3xl shadow-sm relative overflow-hidden transition-transform hover:-translate-y-1">
                <div class="absolute top-0 left-0 w-1.5 h-full bg-blue-500 rounded-l-3xl"></div>
                <h3 class="font-black text-gray-800 text-lg mb-1 leading-tight">${log.title}</h3>
                <div class="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-1">
                    <i class="fa fa-clock"></i> ${log.formattedDate || new Date(log.date).toLocaleString()}
                </div>
                <p class="text-sm font-bold text-gray-600 leading-relaxed whitespace-pre-wrap">${log.message}</p>
            </div>
        `).join('');
    }
    async populateForms() {
        const t = store.state.theme || {};
        const h = store.state.header || {};
        const s = store.state.settings || {};
        const a = store.state.audio || {};
        const p = store.state.userProfile || {};

        const safeSet = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };

        safeSet('settingsBgMode', t.bgMode || 'color');
        safeSet('settingsBgColor', t.bgColor || '#f9fafb');
        safeSet('settingsBgImage', t.bgImage || '');
        safeSet('settingsActionColor', t.actionColor || '#3b82f6');
        safeSet('settingsActionSize', t.actionSize || 'md');
        safeSet('settingsFloatingBtn', t.floatingBtn || 'md');
        safeSet('settingsBannerBg', t.bannerBgColor || '#dc2626');
        safeSet('settingsBannerText', t.bannerTextColor || '#ffffff');

        safeSet('settingsPStudy', s.pStudy || 25);
        safeSet('settingsPBreak', s.pBreak || 5);

        // Timer settings
        const tSettings = store.state.timerSettings || {};
        const applyEl = document.getElementById('settingsApplyPomodoro');
        if (applyEl) applyEl.checked = tSettings.applyPomodoro !== false;
        const cs = document.getElementById('settingsCountStudyPhase');
        if (cs) cs.checked = tSettings.countStudyPhase !== false;
        const cb = document.getElementById('settingsCountBreakPhase');
        if (cb) cb.checked = !!tSettings.countBreakPhase;

        const aEnabled = document.getElementById('settingsAudioEnabled');
        if (aEnabled) aEnabled.checked = !!a.enabled;
        safeSet('settingsAudioVolume', a.volume || 50);
        
        safeSet('settingsAppTitle', h.title || 'Study Planner Pro');
        safeSet('settingsHeaderBg', h.bgColor || '#ffffff');
        safeSet('settingsHeaderTextColor', h.textColor || '#1f2937');

        // 🚨 LOAD DISPLAY NAME
        safeSet('settingsDisplayName', p.displayName || '');

        await this.refreshCustomAudioDropdowns();
        
        if(this.sourceSelect) this.sourceSelect.value = a.source || 'none';
        if(this.breakSourceSelect) this.breakSourceSelect.value = a.breakSource || 'none';

        if (this.bgMode) this.bgMode.dispatchEvent(new Event('change'));
        // render subjects UI
        this.renderSubjectList();
    }

    renderSubjectList() {
        if (!this.subjectList) return;
        const subs = store.state.subjects || {};
        const activeMap = store.state.subjectsActive || {};
        this.subjectList.innerHTML = '';

        // Add new subject form
        const addDiv = document.createElement('div');
        addDiv.className = 'flex gap-2 items-center mb-3';
        addDiv.innerHTML = `
            <input id="newSettingsSubjectName" placeholder="Subject name" class="flex-1 p-2 border rounded text-sm" />
            <input id="newSettingsSubjectColor" type="color" value="#3b82f6" class="w-10 h-10 p-1 border rounded" />
            <button id="addSettingsSubjectBtn" class="px-3 py-2 bg-blue-600 text-white rounded font-bold">Add</button>
        `;
        this.subjectList.appendChild(addDiv);

        document.getElementById('addSettingsSubjectBtn').onclick = () => {
            const name = document.getElementById('newSettingsSubjectName').value.trim();
            const color = document.getElementById('newSettingsSubjectColor').value;
            if (!name) return alert('Enter a subject name');
            if (store.state.subjects[name]) return alert('Subject already exists');
            // Add to subjects and mark active
            store.update('subjects', s => ({ ...s, [name]: color }));
            store.update('subjectsActive', m => ({ ...(m||{}), [name]: true }));
            document.getElementById('newSettingsSubjectName').value = '';
            this.renderSubjectList();
        };

        Object.keys(subs).forEach(s => {
            const color = subs[s];
            const active = activeMap[s] !== false;
            const row = document.createElement('div');
            row.className = 'flex items-center gap-2 p-2 bg-gray-50 rounded border';
            row.innerHTML = `
                <div class="w-3 h-3 rounded" style="background:${color}"></div>
                <div class="flex-1 text-sm font-bold">${s}</div>
                <input type="color" class="subject-color" value="${color}" />
                <button class="toggle-active px-2 py-1 text-sm rounded ${active ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}">${active ? 'Active' : 'Inactive'}</button>
                <button class="rename-subject px-2 py-1 text-sm bg-white border rounded">Rename</button>
                <button class="delete-subject px-2 py-1 text-sm bg-red-100 text-red-700 rounded">Delete</button>
            `;

            // color change
            row.querySelector('.subject-color').onchange = (e) => {
                const newColor = e.target.value;
                store.update('subjects', subsOld => ({ ...subsOld, [s]: newColor }));
                this.renderSubjectList();
            };

            // toggle active (soft-delete)
            row.querySelector('.toggle-active').onclick = (e) => {
                const nowActive = !(activeMap[s] === false);
                store.update('subjectsActive', m => ({ ...(m||{}), [s]: !nowActive }));
                this.renderSubjectList();
            };

            // rename subject -- update all references
            row.querySelector('.rename-subject').onclick = () => {
                const newName = prompt('Rename subject', s);
                if (!newName || newName.trim() === '' || newName === s) return;
                if (store.state.subjects[newName]) return alert('A subject with that name already exists');
                const newColor = store.state.subjects[s];
                // Update subjects map
                store.update('subjects', subsOld => {
                    const copy = { ...subsOld };
                    delete copy[s];
                    copy[newName] = newColor;
                    return copy;
                });
                // Update active map
                store.update('subjectsActive', m => {
                    const copy = { ...(m||{}) };
                    copy[newName] = copy[s] === false ? false : (copy[s] === undefined ? true : copy[s]);
                    delete copy[s];
                    return copy;
                });
                // Update all blocks/exams/goals referencing this subject
                store.update('blocks', blocks => blocks.map(b => b.subject === s ? { ...b, subject: newName } : b));
                store.update('exams', exams => exams.map(x => x.subject === s ? { ...x, subject: newName } : x));
                store.update('goals', goals => goals.map(g => g.subject === s ? { ...g, subject: newName } : g));
                this.renderSubjectList();
            };

            // delete (soft) -> mark inactive
            row.querySelector('.delete-subject').onclick = () => {
                if (!confirm('Soft-delete this subject? Completed/historic items will keep showing the same name/color.')) return;
                store.update('subjectsActive', m => ({ ...(m||{}), [s]: false }));
                this.renderSubjectList();
            };

            this.subjectList.appendChild(row);
        });
    }
}
export const settingsManager = new SettingsManager();

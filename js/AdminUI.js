// js/AdminUI.js
import { pushGlobalBroadcast, pushGlobalHotfix, fetchAllUsers, toggleUserSuspension, fetchSupportTickets, replyToTicket, publishUpdateLog, fetchUserBlocks, forceDeleteUserBlocks } from './State.js';

class AdminUI {
    init() {
        this.modal = document.getElementById('adminDashboardModal');
        this.advancedBanModal = document.getElementById('advancedBanModal');
        this.inspectorModal = document.getElementById('dataInspectorModal');
        
        this.targetBanUid = null;
        this.currentInspectorUid = null; 
        
        this.bindEvents();
    }
    
    bindEvents() {
        document.getElementById('openAdminDashboardBtn')?.addEventListener('click', () => {
            this.modal?.classList.remove('hidden');
        });
        
        document.getElementById('closeAdminDashboardBtn')?.addEventListener('click', () => {
            this.modal?.classList.add('hidden');
        });
        
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.admin-tab-btn').forEach(b => {
                    b.classList.remove('active-admin-tab', 'bg-gray-200', 'text-gray-900');
                    b.classList.add('text-gray-600');
                });
                e.currentTarget.classList.add('active-admin-tab', 'bg-gray-200', 'text-gray-900');
                e.currentTarget.classList.remove('text-gray-600');
                
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
                
                const tabId = e.currentTarget.dataset.tab;
                document.getElementById(tabId)?.classList.remove('hidden');

                if (tabId === 'admin-users') this.loadUsers();
                if (tabId === 'admin-inbox') this.loadTickets();
            });
        });

        let selectedBanType = 'readonly';
        document.querySelectorAll('.ban-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.ban-type-btn').forEach(b => {
                    b.classList.remove('bg-orange-100', 'text-orange-700', 'border-orange-500', 'bg-red-100', 'text-red-700', 'border-red-500');
                    b.classList.add('bg-gray-100', 'text-gray-500', 'border-transparent');
                });
                selectedBanType = e.currentTarget.dataset.type;
                if(selectedBanType === 'readonly') e.currentTarget.classList.add('bg-orange-100', 'text-orange-700', 'border-orange-500');
                else e.currentTarget.classList.add('bg-red-100', 'text-red-700', 'border-red-500');
                e.currentTarget.classList.remove('bg-gray-100', 'text-gray-500', 'border-transparent');
            });
        });

        document.getElementById('closeBanModalBtn')?.addEventListener('click', () => {
            this.advancedBanModal.classList.remove('flex'); this.advancedBanModal.classList.add('hidden');
        });

        document.getElementById('executeBanBtn')?.addEventListener('click', async () => {
            if (!this.targetBanUid) return;
            const duration = parseInt(document.getElementById('banDurationSelect').value) || 24;
            const btn = document.getElementById('executeBanBtn');
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>'; btn.disabled = true;
            
            await toggleUserSuspension(this.targetBanUid, selectedBanType, duration);
            
            this.advancedBanModal.classList.remove('flex'); this.advancedBanModal.classList.add('hidden');
            btn.innerHTML = 'Execute'; btn.disabled = false;
            this.loadUsers();
        });
        
        document.getElementById('publishUpdateBtn')?.addEventListener('click', async () => {
            const title = document.getElementById('adminUpdateTitle').value.trim();
            const msg = document.getElementById('adminUpdateMsg').value.trim();
            if (!title || !msg) return alert("Please fill out both the title and the message.");
            
            const btn = document.getElementById('publishUpdateBtn');
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Publishing...'; btn.disabled = true;
            
            try {
                await publishUpdateLog(title, msg);
                alert("Update log successfully published to all users!");
                document.getElementById('adminUpdateTitle').value = '';
                document.getElementById('adminUpdateMsg').value = '';
            } catch (e) { alert("Error publishing update."); }
            btn.innerHTML = '<i class="fa fa-paper-plane mr-2"></i> Publish to All Users'; btn.disabled = false;
        });

        document.getElementById('sendBroadcastBtn')?.addEventListener('click', async () => {
            const msg = document.getElementById('adminBroadcastInput').value.trim();
            if(!msg) return alert("Please enter a message.");
            try { await pushGlobalBroadcast(msg, true); alert("Broadcast sent globally!");
            } catch(e) { alert("Error sending broadcast."); }
        });
        document.getElementById('clearBroadcastBtn')?.addEventListener('click', async () => {
            document.getElementById('adminBroadcastInput').value = '';
            try { await pushGlobalBroadcast('', false); alert("Banner cleared!");
            } catch(e) { alert("Error clearing banner."); }
        });
        // 🚨 UPDATE your existing broadcast push listener to include the duration dropdown:
        document.getElementById('pushBroadcastBtn')?.addEventListener('click', async () => {
            const input = document.getElementById('broadcastInput');
            const durationSelect = document.getElementById('broadcastDuration'); // We will add this in the HTML later
            if (!input || !input.value.trim()) return;
            
            const btn = document.getElementById('pushBroadcastBtn');
            const ogText = btn.innerHTML;
            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Pushing...'; 
            btn.disabled = true;
            
            try {
                // Check if admin selected an expiry time
                const duration = (durationSelect && durationSelect.value !== 'infinite') 
                    ? parseFloat(durationSelect.value) 
                    : null;
                    
                await pushGlobalBroadcast(input.value.trim(), duration);
                input.value = '';
                alert('Broadcast pushed globally! All online users will see it immediately.');
            } catch (e) {
                alert('Failed to push broadcast.');
            } finally {
                btn.innerHTML = ogText; btn.disabled = false;
            }
        });

        // 🚨 NEW: Add this right after the Broadcast logic to handle your Quick Templates
        document.querySelectorAll('.log-template-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.currentTarget.dataset.type;
                const titleInput = document.getElementById('updateLogTitle');
                const msgInput = document.getElementById('updateLogMessage');
                
                if (!titleInput || !msgInput) return;

                if (type === 'minor') {
                    titleInput.value = "🐛 Minor Bug Fixes & Stability";
                    msgInput.value = "We've squashed a few bugs and improved background stability for a smoother study experience.";
                } else if (type === 'ui') {
                    titleInput.value = "✨ UI/UX Enhancements";
                    msgInput.value = "We've polished the interface and improved animations to make your schedule look even better.";
                } else if (type === 'feature') {
                    titleInput.value = "🚀 New Feature Released";
                    msgInput.value = "Check out the brand new tools we've just added to help you maximize your focus!";
                }
            });
        });
        document.getElementById('pushHotfixBtn')?.addEventListener('click', async () => {
            const css = document.getElementById('adminCssHotfixInput').value;
            try { await pushGlobalHotfix(css); alert("Hotfix CSS injected globally!");
            } catch(e) { alert("Error pushing hotfix."); }
        });

        document.getElementById('closeInspectorModalBtn')?.addEventListener('click', () => {
            this.inspectorModal.classList.remove('flex'); this.inspectorModal.classList.add('hidden');
            this.currentInspectorUid = null;
        });

        document.getElementById('filterInspectorBtn')?.addEventListener('click', () => {
            this.loadInspectorData();
        });

        document.getElementById('forceDeleteBlocksBtn')?.addEventListener('click', async () => {
            const checkboxes = document.querySelectorAll('.inspector-checkbox:checked');
            if (checkboxes.length === 0) return alert('Please select at least one block to delete.');
            
            if (confirm(`⚠️ ESPIONAGE WARNING: Are you sure you want to PERMANENTLY ERASE ${checkboxes.length} blocks from this user's timeline? They will disappear from their screen instantly.`)) {
                const btn = document.getElementById('forceDeleteBlocksBtn');
                btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Nuking...'; btn.disabled = true;
                
                try {
                    const idsToDelete = Array.from(checkboxes).map(cb => cb.value);
                    await forceDeleteUserBlocks(this.currentInspectorUid, idsToDelete);
                    alert('Target blocks successfully wiped from the cloud.');
                    this.loadInspectorData(); 
                } catch (e) { alert("Error deleting blocks."); }
                
                btn.innerHTML = '<i class="fa fa-skull-crossbones mr-2"></i>Nuke Selected'; btn.disabled = false;
            }
        });
    }

    async loadUsers() {
        const container = document.getElementById('adminUserList');
        if (!container) return;
        container.innerHTML = '<div class="text-center text-gray-400 mt-10"><i class="fa fa-spinner fa-spin text-3xl"></i></div>';
        try {
            const users = await fetchAllUsers();
            container.innerHTML = '';
            if (users.length === 0) { container.innerHTML = '<div class="text-gray-500 font-bold">No users found.</div>'; return; }
            
            users.forEach(u => {
                if (u.banUntil && new Date(u.banUntil) < new Date()) u.status = 'active';

                const isRestricted = u.status === 'suspended' || u.status === 'readonly';
                const el = document.createElement('div');
                el.className = 'flex justify-between items-center p-4 bg-gray-50 border rounded-xl mb-2 hover:shadow-md transition-shadow';
                const lastSync = u.lastUpdated ? new Date(u.lastUpdated).toLocaleString() : 'Never synced';
                const totalBlocks = u.blocks ? u.blocks.length : 0;
                
                // 🚨 NEW FORMATTER: Gracefully handle missing emails
                let safeEmail = u.email ? u.email : 'No Email';
                let displayString = safeEmail;

                if (u.email && u.email.endsWith('@studyapp.com')) {
                    displayString = `👤 ${u.email.split('@')[0]} (Username Login)`;
                } else if (u.displayName) {
                    displayString = `${u.displayName} (${safeEmail})`;
                } else if (!u.email) {
                    displayString = `Unknown User (${safeEmail})`;
                }

                const MASTER_ADMIN_EMAIL = "luke.wong.1120@gmail.com"; 
                const isAdmin = u.email === MASTER_ADMIN_EMAIL;
                
                let actionButtons = '';
                if (isAdmin) {
                    actionButtons = `<div class="text-xs font-black text-purple-600 bg-purple-100 px-3 py-1 rounded-full"><i class="fa fa-shield-alt mr-1"></i> Immune</div>`;
                } else {
                    actionButtons = `
                        <button class="inspect-btn px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-lg text-sm shadow-md transition-transform active:scale-95" data-uid="${u.id}" data-name="${displayString}">
                            <i class="fa fa-user-secret mr-1"></i> Inspect Data
                        </button>
                        <button class="suspend-btn px-4 py-2 text-white font-black rounded-lg text-sm shadow-md transition-transform active:scale-95 ${isRestricted ? 'bg-green-500 hover:bg-green-600' : 'bg-red-600 hover:bg-red-700'}" data-uid="${u.id}" data-restricted="${isRestricted}" data-name="${displayString}">
                            ${isRestricted ? '<i class="fa fa-undo mr-1"></i> Revoke Ban' : '<i class="fa fa-gavel mr-1"></i> Restrict'}
                        </button>
                    `;
                }

                let statusBadge = `<span class="text-green-500 font-black"><i class="fa fa-check-circle"></i> Active</span>`;
                if (u.status === 'suspended') statusBadge = `<span class="text-red-500 font-black"><i class="fa fa-ban"></i> Suspended</span>`;
                if (u.status === 'readonly') statusBadge = `<span class="text-orange-500 font-black"><i class="fa fa-eye"></i> Read-Only</span>`;

                el.innerHTML = `
                    <div>
                        <div class="font-bold text-gray-800 text-lg">${displayString}</div>
                        <div class="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Status: ${statusBadge} | Blocks: ${totalBlocks} | Last Online: ${lastSync}</div>
                    </div>
                    <div class="flex gap-2 items-center">
                        ${actionButtons}
                    </div>
                `;
                
                if (!isAdmin) {
                    el.querySelector('.suspend-btn').addEventListener('click', async (e) => {
                        const btn = e.currentTarget;
                        const currentlyRestricted = btn.dataset.restricted === 'true';
                        if (currentlyRestricted) {
                            if (confirm('Revoke restriction and restore user to Active?')) {
                                btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
                                await toggleUserSuspension(btn.dataset.uid, 'active', 0);
                                this.loadUsers();
                            }
                        } else {
                            this.targetBanUid = btn.dataset.uid;
                            document.getElementById('banModalTargetText').innerText = `Target: ${btn.dataset.name}`;
                            this.advancedBanModal.classList.remove('hidden');
                            this.advancedBanModal.classList.add('flex');
                        }
                    });

                    el.querySelector('.inspect-btn').addEventListener('click', (e) => {
                        const btn = e.currentTarget;
                        this.currentInspectorUid = btn.dataset.uid;
                        document.getElementById('inspectorTargetName').innerText = `Target: ${btn.dataset.name}`;
                        document.getElementById('inspectorStartDate').value = '';
                        document.getElementById('inspectorEndDate').value = '';
                        
                        this.inspectorModal.classList.remove('hidden');
                        this.inspectorModal.classList.add('flex');
                        this.loadInspectorData();
                    });
                }
                container.appendChild(el);
            });
        } catch (e) { container.innerHTML = '<div class="text-red-500 font-bold p-4 bg-red-50 rounded-xl">Error loading users. Check permissions.</div>'; }
    }

    async loadInspectorData() {
        const container = document.getElementById('inspectorBlocksList');
        if (!container || !this.currentInspectorUid) return;
        
        container.innerHTML = '<div class="text-center mt-10"><i class="fa fa-spinner fa-spin text-5xl text-purple-500 drop-shadow-md"></i></div>';
        
        try {
            const blocks = await fetchUserBlocks(this.currentInspectorUid);
            const startNode = document.getElementById('inspectorStartDate').value;
            const endNode = document.getElementById('inspectorEndDate').value;
            
            let filtered = blocks;
            if (startNode) filtered = filtered.filter(b => (b.date || b.startDate) >= startNode);
            if (endNode) filtered = filtered.filter(b => (b.date || b.startDate) <= endNode);
            
            filtered.sort((a,b) => new Date(b.date || b.startDate || 0) - new Date(a.date || a.startDate || 0));

            container.innerHTML = '';
            if (filtered.length === 0) {
                container.innerHTML = '<div class="text-gray-400 font-bold text-center mt-10 text-xl"><i class="fa fa-ghost mb-2 text-3xl"></i><br>No blocks found for this criteria.</div>';
                return;
            }
            
            filtered.forEach(b => {
                const el = document.createElement('div');
                el.className = 'flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 mb-3 shadow-sm hover:border-purple-300 transition-colors cursor-pointer';
                
                const theDate = b.date || b.startDate || 'Unknown';
                const timeStr = `${b.scheduledStart || '?'} - ${b.scheduledEnd || '?'}`;
                let statusColor = b.status === 'completed' ? 'text-green-500' : 'text-blue-500';
                
                el.innerHTML = `
                    <input type="checkbox" class="inspector-checkbox w-6 h-6 text-purple-600 rounded cursor-pointer pointer-events-auto" value="${b.id}">
                    <div class="flex-1 pointer-events-none">
                        <div class="font-black text-gray-800 text-lg">${b.title || 'Focus Session'} <span class="text-[10px] text-gray-400 font-mono ml-2">ID: ${b.id.substring(0,6)}</span></div>
                        <div class="text-xs font-black uppercase tracking-widest ${statusColor}"><i class="fa fa-tag mr-1"></i>${b.subject} &nbsp;|&nbsp; <i class="fa fa-calendar mr-1"></i>${theDate} &nbsp;|&nbsp; <i class="fa fa-clock mr-1"></i>${timeStr}</div>
                        ${b.remarks ? `<div class="text-xs text-gray-500 italic mt-1 border-l-2 border-gray-300 pl-2">"${b.remarks}"</div>` : ''}
                    </div>
                `;
                
                el.addEventListener('click', (e) => {
                    if (e.target.type !== 'checkbox') {
                        const cb = el.querySelector('.inspector-checkbox');
                        cb.checked = !cb.checked;
                    }
                });

                container.appendChild(el);
            });
        } catch (e) { container.innerHTML = '<div class="text-red-500 font-bold text-center mt-10">Error decrypting data.</div>'; }
    }

    async loadTickets() {
        const container = document.getElementById('adminTicketList');
        if (!container) return;
        container.innerHTML = '<div class="text-center text-gray-400 mt-10"><i class="fa fa-spinner fa-spin text-3xl"></i></div>';
        try {
            const tickets = await fetchSupportTickets();
            container.innerHTML = '';
            if (tickets.length === 0) { container.innerHTML = '<div class="text-gray-500 font-bold">Inbox is empty.</div>'; return; }
            
            tickets.forEach(t => {
                const el = document.createElement('div');
                el.className = 'p-5 bg-gray-50 border rounded-xl mb-4 shadow-sm relative';
                const timeStr = t.timestamp ? new Date(t.timestamp).toLocaleString() : 'Unknown Time';
                const isAnswered = t.status === 'answered';
                
                // Formatter for Support Inbox Usernames
                let displayEmail = t.email || 'Unknown';
                if (displayEmail.endsWith('@studyapp.com')) displayEmail = displayEmail.split('@')[0] + " (Username)";

                let replyHtml = '';
                if (isAnswered) {
                    replyHtml = `
                        <div class="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                            <span class="text-[10px] font-black text-blue-600 uppercase tracking-widest block mb-1">Your Reply Sent:</span>
                            <div class="text-sm font-bold text-gray-800">${t.adminResponse}</div>
                        </div>
                    `;
                } else {
                    replyHtml = `
                        <div class="mt-4 flex gap-2">
                            <input type="text" class="reply-input flex-1 p-3 border border-gray-300 rounded-xl text-sm font-bold outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" placeholder="Type a direct reply to the user...">
                            <button class="reply-btn bg-blue-600 hover:bg-blue-700 text-white font-black px-6 py-3 rounded-xl text-sm shadow-md transition-transform active:scale-95" data-id="${t.id}">
                                <i class="fa fa-paper-plane mr-2"></i> Send
                            </button>
                        </div>
                    `;
                }

                el.innerHTML = `
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <div class="font-black text-gray-800 text-lg">${displayEmail}</div>
                            <div class="text-xs font-bold text-gray-400 uppercase tracking-widest">${timeStr}</div>
                        </div>
                        <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest shadow-inner ${isAnswered ? 'bg-gray-200 text-gray-600' : 'bg-yellow-100 text-yellow-700 animate-pulse'}">${t.status}</span>
                    </div>
                    <div class="text-sm text-gray-700 bg-white p-4 border border-gray-200 rounded-xl font-medium shadow-inner">"${t.message}"</div>
                    ${replyHtml}
                `;
                
                const replyBtn = el.querySelector('.reply-btn');
                if (replyBtn) {
                    replyBtn.addEventListener('click', async (e) => {
                        const btn = e.currentTarget;
                        const input = el.querySelector('.reply-input');
                        if (!input.value.trim()) return;
                        btn.disabled = true; btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
                        await replyToTicket(btn.dataset.id, input.value.trim());
                        this.loadTickets();
                    });
                }
                container.appendChild(el);
            });
        } catch (e) { container.innerHTML = '<div class="text-red-500 font-bold p-4 bg-red-50 rounded-xl">Error loading tickets.</div>'; }
    }
}
export const adminUI = new AdminUI();

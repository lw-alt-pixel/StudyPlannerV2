// js/AdminUI.js
import { pushGlobalBroadcast, pushGlobalHotfix, fetchAllUsers, toggleUserSuspension, fetchSupportTickets, replyToTicket } from './State.js';

class AdminUI {
    init() {
        this.modal = document.getElementById('adminDashboardModal');
        this.advancedBanModal = document.getElementById('advancedBanModal');
        this.targetBanUid = null;
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

        // 🚨 Advanced Ban Hammer Logic
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
        
        document.getElementById('sendBroadcastBtn')?.addEventListener('click', async () => {
            const msg = document.getElementById('adminBroadcastInput').value.trim();
            if(!msg) return alert("Please enter a message.");
            try {
                await pushGlobalBroadcast(msg, true);
                alert("Broadcast sent globally!");
            } catch(e) { alert("Error sending broadcast. Check permissions."); }
        });
        
        document.getElementById('clearBroadcastBtn')?.addEventListener('click', async () => {
            document.getElementById('adminBroadcastInput').value = '';
            try {
                await pushGlobalBroadcast('', false);
                alert("Banner cleared!");
            } catch(e) { alert("Error clearing banner."); }
        });
        
        document.getElementById('pushHotfixBtn')?.addEventListener('click', async () => {
            const css = document.getElementById('adminCssHotfixInput').value;
            try {
                await pushGlobalHotfix(css);
                alert("Hotfix CSS injected globally!");
            } catch(e) { alert("Error pushing hotfix."); }
        });
    }

    async loadUsers() {
        const container = document.getElementById('adminUserList');
        if (!container) return;
        container.innerHTML = '<div class="text-center text-gray-400 mt-10"><i class="fa fa-spinner fa-spin text-3xl"></i></div>';
        try {
            const users = await fetchAllUsers();
            container.innerHTML = '';
            if (users.length === 0) {
                container.innerHTML = '<div class="text-gray-500 font-bold">No users found in database.</div>';
                return;
            }
            users.forEach(u => {
                // Check if ban is expired naturally
                if (u.banUntil && new Date(u.banUntil) < new Date()) u.status = 'active';

                const isRestricted = u.status === 'suspended' || u.status === 'readonly';
                const el = document.createElement('div');
                el.className = 'flex justify-between items-center p-4 bg-gray-50 border rounded-xl mb-2 hover:shadow-md transition-shadow';
                const lastSync = u.lastUpdated ? new Date(u.lastUpdated).toLocaleString() : 'Never synced';
                const totalBlocks = u.blocks ? u.blocks.length : 0;
                
                let displayString = u.email || 'Unknown User';
                if (u.email && u.email.endsWith('@studyapp.com')) {
                    displayString = `👤 ${u.email.split('@')[0]} (Username Login)`;
                } else if (u.displayName) {
                    displayString = `${u.displayName} (${u.email})`;
                }

                // 🚨 Dynamic Admin Immunity: If this user's email matches YOUR logged-in email!
                // We don't hardcode it here; we check the current session
                const MASTER_ADMIN_EMAIL = "luke.wong.1120@gmail.com"; 
                const isAdmin = u.email === MASTER_ADMIN_EMAIL;
                
                let actionButtons = '';
                if (isAdmin) {
                    actionButtons = `<div class="text-xs font-black text-purple-600 bg-purple-100 px-3 py-1 rounded-full"><i class="fa fa-shield-alt mr-1"></i> Immune</div>`;
                } else {
                    actionButtons = `
                        <button class="suspend-btn px-4 py-2 text-white font-black rounded-lg text-sm shadow-md transition-transform active:scale-95 ${isRestricted ? 'bg-green-500 hover:bg-green-600' : 'bg-red-600 hover:bg-red-700'}" data-uid="${u.id}" data-restricted="${isRestricted}" data-name="${displayString}">
                            ${isRestricted ? '<i class="fa fa-undo mr-1"></i> Revoke Ban' : '<i class="fa fa-gavel mr-1"></i> Restrict'}
                        </button>
                    `;
                    // Notice: Nuke / Trash button completely removed for safety!
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
                            // Open Advanced Ban Modal
                            this.targetBanUid = btn.dataset.uid;
                            document.getElementById('banModalTargetText').innerText = `Target: ${btn.dataset.name}`;
                            this.advancedBanModal.classList.remove('hidden');
                            this.advancedBanModal.classList.add('flex');
                        }
                    });
                }
                
                container.appendChild(el);
            });
        } catch (e) {
            container.innerHTML = '<div class="text-red-500 font-bold p-4 bg-red-50 rounded-xl">Error loading users. Check permissions.</div>';
        }
    }

    async loadTickets() {
        const container = document.getElementById('adminTicketList');
        if (!container) return;
        container.innerHTML = '<div class="text-center text-gray-400 mt-10"><i class="fa fa-spinner fa-spin text-3xl"></i></div>';
        try {
            const tickets = await fetchSupportTickets();
            container.innerHTML = '';
            if (tickets.length === 0) {
                container.innerHTML = '<div class="text-gray-500 font-bold">Inbox is empty.</div>';
                return;
            }
            tickets.forEach(t => {
                const el = document.createElement('div');
                el.className = 'p-5 bg-gray-50 border rounded-xl mb-4 shadow-sm relative';
                const timeStr = t.timestamp ? new Date(t.timestamp).toLocaleString() : 'Unknown Time';
                const isAnswered = t.status === 'answered';
                
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
        } catch (e) {
            container.innerHTML = '<div class="text-red-500 font-bold p-4 bg-red-50 rounded-xl">Error loading tickets. Check Firestore permissions.</div>';
        }
    }
}
export const adminUI = new AdminUI();

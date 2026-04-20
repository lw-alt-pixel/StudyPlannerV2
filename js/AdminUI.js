// js/AdminUI.js
import { pushGlobalBroadcast, pushGlobalHotfix, fetchAllUsers, toggleUserSuspension, deleteUserData, fetchSupportTickets, replyToTicket } from './State.js';

class AdminUI {
    init() {
        this.modal = document.getElementById('adminDashboardModal');
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
                const isSuspended = u.status === 'suspended';
                const el = document.createElement('div');
                el.className = 'flex justify-between items-center p-4 bg-gray-50 border rounded-xl mb-2 hover:shadow-md transition-shadow';
                const lastSync = u.lastUpdated ? new Date(u.lastUpdated).toLocaleString() : 'Never synced';
                const totalBlocks = u.blocks ? u.blocks.length : 0;
                
                // 🚨 Format Display Name (Handle @studyapp.com fake emails gracefully)
                let displayString = u.email || 'Unknown User';
                if (u.email && u.email.endsWith('@studyapp.com')) {
                    displayString = `👤 ${u.email.split('@')[0]} (Username Login)`;
                } else if (u.displayName) {
                    displayString = `${u.displayName} (${u.email})`;
                }

                // 🚨 ADMIN IMMUNITY CHECK: Replace with YOUR actual admin email!
                const ADMIN_EMAIL = "your.email@gmail.com";
                const isAdmin = u.email === ADMIN_EMAIL;
                
                let actionButtons = '';
                if (isAdmin) {
                    actionButtons = `<div class="text-xs font-black text-purple-600 bg-purple-100 px-3 py-1 rounded-full"><i class="fa fa-shield-alt mr-1"></i> Admin Immunity</div>`;
                } else {
                    actionButtons = `
                        <button class="suspend-btn px-4 py-2 text-white font-black rounded-lg text-sm shadow-md transition-transform active:scale-95 ${isSuspended ? 'bg-orange-500 hover:bg-orange-600' : 'bg-red-600 hover:bg-red-700'}" data-uid="${u.id}" data-suspended="${isSuspended}">
                            ${isSuspended ? '<i class="fa fa-undo mr-1"></i> Unban' : '<i class="fa fa-ban mr-1"></i> Suspend'}
                        </button>
                        <button class="delete-user-btn px-4 py-2 bg-gray-800 hover:bg-black text-white font-black rounded-lg text-sm shadow-md transition-transform active:scale-95" data-uid="${u.id}" title="Permanently Erase User">
                            <i class="fa fa-trash"></i>
                        </button>
                    `;
                }

                el.innerHTML = `
                    <div>
                        <div class="font-bold text-gray-800 text-lg">${displayString} <span class="text-[10px] text-gray-400 ml-2 font-mono">${u.id}</span></div>
                        <div class="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Blocks: ${totalBlocks} | Last Online: ${lastSync}</div>
                    </div>
                    <div class="flex gap-2 items-center">
                        ${actionButtons}
                    </div>
                `;
                
                if (!isAdmin) {
                    el.querySelector('.suspend-btn').addEventListener('click', async (e) => {
                        const btn = e.currentTarget;
                        const currentlySuspended = btn.dataset.suspended === 'true';
                        if (confirm(currentlySuspended ? 'Unban this user?' : 'Suspend this user immediately? They will be locked out.')) {
                            btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
                            await toggleUserSuspension(btn.dataset.uid, !currentlySuspended);
                            this.loadUsers();
                        }
                    });
                    
                    el.querySelector('.delete-user-btn').addEventListener('click', async (e) => {
                        if (confirm('WARNING: This will permanently delete their database record. This cannot be undone. Proceed?')) {
                            e.currentTarget.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';
                            await deleteUserData(e.currentTarget.dataset.uid);
                            this.loadUsers();
                        }
                    });
                }
                
                container.appendChild(el);
            });
        } catch (e) {
            container.innerHTML = '<div class="text-red-500 font-bold p-4 bg-red-50 rounded-xl">Error loading users. Ensure your email is written into the Firestore Security Rules as an Admin.</div>';
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

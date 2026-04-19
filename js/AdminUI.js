// js/AdminUI.js
import { pushGlobalBroadcast, pushGlobalHotfix } from './State.js';

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
        
        // Tab switching logic for the dashboard
        document.querySelectorAll('.admin-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.admin-tab-btn').forEach(b => {
                    b.classList.remove('active-admin-tab', 'bg-gray-200', 'text-gray-900');
                    b.classList.add('text-gray-600');
                });
                e.currentTarget.classList.add('active-admin-tab', 'bg-gray-200', 'text-gray-900');
                e.currentTarget.classList.remove('text-gray-600');
                
                document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.add('hidden'));
                document.getElementById(e.currentTarget.dataset.tab)?.classList.remove('hidden');
            });
        });
        
        // Broadcast Power
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
        
        // Live CSS Hotfix Power
        document.getElementById('pushHotfixBtn')?.addEventListener('click', async () => {
            const css = document.getElementById('adminCssHotfixInput').value;
            try {
                await pushGlobalHotfix(css);
                alert("Hotfix CSS injected globally!");
            } catch(e) { alert("Error pushing hotfix."); }
        });
    }
}
export const adminUI = new AdminUI();

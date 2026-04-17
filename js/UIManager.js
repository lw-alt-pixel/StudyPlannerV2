// js/UIManager.js
import { store } from './State.js';

class UIManager {
    init() {
        this.bindEvents();
        store.subscribe('activeTab', (newTabId) => { this.renderTab(newTabId); });
        this.renderTab(store.state.activeTab);
    }

    bindEvents() {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (btn && btn.dataset.tab) store.update('activeTab', () => btn.dataset.tab);
        });
    }

    renderTab(tabId) {
        // Forcefully hide all tabs completely
        document.querySelectorAll('.tab-content').forEach(el => { 
            el.classList.add('hidden'); 
            el.classList.remove('block', 'flex'); 
        });
        
        // Forcefully render the active tab
        const activeContent = document.getElementById(tabId);
        if (activeContent) { 
            activeContent.classList.remove('hidden'); 
            // We use Flex Flex-Col so the internal charts and timers stretch correctly!
            activeContent.classList.add('flex', 'flex-col'); 
        }

        // Update Button Colors
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active-tab', 'text-white', 'shadow');
            btn.classList.add('text-gray-500', 'hover:bg-gray-200');
        });

        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-500', 'hover:bg-gray-200');
            activeBtn.classList.add('active-tab');
        }
    }
}
export const uiManager = new UIManager();

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
        // Forcefully hide all tabs and safely remove the 'flex' display class
        document.querySelectorAll('.tab-content').forEach(el => { 
            el.classList.add('hidden'); 
            el.classList.remove('flex'); 
        });
        
        // Forcefully render the active tab while preserving its strict flex-1 flex-col height chain
        const activeContent = document.getElementById(tabId);
        if (activeContent) { 
            activeContent.classList.remove('hidden'); 
            activeContent.classList.add('flex'); 
        }

        // Update Nav Button Colors
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active-tab', 'text-white', 'shadow');
            btn.classList.add('text-gray-500', 'hover:bg-gray-200');
        });

        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-500', 'hover:bg-gray-200');
            activeBtn.classList.add('active-tab', 'text-white', 'shadow');
        }
    }
}
export const uiManager = new UIManager();

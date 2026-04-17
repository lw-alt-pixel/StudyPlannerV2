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
        document.querySelectorAll('.tab-content').forEach(el => { el.classList.add('hidden'); el.classList.remove('block'); });
        const activeContent = document.getElementById(tabId);
        if (activeContent) { activeContent.classList.remove('hidden'); activeContent.classList.add('block'); }

        // Remove active class from all tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active-tab', 'text-white', 'shadow');
            btn.classList.add('text-gray-500', 'hover:bg-gray-200');
        });

        // Apply Theme engine active-tab CSS
        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-500', 'hover:bg-gray-200');
            activeBtn.classList.add('active-tab');
        }
    }
}
export const uiManager = new UIManager();

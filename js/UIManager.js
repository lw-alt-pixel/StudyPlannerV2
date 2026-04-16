// js/UIManager.js
import { store } from './State.js';

class UIManager {
    init() {
        this.bindEvents();

        // 1. Subscribe to the Brain! Whenever 'activeTab' changes, run renderTab()
        store.subscribe('activeTab', (newTabId) => {
            this.renderTab(newTabId);
        });

        // 2. Trigger the first render based on the default state
        this.renderTab(store.state.activeTab);
    }

    bindEvents() {
        // Listen for clicks on anything with the 'tab-btn' class
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.tab-btn');
            if (btn && btn.dataset.tab) {
                // Tell the Brain to update. The UI will change automatically!
                store.update('activeTab', () => btn.dataset.tab);
            }
        });
    }

    renderTab(tabId) {
        // Hide all contents
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.add('hidden');
            el.classList.remove('block');
        });

        // Show active content
        const activeContent = document.getElementById(tabId);
        if (activeContent) {
            activeContent.classList.remove('hidden');
            activeContent.classList.add('block');
        }

        // Update button styles
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('bg-blue-600', 'text-white', 'shadow');
            btn.classList.add('text-gray-500', 'hover:bg-gray-200');
        });

        // Highlight active button
        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-500', 'hover:bg-gray-200');
            activeBtn.classList.add('bg-blue-600', 'text-white', 'shadow');
        }
    }
}

export const uiManager = new UIManager();

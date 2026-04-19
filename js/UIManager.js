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
        document.querySelectorAll('.tab-content').forEach(el => { 
            el.classList.add('hidden'); 
            el.classList.remove('block', 'flex'); 
        });
        
        const activeContent = document.getElementById(tabId);
        if (activeContent) { 
            activeContent.classList.remove('hidden'); 
            activeContent.classList.add('flex', 'flex-col'); 
        }

        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active-tab', 'text-white', 'shadow');
            btn.classList.add('text-gray-500', 'hover:bg-gray-200');
        });

        const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
        if (activeBtn) {
            activeBtn.classList.remove('text-gray-500', 'hover:bg-gray-200');
            activeBtn.classList.add('active-tab', 'text-white', 'shadow');
        }

        // 🚨 HYBRID GLOBAL SCROLL LOGIC
        const body = document.getElementById('appBody');
        const main = document.getElementById('appMain');
        
        if (tabId === 'schedule') {
            // Lock body so Canvas drag panning doesn't bounce the whole browser window!
            body.classList.add('h-[100dvh]', 'overflow-hidden');
            main.classList.add('min-h-0');
        } else {
            // Unlock body so you can scroll the entire webpage naturally!
            body.classList.remove('h-[100dvh]', 'overflow-hidden');
            main.classList.remove('min-h-0');
        }
    }
}
export const uiManager = new UIManager();

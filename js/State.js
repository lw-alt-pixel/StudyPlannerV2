// js/State.js

// Load existing blocks from your hard drive, just like your old app!
const savedBlocks = JSON.parse(localStorage.getItem('studyBlocks')) || [];

export const defaultState = {
    activeTab: 'schedule', 
    blocks: savedBlocks, 
    theme: {
        appBgColor: '#f3f4f6',
        isGlassMode: true
    },
    timer: {
        activeBlockId: null, // NEW: The Brain now knows WHICH block we are studying
        mode: 'stopwatch', 
        phase: 'study',    
        isRunning: false
    }
};

class Store {
    constructor(initialState) {
        this.state = initialState;
        this.listeners = {};
    }

    subscribe(key, listener) {
        if (!this.listeners[key]) this.listeners[key] = [];
        this.listeners[key].push(listener);
    }

    update(key, updater) {
        const newValue = updater(this.state[key]);
        this.state[key] = newValue;
        
        // NEW: Every time blocks update, save them permanently!
        if (key === 'blocks') {
            localStorage.setItem('studyBlocks', JSON.stringify(newValue));
        }

        if (this.listeners[key]) {
            this.listeners[key].forEach(listener => listener(newValue));
        }
    }
}

export const store = new Store(defaultState);

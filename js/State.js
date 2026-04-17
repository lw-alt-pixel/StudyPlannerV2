// js/State.js

// Load blocks, but DESTROY old V1 "Ghost Blocks" that don't have a schedule!
const rawBlocks = JSON.parse(localStorage.getItem('studyBlocks')) || [];
const savedBlocks = rawBlocks.filter(b => b.scheduledStart && b.scheduledEnd);

export const defaultState = {
    activeTab: 'schedule', 
    blocks: savedBlocks, 
    theme: {
        appBgColor: '#f3f4f6',
        isGlassMode: true
    },
    timer: {
        activeBlockId: null, 
        mode: 'stopwatch', 
        phase: 'study',    
        isRunning: false,
        // NEW: Add these default values so we never get NaN!
        studySeconds: 0,
        breakSeconds: 0,
        secondsElapsed: 0 
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
        
        if (key === 'blocks') {
            localStorage.setItem('studyBlocks', JSON.stringify(newValue));
        }

        if (this.listeners[key]) {
            this.listeners[key].forEach(listener => listener(newValue));
        }
    }
}

export const store = new Store(defaultState);

// js/State.js

// 1. Try to load saved blocks, otherwise use defaults
const savedBlocks = JSON.parse(localStorage.getItem('ypt_blocks'));
const defaultBlocks = savedBlocks || [
    { id: 1, title: 'Math Study', x: 200, y: 150, w: 200, h: 100, color: '#3b82f6' },
    { id: 2, title: 'Break', x: 450, y: 150, w: 100, h: 50, color: '#10b981' }
];

export const defaultState = {
    activeTab: 'schedule', 
    blocks: defaultBlocks, 
    theme: {
        appBgColor: '#f3f4f6',
        isGlassMode: true
    },
    // NEW TIMER MEMORY:
    timer: {
        mode: 'stopwatch', // Can be 'stopwatch' or 'pomodoro'
        phase: 'study',    // Can be 'study' or 'break'
        studySeconds: 0,
        breakSeconds: 0,
        isRunning: false
    }
};

class AppStore {
    constructor(initialState) {
        this.state = initialState;
        this.listeners = new Map();
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) this.listeners.set(key, []);
        this.listeners.get(key).push(callback);
    }

    update(key, updaterFunction) {
        this.state[key] = updaterFunction(this.state[key]);
        
        // 2. LONG TERM MEMORY: If blocks were updated, save them to the browser!
        if (key === 'blocks') {
            localStorage.setItem('ypt_blocks', JSON.stringify(this.state.blocks));
        }

        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(cb => cb(this.state[key], this.state));
        }
    }
}

export const store = new AppStore(defaultState);

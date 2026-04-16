// js/State.js

// This holds the default settings for the app
// js/State.js

export const defaultState = {
    activeTab: 'schedule', 
    blocks: [
        { id: 1, title: 'Math Study', x: 200, y: 150, w: 200, h: 100, color: '#3b82f6' },
        { id: 2, title: 'Break', x: 450, y: 150, w: 100, h: 50, color: '#10b981' }
    ],
    theme: {
        appBgColor: '#f3f4f6',
        isGlassMode: true
    },
    timer: {
        activeType: null,
        phase: 'STUDY',
        secondsElapsed: 0
    }
};

// ... the rest of the file stays exactly the same
class AppStore {
    constructor(initialState) {
        this.state = initialState;
        this.listeners = new Map(); // This will keep track of UI elements listening to changes
    }

    // Components use this to listen for data changes
    subscribe(key, callback) {
        if (!this.listeners.has(key)) this.listeners.set(key, []);
        this.listeners.get(key).push(callback);
    }

    // Use this to change data. It automatically tells the UI to update!
    update(key, updaterFunction) {
        this.state[key] = updaterFunction(this.state[key]);
        
        console.log(`🔄 State Updated: [${key}]`, this.state[key]); // Helpful for debugging!

        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(cb => cb(this.state[key], this.state));
        }
    }
}

// Create and export the single instance of the store
export const store = new AppStore(defaultState);

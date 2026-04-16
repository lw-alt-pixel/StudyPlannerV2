// js/State.js

// This holds the default settings for the app
export const defaultState = {
    activeTab: 'schedule', 
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

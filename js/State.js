// js/State.js
const rawBlocks = JSON.parse(localStorage.getItem('studyBlocks')) || [];
const savedBlocks = rawBlocks.filter(b => b.scheduledStart && b.scheduledEnd);
const savedExams = JSON.parse(localStorage.getItem('studyExams')) || [];

const savedSubjects = JSON.parse(localStorage.getItem('studySubjects')) || {
    'Mathematics': '#3b82f6',
    'Physics': '#ef4444',
    'Chemistry': '#10b981',
    'Biology': '#f59e0b',
    'English': '#8b5cf6',
    'History': '#ec4899',
    'Computer Science': '#14b8a6'
};

const savedSettings = JSON.parse(localStorage.getItem('studySettings')) || { pStudy: 25, pBreak: 5 };
const savedTheme = JSON.parse(localStorage.getItem('studyTheme')) || {
    bgType: 'color', bgColor: '#f3f4f6', bgImage: null,
    actionColor: '#2563eb', actionSize: 'md', tabColor: '#2563eb'
};

export const defaultState = {
    activeTab: 'schedule', 
    blocks: savedBlocks, 
    exams: savedExams, 
    subjects: savedSubjects, 
    theme: savedTheme,
    settings: savedSettings,
    timer: { 
        activeBlockId: null, mode: 'stopwatch', phase: 'study', isRunning: false,
        studySeconds: 0, breakSeconds: 0, secondsElapsed: 0 
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
        
        if (key === 'blocks') localStorage.setItem('studyBlocks', JSON.stringify(newValue));
        if (key === 'exams') localStorage.setItem('studyExams', JSON.stringify(newValue));
        if (key === 'subjects') localStorage.setItem('studySubjects', JSON.stringify(newValue));
        if (key === 'theme') localStorage.setItem('studyTheme', JSON.stringify(newValue));
        if (key === 'settings') localStorage.setItem('studySettings', JSON.stringify(newValue));

        if (this.listeners[key]) {
            this.listeners[key].forEach(listener => listener(newValue));
        }
    }
}
export const store = new Store(defaultState);

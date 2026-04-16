// js/App.js
import { store } from './State.js';

console.log("🚀 App.js is connected!");
console.log("🧠 Checking the Brain (State.js):", store.state);

// Let's test our update system!
store.update('activeTab', () => 'pomodoro');

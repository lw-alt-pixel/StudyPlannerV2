// js/State.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDTdBpVPHLiWmfj_dSAw3pGwn_suIsUISA",
    authDomain: "studyplannerv2.firebaseapp.com",
    projectId: "studyplannerv2",
    storageBucket: "studyplannerv2.firebasestorage.app",
    messagingSenderId: "62085612347",
    appId: "1:62085612347:web:3c8c882912dec4bb26ed1e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null; let syncTimeout = null;

const rawBlocks = JSON.parse(localStorage.getItem('studyBlocks')) || [];
const savedBlocks = rawBlocks.filter(b => b.scheduledStart && b.scheduledEnd);
const savedExams = JSON.parse(localStorage.getItem('studyExams')) || [];
const savedSubjects = JSON.parse(localStorage.getItem('studySubjects')) || {
    'Mathematics': '#3b82f6', 'Physics': '#ef4444', 'Chemistry': '#10b981', 'Biology': '#f59e0b', 'English': '#8b5cf6', 'History': '#ec4899', 'Computer Science': '#14b8a6'
};
const savedSettings = JSON.parse(localStorage.getItem('studySettings')) || { pStudy: 25, pBreak: 5 };
const savedTheme = JSON.parse(localStorage.getItem('studyTheme')) || {
    bgType: 'color', bgColor: '#f3f4f6', bgImage: null, actionColor: '#2563eb', actionSize: 'md', floatingBtn: 'md', tabColor: '#2563eb', bannerBgColor: '#dc2626', bannerTextColor: '#ffffff'
};
const savedDiaries = JSON.parse(localStorage.getItem('studyDiaries')) || {};

// 🚨 UPDATED: Added breakSource default
const savedAudio = JSON.parse(localStorage.getItem('studyAudio')) || { enabled: true, source: 'zen', breakSource: 'upbeat', volume: 50 };

export const defaultState = {
    activeTab: 'schedule', blocks: savedBlocks, exams: savedExams, subjects: savedSubjects, 
    theme: savedTheme, settings: savedSettings, diaries: savedDiaries, audio: savedAudio,
    timer: { activeBlockId: null, mode: 'stopwatch', phase: 'study', isRunning: false, studySeconds: 0, breakSeconds: 0, secondsElapsed: 0 },
    marathon: { active: false, isWaitingForCheckIn: false, strikes: 0, phases: [], currentPhaseIdx: -1, checkInTime: null, warned5Min: false }
};

class Store {
    constructor(initialState) { this.state = initialState; this.listeners = {}; }
    subscribe(key, listener) { if (!this.listeners[key]) this.listeners[key] = []; this.listeners[key].push(listener); }
    update(key, updater) {
        const newValue = updater(this.state[key]); this.state[key] = newValue;
        
        if (key === 'blocks') localStorage.setItem('studyBlocks', JSON.stringify(newValue));
        if (key === 'exams') localStorage.setItem('studyExams', JSON.stringify(newValue));
        if (key === 'subjects') localStorage.setItem('studySubjects', JSON.stringify(newValue));
        if (key === 'theme') localStorage.setItem('studyTheme', JSON.stringify(newValue));
        if (key === 'settings') localStorage.setItem('studySettings', JSON.stringify(newValue));
        if (key === 'diaries') localStorage.setItem('studyDiaries', JSON.stringify(newValue)); 
        if (key === 'audio') localStorage.setItem('studyAudio', JSON.stringify(newValue));

        if (this.listeners[key]) this.listeners[key].forEach(listener => listener(newValue));

        if (currentUser && key !== 'timer' && key !== 'activeTab' && key !== 'marathon') {
            clearTimeout(syncTimeout);
            syncTimeout = setTimeout(async () => {
                try {
                    const dataToSave = {
                        blocks: this.state.blocks, exams: this.state.exams, subjects: this.state.subjects,
                        theme: this.state.theme, settings: this.state.settings, diaries: this.state.diaries, audio: this.state.audio, updatedAt: new Date().toISOString()
                    };
                    await setDoc(doc(db, "users", currentUser.uid), dataToSave);
                } catch (e) { console.error("Cloud Sync Error:", e); }
            }, 2500); 
        }
    }
}
export const store = new Store(defaultState);

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const statusText = document.getElementById('cloudStatusText'); const statusIcon = document.getElementById('cloudStatusIcon');
    const authForms = document.getElementById('authForms'); const logoutBtn = document.getElementById('logoutBtn');
    const authUserDisplay = document.getElementById('authUserDisplay');

    if (user) {
        if (statusText) statusText.innerText = 'Synced';
        if (statusIcon) { statusIcon.innerText = '☁️'; statusIcon.classList.add('text-blue-500'); }
        if (authForms) authForms.classList.add('hidden');
        if (logoutBtn) logoutBtn.classList.remove('hidden');
        if (authUserDisplay) { authUserDisplay.classList.remove('hidden'); authUserDisplay.innerText = `Connected as: ${user.email}`; }

        try {
            const docRef = doc(db, "users", user.uid); const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.blocks) { store.state.blocks = data.blocks; localStorage.setItem('studyBlocks', JSON.stringify(data.blocks)); }
                if (data.exams) { store.state.exams = data.exams; localStorage.setItem('studyExams', JSON.stringify(data.exams)); }
                if (data.subjects) { store.state.subjects = data.subjects; localStorage.setItem('studySubjects', JSON.stringify(data.subjects)); }
                if (data.theme) { store.state.theme = data.theme; localStorage.setItem('studyTheme', JSON.stringify(data.theme)); }
                if (data.settings) { store.state.settings = data.settings; localStorage.setItem('studySettings', JSON.stringify(data.settings)); }
                if (data.diaries) { store.state.diaries = data.diaries; localStorage.setItem('studyDiaries', JSON.stringify(data.diaries)); }
                if (data.audio) { store.state.audio = data.audio; localStorage.setItem('studyAudio', JSON.stringify(data.audio)); }
                
                Object.keys(store.listeners).forEach(key => store.listeners[key].forEach(l => l(store.state[key])));
            }
        } catch (e) { console.error("Data Fetch Error:", e); }
    } else {
        if (statusText) statusText.innerText = 'Offline';
        if (statusIcon) { statusIcon.innerText = '⚠️'; statusIcon.classList.remove('text-blue-500'); }
        if (authForms) authForms.classList.remove('hidden');
        if (logoutBtn) logoutBtn.classList.add('hidden');
        if (authUserDisplay) authUserDisplay.classList.add('hidden');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('openLoginBtn')?.addEventListener('click', () => document.getElementById('loginModal')?.classList.remove('hidden'));
    document.getElementById('closeLoginModal')?.addEventListener('click', () => document.getElementById('loginModal')?.classList.add('hidden'));

    document.getElementById('emailLoginBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value; const pass = document.getElementById('authPassword').value;
        if(!email || !pass) return alert("Please enter email and password.");
        try { await signInWithEmailAndPassword(auth, email, pass); document.getElementById('loginModal').classList.add('hidden');
        } catch(e) { alert("Login Error: " + e.message); }
    });

    document.getElementById('emailSignupBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('authEmail').value; const pass = document.getElementById('authPassword').value;
        if(!email || !pass) return alert("Please enter email and password.");
        try { await createUserWithEmailAndPassword(auth, email, pass); document.getElementById('loginModal').classList.add('hidden');
        } catch(e) { alert("Signup Error: " + e.message); }
    });

    document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
        const provider = new GoogleAuthProvider();
        try { await signInWithPopup(auth, provider); document.getElementById('loginModal').classList.add('hidden');
        } catch(e) { alert("Google Login Error: " + e.message); }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => { signOut(auth); document.getElementById('loginModal').classList.add('hidden'); });
});

// js/State.js
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
const savedSubjects = JSON.parse(localStorage.getItem('studySubjects')) || {};
const savedSettings = JSON.parse(localStorage.getItem('studySettings')) || { pStudy: 25, pBreak: 5 };
const savedAudio = JSON.parse(localStorage.getItem('studyAudio')) || { enabled: true, volume: 50, source: 'none', breakSource: 'none' };
const savedTheme = JSON.parse(localStorage.getItem('studyTheme')) || { bgType: 'color', bgColor: '#f3f4f6', bgImage: '', actionColor: '#3b82f6', actionSize: 'md', floatingBtn: 'md', bannerBgColor: '#dc2626', bannerTextColor: '#ffffff' };
const savedDiaries = JSON.parse(localStorage.getItem('studyDiaries')) || {};

// 🚨 NEW: Header Customization State
const savedHeader = JSON.parse(localStorage.getItem('studyHeader')) || { title: 'Study Planner Pro', bgColor: '#ffffff', textColor: '#1f2937', stickers: [] };

class State {
    constructor() {
        this.state = {
            activeTab: 'schedule',
            blocks: savedBlocks,
            exams: savedExams,
            subjects: savedSubjects,
            settings: savedSettings,
            audio: savedAudio,
            theme: savedTheme,
            header: savedHeader,
            diaries: savedDiaries,
            marathon: { active: false, phases: [], currentPhaseIdx: -1, isWaitingForCheckIn: false },
            timer: {
                activeBlockId: null,
                spontaneousSubject: null,
                mode: 'pomodoro', 
                phase: 'study', 
                studySeconds: 0,
                breakSeconds: 0,
                secondsElapsed: 0,
                isRunning: false
            }
        };
        this.listeners = {};
    }

    subscribe(key, callback) {
        if (!this.listeners[key]) this.listeners[key] = [];
        this.listeners[key].push(callback);
    }

    update(key, updater) {
        const oldVal = this.state[key];
        const newVal = typeof updater === 'function' ? updater(oldVal) : updater;
        this.state[key] = newVal;
        
        if (key === 'blocks') localStorage.setItem('studyBlocks', JSON.stringify(newVal));
        if (key === 'exams') localStorage.setItem('studyExams', JSON.stringify(newVal));
        if (key === 'subjects') localStorage.setItem('studySubjects', JSON.stringify(newVal));
        if (key === 'settings') localStorage.setItem('studySettings', JSON.stringify(newVal));
        if (key === 'audio') localStorage.setItem('studyAudio', JSON.stringify(newVal));
        if (key === 'theme') localStorage.setItem('studyTheme', JSON.stringify(newVal));
        if (key === 'header') localStorage.setItem('studyHeader', JSON.stringify(newVal));
        if (key === 'diaries') localStorage.setItem('studyDiaries', JSON.stringify(newVal));

        if (this.listeners[key]) this.listeners[key].forEach(cb => cb(newVal));
        if (currentUser && ['blocks', 'exams', 'subjects', 'settings', 'audio', 'theme', 'header', 'diaries'].includes(key)) this.debouncedSync();
    }

    debouncedSync() {
        if (syncTimeout) clearTimeout(syncTimeout);
        syncTimeout = setTimeout(() => this.syncToFirebase(), 2000);
    }

    async syncToFirebase() {
        if (!currentUser) return;
        try {
            const dataToSync = {
                blocks: this.state.blocks, exams: this.state.exams, subjects: this.state.subjects,
                settings: this.state.settings, audio: this.state.audio, theme: this.state.theme,
                header: this.state.header, diaries: this.state.diaries, lastUpdated: new Date().toISOString()
            };
            await setDoc(doc(db, "users", currentUser.uid), dataToSync, { merge: true });
            console.log("Auto-synced to Firebase");
        } catch (e) { console.error("Sync failed", e); }
    }

    async loadFromFirebase(uid) {
        try {
            const docSnap = await getDoc(doc(db, "users", uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                if(data.blocks) this.update('blocks', data.blocks);
                if(data.exams) this.update('exams', data.exams);
                if(data.subjects) this.update('subjects', data.subjects);
                if(data.settings) this.update('settings', data.settings);
                if(data.audio) this.update('audio', data.audio);
                if(data.theme) this.update('theme', data.theme);
                if(data.header) this.update('header', data.header);
                if(data.diaries) this.update('diaries', data.diaries);
                console.log("Loaded from Firebase");
            }
        } catch (e) { console.error("Load failed", e); }
    }
}

export const store = new State();

const dbName = "AudioStorage";
let idb;
export const audioDB = {
    init: () => new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName, 1);
        req.onupgradeneeded = e => { idb = e.target.result; if(!idb.objectStoreNames.contains('files')) idb.createObjectStore('files'); };
        req.onsuccess = e => { idb = e.target.result; resolve(); };
        req.onerror = () => reject();
    }),
    save: (id, blob) => new Promise(res => { const tx = idb.transaction('files', 'readwrite'); tx.objectStore('files').put(blob, id); tx.oncomplete = res; }),
    get: id => new Promise(res => { const tx = idb.transaction('files', 'readonly'); const req = tx.objectStore('files').get(id); req.onsuccess = () => res(req.result); }),
    getAllIds: () => new Promise(res => { const tx = idb.transaction('files', 'readonly'); const req = tx.objectStore('files').getAllKeys(); req.onsuccess = () => res(req.result); }),
    delete: id => new Promise(res => { const tx = idb.transaction('files', 'readwrite'); tx.objectStore('files').delete(id); tx.oncomplete = res; })
};

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('loginModal').classList.add('hidden');
        
        // 🚨 1. LISTEN FOR GLOBAL BROADCASTS IN REAL-TIME
        onSnapshot(doc(db, 'server', 'broadcast'), (docSnap) => {
            if (docSnap.exists()) {
                store.update('broadcast', () => docSnap.data());
            } else {
                store.update('broadcast', () => null);
            }
        });

        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if(data.blocks) store.update('blocks', () => data.blocks);
                if(data.exams) store.update('exams', () => data.exams);
                if(data.subjects) store.update('subjects', () => data.subjects);
                if(data.settings) store.update('settings', () => data.settings);
                if(data.diaries) store.update('diaries', () => data.diaries);
                if(data.theme) store.update('theme', () => data.theme);
                if(data.header) store.update('header', () => data.header);
                
                // 🚨 2. FETCH USER PROFILE (For the Bouncer!)
                store.update('userProfile', () => ({
                    email: user.email,
                    status: data.status || 'active',
                    role: data.role || 'user'
                }));
            }
        } catch (e) {
            console.error("Error fetching user data:", e);
        }
    } else {
        currentUser = null;
        document.getElementById('loginModal').classList.remove('hidden');
        document.getElementById('loginModal').classList.add('flex');
        store.update('userProfile', () => null);
    }
});

    document.getElementById('openLoginModalBtn')?.addEventListener('click', () => document.getElementById('loginModal').classList.remove('hidden'));
    document.getElementById('cancelLoginBtn')?.addEventListener('click', () => document.getElementById('loginModal').classList.add('hidden'));

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
export const submitSupportTicket = async (message) => {
    if (!currentUser) throw new Error("Must be logged in.");
    try {
        await addDoc(collection(db, 'supportTickets'), {
            uid: currentUser.uid,
            email: currentUser.email,
            message: message,
            status: 'open',
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.error("Ticket Error:", e);
        throw e;
    }
};

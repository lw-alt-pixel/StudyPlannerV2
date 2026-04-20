// js/State.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, addDoc, collection, onSnapshot, getDocs, deleteDoc, query, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
export const db = getFirestore(app);

let currentUser = null; let syncTimeout = null;

const rawBlocks = JSON.parse(localStorage.getItem('studyBlocks')) || [];
const savedBlocks = rawBlocks.filter(b => b.scheduledStart && b.scheduledEnd);
const savedExams = JSON.parse(localStorage.getItem('studyExams')) || [];
const savedSubjects = JSON.parse(localStorage.getItem('studySubjects')) || {
    'Physics': '#3b82f6', 'Math': '#ef4444', 'English': '#10b981', 'History': '#f59e0b', 'Biology': '#8b5cf6', 'Chemistry': '#ec4899', 'Computer Science': '#14b8a6'
};
const savedSettings = JSON.parse(localStorage.getItem('studySettings')) || { pStudy: 25, pBreak: 5 };
const savedDiaries = JSON.parse(localStorage.getItem('studyDiaries')) || {};
const savedTheme = JSON.parse(localStorage.getItem('studyTheme')) || {};
const savedHeader = JSON.parse(localStorage.getItem('studyHeader')) || {};

class Store {
    constructor() {
        this.state = {
            blocks: savedBlocks, exams: savedExams, subjects: savedSubjects,
            settings: savedSettings, diaries: savedDiaries, theme: savedTheme, header: savedHeader,
            timer: { activeBlockId: null, spontaneousSubject: null, mode: 'pomodoro', phase: 'study', studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, isRunning: false },
            marathon: { active: false, phases: [], currentPhaseIdx: -1, strikes: 0, isWaitingForCheckIn: false },
            audio: { enabled: false, volume: 50, source: 'none', breakSource: 'none' },
            activeTab: 'focus', userProfile: null, broadcast: null
        };
        this.listeners = {};
    }
    subscribe(key, listener) { if (!this.listeners[key]) this.listeners[key] = []; this.listeners[key].push(listener); }
    update(key, updater) {
        this.state[key] = updater(this.state[key]);
        if (this.listeners[key]) this.listeners[key].forEach(l => l(this.state[key]));
        if (['blocks', 'exams', 'subjects', 'settings', 'diaries', 'theme', 'header'].includes(key)) this.saveLocal();
    }
    saveLocal() {
        localStorage.setItem('studyBlocks', JSON.stringify(this.state.blocks));
        localStorage.setItem('studyExams', JSON.stringify(this.state.exams));
        localStorage.setItem('studySubjects', JSON.stringify(this.state.subjects));
        localStorage.setItem('studySettings', JSON.stringify(this.state.settings));
        localStorage.setItem('studyDiaries', JSON.stringify(this.state.diaries));
        localStorage.setItem('studyTheme', JSON.stringify(this.state.theme));
        localStorage.setItem('studyHeader', JSON.stringify(this.state.header));
        if (currentUser) {
            clearTimeout(syncTimeout);
            syncTimeout = setTimeout(() => this.saveToFirebase(), 2000);
        }
    }
    async saveToFirebase() {
        if (!currentUser) return;
        try {
            await setDoc(doc(db, 'users', currentUser.uid), {
                blocks: this.state.blocks, exams: this.state.exams, subjects: this.state.subjects,
                settings: this.state.settings, diaries: this.state.diaries, theme: this.state.theme, header: this.state.header,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        } catch (e) { console.error("Sync Error:", e); }
    }
}
export const store = new Store();

export const audioDB = window.indexedDB ? {
    db: null,
    async init() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('AudioDB', 1);
            req.onupgradeneeded = e => e.target.result.createObjectStore('files', { keyPath: 'id' });
            req.onsuccess = e => { this.db = e.target.result; resolve(); };
            req.onerror = e => reject(e);
        });
    },
    async save(id, blob, name) {
        return new Promise((resolve) => {
            const tx = this.db.transaction('files', 'readwrite');
            tx.objectStore('files').put({ id, blob, name });
            tx.oncomplete = () => resolve();
        });
    },
    async get(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction('files', 'readonly');
            const req = tx.objectStore('files').get(id);
            req.onsuccess = () => resolve(req.result);
        });
    },
    async getAll() {
        return new Promise((resolve) => {
            const tx = this.db.transaction('files', 'readonly');
            const req = tx.objectStore('files').getAll();
            req.onsuccess = () => resolve(req.result || []);
        });
    },
    async getAllIds() {
        return new Promise((resolve) => {
            const tx = this.db.transaction('files', 'readonly');
            const req = tx.objectStore('files').getAllKeys();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => resolve([]);
        });
    },
    async delete(id) {
        return new Promise((resolve) => {
            const tx = this.db.transaction('files', 'readwrite');
            tx.objectStore('files').delete(id);
            tx.oncomplete = () => resolve();
        });
    }
} : null;

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('loginModal').classList.add('hidden');
        
        onSnapshot(doc(db, 'server', 'broadcast'), (docSnap) => {
            if (docSnap.exists()) store.update('broadcast', () => docSnap.data());
            else store.update('broadcast', () => null);
        });

        onSnapshot(doc(db, 'server', 'hotfix'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().css) {
                let styleTag = document.getElementById('liveHotfixStyles');
                if(!styleTag) {
                    styleTag = document.createElement('style');
                    styleTag.id = 'liveHotfixStyles';
                    document.head.appendChild(styleTag);
                }
                styleTag.innerHTML = docSnap.data().css;
            }
        });

        const ticketQuery = query(collection(db, 'supportTickets'), where("uid", "==", user.uid));
        onSnapshot(ticketQuery, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === "added" || change.type === "modified") {
                    const ticket = change.doc.data();
                    if (ticket.status === 'answered') {
                        const seenTickets = JSON.parse(localStorage.getItem('seenTickets') || '[]');
                        if (!seenTickets.includes(change.doc.id)) {
                            alert(`📬 Message from Admin regarding your report:\n\n"${ticket.adminResponse}"`);
                            seenTickets.push(change.doc.id);
                            localStorage.setItem('seenTickets', JSON.stringify(seenTickets));
                        }
                    }
                }
            });
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
                
                store.update('userProfile', () => ({
                    email: user.email,
                    displayName: data.displayName || '',
                    status: data.status || 'active',
                    role: data.role || 'user'
                }));
            } else {
                // First time login -> Create basic profile
                await setDoc(docRef, { status: 'active', role: 'user', lastUpdated: new Date().toISOString() }, { merge: true });
                store.update('userProfile', () => ({ email: user.email, status: 'active', role: 'user' }));
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

document.addEventListener('DOMContentLoaded', () => {
    let loginMode = 'email'; // can be 'email' or 'username'

    document.getElementById('openLoginModalBtn')?.addEventListener('click', () => {
        document.getElementById('loginModal').classList.remove('hidden');
        document.getElementById('loginModal').classList.add('flex');
    });

    document.getElementById('cancelLoginBtn')?.addEventListener('click', () => {
        document.getElementById('loginModal').classList.remove('flex');
        document.getElementById('loginModal').classList.add('hidden');
    });

    // 🚨 Toggle Logic for Hybrid Auth
    document.getElementById('modeEmailBtn')?.addEventListener('click', (e) => {
        loginMode = 'email';
        e.target.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
        e.target.classList.remove('text-gray-500');
        const userBtn = document.getElementById('modeUsernameBtn');
        userBtn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
        userBtn.classList.add('text-gray-500');
        document.getElementById('authEmail').placeholder = "Email Address";
        document.getElementById('authEmail').type = "email";
        document.getElementById('googleLoginBtn').style.display = 'flex';
    });

    document.getElementById('modeUsernameBtn')?.addEventListener('click', (e) => {
        loginMode = 'username';
        e.target.classList.add('bg-white', 'shadow-sm', 'text-blue-600');
        e.target.classList.remove('text-gray-500');
        const emailBtn = document.getElementById('modeEmailBtn');
        emailBtn.classList.remove('bg-white', 'shadow-sm', 'text-blue-600');
        emailBtn.classList.add('text-gray-500');
        document.getElementById('authEmail').placeholder = "Pick a Username";
        document.getElementById('authEmail').type = "text";
        document.getElementById('googleLoginBtn').style.display = 'none'; // Google doesn't support generic usernames
    });

    const getProcessedIdentifier = () => {
        let val = document.getElementById('authEmail').value.trim();
        if (loginMode === 'username') {
            val = val.replace(/\s+/g, '').toLowerCase() + "@studyapp.com"; // Silently append fake domain
        }
        return val;
    };

    document.getElementById('emailLoginBtn')?.addEventListener('click', async () => {
        const identifier = getProcessedIdentifier(); 
        const pass = document.getElementById('authPassword').value;
        if(!identifier || !pass) return alert("Please enter credentials.");
        try { await signInWithEmailAndPassword(auth, identifier, pass); document.getElementById('loginModal').classList.add('hidden');
        } catch(e) { alert("Login Error: " + e.message); }
    });

    document.getElementById('emailSignupBtn')?.addEventListener('click', async () => {
        const identifier = getProcessedIdentifier(); 
        const pass = document.getElementById('authPassword').value;
        if(!identifier || !pass) return alert("Please enter credentials.");
        try { await createUserWithEmailAndPassword(auth, identifier, pass); document.getElementById('loginModal').classList.add('hidden');
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
            uid: currentUser.uid, email: currentUser.email, message: message, status: 'open', timestamp: new Date().toISOString()
        });
    } catch (e) { console.error("Ticket Error:", e); throw e; }
};

export const pushGlobalBroadcast = async (message, active) => {
    if (!currentUser) return;
    try { await setDoc(doc(db, 'server', 'broadcast'), { message, active, timestamp: new Date().toISOString() });
    } catch (e) { console.error("Broadcast Error:", e); throw e; }
};

export const pushGlobalHotfix = async (cssString) => {
    if (!currentUser) return;
    try { await setDoc(doc(db, 'server', 'hotfix'), { css: cssString, timestamp: new Date().toISOString() });
    } catch (e) { console.error("Hotfix Error:", e); throw e; }
};

export const fetchAllUsers = async () => {
    if (!currentUser) return [];
    const snapshot = await getDocs(collection(db, 'users'));
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const toggleUserSuspension = async (uid, isSuspended) => {
    await setDoc(doc(db, 'users', uid), { status: isSuspended ? 'suspended' : 'active' }, { merge: true });
};

export const deleteUserData = async (uid) => {
    await deleteDoc(doc(db, 'users', uid));
};

export const fetchSupportTickets = async () => {
    if (!currentUser) return [];
    const q = query(collection(db, 'supportTickets'), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
};

export const replyToTicket = async (ticketId, replyMessage) => {
    await setDoc(doc(db, 'supportTickets', ticketId), { adminResponse: replyMessage, status: 'answered' }, { merge: true });
};

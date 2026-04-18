// js/AudioEngine.js
import { store } from './State.js';

class AudioEngine {
    init() {
        this.ytPlayer = null;
        this.localAudio = new Audio();
        this.localAudio.loop = true;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // Inject YouTube API
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            this.ytPlayer = new YT.Player('yt-player-container', {
                height: '0', width: '0', videoId: store.state.audio.ytId || 'jfKfPfyJRdk', // Default Lofi Girl
                playerVars: { 'autoplay': 0, 'controls': 0, 'showinfo': 0, 'rel': 0, 'loop': 1 },
                events: { 'onReady': () => this.setVolume(store.state.audio.volume) }
            });
        };

        store.subscribe('timer', (t) => this.handleTimerState(t));
        store.subscribe('audio', (a) => this.setVolume(a.volume));
    }

    handleTimerState(timerState) {
        const audioState = store.state.audio;
        if (!audioState.enabled) return this.pauseMusic();

        if (timerState.isRunning && timerState.mode === 'pomodoro' && timerState.phase === 'study') {
            this.playMusic(audioState);
        } else {
            this.pauseMusic();
        }
    }

    playMusic(audioState) {
        if (audioState.source === 'youtube' && this.ytPlayer && this.ytPlayer.playVideo) {
            this.localAudio.pause();
            this.ytPlayer.playVideo();
        } else if (audioState.source === 'local' && this.localAudio.src) {
            if (this.ytPlayer && this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
            this.localAudio.play().catch(e => console.log("Local audio play blocked by browser."));
        }
    }

    pauseMusic() {
        if (this.ytPlayer && this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
        this.localAudio.pause();
    }

    setVolume(vol) {
        if (this.ytPlayer && this.ytPlayer.setVolume) this.ytPlayer.setVolume(vol);
        this.localAudio.volume = vol / 100;
    }

    setLocalAudio(file) {
        const url = URL.createObjectURL(file);
        this.localAudio.src = url;
        store.update('audio', a => ({ ...a, source: 'local' }));
    }

    setYoutube(id) {
        store.update('audio', a => ({ ...a, source: 'youtube', ytId: id }));
        if (this.ytPlayer && this.ytPlayer.loadVideoById) this.ytPlayer.loadVideoById(id);
    }

    // ==========================================
    // 🚨 EXAM SOUND EFFECTS SYNTHESIZER
    // ==========================================
    playSpeech(text) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9; utterance.pitch = 1;
        window.speechSynthesis.speak(utterance);
    }

    playDidaDida() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const playBeep = (time) => {
            const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
            osc.type = 'sine'; osc.frequency.setValueAtTime(800, time);
            gain.gain.setValueAtTime(0.5, time); gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
            osc.connect(gain); gain.connect(this.audioCtx.destination);
            osc.start(time); osc.stop(time + 0.1);
        };
        const now = this.audioCtx.currentTime;
        playBeep(now); playBeep(now + 0.2); playBeep(now + 0.6); playBeep(now + 0.8);
    }

    playSchoolBell() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const playRing = (time, duration) => {
            const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
            osc.type = 'square'; osc.frequency.setValueAtTime(400, time); osc.frequency.setValueAtTime(450, time + 0.05);
            gain.gain.setValueAtTime(0.3, time); gain.gain.exponentialRampToValueAtTime(0.01, time + duration);
            osc.connect(gain); gain.connect(this.audioCtx.destination);
            osc.start(time); osc.stop(time + duration);
        };
        for(let i=0; i<15; i++) playRing(this.audioCtx.currentTime + (i * 0.1), 0.08);
    }

    playDoubleBell() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const ring = (time) => {
            const osc = this.audioCtx.createOscillator(); const gain = this.audioCtx.createGain();
            osc.type = 'triangle'; osc.frequency.setValueAtTime(600, time);
            gain.gain.setValueAtTime(0.5, time); gain.gain.exponentialRampToValueAtTime(0.01, time + 0.5);
            osc.connect(gain); gain.connect(this.audioCtx.destination);
            osc.start(time); osc.stop(time + 0.5);
        };
        const now = this.audioCtx.currentTime;
        ring(now); ring(now + 0.6);
    }
}
export const audioEngine = new AudioEngine();

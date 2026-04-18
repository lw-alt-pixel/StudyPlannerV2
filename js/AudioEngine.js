// js/AudioEngine.js
import { store } from './State.js';

class AudioEngine {
    init() {
        this.ytPlayer = null;
        this.localAudio = new Audio();
        
        // 🚨 STRICT LOOP ENFORCEMENT FOR LOCAL FILES
        this.localAudio.loop = true;
        this.localAudio.preload = 'auto';
        
        this.currentTrackId = null;
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        const tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
            this.ytPlayer = new YT.Player('yt-player-container', {
                height: '0', width: '0', videoId: 'jfKfPfyJRdk', 
                playerVars: { 'autoplay': 0, 'controls': 0, 'showinfo': 0, 'rel': 0, 'loop': 1 },
                events: { 'onReady': () => this.setVolume(store.state.audio.volume) }
            });
        };

        store.subscribe('timer', (t) => this.handleTimerState(t));
        store.subscribe('audio', (a) => this.handleTimerState(store.state.timer)); 
    }

    handleTimerState(timerState) {
        const a = store.state.audio;
        
        // 🚨 GATEKEEPER: Only play music if Pomodoro is active AND timer is running
        if (!a.enabled || !timerState.isRunning || timerState.mode !== 'pomodoro') {
            return this.pauseMusic();
        }

        // 🚨 BREAK PHASE AUDIO LOGIC
        if (timerState.phase === 'break') {
            if (a.breakSource === 'silent') return this.pauseMusic();
            
            const breakSources = {
                upbeat: { type: 'youtube', id: '7tNtU5XFwrU' }, // Reliable NCS 24/7 stream
                nature: { type: 'youtube', id: 'mc0HInBqXOU' },
                lofi: { type: 'youtube', id: 'jfKfPfyJRdk' },
                zen: { type: 'local', url: './quietphase-ambient-zen-489706.mp3' }
            };
            this.playTrack(breakSources[a.breakSource] || breakSources.upbeat);
        } else {
            // 🚨 FOCUS PHASE AUDIO LOGIC
            const sources = {
                zen: { type: 'local', url: './quietphase-ambient-zen-489706.mp3' },
                lofi: { type: 'youtube', id: 'jfKfPfyJRdk' },
                nature: { type: 'youtube', id: 'mc0HInBqXOU' },
                altpop: { type: 'youtube', id: 'lTRiuFIWV54' },
                energetic: { type: 'youtube', id: '5qap5aO4i9A' }
            };
            this.playTrack(sources[a.source] || sources.zen);
        }
    }

    playTrack(track) {
        if (this.currentTrackId === (track.id || track.url)) {
            // Track is already loaded, just make sure it's playing
            if (track.type === 'local') this.localAudio.play().catch(e => console.log(e));
            else if (this.ytPlayer && this.ytPlayer.getPlayerState && this.ytPlayer.getPlayerState() !== 1) this.ytPlayer.playVideo();
            return;
        }

        this.currentTrackId = track.id || track.url;
        this.setVolume(store.state.audio.volume);

        if (track.type === 'youtube') {
            this.localAudio.pause();
            if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                this.ytPlayer.loadVideoById(track.id);
                this.ytPlayer.playVideo();
            }
        } else if (track.type === 'local') {
            if (this.ytPlayer && this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
            this.localAudio.src = track.url;
            this.localAudio.play().catch(e => console.log("Browser blocked local auto-play"));
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

    // EXAM SOUND EFFECTS SYNTHESIZER
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

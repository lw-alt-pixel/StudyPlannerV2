// js/AudioEngine.js
import { store, audioDB } from './State.js';

class AudioEngine {
    init() {
        this.ytPlayer = null;
        this.localAudio = new Audio();
        this.localAudio.loop = true;
        this.currentLocalUrl = null;
        
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
        store.subscribe('audio', () => this.handleTimerState(store.state.timer)); 
    }

    async handleTimerState(t) {
        const a = store.state.audio;
        if (!a.enabled || !t.isRunning) { this.stopAll(); return; }

        const targetSource = t.phase === 'study' ? a.source : a.breakSource;
        
        if (targetSource !== this.currentTrackId) {
            this.stopAll();
            this.currentTrackId = targetSource;

            if (targetSource === 'none') return;

            if (targetSource.startsWith('yt_')) {
                const map = { 'yt_rain': 'jfKfPfyJRdk', 'yt_cafe': 'BOAJDgqUeg0', 'yt_brown': 'RqzGzwTY-6w', 'yt_jazz': 'kgx4WGK0oNU' };
                if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                    this.ytPlayer.loadVideoById(map[targetSource]);
                    this.setVolume(a.volume);
                }
            } else if (targetSource === 'local_white') {
                this.playWhiteNoise();
            } else if (targetSource === 'local_nature') {
                // Mock local file implementation
            } else if (targetSource.startsWith('local_') && audioDB) {
                const fileData = await audioDB.get(targetSource);
                if (fileData) {
                    if (this.currentLocalUrl) URL.revokeObjectURL(this.currentLocalUrl);
                    this.currentLocalUrl = URL.createObjectURL(fileData.blob);
                    this.localAudio.src = this.currentLocalUrl;
                    this.localAudio.volume = a.volume / 100;
                    this.localAudio.play().catch(e => console.warn("Local play blocked", e));
                }
            }
        } else {
            this.setVolume(a.volume);
        }
    }

    setVolume(vol) {
        if (this.ytPlayer && this.ytPlayer.setVolume) this.ytPlayer.setVolume(vol);
        this.localAudio.volume = vol / 100;
    }

    stopAll() {
        if (this.ytPlayer && this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
        this.localAudio.pause();
        if (this.whiteNoiseSource) { this.whiteNoiseSource.stop(); this.whiteNoiseSource = null; }
        this.currentTrackId = null;
    }

    playWhiteNoise() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        if(this.whiteNoiseSource) this.whiteNoiseSource.stop();
        
        const bufferSize = this.audioCtx.sampleRate * 2; 
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) { data[i] = Math.random() * 2 - 1; }
        
        this.whiteNoiseSource = this.audioCtx.createBufferSource();
        this.whiteNoiseSource.buffer = buffer;
        this.whiteNoiseSource.loop = true;
        
        const filter = this.audioCtx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 1000;
        
        this.whiteNoiseSource.connect(filter);
        filter.connect(this.audioCtx.destination);
        this.whiteNoiseSource.start();
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

    // 🚨 NEW: Dynamic Voice Synthesizer for Exams!
    speak(text) {
        if ('speechSynthesis' in window) {
            // Cancel any ongoing speech
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = 0.95; // Slightly slower, authoritative voice
            utterance.pitch = 1;
            window.speechSynthesis.speak(utterance);
        }
    }

    // 🚨 NEW: Combines Bell + Voice
    playExamAnnouncement(text) {
        this.playSchoolBell();
        // Wait 1.5 seconds for the bell to finish ringing, then speak
        setTimeout(() => this.speak(text), 1500); 
    }
}
export const audioEngine = new AudioEngine();

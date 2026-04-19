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

        // 🚨 LIVE SYNC: Listen to timer changes AND settings changes!
        store.subscribe('timer', (t) => this.handleTimerState(t));
        store.subscribe('audio', () => this.handleTimerState(store.state.timer)); 
    }

    async handleTimerState(t) {
        const a = store.state.audio;
        if (!a.enabled || !t.isRunning) {
            this.stopAll();
            return;
        }

        const targetSource = t.phase === 'study' ? a.source : a.breakSource;
        this.setVolume(a.volume);

        // If the track changed, instantly hot-swap it!
        if (this.currentTrackId !== targetSource) {
            this.stopAll();
            this.currentTrackId = targetSource;

            if (!targetSource || targetSource === 'none') return;

            if (targetSource.startsWith('yt_')) {
                const map = { 'yt_rain': 'jfKfPfyJRdk', 'yt_cafe': 'BOAJDgqUeg0', 'yt_brown': 'RqzGzwTY-6w', 'yt_jazz': 'kgx4WGK0oNU' };
                const vid = map[targetSource];
                if (this.ytPlayer && this.ytPlayer.loadVideoById) {
                    this.ytPlayer.loadVideoById({videoId: vid});
                    this.ytPlayer.playVideo();
                }
            } else if (targetSource.startsWith('custom_')) {
                const blob = await audioDB.get(targetSource);
                if (blob) {
                    if(this.currentLocalUrl) URL.revokeObjectURL(this.currentLocalUrl);
                    this.currentLocalUrl = URL.createObjectURL(blob);
                    this.localAudio.src = this.currentLocalUrl;
                    this.localAudio.play().catch(e => console.warn("Local play blocked:", e));
                }
            } else if (targetSource.startsWith('local_')) {
                if (targetSource === 'local_white' || targetSource === 'local_nature') {
                    this.playWhiteNoise();
                }
            }
        } else if (!this.isPlaying()) {
            // Resume if it paused somehow
            if (targetSource.startsWith('yt_')) this.ytPlayer?.playVideo();
            else if (targetSource.startsWith('custom_')) this.localAudio.play();
            else if (targetSource.startsWith('local_')) this.audioCtx.resume();
        }
    }

    isPlaying() {
        if (this.currentTrackId?.startsWith('yt_')) return this.ytPlayer?.getPlayerState?.() === 1;
        if (this.currentTrackId?.startsWith('custom_')) return !this.localAudio.paused;
        if (this.currentTrackId?.startsWith('local_')) return this.audioCtx.state === 'running';
        return false;
    }

    stopAll() {
        if (this.ytPlayer && this.ytPlayer.pauseVideo) this.ytPlayer.pauseVideo();
        this.localAudio.pause();
        if (this.whiteNoiseSource) this.whiteNoiseSource.stop();
        if (this.audioCtx.state === 'running') this.audioCtx.suspend();
        this.currentTrackId = null;
    }

    setVolume(vol) {
        if (this.ytPlayer && this.ytPlayer.setVolume) this.ytPlayer.setVolume(vol);
        this.localAudio.volume = vol / 100;
        if (this.whiteNoiseGain) this.whiteNoiseGain.gain.value = (vol / 100) * 0.1;
    }

    playWhiteNoise() {
        if(this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const bufferSize = this.audioCtx.sampleRate * 2; 
        const buffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        
        if(this.whiteNoiseSource) this.whiteNoiseSource.stop();
        this.whiteNoiseSource = this.audioCtx.createBufferSource();
        this.whiteNoiseSource.buffer = buffer;
        this.whiteNoiseSource.loop = true;
        
        this.whiteNoiseGain = this.audioCtx.createGain();
        this.whiteNoiseGain.gain.value = (store.state.audio.volume / 100) * 0.1; 
        this.whiteNoiseSource.connect(this.whiteNoiseGain);
        this.whiteNoiseGain.connect(this.audioCtx.destination);
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
        ring(now); ring(now + 0.2); ring(now + 0.6); ring(now + 0.8);
    }
}
export const audioEngine = new AudioEngine();

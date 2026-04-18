// js/App.js
import { store } from './State.js';
import { uiManager } from './UIManager.js';
import { timerUI } from './TimerUI.js';
import { themeManager } from './ThemeManager.js';
import { canvasUI } from './CanvasUI.js';
import { blockManager } from './BlockManager.js'; 
import { statsUI } from './StatsUI.js'; 
import { examManager } from './ExamManager.js';
import { settingsManager } from './SettingsManager.js';
import { floatingWidgetManager } from './FloatingWidgetManager.js';
import { audioEngine } from './AudioEngine.js'; // NEW
import { marathonEngine } from './MarathonEngine.js'; // NEW

document.addEventListener('DOMContentLoaded', () => {
    uiManager.init();
    timerUI.init();
    themeManager.init();
    canvasUI.init();
    blockManager.init(); 
    statsUI.init(); 
    examManager.init();
    settingsManager.init(); 
    floatingWidgetManager.init();
    audioEngine.init(); // NEW
    marathonEngine.init(); // NEW
    
    // Wire up Settings Manager to the new Audio controls safely here
    document.getElementById('settingsAudioEnabled')?.addEventListener('change', (e) => store.update('audio', a => ({...a, enabled: e.target.checked})));
    document.getElementById('settingsAudioYtId')?.addEventListener('change', (e) => audioEngine.setYoutube(e.target.value));
    document.getElementById('settingsAudioVolume')?.addEventListener('input', (e) => store.update('audio', a => ({...a, volume: parseInt(e.target.value)})));
    document.getElementById('settingsAudioLocalFile')?.addEventListener('change', (e) => {
        if(e.target.files[0]) audioEngine.setLocalAudio(e.target.files[0]);
    });
    document.getElementById('settingsAudioSource')?.addEventListener('change', (e) => {
        if(e.target.value === 'youtube') {
            document.getElementById('audioYoutubeDiv').classList.remove('hidden');
            document.getElementById('audioLocalDiv').classList.add('hidden');
            audioEngine.setYoutube(document.getElementById('settingsAudioYtId').value);
        } else {
            document.getElementById('audioYoutubeDiv').classList.add('hidden');
            document.getElementById('audioLocalDiv').classList.remove('hidden');
        }
    });
});

// js/ThemeManager.js
import { store } from './State.js';

class ThemeManager {
    init() {
        store.subscribe('theme', (themeState) => this.applyTheme(themeState));
        store.subscribe('header', (headerState) => this.applyHeader(headerState));
        
        this.applyTheme(store.state.theme);
        this.applyHeader(store.state.header);
    }

    applyHeader(header) {
        const headerEl = document.getElementById('appHeader');
        const titleEl = document.getElementById('appTitle');
        const zone = document.getElementById('headerStickerZone');
        
        if (headerEl) headerEl.style.backgroundColor = header.bgColor || '#ffffff';
        if (titleEl) {
            titleEl.style.color = header.textColor || '#1f2937';
            titleEl.innerText = header.title || 'Study Planner Pro';
        }

        // 🚨 RENDER STICKERS FROM PERCENTAGES
        if (zone) {
            zone.innerHTML = '';
            const stickers = header.stickers || [];
            stickers.forEach(s => {
                const el = document.createElement('div');
                el.innerText = s.emoji;
                // Add pointer-events-auto so you can double click to delete them!
                el.className = 'absolute text-2xl md:text-3xl cursor-pointer hover:scale-125 transition-transform pointer-events-auto select-none';
                el.style.left = `${s.x}%`;
                el.style.top = `${s.y}%`;
                el.style.transform = 'translate(-50%, -50%)';
                
                el.ondblclick = () => {
                    store.update('header', state => ({ ...state, stickers: state.stickers.filter(x => x.id !== s.id) }));
                };
                zone.appendChild(el);
            });
        }
    }

    applyTheme(theme) {
        const root = document.documentElement;
        
        if (theme.bgType === 'image' && theme.bgImage) {
            document.body.style.backgroundImage = `url(${theme.bgImage})`;
            document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed'; document.body.style.backgroundColor = 'transparent';
        } else {
            document.body.style.backgroundImage = 'none';
            document.body.style.backgroundColor = theme.bgColor || '#f3f4f6';
        }

        root.style.setProperty('--action-color', theme.actionColor || '#3b82f6');
        root.style.setProperty('--tab-color', theme.actionColor || '#3b82f6');
        
        let padding = '0.5rem 1rem'; let fontSize = '0.875rem';
        if (theme.actionSize === 'sm') { padding = '0.3rem 0.6rem'; fontSize = '0.7rem'; }
        else if (theme.actionSize === 'lg') { padding = '0.8rem 1.6rem'; fontSize = '1.1rem'; }
        
        root.style.setProperty('--action-padding', padding);
        root.style.setProperty('--action-font-size', fontSize);

        // 🚨 DYNAMIC FLOATING BUTTON SIZING
        const fStyle = theme.floatingBtn || 'md';
        const fBtns = [document.getElementById('openAddBlockModal'), document.getElementById('openSettingsBtn')];
        const fallback = document.getElementById('fallbackButtons');
        
        if (fStyle === 'hidden') {
            fBtns.forEach(b => { if(b) b.classList.add('hidden'); });
            if(fallback) { fallback.classList.remove('hidden'); fallback.classList.add('flex'); }
        } else {
            fBtns.forEach(b => { if(b) b.classList.remove('hidden'); });
            if(fallback) { fallback.classList.add('hidden'); fallback.classList.remove('flex'); }
            
            let fSize = '4rem'; let fFont = '1.875rem'; 
            if (fStyle === 'xs') { fSize = '2.5rem'; fFont = '1rem'; }
            else if (fStyle === 'sm') { fSize = '3rem'; fFont = '1.25rem'; }
            else if (fStyle === 'lg') { fSize = '5rem'; fFont = '2.25rem'; }
            else if (fStyle === 'xl') { fSize = '6rem'; fFont = '3rem'; }
            
            fBtns.forEach(b => {
                if(b) {
                    b.style.width = fSize; b.style.height = fSize; 
                    b.style.fontSize = fFont;
                }
            });
        }
    }
}
export const themeManager = new ThemeManager();

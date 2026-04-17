// js/ThemeManager.js
import { store } from './State.js';

class ThemeManager {
    init() {
        store.subscribe('theme', (themeState) => this.applyTheme(themeState));
        this.applyTheme(store.state.theme);
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
        root.style.setProperty('--tab-color', theme.tabColor || '#3b82f6');
        
        // 🎯 EXTREME ACTION BUTTON SIZES (Overrides Tailwind)
        let padding = '0.5rem 1rem'; let fontSize = '0.875rem';
        if (theme.actionSize === 'sm') { padding = '0.3rem 0.6rem'; fontSize = '0.7rem'; }
        else if (theme.actionSize === 'lg') { padding = '0.8rem 1.6rem'; fontSize = '1.1rem'; }
        
        root.style.setProperty('--action-padding', padding);
        root.style.setProperty('--action-font-size', fontSize);

        // 🎯 NEW: SEPARATE FLOATING BUTTON LOGIC
        const fStyle = theme.floatingBtn || 'md';
        const fBtns = [document.getElementById('openAddBlockModal'), document.getElementById('openSettingsBtn')];
        const fallback = document.getElementById('fallbackButtons');
        
        if (fStyle === 'hidden') {
            fBtns.forEach(b => { if(b) b.classList.add('hidden'); });
            if(fallback) { fallback.classList.remove('hidden'); fallback.classList.add('flex'); }
        } else {
            fBtns.forEach(b => { if(b) b.classList.remove('hidden'); });
            if(fallback) { fallback.classList.add('hidden'); fallback.classList.remove('flex'); }
            
            let fSize = '4rem'; let fFont = '1.875rem'; // Default md
            if (fStyle === 'xs') { fSize = '2.5rem'; fFont = '1rem'; }
            else if (fStyle === 'sm') { fSize = '3rem'; fFont = '1.25rem'; }
            else if (fStyle === 'lg') { fSize = '5rem'; fFont = '2.25rem'; }
            
            fBtns.forEach(b => { 
                if(b) { b.style.width = fSize; b.style.height = fSize; b.style.fontSize = fFont; }
            });
        }
    }
}
export const themeManager = new ThemeManager();

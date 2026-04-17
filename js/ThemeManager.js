// js/ThemeManager.js
import { store } from './State.js';

class ThemeManager {
    init() {
        store.subscribe('theme', (themeState) => this.applyTheme(themeState));
        this.applyTheme(store.state.theme);
    }

    applyTheme(theme) {
        const root = document.documentElement;
        
        // 1. Background Logic
        if (theme.bgType === 'image' && theme.bgImage) {
            document.body.style.backgroundImage = `url(${theme.bgImage})`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.style.backgroundColor = 'transparent';
        } else {
            document.body.style.backgroundImage = 'none';
            document.body.style.backgroundColor = theme.bgColor || '#f3f4f6';
        }

        // 2. Colors injection into CSS Variables
        root.style.setProperty('--action-color', theme.actionColor || '#3b82f6');
        root.style.setProperty('--tab-color', theme.tabColor || '#3b82f6');
        
        // 3. Size injection into CSS Variables
        let padding = '0.5rem 1rem';
        let fontSize = '0.875rem';
        if (theme.actionSize === 'sm') { padding = '0.25rem 0.75rem'; fontSize = '0.75rem'; }
        if (theme.actionSize === 'lg') { padding = '0.75rem 1.5rem'; fontSize = '1.125rem'; }
        
        root.style.setProperty('--action-padding', padding);
        root.style.setProperty('--action-font-size', fontSize);
    }
}
export const themeManager = new ThemeManager();

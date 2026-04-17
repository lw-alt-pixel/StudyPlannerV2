// js/ThemeManager.js
import { store } from './State.js';

class ThemeManager {
    init() {
        // 1. Subscribe to the Brain! Whenever the 'theme' changes, update the visuals.
        store.subscribe('theme', (themeState) => {
            this.applyTheme(themeState);
        });

        // 2. Apply the default theme immediately on load
        this.applyTheme(store.state.theme);
    }

    applyTheme(themeState) {
        // Change the background color
        document.body.style.backgroundColor = themeState.appBgColor;

        // Apply Glassmorphism effect if enabled
        if (themeState.isGlassMode) {
            document.body.classList.add('bg-opacity-50', 'backdrop-blur-md');
        } else {
            document.body.classList.remove('bg-opacity-50', 'backdrop-blur-md');
        }

        console.log("🎨 Theme Applied:", themeState);
    }
}

export const themeManager = new ThemeManager();


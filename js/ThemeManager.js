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

        if (zone) {
            zone.innerHTML = '';
            const stickers = header.stickers || [];
            
            stickers.forEach(s => {
                const el = document.createElement('div');
                el.innerText = s.emoji;
                el.className = 'absolute cursor-grab hover:scale-110 transition-transform pointer-events-auto select-none';
                el.style.left = `${s.x}%`;
                el.style.top = `${s.y}%`;
                el.style.transform = 'translate(-50%, -50%)';
                
                const fontSize = s.size ? s.size : 3;
                el.style.fontSize = `${fontSize}rem`;
                
                el.ondblclick = () => {
                    store.update('header', state => ({ ...state, stickers: state.stickers.filter(x => x.id !== s.id) }));
                };

                let isDragging = false;

                el.addEventListener('pointerdown', (e) => {
                    isDragging = true;
                    el.setPointerCapture(e.pointerId);
                    el.classList.remove('cursor-grab', 'transition-transform', 'hover:scale-110');
                    el.classList.add('cursor-grabbing');
                });

                el.addEventListener('pointermove', (e) => {
                    if (!isDragging) return;
                    const zoneRect = zone.getBoundingClientRect();
                    
                    let newX = ((e.clientX - zoneRect.left) / zoneRect.width) * 100;
                    let newY = ((e.clientY - zoneRect.top) / zoneRect.height) * 100;
                    
                    el.style.left = `${newX}%`;
                    el.style.top = `${newY}%`;
                });

                el.addEventListener('pointerup', (e) => {
                    if (!isDragging) return;
                    isDragging = false;
                    el.releasePointerCapture(e.pointerId);
                    el.classList.add('cursor-grab', 'transition-transform', 'hover:scale-110');
                    el.classList.remove('cursor-grabbing');
                    
                    const zoneRect = zone.getBoundingClientRect();
                    const dropX = e.clientX;
                    const dropY = e.clientY;

                    // 🚨 VAPORIZER LOGIC: If dropped outside the header boundaries, delete it!
                    if (dropY < zoneRect.top - 20 || dropY > zoneRect.bottom + 20 || dropX < zoneRect.left - 20 || dropX > zoneRect.right + 20) {
                        store.update('header', state => ({ ...state, stickers: state.stickers.filter(x => x.id !== s.id) }));
                        return;
                    }

                    // Otherwise, permanently save new coordinates
                    const finalX = parseFloat(el.style.left);
                    const finalY = parseFloat(el.style.top);
                    
                    store.update('header', state => ({
                        ...state,
                        stickers: state.stickers.map(x => x.id === s.id ? { ...x, x: finalX, y: finalY } : x)
                    }));
                });

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

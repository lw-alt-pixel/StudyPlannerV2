// js/FloatingWidgetManager.js
class FloatingWidgetManager {
    init() {
        this.makeDraggable('openAddBlockModal');
        this.makeDraggable('openSettingsBtn');
        
        // Primary Floating Click Bindings
        document.getElementById('openSettingsBtn')?.addEventListener('click', () => {
            document.getElementById('settingsPanel')?.classList.remove('translate-x-full');
            document.getElementById('settingsOverlay')?.classList.remove('hidden');
        });

        // Fallback Button Bindings (Analytics Tab)
        document.getElementById('fallbackSettingsBtn')?.addEventListener('click', () => {
            document.getElementById('settingsPanel')?.classList.remove('translate-x-full');
            document.getElementById('settingsOverlay')?.classList.remove('hidden');
        });
        document.getElementById('fallbackAddBlockBtn')?.addEventListener('click', () => {
            document.getElementById('addBlockModal')?.classList.remove('hidden');
        });
    }

    makeDraggable(id) {
        const el = document.getElementById(id);
        if (!el) return;

        let isDragging = false;
        let startX, startY, initialLeft, initialTop;
        let hasMoved = false;

        el.addEventListener('pointerdown', (e) => {
            isDragging = true; hasMoved = false;
            startX = e.clientX; startY = e.clientY;
            const rect = el.getBoundingClientRect();
            initialLeft = rect.left; initialTop = rect.top;
            
            el.style.transition = 'none'; 
            el.classList.add('dragging-widget');
            el.setPointerCapture(e.pointerId);
        });

        el.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX; const dy = e.clientY - startY;
            if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
            
            el.style.left = `${initialLeft + dx}px`;
            el.style.top = `${initialTop + dy}px`;
            el.style.bottom = 'auto'; el.style.right = 'auto';
        });

        el.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            isDragging = false;
            el.classList.remove('dragging-widget');
            el.releasePointerCapture(e.pointerId);
            
            const rect = el.getBoundingClientRect();
            
            // 🎯 NEW: ASSISTIVETOUCH EDGE-SNAPPING PHYSICS
            const isLeftHalf = (rect.left + rect.width / 2) < (window.innerWidth / 2);
            const snapX = isLeftHalf ? 20 : window.innerWidth - rect.width - 20;
            
            // Keep Y where it is, but clamp it so it doesn't get lost off-screen!
            const snapY = Math.max(20, Math.min(rect.top, window.innerHeight - rect.height - 20));

            el.style.transition = 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)';
            el.style.left = `${snapX}px`;
            el.style.top = `${snapY}px`;
        });

        el.addEventListener('click', (e) => { if (hasMoved) { e.preventDefault(); e.stopPropagation(); } });
    }
}
export const floatingWidgetManager = new FloatingWidgetManager();

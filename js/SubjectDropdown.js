// js/SubjectDropdown.js
// Enhances a native <select> into a custom dropdown showing color swatches.
export function enhanceSelect(selectEl) {
    if (!selectEl) return;
    // If select has no options don't do anything
    const build = () => {
        // If already enhanced, update options
        if (selectEl.dataset.enhanced === 'true') {
            const container = document.getElementById(selectEl.id + '-sd-container');
            if (!container) return;
            const list = container.querySelector('.sd-options');
            list.innerHTML = '';
            Array.from(selectEl.options).forEach(opt => {
                const row = document.createElement('div');
                row.className = 'sd-option flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer';
                const sw = document.createElement('div'); sw.className = 'w-4 h-4 rounded'; sw.style.background = opt.dataset.color || 'transparent';
                const label = document.createElement('div'); label.className = 'text-sm flex-1'; label.innerText = opt.text;
                row.appendChild(sw); row.appendChild(label);
                row.addEventListener('click', () => {
                    selectEl.value = opt.value;
                    selectEl.dispatchEvent(new Event('change'));
                    container.classList.add('hidden');
                });
                list.appendChild(row);
            });
            // update selected display
            const selOpt = selectEl.options[selectEl.selectedIndex];
            const displaySw = container.querySelector('.sd-selected-swatch');
            const displayLabel = container.querySelector('.sd-selected-label');
            if (selOpt) {
                displaySw.style.background = selOpt.dataset.color || 'transparent';
                displayLabel.innerText = selOpt.text || '';
            } else {
                displaySw.style.background = 'transparent'; displayLabel.innerText = '';
            }
            return;
        }

        // Create container
        const container = document.createElement('div');
        container.id = selectEl.id + '-sd-container';
        container.className = 'relative inline-block w-full text-left';

        // Selected button
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full flex items-center gap-2 p-2 border rounded text-sm bg-white justify-between';
        btn.setAttribute('aria-haspopup', 'listbox');

        const left = document.createElement('div'); left.className = 'flex items-center gap-2';
        const swatch = document.createElement('div'); swatch.className = 'sd-selected-swatch w-4 h-4 rounded'; swatch.style.background = 'transparent';
        const lbl = document.createElement('div'); lbl.className = 'sd-selected-label text-sm flex-1 text-left'; lbl.innerText = '';
        left.appendChild(swatch); left.appendChild(lbl);

        const care = document.createElement('i'); care.className = 'fa fa-chevron-down text-gray-400';
        btn.appendChild(left); btn.appendChild(care);

        // Options list
        const list = document.createElement('div');
        list.className = 'sd-options absolute left-0 right-0 mt-1 bg-white border rounded shadow z-50 max-h-48 overflow-y-auto hidden';

        // Build options from select
        Array.from(selectEl.options).forEach(opt => {
            const row = document.createElement('div');
            row.className = 'sd-option flex items-center gap-2 p-2 hover:bg-gray-100 cursor-pointer';
            const sw = document.createElement('div'); sw.className = 'w-4 h-4 rounded'; sw.style.background = opt.dataset.color || 'transparent';
            const label = document.createElement('div'); label.className = 'text-sm flex-1'; label.innerText = opt.text;
            row.appendChild(sw); row.appendChild(label);
            row.addEventListener('click', () => {
                selectEl.value = opt.value;
                selectEl.dispatchEvent(new Event('change'));
                list.classList.add('hidden');
            });
            list.appendChild(row);
        });

        container.appendChild(btn); container.appendChild(list);

        // Insert container after select and hide select
        selectEl.style.display = 'none';
        selectEl.parentNode.insertBefore(container, selectEl.nextSibling);

        // Toggle
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            list.classList.toggle('hidden');
        });
        // Close when clicking outside
        document.addEventListener('click', () => list.classList.add('hidden'));

        // Sync initial selected
        const selOpt = selectEl.options[selectEl.selectedIndex];
        if (selOpt) { swatch.style.background = selOpt.dataset.color || 'transparent'; lbl.innerText = selOpt.text || ''; }

        // Update on select change
        selectEl.addEventListener('change', () => {
            const o = selectEl.options[selectEl.selectedIndex];
            swatch.style.background = o?.dataset.color || 'transparent';
            lbl.innerText = o?.text || '';
        });

        // Mark enhanced
        selectEl.dataset.enhanced = 'true';
    };

    build();
}

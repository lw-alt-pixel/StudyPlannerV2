// js/SubjectDropdown.js
// FIXED: Dropdown list now stays INSIDE its parent container (perfect for modals)

export function enhanceSelect(selectEl) {
    if (!selectEl) return;

    const build = () => {
        if (selectEl.dataset.enhanced === 'true') return;

        const container = document.createElement('div');
        container.className = 'sd-container relative w-full';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'w-full flex items-center gap-2 p-2.5 border border-gray-200 rounded-xl text-sm bg-white justify-between focus:outline-none focus:ring-2 focus:ring-blue-200 font-bold';
        
        const left = document.createElement('div');
        left.className = 'flex items-center gap-2 flex-1';
        const swatch = document.createElement('div');
        swatch.className = 'sd-selected-swatch w-5 h-5 rounded';
        const lbl = document.createElement('div');
        lbl.className = 'sd-selected-label flex-1 text-left';
        left.append(swatch, lbl);

        const caret = document.createElement('i');
        caret.className = 'fa fa-chevron-down text-gray-400';
        btn.append(left, caret);

        const list = document.createElement('div');
        list.className = 'sd-options hidden absolute z-50 bg-white border border-gray-200 rounded-2xl shadow-2xl mt-1 max-h-64 overflow-auto w-full py-1';

        Array.from(selectEl.options).forEach(opt => {
            const row = document.createElement('div');
            row.className = 'flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer';
            const sw = document.createElement('div');
            sw.className = 'w-5 h-5 rounded';
            sw.style.background = opt.dataset.color || 'transparent';
            const label = document.createElement('div');
            label.className = 'font-bold';
            label.textContent = opt.text;
            row.append(sw, label);
            row.onclick = () => {
                selectEl.value = opt.value;
                selectEl.dispatchEvent(new Event('change'));
                list.classList.add('hidden');
            };
            list.appendChild(row);
        });

        container.appendChild(btn);
        container.appendChild(list);

        selectEl.style.display = 'none';
        selectEl.parentNode.insertBefore(container, selectEl.nextSibling);

        const positionList = () => {
            list.style.top = `${btn.offsetHeight + 4}px`;
            list.style.left = '0';
            list.style.width = `${btn.offsetWidth}px`;
        };

        btn.addEventListener('click', e => {
            e.stopPropagation();
            positionList();
            list.classList.toggle('hidden');
        });

        document.addEventListener('click', () => list.classList.add('hidden'));

        const syncDisplay = () => {
            const opt = selectEl.options[selectEl.selectedIndex];
            if (opt) {
                swatch.style.background = opt.dataset.color || 'transparent';
                lbl.textContent = opt.text || '';
            }
        };
        syncDisplay();
        selectEl.addEventListener('change', syncDisplay);

        selectEl.dataset.enhanced = 'true';
    };

    build();
}


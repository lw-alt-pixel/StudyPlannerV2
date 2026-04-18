// js/BlockManager.js
import { store } from './State.js';
import { timerEngine } from './TimerEngine.js';

class BlockManager {
    init() {
        this.modal = document.getElementById('addBlockModal');
        this.subjectInput = document.getElementById('newBlockSubject');
        this.customSubjectDiv = document.getElementById('newBlockCustomSubjectDiv');
        this.customNameInput = document.getElementById('newBlockCustomName');
        this.customColorInput = document.getElementById('newBlockCustomColor');
        this.titleInput = document.getElementById('newBlockTitle');
        this.startDateInput = document.getElementById('newBlockStartDate');
        this.startInput = document.getElementById('newBlockStart');
        this.endDateInput = document.getElementById('newBlockEndDate');
        this.endInput = document.getElementById('newBlockEnd');
        
        this.editModal = document.getElementById('editBlockModal');
        this.editBlockId = null;

        // 🚨 NEW MODALS
        this.bulkModal = document.getElementById('bulkScheduleModal');
        this.pushBackModal = document.getElementById('pushBackModal');
        this.activePushBackId = null;
        this.lastBulkBatchId = null;

        store.subscribe('subjects', () => this.populateSubjects());
        this.populateSubjects();
        this.bindEvents();
    }

    populateSubjects() {
        if (!this.subjectInput) return; 
        const subs = store.state.subjects;
        this.subjectInput.innerHTML = '';
        Object.keys(subs).forEach(sub => {
            this.subjectInput.innerHTML += `<option value="${sub}">${sub}</option>`;
        });
        this.subjectInput.innerHTML += `<option value="Other">📌 Other (New Subject)</option>`;
        
        this.subjectInput.addEventListener('change', (e) => {
            if (e.target.value === 'Other') this.customSubjectDiv.classList.remove('hidden');
            else this.customSubjectDiv.classList.add('hidden');
        });
    }

    bindEvents() {
        document.getElementById('openAddBlockModalHeader')?.addEventListener('click', () => this.openModal());
        document.getElementById('openAddBlockModal')?.addEventListener('click', () => this.openModal());
        document.getElementById('cancelAddBlock')?.addEventListener('click', () => this.modal.classList.add('hidden'));
        document.getElementById('saveNewBlock')?.addEventListener('click', () => this.createBlock());

        document.getElementById('cancelEditBlock')?.addEventListener('click', () => this.editModal.classList.add('hidden'));
        document.getElementById('saveEditBlock')?.addEventListener('click', () => this.saveEditBlock());
        document.getElementById('deleteEditBlock')?.addEventListener('click', () => {
            if(confirm("Are you sure you want to delete this block?")) {
                store.update('blocks', blocks => blocks.filter(b => b.id !== this.editBlockId));
                this.editModal.classList.add('hidden');
            }
        });

        // 🚨 AUTO-FILL EVENTS
        document.getElementById('openBulkModalBtn')?.addEventListener('click', () => {
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('bulkStartDate').value = today;
            document.getElementById('bulkEndDate').value = today;
            this.bulkModal.classList.remove('hidden');
        });
        document.getElementById('cancelBulkBtn')?.addEventListener('click', () => this.bulkModal.classList.add('hidden'));
        document.getElementById('saveBulkBtn')?.addEventListener('click', () => this.generateBulkSchedule());
        document.getElementById('undoBulkBtn')?.addEventListener('click', () => this.undoBulkSchedule());

        // 🚨 PUSH BACK EVENTS
        document.getElementById('cancelPushBackBtn')?.addEventListener('click', () => this.pushBackModal.classList.add('hidden'));
        document.getElementById('savePushBackBtn')?.addEventListener('click', () => this.executePushBack());
    }

    openModal() {
        if (!this.modal) return;
        const now = new Date();
        const yyyyMmDd = now.toISOString().split('T')[0];
        const hhMm = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        
        const endNow = new Date(now.getTime() + 60 * 60000); // Default 1 hour block
        const endYyyyMmDd = endNow.toISOString().split('T')[0];
        const endHhMm = endNow.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

        if(this.startDateInput) this.startDateInput.value = yyyyMmDd;
        if(this.startInput) this.startInput.value = hhMm;
        if(this.endDateInput) this.endDateInput.value = endYyyyMmDd;
        if(this.endInput) this.endInput.value = endHhMm;
        if(this.titleInput) this.titleInput.value = '';
        this.customSubjectDiv?.classList.add('hidden');
        
        this.modal.classList.remove('hidden');
    }

    openModalWithPreFill(dateStr, timeStr, durationMins = 60) {
        if (!this.modal) return;
        this.startDateInput.value = dateStr; this.startInput.value = timeStr;
        
        const startObj = new Date(`${dateStr}T${timeStr}:00`);
        const endObj = new Date(startObj.getTime() + durationMins * 60000);
        this.endDateInput.value = endObj.toISOString().split('T')[0];
        this.endInput.value = endObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        
        this.titleInput.value = ''; this.customSubjectDiv?.classList.add('hidden');
        this.modal.classList.remove('hidden');
    }

    openEditModal(id) {
        this.editBlockId = id;
        const block = store.state.blocks.find(b => b.id === id);
        if (!block) return;

        document.getElementById('editBlockSubject').value = block.subject;
        document.getElementById('editBlockTitle').value = block.title.replace(`${block.subject}: `, '');
        document.getElementById('editBlockStartDate').value = block.startDate;
        document.getElementById('editBlockStart').value = block.scheduledStart;
        document.getElementById('editBlockEndDate').value = block.endDate;
        document.getElementById('editBlockEnd').value = block.scheduledEnd;
        document.getElementById('editBlockRemarks').value = block.remarks || '';

        const statusEl = document.getElementById('editBlockStatus');
        statusEl.innerText = block.status.toUpperCase();
        statusEl.className = `px-2 py-1 text-[10px] font-black uppercase rounded ${block.status === 'completed' ? 'bg-green-100 text-green-700' : block.status === 'active' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`;

        const realStartD = document.getElementById('editBlockRealStartDate'); const realStartT = document.getElementById('editBlockRealStart');
        const realEndD = document.getElementById('editBlockRealEndDate'); const realEndT = document.getElementById('editBlockRealEnd');
        const warning = document.getElementById('editBlockRealWarning');

        if (block.actualStart) {
            const startD = new Date(block.actualStart);
            realStartD.value = startD.toISOString().split('T')[0];
            realStartT.value = startD.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        } else { realStartD.value = ''; realStartT.value = ''; }

        if (block.actualEnd) {
            const endD = new Date(block.actualEnd);
            realEndD.value = endD.toISOString().split('T')[0];
            realEndT.value = endD.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
        } else { realEndD.value = ''; realEndT.value = ''; }

        if (block.status === 'completed') {
            realStartD.disabled = false; realStartT.disabled = false; realEndD.disabled = false; realEndT.disabled = false;
            warning.classList.remove('hidden');
        } else {
            realStartD.disabled = true; realStartT.disabled = true; realEndD.disabled = true; realEndT.disabled = true;
            warning.classList.add('hidden');
        }

        this.editModal.classList.remove('hidden');
    }

    saveEditBlock() {
        const block = store.state.blocks.find(b => b.id === this.editBlockId);
        if (!block) return;

        const topic = document.getElementById('editBlockTitle').value.trim();
        const updatedBlock = {
            ...block,
            title: topic ? `${block.subject}: ${topic}` : block.subject,
            startDate: document.getElementById('editBlockStartDate').value,
            scheduledStart: document.getElementById('editBlockStart').value,
            endDate: document.getElementById('editBlockEndDate').value,
            scheduledEnd: document.getElementById('editBlockEnd').value,
            remarks: document.getElementById('editBlockRemarks').value
        };

        if (block.status === 'completed') {
            const rStartD = document.getElementById('editBlockRealStartDate').value;
            const rStartT = document.getElementById('editBlockRealStart').value;
            const rEndD = document.getElementById('editBlockRealEndDate').value;
            const rEndT = document.getElementById('editBlockRealEnd').value;

            if (rStartD && rStartT) updatedBlock.actualStart = new Date(`${rStartD}T${rStartT}:00`).getTime();
            if (rEndD && rEndT) updatedBlock.actualEnd = new Date(`${rEndD}T${rEndT}:00`).getTime();
        }

        store.update('blocks', blocks => blocks.map(b => b.id === this.editBlockId ? updatedBlock : b));
        this.editModal.classList.add('hidden');
    }

    createBlock() {
        if (!this.subjectInput) return;

        let finalSubject = this.subjectInput.value;
        if (finalSubject === 'Other') {
            finalSubject = this.customNameInput?.value.trim() || 'Custom Subject';
            const newColor = this.customColorInput?.value || '#3b82f6';
            store.update('subjects', subs => ({...subs, [finalSubject]: newColor}));
        }

        const topic = this.titleInput?.value.trim();
        const finalTitle = topic ? `${finalSubject}: ${topic}` : finalSubject;

        const newBlock = {
            id: Date.now(), subject: finalSubject, title: finalTitle,
            startDate: this.startDateInput?.value, scheduledStart: this.startInput?.value,
            endDate: this.endDateInput?.value, scheduledEnd: this.endInput?.value,
            actualStart: null, actualEnd: null, status: 'pending', studySeconds: 0, breakSeconds: 0, remarks: ''
        };

        store.update('blocks', oldBlocks => [...oldBlocks, newBlock]);
        this.modal.classList.add('hidden');
    }

    // ==========================================
    // 🚨 SMART PUSH BACK (SPLIT ENGINE)
    // ==========================================
    openPushBackModal(blockId, prefillDuration = null) {
        this.activePushBackId = blockId;
        const b = store.state.blocks.find(x => x.id === blockId);
        
        // Auto-calculate remaining time if not provided
        let duration = prefillDuration;
        if (!duration) {
            const sObj = new Date(`${b.startDate}T${b.scheduledStart}:00`);
            const eObj = new Date(`${b.endDate}T${b.scheduledEnd}:00`);
            const expectedMins = Math.round((eObj - sObj) / 60000);
            const studiedMins = Math.floor((b.studySeconds || store.state.timer.studySeconds) / 60);
            duration = Math.max(15, expectedMins - studiedMins);
        }

        document.getElementById('pushBackDuration').value = duration;
        
        // Default to Tomorrow at the same time
        const tmrw = new Date(); tmrw.setDate(tmrw.getDate() + 1);
        document.getElementById('pushBackDate').value = tmrw.toISOString().split('T')[0];
        document.getElementById('pushBackTime').value = b.scheduledStart;

        this.pushBackModal.classList.remove('hidden');
    }

    executePushBack() {
        const id = this.activePushBackId;
        const b = store.state.blocks.find(x => x.id === id);
        if (!b) return;

        const durMins = parseInt(document.getElementById('pushBackDuration').value) || 60;
        const newDateStr = document.getElementById('pushBackDate').value;
        const newTimeStr = document.getElementById('pushBackTime').value;

        if (!newDateStr || !newTimeStr) return alert("Please provide a new date and time.");

        // 1. Calculate End Time for new block
        const startObj = new Date(`${newDateStr}T${newTimeStr}:00`);
        const endObj = new Date(startObj.getTime() + durMins * 60000);
        const newEndDateStr = endObj.toISOString().split('T')[0];
        const newEndTimeStr = endObj.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });

        // 2. Finish Current Block safely
        const actualEnd = new Date().getTime();
        let studySecs = b.studySeconds;
        let breakSecs = b.breakSeconds;
        if (store.state.timer.activeBlockId === id) {
            studySecs = store.state.timer.studySeconds;
            breakSecs = store.state.timer.breakSeconds;
            timerEngine.stop();
            store.update('timer', state => ({ ...state, isRunning: false, activeBlockId: null, studySeconds: 0, breakSeconds: 0, secondsElapsed: 0, phase: 'study' }));
        }

        store.update('blocks', blocks => blocks.map(x => x.id === id ? { 
            ...x, actualEnd: actualEnd, status: 'completed', studySeconds: studySecs, breakSeconds: breakSecs, title: `${x.title} (Part 1)` 
        } : x));

        // 3. Create New Future Block
        const newBlock = {
            id: Date.now() + Math.floor(Math.random()*1000), 
            subject: b.subject, title: b.title.replace(' (Part 1)', '') + ' (Cont.)',
            startDate: newDateStr, scheduledStart: newTimeStr, endDate: newEndDateStr, scheduledEnd: newEndTimeStr,
            actualStart: null, actualEnd: null, status: 'pending', studySeconds: 0, breakSeconds: 0, remarks: ''
        };
        store.update('blocks', old => [...old, newBlock]);

        this.pushBackModal.classList.add('hidden');
        alert("Session split! Progress saved, and remaining time pushed back.");
    }

    // ==========================================
    // 🚨 GHOST BULK AUTO-SCHEDULER (COLLISION ENGINE)
    // ==========================================
    isSlotFree(startObj, endObj) {
        // Checks if this time slot overlaps with ANY existing block
        const startMs = startObj.getTime();
        const endMs = endObj.getTime();
        
        return !store.state.blocks.some(b => {
            const bStart = new Date(`${b.startDate}T${b.scheduledStart}:00`).getTime();
            const bEnd = new Date(`${b.endDate}T${b.scheduledEnd}:00`).getTime();
            // Overlap math: (StartA < EndB) && (EndA > StartB)
            return (startMs < bEnd) && (endMs > bStart);
        });
    }

    generateBulkSchedule() {
        const sDate = document.getElementById('bulkStartDate').value; const sTime = document.getElementById('bulkStartTime').value;
        const eDate = document.getElementById('bulkEndDate').value; const eTime = document.getElementById('bulkEndTime').value;
        const studyMins = parseInt(document.getElementById('bulkStudy').value) || 50;
        const breakMins = parseInt(document.getElementById('bulkBreak').value) || 10;
        
        const hasLunch = document.getElementById('bulkHasLunch').checked;
        const lunchTime = document.getElementById('bulkLunchTime').value;
        const lunchDur = parseInt(document.getElementById('bulkLunchDuration').value) || 60;

        if (!sDate || !sTime || !eDate || !eTime) return alert("Fill all dates and times!");
        const startTotal = new Date(`${sDate}T${sTime}`); const endTotal = new Date(`${eDate}T${eTime}`);
        if (startTotal >= endTotal) return alert("End must be after start!");

        let current = new Date(startTotal);
        const batchId = Date.now();
        const newGhostBlocks = [];
        let generated = 0;

        // Ensure we don't infinitely loop
        while (current < endTotal && generated < 100) {
            
            // Skip the night! (If current jumps past the user's daily end time, push it to tomorrow's start time)
            const dailyEndStr = `${current.toISOString().split('T')[0]}T${eTime}`;
            const dailyEndObj = new Date(dailyEndStr);
            if (current >= dailyEndObj) {
                current.setDate(current.getDate() + 1);
                const nextStartStr = `${current.toISOString().split('T')[0]}T${sTime}`;
                current = new Date(nextStartStr);
                continue;
            }

            // Lunch Evasion
            if (hasLunch && lunchTime) {
                const lunchStartObj = new Date(`${current.toISOString().split('T')[0]}T${lunchTime}`);
                const lunchEndObj = new Date(lunchStartObj.getTime() + lunchDur * 60000);
                
                // If current time is inside lunch, skip past lunch!
                if (current >= lunchStartObj && current < lunchEndObj) {
                    current = new Date(lunchEndObj);
                    continue;
                }
                // If block would overflow INTO lunch, skip past lunch!
                const proposedEnd = new Date(current.getTime() + studyMins * 60000);
                if (current < lunchStartObj && proposedEnd > lunchStartObj) {
                    current = new Date(lunchEndObj);
                    continue;
                }
            }

            const blockEnd = new Date(current.getTime() + studyMins * 60000);
            
            // Collision Detection
            if (this.isSlotFree(current, blockEnd) && blockEnd <= dailyEndObj) {
                newGhostBlocks.push({
                    id: Date.now() + generated + Math.floor(Math.random()*1000), 
                    subject: "Ghost Block", title: "Untitled (Auto-Fill)",
                    startDate: current.toISOString().split('T')[0], 
                    scheduledStart: current.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }), 
                    endDate: blockEnd.toISOString().split('T')[0], 
                    scheduledEnd: blockEnd.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' }),
                    actualStart: null, actualEnd: null, status: 'pending', studySeconds: 0, breakSeconds: 0, remarks: '',
                    batchId: batchId // Used for UNDO
                });
                generated++;
            }

            // Move pointer forward (Study + Break)
            current = new Date(current.getTime() + (studyMins + breakMins) * 60000);
        }

        if (generated > 0) {
            this.lastBulkBatchId = batchId;
            store.update('blocks', old => [...old, ...newGhostBlocks]);
            document.getElementById('undoBulkBtn').classList.remove('hidden');
            alert(`Successfully generated ${generated} ghost blocks!`);
        } else {
            alert("Could not find any empty slots in that time range!");
        }
        this.bulkModal.classList.add('hidden');
    }

    undoBulkSchedule() {
        if (!this.lastBulkBatchId) return;
        if (confirm("Remove the last bulk-generated blocks?")) {
            store.update('blocks', b => b.filter(x => x.batchId !== this.lastBulkBatchId));
            this.lastBulkBatchId = null;
            document.getElementById('undoBulkBtn').classList.add('hidden');
        }
    }
}
export const blockManager = new BlockManager();

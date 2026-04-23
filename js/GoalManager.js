// js/GoalManager.js
import { store } from './State.js';
import { enhanceSelect } from './SubjectDropdown.js';

class GoalManager {
    init() {
        this.container = document.getElementById('goalsListContainer');
        this.modal = document.getElementById('goalSetupModal');
        this.bindEvents();
        this.populateExamDropdown();
        this.populateSubjectDropdown();
        
        store.subscribe('goals', () => this.render());
        store.subscribe('exams', () => this.populateExamDropdown());
        store.subscribe('subjects', () => this.populateSubjectDropdown());
        this.render();
    }

    bindEvents() {
        document.getElementById('createNewGoalBtn')?.addEventListener('click', () => {
            document.getElementById('newGoalTitle').value = '';
            document.getElementById('newGoalDate').value = '';
            document.getElementById('newGoalExamSelect').value = '';
            const subjEl = document.getElementById('newGoalSubject');
            if (subjEl) { subjEl.value = ''; subjEl.disabled = false; }
            this.modal?.classList.remove('hidden');
        });

        // When an exam is selected, auto-set and lock the subject to the exam's subject
        document.getElementById('newGoalExamSelect')?.addEventListener('change', (e) => {
            const examId = e.target.value;
            const subjectSelect = document.getElementById('newGoalSubject');
            if (!subjectSelect) return;
            if (!examId) {
                subjectSelect.disabled = false;
                return;
            }
            const exam = store.state.exams?.find(x => x.id === examId);
            if (exam && exam.subject) {
                subjectSelect.value = exam.subject;
            } else {
                subjectSelect.value = '';
            }
            subjectSelect.disabled = true;
        });

        document.getElementById('closeGoalSetupBtn')?.addEventListener('click', () => {
            this.modal?.classList.add('hidden');
        });

        document.getElementById('saveNewGoalBtn')?.addEventListener('click', () => {
            const title = document.getElementById('newGoalTitle').value.trim();
            const linkedExamId = document.getElementById('newGoalExamSelect')?.value || null;
            let subject = document.getElementById('newGoalSubject')?.value || null;
            if (linkedExamId) {
                const ex = store.state.exams?.find(x => x.id === linkedExamId);
                subject = ex?.subject || subject;
            }
            const date = document.getElementById('newGoalDate').value;
            
            if (!title) return alert("Please enter a Goal title.");
            
            const newGoal = {
                id: 'goal_' + Date.now(),
                title: title,
                targetDate: date,
                subject: subject,
                linkedExamId: linkedExamId,
                topics: []
            };

            store.update('goals', old => [...(old || []), newGoal]);
            this.modal.classList.add('hidden');
        });

        // Timeline dropdown toggle
        document.getElementById('toggleTimelineBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = document.getElementById('timelineDropdown');
            dropdown?.classList.toggle('hidden');
        });
    }

    populateExamDropdown() {
        const select = document.getElementById('newGoalExamSelect');
        if (!select) return;

        const exams = store.state.exams || [];
        const currentValue = select.value;
        
        select.innerHTML = '<option value="">None - Create Standalone Goal</option>';
        exams.forEach(exam => {
            const opt = document.createElement('option');
            opt.value = exam.id;
            opt.text = `${exam.title} (${exam.subject}) - ${exam.date}`;
            select.appendChild(opt);
        });

        select.value = currentValue;
    }

    populateSubjectDropdown() {
        const select = document.getElementById('newGoalSubject');
        if (!select) return;
        const allSubs = store.state.subjects || {};
        const activeMap = store.state.subjectsActive || {};
        const subs = Object.keys(allSubs).filter(s => activeMap[s] !== false).reduce((acc,k)=>{acc[k]=allSubs[k];return acc;},{ });
        const current = select.value;
        select.innerHTML = '<option value="">(None)</option>';
        Object.keys(subs).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s; opt.text = s; if (subs[s]) opt.dataset.color = subs[s]; select.appendChild(opt);
        });
        // Color chip for the select
        const setColor = (sel) => {
            const v = sel.value; const color = (subs && subs[v]) ? subs[v] : '';
            if (color) sel.style.backgroundImage = `linear-gradient(to right, ${color} 0 22px, transparent 22px)`; else sel.style.backgroundImage = '';
        };
        select.addEventListener('change', () => setColor(select));
        select.value = current;
        setColor(select);
        try { enhanceSelect(select); } catch (e) { }
    }

    // 🚨 The Math Engine: Recursively calculates progress from Tasks -> Chapters -> Topics -> Goal
    calculateProgress(node, type) {
        if (type === 'task') return node.isCompleted ? 100 : 0;
        
        const children = type === 'goal' ? node.topics : (type === 'topic' ? node.chapters : node.tasks);
        if (!children || children.length === 0) return 0;

        // Auto-balance: if children don't have manually set weights, distribute 100% equally
        const totalManualWeight = children.reduce((sum, c) => sum + (c.weight || 0), 0);
        const autoWeight = children.length > 0 ? (100 - totalManualWeight) / children.filter(c => !c.weight).length : 0;

        let totalProgress = 0;
        children.forEach(c => {
            const childWeight = c.weight || autoWeight;
            const childProgress = this.calculateProgress(c, type === 'goal' ? 'topic' : (type === 'topic' ? 'chapter' : 'task'));
            totalProgress += (childProgress * (childWeight / 100));
        });

        return Math.min(100, Math.round(totalProgress));
    }

    render() {
        if (!this.container) return;
        const goals = store.state.goals || [];
        this.container.innerHTML = '';

        if (goals.length === 0) {
            this.container.innerHTML = `
                <div class="text-center p-12 border-2 border-dashed border-gray-300 rounded-3xl">
                    <i class="fa fa-mountain text-6xl text-gray-200 mb-4"></i>
                    <h3 class="text-xl font-black text-gray-400">No Goals Yet</h3>
                    <p class="text-sm font-bold text-gray-400 mt-2">Create a Master Goal to start tracking your syllabus.</p>
                </div>`;
            return;
        }

        goals.forEach((goal, gIndex) => {
            const goalProgress = this.calculateProgress(goal, 'goal');
            const gEl = document.createElement('div');
            gEl.className = 'bg-white border-2 border-gray-200 rounded-3xl p-6 shadow-sm mb-6';
            
            const dateBadge = goal.targetDate ? `<span class="bg-red-100 text-red-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ml-3"><i class="fa fa-flag-checkered mr-1"></i>${goal.targetDate}</span>` : '';
            
            // 🚨 Show exam link if linked
            const linkedExam = goal.linkedExamId ? store.state.exams?.find(e => e.id === goal.linkedExamId) : null;
            const examBadge = linkedExam ? `<span class="bg-purple-100 text-purple-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ml-2"><i class="fa fa-link mr-1"></i>Exam: ${linkedExam.title}</span>` : '';

            const subColor = goal.subject ? (store.state.subjects[goal.subject] || '#3b82f6') : null;
            const subjectBadge = goal.subject ? `<span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ml-2" style="background:${subColor}; color: white;"><i class="fa fa-book mr-1"></i>${goal.subject}</span>` : '';

            gEl.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-2xl font-black text-gray-800 tracking-tight">${goal.title} ${dateBadge}</h3>
                        <div class="text-xs font-bold text-gray-400 mt-2 flex gap-2 flex-wrap">${examBadge}${subjectBadge}</div>
                        <div class="text-xs font-bold text-gray-400 mt-1 uppercase tracking-widest">Master Goal Progress</div>
                    </div>
                    <button class="text-gray-400 hover:text-red-500 transition-colors px-2 py-1" onclick="if(confirm('Delete this entire Goal?')) window.goalManager.deleteNode('goal', '${goal.id}')"><i class="fa fa-trash"></i></button>
                </div>
                <div class="w-full bg-gray-100 rounded-full h-4 mb-2 overflow-hidden shadow-inner">
                    <div class="bg-blue-600 h-4 rounded-full transition-all duration-1000" style="width: ${goalProgress}%"></div>
                </div>
                <div class="text-right text-xs font-black text-blue-600 mb-6">${goalProgress}% Completed</div>
                
                <div class="space-y-4 pl-2" id="topics-container-${goal.id}"></div>
                
                <button class="mt-6 w-full py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 font-bold rounded-xl text-sm transition-colors" onclick="window.goalManager.addChild('topic', '${goal.id}')">
                    <i class="fa fa-plus text-blue-500 mr-2"></i> Add Study Topic
                </button>
            `;

            this.container.appendChild(gEl);
            const topicsContainer = document.getElementById(`topics-container-${goal.id}`);

            // Render Topics
            (goal.topics || []).forEach(topic => {
                const topicProgress = this.calculateProgress(topic, 'topic');
                const tEl = document.createElement('div');
                tEl.className = 'border border-gray-200 rounded-2xl bg-gray-50 overflow-hidden';
                
                tEl.innerHTML = `
                    <div class="p-4 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors" onclick="document.getElementById('chapters-${topic.id}').classList.toggle('hidden')">
                        <div class="flex-1">
                            <div class="flex items-center gap-2">
                                <i class="fa fa-folder text-blue-400"></i>
                                <span class="font-bold text-gray-800">${topic.title}</span>
                            </div>
                            <div class="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden w-3/4">
                                <div class="bg-blue-400 h-1.5 rounded-full" style="width: ${topicProgress}%"></div>
                            </div>
                        </div>
                        <div class="text-xs font-black text-gray-500 ml-4">${topicProgress}%</div>
                        <button class="ml-4 text-gray-400 hover:text-red-500" onclick="event.stopPropagation(); window.goalManager.deleteNode('topic', '${goal.id}', '${topic.id}')"><i class="fa fa-times"></i></button>
                    </div>
                    <div id="chapters-${topic.id}" class="hidden bg-white border-t border-gray-200 p-4 pl-8 space-y-4"></div>
                `;
                topicsContainer.appendChild(tEl);

                const chaptersContainer = document.getElementById(`chapters-${topic.id}`);
                
                // Render Chapters
                (topic.chapters || []).forEach(chapter => {
                    const chapterProgress = this.calculateProgress(chapter, 'chapter');
                    const cEl = document.createElement('div');
                    cEl.className = 'border-l-2 border-blue-200 pl-4 py-1';
                    
                    cEl.innerHTML = `
                        <div class="flex justify-between items-center cursor-pointer mb-2" onclick="document.getElementById('tasks-${chapter.id}').classList.toggle('hidden')">
                            <div>
                                <i class="fa fa-bookmark text-blue-300 mr-2 text-sm"></i>
                                <span class="font-bold text-gray-700 text-sm">${chapter.title}</span> <span class="text-[10px] text-gray-400 font-bold ml-2">(${chapterProgress}%)</span>
                            </div>
                            <button class="text-gray-400 hover:text-red-500 text-xs" onclick="event.stopPropagation(); window.goalManager.deleteNode('chapter', '${goal.id}', '${topic.id}', '${chapter.id}')"><i class="fa fa-times"></i></button>
                        </div>
                        <div id="tasks-${chapter.id}" class="hidden space-y-2 mt-3 mb-3"></div>
                    `;
                    chaptersContainer.appendChild(cEl);

                    const tasksContainer = document.getElementById(`tasks-${chapter.id}`);
                    
                    // Render Tasks
                    (chapter.tasks || []).forEach(task => {
                        const taskEl = document.createElement('div');
                        taskEl.className = 'flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-100 hover:shadow-sm transition-shadow';
                        
                        taskEl.innerHTML = `
                            <input type="checkbox" ${task.isCompleted ? 'checked' : ''} class="w-4 h-4 text-blue-600 rounded border-gray-300 cursor-pointer" onclick="window.goalManager.toggleTask('${goal.id}', '${topic.id}', '${chapter.id}', '${task.id}', this.checked)">
                            <span class="flex-1 text-xs font-bold ${task.isCompleted ? 'text-gray-400 line-through' : 'text-gray-700'}">${task.title}</span>
                            
                            <button class="text-[10px] font-black bg-blue-100 text-blue-600 hover:bg-blue-600 hover:text-white px-2 py-1 rounded transition-colors uppercase tracking-widest" onclick="window.goalManager.scheduleToCanvas('${goal.id}', '${topic.id}', '${chapter.id}', '${task.id}')">
                                <i class="fa fa-calendar-plus mr-1"></i> Schedule
                            </button>
                            <button class="text-gray-300 hover:text-red-500 text-xs ml-2" onclick="window.goalManager.deleteNode('task', '${goal.id}', '${topic.id}', '${chapter.id}', '${task.id}')"><i class="fa fa-trash"></i></button>
                        `;
                        tasksContainer.appendChild(taskEl);
                    });

                    tasksContainer.innerHTML += `<button class="text-xs font-bold text-gray-400 hover:text-blue-500" onclick="window.goalManager.addChild('task', '${goal.id}', '${topic.id}', '${chapter.id}')"><i class="fa fa-plus mr-1"></i> Add Task</button>`;
                });

                chaptersContainer.innerHTML += `<button class="text-sm font-bold text-blue-500 hover:text-blue-600 mt-2" onclick="window.goalManager.addChild('chapter', '${goal.id}', '${topic.id}')"><i class="fa fa-plus mr-1"></i> Add Chapter</button>`;
            });
        });
    }

    // --- DATA MUTATION HELPERS ---
    
    addChild(type, goalId, topicId, chapterId) {
        const title = prompt(`Enter ${type} title:`);
        if (!title) return;

        store.update('goals', goals => {
            const g = goals.find(x => x.id === goalId);
            if (type === 'topic') {
                g.topics.push({ id: 't_' + Date.now(), title, weight: 0, chapters: [] });
            } else if (type === 'chapter') {
                const t = g.topics.find(x => x.id === topicId);
                t.chapters.push({ id: 'c_' + Date.now(), title, weight: 0, tasks: [] });
            } else if (type === 'task') {
                const t = g.topics.find(x => x.id === topicId);
                const c = t.chapters.find(x => x.id === chapterId);
                c.tasks.push({ id: 'task_' + Date.now(), title, weight: 0, isCompleted: false });
            }
            return [...goals];
        });
    }

    toggleTask(goalId, topicId, chapterId, taskId, isCompleted) {
        store.update('goals', goals => {
            const g = goals.find(x => x.id === goalId);
            const t = g.topics.find(x => x.id === topicId);
            const c = t.chapters.find(x => x.id === chapterId);
            const task = c.tasks.find(x => x.id === taskId);
            task.isCompleted = isCompleted;
            return [...goals];
        });
    }

    deleteNode(type, goalId, topicId, chapterId, taskId) {
        if (!confirm('Delete this item?')) return;
        store.update('goals', goals => {
            if (type === 'goal') return goals.filter(x => x.id !== goalId);
            const g = goals.find(x => x.id === goalId);
            if (type === 'topic') g.topics = g.topics.filter(x => x.id !== topicId);
            else if (type === 'chapter') {
                const t = g.topics.find(x => x.id === topicId);
                t.chapters = t.chapters.filter(x => x.id !== chapterId);
            } else if (type === 'task') {
                const t = g.topics.find(x => x.id === topicId);
                const c = t.chapters.find(x => x.id === chapterId);
                c.tasks = c.tasks.filter(x => x.id !== taskId);
            }
            return [...goals];
        });
    }

    // 🚨 ENHANCED CANVAS SYNERGY ENGINE - Generates rich task titles
    scheduleToCanvas(goalId, topicId, chapterId, taskId) {
        const goal = store.state.goals.find(g => g.id === goalId);
        const topic = goal?.topics.find(t => t.id === topicId);
        const chapter = topic?.chapters.find(c => c.id === chapterId);
        const task = chapter?.tasks.find(t => t.id === taskId);
        
        if (!task || !topic || !chapter) return;

        // Switch view to schedule
        document.querySelector('.tab-btn[data-tab="schedule"]')?.click();
        
        // Open the Add Block Modal
        const modal = document.getElementById('addBlockModal');
        if (modal) modal.classList.remove('hidden');

        // Pre-fill the inputs!
        const titleInput = document.getElementById('newBlockTitle');
        const subjectSelect = document.getElementById('newBlockSubject');
        const customSubjectDiv = document.getElementById('newBlockCustomSubjectDiv');
        const customNameInput = document.getElementById('newBlockCustomName');

        // 🎯 ENHANCED TITLE FORMAT: [Topic: Physics] [Chapter: Electromagnetism] [Task: Solve 10 problems] *for Final Physics*
        let blocktitle = `[Topic: ${topic.title}] [Chapter: ${chapter.title}] [Task: ${task.title}]`;
        if (goal.linkedExamId) {
            const exam = store.state.exams?.find(e => e.id === goal.linkedExamId);
            if (exam) blocktitle += ` *for ${exam.title}*`;
        }
        
        if (titleInput) titleInput.value = blocktitle;
        
        // Auto-populate subject
        if (goal.subject) {
            // Try to set the subject from goal
            const subs = store.state.subjects;
            if (subs && subs[goal.subject]) {
                subjectSelect.value = goal.subject;
                // If the goal is linked to an exam, lock the subject to exam's subject
            } else {
                subjectSelect.value = '';
            }
        }

        // If this goal is linked to an exam, lock the add-block modal subject
        if (goal.linkedExamId) {
            const m = document.getElementById('addBlockModal');
            if (m) {
                m.dataset.lockedSubject = 'true';
                m.dataset.lockedSubjectValue = (store.state.exams?.find(e => e.id === goal.linkedExamId)?.subject) || goal.subject || '';
            }
            if (subjectSelect) {
                const examSubject = store.state.exams?.find(e => e.id === goal.linkedExamId)?.subject || goal.subject;
                if (examSubject) subjectSelect.value = examSubject;
                subjectSelect.disabled = true;
            }
        }
    }
}
export const goalManager = new GoalManager();

// Expose to window so our inline HTML onclicks can reach it
window.goalManager = goalManager;

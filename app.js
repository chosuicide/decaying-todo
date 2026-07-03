/**
 * DECAY - client-side task decay manager.
 * One state store drives Today, Task Detail, Timeline, Report, and Settings.
 */

const CONFIG = {
    LOCAL_STORAGE_KEYS: {
        TASKS: 'decaying_todo_tasks',
        EVENTS: 'decaying_todo_events',
        LOGGED_DECAYS: 'decaying_todo_logged_decays',
        TIME_OFFSET: 'decaying_todo_time_offset',
        STATS: 'decaying_todo_total_stats',
        THEME: 'decaying_todo_theme',
        DEFAULT_DURATION: 'decaying_todo_default_duration'
    },
    VALID_VIEWS: ['today', 'timeline', 'report', 'settings'],
    VALID_PRIORITIES: ['low', 'medium', 'high'],
    DEFAULT_DURATION: 172800,
    MAX_DURATION: 31536000
};

const PRIORITY_LABELS = {
    low: '低优先级',
    medium: '中优先级',
    high: '高优先级'
};

const CATEGORY_LABELS = {
    personal: '个人',
    work: '工作',
    study: '学习',
    life: '生活'
};

let state = {
    tasks: [],
    procrastinationEvents: [],
    loggedDecayIds: [],
    timeOffsetMs: 0,
    activeView: 'today',
    taskFilter: 'active',
    selectedTaskId: null,
    stats: {
        totalCreated: 0,
        totalCompleted: 0,
        totalDecayed: 0,
        totalRenewed: 0,
        totalCompletionDecay: 0,
        completionSamples: 0
    }
};

let sheetReturnFocus = null;

function getCurrentTime() {
    return Date.now() + state.timeOffsetMs;
}

function getLocalDateString(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function durationToSeconds(value, unit) {
    const numericValue = Math.max(1, Math.floor(Number(value) || 0));
    const multipliers = {
        seconds: 1,
        minutes: 60,
        hours: 3600,
        days: 86400
    };
    return Math.min(CONFIG.MAX_DURATION, numericValue * (multipliers[unit] || 1));
}

function durationToEditorValue(seconds) {
    if (seconds % 86400 === 0) return { value: seconds / 86400, unit: 'days' };
    if (seconds % 3600 === 0) return { value: seconds / 3600, unit: 'hours' };
    if (seconds % 60 === 0) return { value: seconds / 60, unit: 'minutes' };
    return { value: seconds, unit: 'seconds' };
}

function getSelectedDecaySeconds() {
    const decaySelect = document.getElementById('decay-select');
    if (!decaySelect) return CONFIG.DEFAULT_DURATION;

    if (decaySelect.value !== 'custom') {
        return Math.max(1, Number.parseInt(decaySelect.value, 10) || CONFIG.DEFAULT_DURATION);
    }

    return durationToSeconds(
        document.getElementById('custom-duration-value')?.value,
        document.getElementById('custom-duration-unit')?.value
    );
}

function normalizeTask(task) {
    const fallbackSeconds = Number.parseInt(task?.decaySeconds, 10) || CONFIG.DEFAULT_DURATION;
    const status = task?.status === 'completed' ? 'completed' : 'active';
    return {
        id: task?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: String(task?.text || '未命名任务'),
        notes: String(task?.notes || ''),
        createdAt: Number(task?.createdAt) || Date.now(),
        decaySeconds: Math.max(1, Math.min(CONFIG.MAX_DURATION, fallbackSeconds)),
        renewCount: Math.max(0, Number(task?.renewCount) || 0),
        status,
        completedAt: status === 'completed' ? Number(task?.completedAt) || Number(task?.createdAt) || Date.now() : null,
        completionDecay: status === 'completed' ? Math.max(0, Math.min(1, Number(task?.completionDecay) || 0)) : null,
        priority: CONFIG.VALID_PRIORITIES.includes(task?.priority) ? task.priority : 'medium',
        category: CATEGORY_LABELS[task?.category] ? task.category : 'personal',
        subtasks: Array.isArray(task?.subtasks)
            ? task.subtasks.map(item => ({
                id: item.id || `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                text: String(item.text || ''),
                completed: Boolean(item.completed)
            })).filter(item => item.text)
            : []
    };
}

function normalizeStats(stats) {
    const source = stats && typeof stats === 'object' ? stats : {};
    return {
        totalCreated: Math.max(0, Number(source.totalCreated) || 0),
        totalCompleted: Math.max(0, Number(source.totalCompleted) || 0),
        totalDecayed: Math.max(0, Number(source.totalDecayed) || 0),
        totalRenewed: Math.max(0, Number(source.totalRenewed) || 0),
        totalCompletionDecay: Math.max(0, Number(source.totalCompletionDecay) || 0),
        completionSamples: Math.max(0, Number(source.completionSamples) || 0)
    };
}

function loadStateFromStorage() {
    try {
        state.timeOffsetMs = Number.parseInt(localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.TIME_OFFSET) || '0', 10) || 0;
        const storedTasks = JSON.parse(localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.TASKS) || '[]');
        state.tasks = Array.isArray(storedTasks) ? storedTasks.map(normalizeTask) : [];
        const events = JSON.parse(localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.EVENTS) || '[]');
        state.procrastinationEvents = Array.isArray(events) ? events : [];
        const loggedIds = JSON.parse(localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.LOGGED_DECAYS) || '[]');
        state.loggedDecayIds = Array.isArray(loggedIds) ? loggedIds : [];
        state.stats = normalizeStats(JSON.parse(localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.STATS) || '{}'));
    } catch (error) {
        console.error('Could not read local DECAY data:', error);
        resetStateData(false);
    }
}

function saveStateToStorage() {
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.TIME_OFFSET, String(state.timeOffsetMs));
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.EVENTS, JSON.stringify(state.procrastinationEvents));
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.LOGGED_DECAYS, JSON.stringify(state.loggedDecayIds));
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.STATS, JSON.stringify(state.stats));
}

function getInitialTheme() {
    const savedTheme = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.THEME);
    if (savedTheme === 'light' || savedTheme === 'dark') return savedTheme;
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function applyTheme(theme) {
    const normalizedTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = normalizedTheme;
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.THEME, normalizedTheme);

    const toggle = document.getElementById('btn-theme-toggle');
    const value = document.getElementById('theme-value');
    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (toggle) toggle.setAttribute('aria-label', normalizedTheme === 'light' ? '切换到深色模式' : '切换到浅色模式');
    if (value) value.textContent = normalizedTheme === 'light' ? '浅色' : '深色';
    if (themeColor) themeColor.content = normalizedTheme === 'light' ? '#eef0e9' : '#080a0b';
}

function resetStateData(notify = true) {
    state.tasks = [];
    state.procrastinationEvents = [];
    state.loggedDecayIds = [];
    state.timeOffsetMs = 0;
    state.taskFilter = 'active';
    state.selectedTaskId = null;
    state.stats = normalizeStats({});
    saveStateToStorage();
    setActiveView('today', false);
    renderAll();
    if (notify) showToast('本地数据已清空');
}

function isReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function spawnParticles(sourceElement, kind = 'ember') {
    if (isReducedMotion() || !sourceElement) return;
    const layer = document.getElementById('particle-layer');
    if (!layer) return;

    const rect = sourceElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const count = kind === 'ash' ? 24 : 18;

    for (let index = 0; index < count; index += 1) {
        const particle = document.createElement('span');
        const angle = kind === 'ash'
            ? Math.PI / 2 + (Math.random() - 0.5) * Math.PI
            : -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.85;
        const distance = 36 + Math.random() * 80;
        particle.className = `particle particle-${kind}`;
        particle.style.setProperty('--x', `${rect.left + rect.width * (0.2 + Math.random() * 0.6)}px`);
        particle.style.setProperty('--y', `${rect.top + rect.height * (0.25 + Math.random() * 0.5)}px`);
        particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`);
        particle.style.setProperty('--dy', `${Math.sin(angle) * distance + (kind === 'ash' ? 26 : -8)}px`);
        particle.style.setProperty('--size', `${2 + Math.random() * 3.5}px`);
        particle.style.setProperty('--duration', `${520 + Math.random() * 420}ms`);
        particle.style.setProperty('--particle-color', kind === 'ash'
            ? 'rgba(126, 131, 126, 0.72)'
            : `rgba(170, ${185 + Math.floor(Math.random() * 45)}, 35, 0.92)`);
        layer.appendChild(particle);
        particle.addEventListener('animationend', () => particle.remove(), { once: true });
    }
}

function logProcrastinationEvent(taskId, type) {
    if (type === 'expire' && state.loggedDecayIds.includes(taskId)) return;
    const timestamp = getCurrentTime();

    if (type === 'expire') {
        state.loggedDecayIds.push(taskId);
        state.stats.totalDecayed += 1;
    } else if (type === 'renew') {
        state.stats.totalRenewed += 1;
    }

    state.procrastinationEvents.push({
        id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        taskId,
        date: getLocalDateString(timestamp),
        timestamp,
        type
    });
    saveStateToStorage();
}

function getDecayRatio(task, now = getCurrentTime()) {
    const durationMs = Math.max(1000, task.decaySeconds * 1000);
    return Math.max(0, Math.min(1, (now - task.createdAt) / durationMs));
}

function getTimeLeftMs(task, now = getCurrentTime()) {
    return Math.max(0, task.decaySeconds * 1000 - (now - task.createdAt));
}

function getRiskLevel(task) {
    const ratio = getDecayRatio(task);
    if (ratio > 0.7) return 'high';
    if (ratio > 0.3) return 'medium';
    return 'low';
}

function addTask(text, decaySeconds, options = {}) {
    const cleanText = String(text || '').trim();
    if (!cleanText) return null;

    const task = normalizeTask({
        id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        text: cleanText,
        notes: options.notes || '',
        createdAt: getCurrentTime(),
        decaySeconds: Number.parseInt(decaySeconds, 10),
        renewCount: 0,
        status: 'active',
        priority: options.priority,
        category: options.category,
        subtasks: []
    });

    state.tasks.push(task);
    state.stats.totalCreated += 1;
    saveStateToStorage();
    renderAll();
    showToast('任务已进入倒计时');

    if (!isReducedMotion()) {
        const row = document.getElementById(`task-${task.id}`);
        row?.classList.add('animate-add');
    }
    return task;
}

function completeTask(taskId) {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task || task.status !== 'active') return;

    const ratio = getDecayRatio(task);
    const source = state.selectedTaskId === taskId
        ? document.getElementById('detail-primary-card')
        : document.getElementById(`task-${taskId}`);
    spawnParticles(source, 'ember');
    source?.classList.add('animate-complete');

    task.status = 'completed';
    task.completedAt = getCurrentTime();
    task.completionDecay = ratio;
    state.stats.totalCompleted += 1;
    state.stats.totalCompletionDecay += ratio;
    state.stats.completionSamples += 1;
    saveStateToStorage();

    const finish = () => {
        if (state.selectedTaskId === taskId) {
            state.selectedTaskId = null;
            setActiveView('today', false);
        }
        saveStateToStorage();
        renderAll();
    };

    if (source && !isReducedMotion()) window.setTimeout(finish, 440);
    else finish();
    showToast('任务已完成');
}

function renewTask(taskId) {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task || task.status !== 'active') return;
    task.createdAt = getCurrentTime();
    task.renewCount += 1;
    logProcrastinationEvent(taskId, 'renew');
    saveStateToStorage();
    renderAll();

    const source = state.selectedTaskId === taskId
        ? document.getElementById('detail-primary-card')
        : document.getElementById(`task-${taskId}`);
    source?.classList.add('animate-renew');
    showToast('已续命，并记录一次拖延');
}

function deleteTask(taskId) {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return;
    state.tasks = state.tasks.filter(item => item.id !== taskId);
    if (state.selectedTaskId === taskId) {
        state.selectedTaskId = null;
        setActiveView('today', false);
    }
    saveStateToStorage();
    renderAll();
    showToast('任务已归档');
}

function updateTaskDuration(taskId) {
    const task = state.tasks.find(item => item.id === taskId);
    if (!task) return;

    const valueInput = document.getElementById('detail-duration-value')
        || document.getElementById(`duration-value-${taskId}`);
    const unitSelect = document.getElementById('detail-duration-unit')
        || document.getElementById(`duration-unit-${taskId}`);
    const nextSeconds = durationToSeconds(valueInput?.value, unitSelect?.value);

    task.decaySeconds = nextSeconds;
    saveStateToStorage();
    processDecayCycle();
    renderAll();
    showToast('衰退时长已更新');
}

function addSubtask(taskId, text) {
    const task = state.tasks.find(item => item.id === taskId);
    const cleanText = String(text || '').trim();
    if (!task || !cleanText) return;
    task.subtasks.push({
        id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        text: cleanText,
        completed: false
    });
    saveStateToStorage();
    renderTaskDetail();
}

function toggleSubtask(taskId, subtaskId) {
    const task = state.tasks.find(item => item.id === taskId);
    const subtask = task?.subtasks.find(item => item.id === subtaskId);
    if (!subtask) return;
    subtask.completed = !subtask.completed;
    saveStateToStorage();
    renderTaskDetail();
}

function processDecayCycle() {
    const now = getCurrentTime();
    const expiredTasks = state.tasks.filter(task => task.status === 'active' && getDecayRatio(task, now) >= 1);

    if (!expiredTasks.length) {
        updateVisualMeters();
        return;
    }

    expiredTasks.forEach(task => {
        const source = state.selectedTaskId === task.id
            ? document.getElementById('detail-primary-card')
            : document.getElementById(`task-${task.id}`);
        spawnParticles(source, 'ash');
        source?.classList.add('animate-expire');
        task.status = 'decayed';
        logProcrastinationEvent(task.id, 'expire');

        const finish = () => {
            state.tasks = state.tasks.filter(item => item.id !== task.id);
            if (state.selectedTaskId === task.id) {
                state.selectedTaskId = null;
                setActiveView('today', false);
            }
            saveStateToStorage();
            renderAll();
        };

        if (source && !isReducedMotion()) window.setTimeout(finish, 560);
        else finish();
    });
    showToast('任务已腐烂并归档', true);
}

function getActiveTasks() {
    return state.tasks
        .filter(task => task.status === 'active')
        .sort((a, b) => getDecayRatio(b) - getDecayRatio(a));
}

function getCompletedTasks() {
    return state.tasks
        .filter(task => task.status === 'completed')
        .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}

function getTodayTasks() {
    if (state.taskFilter === 'completed') return getCompletedTasks();
    if (state.taskFilter === 'risk') {
        return getActiveTasks().filter(task => getDecayRatio(task) > 0.7);
    }
    return getActiveTasks();
}

function setTaskFilter(filter) {
    state.taskFilter = ['active', 'completed', 'risk'].includes(filter) ? filter : 'active';
    renderTaskList();
    renderStats();
}

function getStatsSnapshot() {
    const activeTasks = getActiveTasks();
    const processed = state.stats.totalCompleted + state.stats.totalDecayed;
    const completionRate = processed > 0 ? Math.round(state.stats.totalCompleted / processed * 100) : 0;
    return {
        activeTasks,
        active: activeTasks.length,
        atRisk: activeTasks.filter(task => getDecayRatio(task) > 0.7).length,
        completionRate,
        processed
    };
}

function renderAll() {
    renderToday();
    renderTaskDetail();
    renderTimeline();
    renderReport();
    renderSettings();
}

function renderToday() {
    const now = new Date(getCurrentTime());
    const heading = document.getElementById('today-heading');
    const dateLine = document.getElementById('today-date');
    if (heading) heading.textContent = `${now.getMonth() + 1}月${now.getDate()}日`;
    if (dateLine) dateLine.textContent = new Intl.DateTimeFormat('zh-CN', { weekday: 'long', year: 'numeric' }).format(now);
    renderTaskList();
    renderStats();
}

function renderTaskList() {
    const list = document.getElementById('task-list');
    const empty = document.getElementById('task-empty-state');
    if (!list || !empty) return;
    const tasks = getTodayTasks();
    const completedTasks = getCompletedTasks();
    const legacyCompletedCount = Math.max(0, state.stats.totalCompleted - completedTasks.length);
    const viewCopy = {
        active: {
            kicker: 'QUEUE',
            heading: '活跃任务',
            emptyTitle: '队列为空',
            emptyCopy: '创建一项任务，倒计时会立即开始。',
            emptyIndex: '00',
            showAction: true
        },
        completed: {
            kicker: 'COMPLETED',
            heading: '完成记录',
            emptyTitle: legacyCompletedCount ? '旧记录没有任务详情' : '还没有完成记录',
            emptyCopy: legacyCompletedCount
                ? `旧版本只留下了 ${legacyCompletedCount} 项完成计数，今后完成的任务会保留在这里。`
                : '完成一项任务后，它会保留在这里。',
            emptyIndex: String(state.stats.totalCompleted).padStart(2, '0'),
            showAction: false
        },
        risk: {
            kicker: 'AT RISK',
            heading: '风险任务',
            emptyTitle: '没有高风险任务',
            emptyCopy: '当前没有衰退超过 70% 的活跃任务。',
            emptyIndex: '00',
            showAction: false
        }
    }[state.taskFilter];

    setText('task-list-kicker', viewCopy.kicker);
    setText('today-tasks-heading', viewCopy.heading);
    setText('task-empty-index', viewCopy.emptyIndex);
    setText('task-empty-title', viewCopy.emptyTitle);
    setText('task-empty-copy', viewCopy.emptyCopy);
    const emptyAction = document.getElementById('task-empty-action');
    if (emptyAction) emptyAction.hidden = !viewCopy.showAction;
    empty.hidden = tasks.length > 0;
    list.hidden = tasks.length === 0;

    list.innerHTML = tasks.map(task => {
        if (task.status === 'completed') {
            return `
                <article id="task-${task.id}" class="task-row completed-row">
                    <span class="task-risk-rail" aria-hidden="true"></span>
                    <span class="completed-mark" aria-hidden="true">
                        <svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"></path></svg>
                    </span>
                    <div class="task-open">
                        <span class="task-title">${escapeHtml(task.text)}</span>
                        <span class="task-meta-line">${escapeHtml(CATEGORY_LABELS[task.category])} · 完成时衰退 ${Math.round((task.completionDecay || 0) * 100)}%</span>
                    </div>
                    <div class="task-due">
                        <span>完成于</span>
                        <strong>${formatCompletedTime(task.completedAt)}</strong>
                    </div>
                    <span class="task-decay-track" aria-hidden="true"><i></i></span>
                </article>
            `;
        }

        const ratio = getDecayRatio(task);
        const risk = getRiskLevel(task);
        const dueAt = task.createdAt + task.decaySeconds * 1000;
        return `
            <article id="task-${task.id}" class="task-row risk-${risk}" style="--decay:${Math.round(ratio * 100)}%">
                <span class="task-risk-rail" aria-hidden="true"></span>
                <button class="task-check" type="button" data-task-action="complete" data-task-id="${task.id}" aria-label="完成 ${escapeHtml(task.text)}">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>
                </button>
                <button class="task-open" type="button" data-task-action="open" data-task-id="${task.id}">
                    <span class="task-title">${escapeHtml(task.text)}</span>
                    <span class="task-meta-line">${escapeHtml(CATEGORY_LABELS[task.category])} · ${escapeHtml(PRIORITY_LABELS[task.priority])}</span>
                </button>
                <div class="task-due">
                    <span>${formatDueTime(dueAt)}</span>
                    <strong data-task-timer="${task.id}">${formatShortTimeLeft(getTimeLeftMs(task))}</strong>
                </div>
                <span class="task-decay-track" aria-hidden="true"><i></i></span>
            </article>
        `;
    }).join('');
}

function renderStats() {
    const snapshot = getStatsSnapshot();
    setText('today-active-count', snapshot.active);
    setText('today-completed-count', state.stats.totalCompleted);
    setText('today-risk-count', snapshot.atRisk);
    setText('today-completion-rate', `${snapshot.completionRate}%`);
    document.querySelectorAll('[data-task-filter]').forEach(button => {
        const isActive = button.dataset.taskFilter === state.taskFilter;
        button.classList.toggle('is-active', isActive);
        button.setAttribute('aria-pressed', String(isActive));
    });
    const ring = document.getElementById('completion-ring');
    if (ring) {
        ring.style.setProperty('--completion', `${snapshot.completionRate * 3.6}deg`);
        ring.setAttribute('aria-label', `完成率 ${snapshot.completionRate}%`);
    }
}

function renderTaskDetail() {
    const view = document.getElementById('task-detail-view');
    if (!view) return;
    const task = state.tasks.find(item => item.id === state.selectedTaskId && item.status === 'active');
    if (!task) {
        view.hidden = true;
        view.innerHTML = '';
        return;
    }

    const ratio = getDecayRatio(task);
    const risk = getRiskLevel(task);
    const editor = durationToEditorValue(task.decaySeconds);
    const dueAt = task.createdAt + task.decaySeconds * 1000;
    const completedSubtasks = task.subtasks.filter(item => item.completed).length;
    const segments = Array.from({ length: 10 }, (_, index) => `<i class="${index < Math.ceil(ratio * 10) ? 'active' : ''}"></i>`).join('');

    view.innerHTML = `
        <header class="screen-header detail-header">
            <button id="detail-back" class="icon-button" type="button" aria-label="返回">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 18-6-6 6-6"></path></svg>
            </button>
            <span class="header-meta">TASK DETAIL</span>
            <button class="icon-button" type="button" data-detail-action="archive" aria-label="归档任务">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16v13H4zM3 3h18v4H3zM9 11h6"></path></svg>
            </button>
        </header>

        <article id="detail-primary-card" class="detail-primary risk-${risk}">
            <span class="risk-badge risk-${risk}">${risk === 'high' ? 'HIGH RISK' : risk === 'medium' ? 'WATCH' : 'STABLE'}</span>
            <h1>${escapeHtml(task.text)}</h1>
            <p class="detail-meta">${escapeHtml(CATEGORY_LABELS[task.category])} · ${escapeHtml(PRIORITY_LABELS[task.priority])}</p>
            ${task.notes ? `<p class="detail-notes">${escapeHtml(task.notes)}</p>` : ''}
        </article>

        <section class="detail-metrics" aria-label="任务时间">
            <div><span>到期</span><strong>${formatDateTime(dueAt)}</strong></div>
            <div><span>剩余时间</span><strong id="detail-countdown" class="risk-text-${risk}">${formatCountdown(getTimeLeftMs(task))}</strong></div>
        </section>

        <section class="detail-section">
            <div class="section-heading-row compact">
                <div><p class="section-kicker">DECAY LEVEL</p><h2>腐烂进度</h2></div>
                <strong id="detail-decay-percent" class="risk-text-${risk}">${Math.round(ratio * 100)}%</strong>
            </div>
            <div id="detail-decay-progress" class="decay-meter risk-${risk}" style="--decay:${Math.round(ratio * 100)}%">${segments}</div>
        </section>

        <section class="detail-section duration-editor" aria-labelledby="duration-heading">
            <div class="section-heading-row compact">
                <div><p class="section-kicker">DURATION</p><h2 id="duration-heading">调整衰退时长</h2></div>
                <span class="header-meta">不会计为续命</span>
            </div>
            <div class="duration-editor-controls">
                <input id="detail-duration-value" type="number" min="1" max="31536000" step="1" value="${editor.value}" inputmode="numeric" aria-label="衰退时长数值">
                <select id="detail-duration-unit" data-duration-unit aria-label="衰退时长单位">
                    <option value="seconds" ${editor.unit === 'seconds' ? 'selected' : ''}>秒</option>
                    <option value="minutes" ${editor.unit === 'minutes' ? 'selected' : ''}>分钟</option>
                    <option value="hours" ${editor.unit === 'hours' ? 'selected' : ''}>小时</option>
                    <option value="days" ${editor.unit === 'days' ? 'selected' : ''}>天</option>
                </select>
                <button id="detail-duration-save" class="outline-button" type="button">保存</button>
            </div>
        </section>

        <section class="detail-section">
            <div class="section-heading-row compact">
                <div><p class="section-kicker">SUBTASKS</p><h2>子任务</h2></div>
                <span class="header-meta">${completedSubtasks}/${task.subtasks.length}</span>
            </div>
            <div class="subtask-list">
                ${task.subtasks.length ? task.subtasks.map(item => `
                    <button type="button" class="subtask-row ${item.completed ? 'completed' : ''}" data-subtask-id="${item.id}">
                        <span class="subtask-check">${item.completed ? '✓' : ''}</span>
                        <span>${escapeHtml(item.text)}</span>
                    </button>
                `).join('') : '<p class="empty-inline">还没有子任务。</p>'}
            </div>
            <form id="subtask-form" class="subtask-form">
                <input id="subtask-input" type="text" maxlength="80" placeholder="添加子任务" aria-label="子任务">
                <button type="submit" class="icon-button" aria-label="添加子任务">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"></path></svg>
                </button>
            </form>
        </section>

        <section class="detail-actions" aria-label="任务操作">
            <button type="button" data-detail-action="renew" class="outline-button">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5"></path></svg>
                续命 ${task.renewCount ? `· ${task.renewCount}` : ''}
            </button>
            <button type="button" data-detail-action="complete" class="primary-button">完成任务</button>
        </section>
    `;
}

function renderTimeline() {
    const heatmap = document.getElementById('timeline-heatmap');
    const weekStrip = document.getElementById('week-strip');
    const upcoming = document.getElementById('upcoming-list');
    if (!heatmap || !weekStrip || !upcoming) return;

    const now = new Date(getCurrentTime());
    setText('timeline-month', `${now.getFullYear()} / ${String(now.getMonth() + 1).padStart(2, '0')}`);
    const sunday = new Date(now);
    sunday.setHours(0, 0, 0, 0);
    sunday.setDate(now.getDate() - now.getDay());
    const days = Array.from({ length: 7 }, (_, index) => {
        const date = new Date(sunday);
        date.setDate(sunday.getDate() + index);
        return date;
    });

    weekStrip.innerHTML = days.map((date, index) => `
        <div class="${getLocalDateString(date.getTime()) === getLocalDateString(getCurrentTime()) ? 'current' : ''}">
            <span>${['日', '一', '二', '三', '四', '五', '六'][index]}</span>
            <strong>${date.getDate()}</strong>
        </div>
    `).join('');

    const cells = [];
    const bands = [6, 9, 12, 15, 18, 21];
    bands.forEach(hour => {
        days.forEach(day => {
            const dateKey = getLocalDateString(day.getTime());
            const eventCount = state.procrastinationEvents.filter(event => {
                const eventHour = event.timestamp ? new Date(event.timestamp).getHours() : 12;
                return event.date === dateKey && Math.abs(eventHour - hour) < 2;
            }).length;
            const dueCount = getActiveTasks().filter(task => {
                const due = new Date(task.createdAt + task.decaySeconds * 1000);
                return getLocalDateString(due.getTime()) === dateKey && Math.abs(due.getHours() - hour) < 2;
            }).length;
            const intensity = eventCount + dueCount;
            const level = intensity >= 4 ? 4 : intensity >= 3 ? 3 : intensity >= 2 ? 2 : intensity >= 1 ? 1 : 0;
            cells.push(`<button class="heat-cell heat-level-${level}" type="button" aria-label="${dateKey} ${hour}:00，${intensity} 条衰退记录" title="${dateKey} ${hour}:00 · ${intensity}"></button>`);
        });
    });
    heatmap.innerHTML = cells.join('');

    const upcomingTasks = getActiveTasks()
        .sort((a, b) => getTimeLeftMs(a) - getTimeLeftMs(b))
        .slice(0, 5);
    upcoming.innerHTML = upcomingTasks.length ? upcomingTasks.map(task => `
        <button class="upcoming-row risk-${getRiskLevel(task)}" type="button" data-upcoming-task="${task.id}">
            <span class="task-risk-rail" aria-hidden="true"></span>
            <span><strong>${escapeHtml(task.text)}</strong><small>${escapeHtml(PRIORITY_LABELS[task.priority])} · ${Math.round(getDecayRatio(task) * 100)}% 衰退</small></span>
            <time>${formatShortTimeLeft(getTimeLeftMs(task))}</time>
        </button>
    `).join('') : '<p class="empty-inline">没有即将到期的任务。</p>';
}

function renderHeatmap() {
    renderTimeline();
}

function renderReport() {
    const snapshot = getStatsSnapshot();
    const now = new Date(getCurrentTime());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    setText('report-range', `${weekStart.getMonth() + 1}.${weekStart.getDate()} - ${now.getMonth() + 1}.${now.getDate()}`);
    setText('report-completion-rate', `${snapshot.completionRate}%`);
    setText('report-completed', state.stats.totalCompleted);
    setText('report-active', snapshot.active);
    setText('report-decayed', state.stats.totalDecayed);
    setText('report-decay-rate', `${snapshot.processed ? Math.round(state.stats.totalDecayed / snapshot.processed * 100) : 0}%`);
    setText('report-average-decay', `${state.stats.completionSamples ? Math.round(state.stats.totalCompletionDecay / state.stats.completionSamples * 100) : 0}%`);
    setText('report-renews', state.stats.totalRenewed);
    setText('report-rate-caption', snapshot.processed ? `已处理 ${snapshot.processed} 项任务` : '等待首个完成记录');

    const trend = document.getElementById('report-trend');
    if (trend) {
        const hasNoTrendData = snapshot.processed === 0 && state.procrastinationEvents.length === 0;
        trend.classList.toggle('empty', hasNoTrendData);
        const base = Math.max(14, snapshot.completionRate);
        trend.innerHTML = Array.from({ length: 12 }, (_, index) => {
            const eventDrag = state.procrastinationEvents.slice(-12)[index]?.type === 'expire' ? 18 : 0;
            const height = hasNoTrendData ? 8 : Math.max(10, Math.min(92, base * 0.55 + index * 2.4 - eventDrag));
            return `<i style="--bar:${height}%"></i>`;
        }).join('');
    }

    const distribution = { low: 0, medium: 0, high: 0 };
    snapshot.activeTasks.forEach(task => {
        const ratio = getDecayRatio(task);
        if (ratio <= 0.3) distribution.low += 1;
        else if (ratio <= 0.7) distribution.medium += 1;
        else distribution.high += 1;
    });
    const total = snapshot.active || 1;
    const lowEnd = distribution.low / total * 360;
    const mediumEnd = lowEnd + distribution.medium / total * 360;
    const donut = document.getElementById('decay-donut');
    if (donut) {
        donut.classList.toggle('empty', snapshot.active === 0);
        donut.style.setProperty('--low-end', `${lowEnd}deg`);
        donut.style.setProperty('--medium-end', `${mediumEnd}deg`);
    }
    setText('donut-total', snapshot.active);
    setText('distribution-low', distribution.low);
    setText('distribution-medium', distribution.medium);
    setText('distribution-high', distribution.high);
}

function renderSettings() {
    setText('settings-task-count', getActiveTasks().length);
    const minutes = Math.round(state.timeOffsetMs / 60000);
    setText('time-offset-label', minutes ? `+${minutes}m` : '+0m');
    const select = document.getElementById('settings-default-duration');
    const saved = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.DEFAULT_DURATION) || String(CONFIG.DEFAULT_DURATION);
    if (select && [...select.options].some(option => option.value === saved)) select.value = saved;
}

function updateVisualMeters() {
    getActiveTasks().forEach(task => {
        const timer = document.querySelector(`[data-task-timer="${task.id}"]`);
        if (timer) timer.textContent = formatShortTimeLeft(getTimeLeftMs(task));
        const row = document.getElementById(`task-${task.id}`);
        if (row) {
            row.classList.remove('risk-low', 'risk-medium', 'risk-high');
            row.classList.add(`risk-${getRiskLevel(task)}`);
            row.style.setProperty('--decay', `${Math.round(getDecayRatio(task) * 100)}%`);
        }
    });

    const selected = state.tasks.find(task => task.id === state.selectedTaskId);
    if (selected) {
        const ratio = getDecayRatio(selected);
        setText('detail-countdown', formatCountdown(getTimeLeftMs(selected)));
        setText('detail-decay-percent', `${Math.round(ratio * 100)}%`);
        document.getElementById('detail-decay-progress')?.style.setProperty('--decay', `${Math.round(ratio * 100)}%`);
    }
}

function setActiveView(viewName, shouldRender = true) {
    const nextView = CONFIG.VALID_VIEWS.includes(viewName) ? viewName : 'today';
    state.activeView = nextView;
    state.selectedTaskId = null;
    document.getElementById('task-detail-view').hidden = true;
    document.querySelectorAll('[data-view]').forEach(view => {
        view.hidden = view.dataset.view !== nextView;
    });
    document.querySelectorAll('[data-nav-view]').forEach(button => {
        if (button.dataset.navView === nextView) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
    if (shouldRender) renderAll();
    window.scrollTo({ top: 0, behavior: isReducedMotion() ? 'auto' : 'smooth' });
}

function openTaskDetail(taskId) {
    const task = state.tasks.find(item => item.id === taskId && item.status === 'active');
    if (!task) return;
    state.selectedTaskId = taskId;
    document.querySelectorAll('[data-view]').forEach(view => { view.hidden = true; });
    const detail = document.getElementById('task-detail-view');
    detail.hidden = false;
    renderTaskDetail();
    window.scrollTo({ top: 0, behavior: isReducedMotion() ? 'auto' : 'smooth' });
}

function closeTaskDetail() {
    const previousTaskId = state.selectedTaskId;
    state.selectedTaskId = null;
    setActiveView(state.activeView || 'today');
    window.setTimeout(() => document.querySelector(`[data-task-id="${previousTaskId}"]`)?.focus(), 0);
}

function openTaskSheet(trigger) {
    const sheet = document.getElementById('task-sheet');
    if (!sheet) return;
    sheetReturnFocus = trigger || document.activeElement;
    sheet.hidden = false;
    document.body.classList.add('sheet-open');
    const defaultDuration = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.DEFAULT_DURATION) || String(CONFIG.DEFAULT_DURATION);
    const decaySelect = document.getElementById('decay-select');
    if (decaySelect && [...decaySelect.options].some(option => option.value === defaultDuration)) decaySelect.value = defaultDuration;
    syncCustomDurationRow();
    window.setTimeout(() => document.getElementById('task-input')?.focus(), 0);
}

function closeTaskSheet() {
    const sheet = document.getElementById('task-sheet');
    if (!sheet) return;
    sheet.hidden = true;
    document.body.classList.remove('sheet-open');
    document.getElementById('task-form-error').hidden = true;
    sheetReturnFocus?.focus?.();
}

function syncCustomDurationRow() {
    const select = document.getElementById('decay-select');
    const row = document.getElementById('custom-duration-row');
    if (select && row) row.hidden = select.value !== 'custom';
}

function fastForwardTime(minutes) {
    state.timeOffsetMs += minutes * 60000;
    saveStateToStorage();
    processDecayCycle();
    renderAll();
    showToast(`时间已快进 ${formatDurationChinese(minutes * 60000)}`);
}

function warpAllActiveToDecay(percent) {
    const tasks = getActiveTasks();
    if (!tasks.length) {
        showToast('没有活跃任务', true);
        return;
    }
    const now = getCurrentTime();
    tasks.forEach(task => {
        task.createdAt = now - task.decaySeconds * 1000 * percent;
    });
    saveStateToStorage();
    renderAll();
    showToast(`活跃任务已设为 ${Math.round(percent * 100)}% 衰退`);
}

function setupUIEventListeners() {
    document.querySelectorAll('[data-task-filter]').forEach(button => {
        button.addEventListener('click', () => setTaskFilter(button.dataset.taskFilter));
    });
    document.querySelectorAll('[data-nav-view]').forEach(button => {
        button.addEventListener('click', () => setActiveView(button.dataset.navView));
    });
    document.querySelectorAll('[data-open-view]').forEach(button => {
        button.addEventListener('click', () => setActiveView(button.dataset.openView));
    });
    document.querySelectorAll('[data-open-task-sheet]').forEach(button => {
        button.addEventListener('click', () => openTaskSheet(button));
    });

    document.getElementById('btn-close-task-sheet')?.addEventListener('click', closeTaskSheet);
    document.getElementById('task-sheet')?.addEventListener('click', event => {
        if (event.target.id === 'task-sheet') closeTaskSheet();
    });
    document.getElementById('decay-select')?.addEventListener('change', syncCustomDurationRow);

    document.getElementById('task-form')?.addEventListener('submit', event => {
        event.preventDefault();
        const title = document.getElementById('task-input').value.trim();
        const error = document.getElementById('task-form-error');
        if (!title) {
            error.textContent = '请输入任务名称';
            error.hidden = false;
            return;
        }
        const duration = getSelectedDecaySeconds();
        addTask(title, duration, {
            notes: document.getElementById('task-notes').value,
            priority: document.getElementById('task-priority').value,
            category: document.getElementById('task-category').value
        });
        event.currentTarget.reset();
        document.getElementById('decay-select').value = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.DEFAULT_DURATION) || String(CONFIG.DEFAULT_DURATION);
        syncCustomDurationRow();
        closeTaskSheet();
    });

    document.getElementById('task-list')?.addEventListener('click', event => {
        const button = event.target.closest('[data-task-action]');
        if (!button) return;
        if (button.dataset.taskAction === 'complete') completeTask(button.dataset.taskId);
        if (button.dataset.taskAction === 'open') openTaskDetail(button.dataset.taskId);
    });

    document.getElementById('upcoming-list')?.addEventListener('click', event => {
        const row = event.target.closest('[data-upcoming-task]');
        if (row) openTaskDetail(row.dataset.upcomingTask);
    });

    document.getElementById('task-detail-view')?.addEventListener('click', event => {
        if (event.target.closest('#detail-back')) {
            closeTaskDetail();
            return;
        }
        const action = event.target.closest('[data-detail-action]')?.dataset.detailAction;
        if (action === 'complete') completeTask(state.selectedTaskId);
        if (action === 'renew') renewTask(state.selectedTaskId);
        if (action === 'archive') deleteTask(state.selectedTaskId);
        if (event.target.closest('#detail-duration-save')) updateTaskDuration(state.selectedTaskId);
        const subtask = event.target.closest('[data-subtask-id]');
        if (subtask) toggleSubtask(state.selectedTaskId, subtask.dataset.subtaskId);
    });

    document.getElementById('task-detail-view')?.addEventListener('submit', event => {
        if (event.target.id !== 'subtask-form') return;
        event.preventDefault();
        const input = event.target.querySelector('#subtask-input');
        addSubtask(state.selectedTaskId, input.value);
    });

    document.getElementById('btn-theme-toggle')?.addEventListener('click', () => {
        applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });
    document.getElementById('settings-default-duration')?.addEventListener('change', event => {
        localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.DEFAULT_DURATION, event.target.value);
        showToast('默认时长已保存');
    });

    document.getElementById('btn-ff-1m')?.addEventListener('click', () => fastForwardTime(1));
    document.getElementById('btn-ff-5m')?.addEventListener('click', () => fastForwardTime(5));
    document.getElementById('btn-ff-1h')?.addEventListener('click', () => fastForwardTime(60));
    document.getElementById('btn-ff-6h')?.addEventListener('click', () => fastForwardTime(360));
    document.getElementById('btn-ff-24h')?.addEventListener('click', () => fastForwardTime(1440));
    document.getElementById('btn-warp-85')?.addEventListener('click', () => warpAllActiveToDecay(0.85));
    document.getElementById('btn-mock-events')?.addEventListener('click', () => {
        const now = getCurrentTime();
        for (let index = 0; index < 28; index += 1) {
            const timestamp = now - Math.floor(Math.random() * 21 * 86400000) - Math.floor(Math.random() * 18 * 3600000);
            state.procrastinationEvents.push({
                id: `mock_${Date.now()}_${index}`,
                taskId: 'mock_task',
                date: getLocalDateString(timestamp),
                timestamp,
                type: Math.random() > 0.25 ? 'renew' : 'expire'
            });
        }
        saveStateToStorage();
        renderAll();
        showToast('已注入测试负担记录');
    });
    document.getElementById('btn-reset-all')?.addEventListener('click', () => {
        if (window.confirm('清空所有任务、事件与统计数据？')) resetStateData();
    });

    document.addEventListener('keydown', event => {
        if (event.key !== 'Escape') return;
        if (!document.getElementById('task-sheet').hidden) closeTaskSheet();
        else if (state.selectedTaskId) closeTaskDetail();
    });
}

function formatCountdown(milliseconds) {
    if (milliseconds <= 0) return '00:00:00';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
    const minutes = String(Math.floor(totalSeconds % 3600 / 60)).padStart(2, '0');
    const seconds = String(totalSeconds % 60).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
}

function formatShortTimeLeft(milliseconds) {
    const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
    if (totalMinutes < 60) return `剩 ${totalMinutes} 分钟`;
    const hours = Math.ceil(totalMinutes / 60);
    if (hours < 24) return `剩 ${hours} 小时`;
    return `剩 ${Math.ceil(hours / 24)} 天`;
}

function formatDueTime(timestamp) {
    const due = new Date(timestamp);
    const today = getLocalDateString(getCurrentTime());
    const prefix = getLocalDateString(timestamp) === today ? '今天' : `${due.getMonth() + 1}/${due.getDate()}`;
    return `${prefix} ${String(due.getHours()).padStart(2, '0')}:${String(due.getMinutes()).padStart(2, '0')}`;
}

function formatCompletedTime(timestamp) {
    const date = new Date(timestamp || getCurrentTime());
    const today = getLocalDateString(getCurrentTime());
    const prefix = getLocalDateString(date.getTime()) === today ? '今天' : `${date.getMonth() + 1}/${date.getDate()}`;
    return `${prefix} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDurationChinese(milliseconds) {
    const totalMinutes = Math.max(1, Math.floor(milliseconds / 60000));
    if (totalMinutes >= 60) return `${Math.floor(totalMinutes / 60)} 小时${totalMinutes % 60 ? ` ${totalMinutes % 60} 分钟` : ''}`;
    return `${totalMinutes} 分钟`;
}

function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = String(value);
}

function escapeHtml(value) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(value).replace(/[&<>"']/g, character => map[character]);
}

function showToast(message, urgent = false) {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.className = `toast${urgent ? ' urgent' : ''}`;
    if (toast.timeoutId) window.clearTimeout(toast.timeoutId);
    toast.timeoutId = window.setTimeout(() => toast.classList.add('hidden'), 2600);
}

document.addEventListener('DOMContentLoaded', () => {
    loadStateFromStorage();
    applyTheme(getInitialTheme());
    setupUIEventListeners();
    setActiveView('today', false);
    renderAll();
    processDecayCycle();
    window.setInterval(processDecayCycle, 1000);
});

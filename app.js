/**
 * Application Logic for Gamified Habit Tracker
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- Helpers ---
    function getDateString(date) {
        // Adjust for timezone to get local YYYY-MM-DD
        const offset = date.getTimezoneOffset() * 60000;
        const localISOTime = (new Date(date - offset)).toISOString().slice(0, -1);
        return localISOTime.split('T')[0];
    }
    function getTodayString() {
        return getDateString(new Date());
    }

    // --- DOM Elements ---
    const landingView = document.getElementById('landing-view');
    const dashboardView = document.getElementById('dashboard-view');

    // Auth Buttons
    const btnGoogle = document.getElementById('btn-google');
    const btnApple = document.getElementById('btn-apple');

    // Header & Stats Elements
    const userLevelDisplay = document.getElementById('user-level');
    const xpText = document.getElementById('xp-text');
    const xpFill = document.getElementById('xp-fill');
    const completionRate = document.getElementById('completion-rate');
    const lifetimeCompletionsDisplay = document.getElementById('lifetime-completions');

    // Phase 5 Elements
    const userClassTitle = document.getElementById('user-class-title');
    const balanceBytecoins = document.getElementById('balance-bytecoins');
    const statStr = document.getElementById('stat-str');
    const statInt = document.getElementById('stat-int');
    const statFoc = document.getElementById('stat-foc');

    // Forms & Containers
    const newHabitForm = document.getElementById('new-habit-form');
    const habitNameInput = document.getElementById('habit-name');
    const habitCategoryInput = document.getElementById('habit-category');
    const habitsContainer = document.getElementById('habits-container');

    // Overlay
    const levelUpOverlay = document.getElementById('level-up-overlay');
    const newLevelDisplay = document.getElementById('new-level-display');
    const closeOverlayBtn = document.getElementById('close-overlay');

    // --- State ---
    let state = {
        userId: null,
        level: 1,
        xp: 0,
        xpNeeded: 100,
        lifetimeCompletions: 0,
        habits: [], // { id, name, category, streak, completionsLog: string[] }
        matrixData: [],
        currentMonthDate: new Date(),
        unlockedAchievements: {},
        bytecoins: 0,
        streakFreezes: 0,
        neonThemeUnlocked: false
    };

    // --- Audio Engine ---
    const AudioEngine = {
        ctx: null,
        init() {
            if (!this.ctx) {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume();
            }
        },
        playClickSound() {
            this.init();
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.1);
            osc.connect(gain);
            gain.connect(this.ctx.destination);
            osc.start();
            osc.stop(this.ctx.currentTime + 0.1);
        },
        playLevelUpFanfare() {
            this.init();
            const notes = [
                { f: 440, d: 0.1 }, { f: 554.37, d: 0.1 }, { f: 659.25, d: 0.1 }, { f: 880, d: 0.4 }
            ];
            let time = this.ctx.currentTime;
            notes.forEach(note => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.type = 'square';
                osc.frequency.value = note.f;
                gain.gain.setValueAtTime(0.1, time);
                gain.gain.exponentialRampToValueAtTime(0.01, time + note.d);
                osc.connect(gain);
                gain.connect(this.ctx.destination);
                osc.start(time);
                osc.stop(time + note.d);
                time += note.d;
            });
        }
    };

    // --- Initialization ---
    async function initApp(userId) {
        landingView.classList.remove('active');
        setTimeout(() => {
            landingView.classList.add('hidden');
            dashboardView.classList.remove('hidden');
            void dashboardView.offsetWidth;
            dashboardView.classList.add('active');
        }, 500);

        const userData = await window.BackendStubs.fetchUserData(userId);
        state.userId = userData.id;
        state.level = userData.level;
        state.xp = userData.xp;
        state.lifetimeCompletions = userData.lifetimeCompletions;
        state.bytecoins = userData.bytecoins || 0;
        state.streakFreezes = userData.streakFreezes || 0;
        state.neonThemeUnlocked = userData.neonThemeUnlocked || false;

        if (state.neonThemeUnlocked) {
            document.body.classList.add('neon-overdrive');
        }

        if (state.habits.length === 0) {
            const today = getTodayString();
            const yesterday = getDateString(new Date(Date.now() - 86400000));
            state.habits = [
                { id: 'h1', name: 'Morning Run', category: 'Fitness', streak: 3, completionsLog: [yesterday] },
                { id: 'h2', name: 'Deep Work', category: 'Cognition', streak: 12, completionsLog: [yesterday, today] },
                { id: 'h3', name: 'Read 20 pages', category: 'Code', streak: 0, completionsLog: [] }
            ];
            state.lifetimeCompletions = 15;
        }

        generateMatrixData();
        updateUI();
        renderHabits();
        renderWeeklyMatrix();
        renderMonthlyGrid();
        renderConsistencyMatrix();
        checkProactiveAlerts();
    }

    btnGoogle.addEventListener('click', () => initApp('user_google_123'));
    btnApple.addEventListener('click', () => initApp('user_apple_456'));

    // --- SPA Router ---
    const navButtons = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const targetId = e.target.dataset.target;
            switchDashboardTab(targetId);

            if (targetId === 'weekly-matrix') renderWeeklyMatrix();
            if (targetId === 'monthly-grid') renderMonthlyGrid();
            if (targetId === 'rewards-shop') updateRewardsShopUI();
        });
    });

    function switchDashboardTab(tabId) {
        navButtons.forEach(btn => {
            if (btn.dataset.target === tabId) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        tabContents.forEach(tab => {
            if (tab.id === tabId) {
                tab.classList.remove('hidden-tab');
                tab.classList.add('active-tab');
            } else {
                tab.classList.add('hidden-tab');
                tab.classList.remove('active-tab');
            }
        });
    }

    // --- Helpers ---
    function calculateMicroStats() {
        let str = 0; let int = 0; let foc = 0;
        state.habits.forEach(h => {
            const count = h.completionsLog.length;
            if (h.category === 'Fitness') str += count;
            else if (h.category === 'Cognition' || h.category === 'Code') int += count;
            else if (h.category === 'Mindfulness') foc += count;
        });
        return { str, int, foc };
    }

    function updateRewardsShopUI() {
        const buttons = document.querySelectorAll('.purchase-btn');
        buttons.forEach(btn => {
            const cost = parseInt(btn.dataset.cost);
            const item = btn.dataset.item;

            if (item === 'neon-theme' && state.neonThemeUnlocked) {
                btn.textContent = 'Toggle Theme';
                btn.disabled = false;
                return;
            }

            if (state.bytecoins < cost) {
                btn.disabled = true;
            } else {
                btn.disabled = false;
                btn.textContent = 'Purchase';
            }
        });
    }

    // --- UI Updaters ---
    function updateUI() {
        if (userLevelDisplay) userLevelDisplay.textContent = state.level;
        if (xpText) xpText.textContent = `${state.xp} / ${state.xpNeeded}`;
        const xpPercent = Math.min((state.xp / state.xpNeeded) * 100, 100);
        if (xpFill) xpFill.style.width = `${xpPercent}%`;

        if (lifetimeCompletionsDisplay) lifetimeCompletionsDisplay.textContent = state.lifetimeCompletions;

        let title = 'Carbon Novice';
        if (state.level >= 5) title = 'Algorithmic Overlord';
        else if (state.level >= 3) title = 'Neural Hacker';
        if (userClassTitle) userClassTitle.textContent = title;

        if (balanceBytecoins) balanceBytecoins.textContent = state.bytecoins;

        const stats = calculateMicroStats();
        if (statStr) statStr.textContent = stats.str;
        if (statInt) statInt.textContent = stats.int;
        if (statFoc) statFoc.textContent = stats.foc;

        const totalHabits = state.habits.length;
        if (totalHabits === 0) {
            completionRate.textContent = '0%';
        } else {
            const todayStr = getTodayString();
            const completed = state.habits.filter(h => h.completionsLog.includes(todayStr)).length;
            const rate = Math.round((completed / totalHabits) * 100);
            completionRate.textContent = `${rate}%`;
        }

        renderVectorChart();
        checkAchievements();
    }

    // --- Habit Rendering (Daily) ---
    function renderHabits() {
        habitsContainer.innerHTML = '';
        const todayStr = getTodayString();

        state.habits.forEach(habit => {
            const isCompletedToday = habit.completionsLog.includes(todayStr);
            const card = document.createElement('div');
            card.className = `habit-card glass-card ${isCompletedToday ? 'completed' : ''}`;
            card.dataset.id = habit.id;

            card.innerHTML = `
                <div class="habit-header">
                    <div class="habit-main-info">
                        <input type="checkbox" class="custom-checkbox" 
                            ${isCompletedToday ? 'checked' : ''} 
                            data-action="toggle" data-date="${todayStr}">
                        <span class="habit-name">${habit.name}</span>
                    </div>
                    <button class="delete-btn" data-action="delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                <div class="habit-footer">
                    <span class="habit-category-tag">${habit.category}</span>
                    <span class="streak-counter">
                        <i class="fa-solid fa-fire"></i> ${habit.streak} Days
                    </span>
                </div>
            `;
            habitsContainer.appendChild(card);
        });
    }

    // --- Actions ---
    newHabitForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = habitNameInput.value.trim();
        const category = habitCategoryInput.value;

        if (!name || !category) return;

        const newHabit = {
            id: `h_${Date.now()}`,
            name,
            category,
            streak: 0,
            completionsLog: []
        };

        state.habits.push(newHabit);
        window.BackendStubs.syncHabitsToDB(state.habits);

        habitNameInput.value = '';
        habitCategoryInput.value = '';

        renderHabits();
        renderWeeklyMatrix();
        renderMonthlyGrid();
        updateUI();
    });

    habitsContainer.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const card = target.closest('.habit-card');
        const habitId = card.dataset.id;
        const habit = state.habits.find(h => h.id === habitId);
        const action = target.dataset.action;

        if (action === 'delete') {
            state.habits = state.habits.filter(h => h.id !== habitId);
            window.BackendStubs.syncHabitsToDB(state.habits);
            renderHabits();
            renderWeeklyMatrix();
            renderMonthlyGrid();
            updateUI();
        } else if (action === 'toggle' && target.tagName === 'INPUT') {
            const dateStr = target.dataset.date || getTodayString();
            handleToggle(habit, dateStr, target.checked);
        }
    });

    function handleToggle(habit, dateStr, isChecked) {
        if (isChecked) {
            if (!habit.completionsLog.includes(dateStr)) {
                habit.completionsLog.push(dateStr);
            }
            AudioEngine.playClickSound();
            triggerConfetti();
            habit.streak += 1;
            state.lifetimeCompletions += 1;
            state.bytecoins += 5; // +5 ByteCoins per completion
            addXP(10);
            window.BackendStubs.updateStreakAndXPInDB(habit.id, habit.streak, state.xp, state.level, habit.completionsLog);
        } else {
            habit.completionsLog = habit.completionsLog.filter(d => d !== dateStr);
            habit.streak = Math.max(0, habit.streak - 1);
            state.lifetimeCompletions = Math.max(0, state.lifetimeCompletions - 1);

            if (habit.streak === 0 && window.aiCoachEngineInstance) {
                window.aiCoachEngineInstance.triggerProactiveAlert(habit.name);
            }
        }

        renderHabits();
        renderWeeklyMatrix();
        renderMonthlyGrid();
        updateUI();

        if (dateStr === getTodayString() && state.matrixData && state.matrixData.length > 0) {
            state.matrixData[27] = Math.min(4, Math.max(0, state.matrixData[27] + (isChecked ? 1 : -1)));
            renderConsistencyMatrix();
        }
    }

    // --- Gamification Logic ---
    function addXP(amount) {
        state.xp += amount;
        if (state.xp >= state.xpNeeded) {
            state.level += 1;
            state.xp = state.xp - state.xpNeeded;
            state.bytecoins += 50; // +50 ByteCoins on level up
            showLevelUpOverlay();
        }
    }

    function triggerConfetti() {
        if (typeof confetti === 'function') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#6366F1', '#F97316', '#34D399']
            });
        }
    }

    function showLevelUpOverlay() {
        AudioEngine.playLevelUpFanfare();
        newLevelDisplay.textContent = state.level;
        levelUpOverlay.classList.remove('hidden');

        setTimeout(() => {
            if (typeof confetti === 'function') {
                const duration = 3000;
                const end = Date.now() + duration;

                (function frame() {
                    confetti({ particleCount: 5, angle: 60, spread: 55, origin: { x: 0 }, colors: ['#6366F1', '#34D399'] });
                    confetti({ particleCount: 5, angle: 120, spread: 55, origin: { x: 1 }, colors: ['#F97316', '#34D399'] });
                    if (Date.now() < end) requestAnimationFrame(frame);
                }());
            }
        }, 300);
    }

    closeOverlayBtn.addEventListener('click', () => {
        levelUpOverlay.classList.add('hidden');
    });

    // --- Gamification & Visualization ---
    function generateMatrixData() {
        state.matrixData = Array.from({ length: 28 }, () => Math.floor(Math.random() * 5));
        const todayStr = getTodayString();
        state.matrixData[27] = state.habits.filter(h => h.completionsLog.includes(todayStr)).length;
    }

    function renderConsistencyMatrix() {
        const matrixGrid = document.getElementById('consistency-matrix');
        if (!matrixGrid) return;
        matrixGrid.innerHTML = '';
        state.matrixData.forEach(intensity => {
            const block = document.createElement('div');
            block.className = `matrix-block intensity-${intensity}`;
            matrixGrid.appendChild(block);
        });
    }

    function renderVectorChart() {
        const canvas = document.getElementById('vectorChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = Math.min(cx, cy) - 10;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const categories = { 'Fitness': 0, 'Cognition': 0, 'Code': 0, 'Mindfulness': 0 };
        let total = 0;
        state.habits.forEach(h => {
            if (categories[h.category] !== undefined) {
                categories[h.category] += Math.max(1, h.streak);
                total += Math.max(1, h.streak);
            }
        });

        if (total === 0) {
            categories['Fitness'] = 1;
            total = 1;
        }

        let currentAngle = -Math.PI / 2;
        const colors = {
            'Fitness': '#F97316',
            'Cognition': '#6366F1',
            'Code': '#34D399',
            'Mindfulness': '#A78BFA'
        };

        for (const [cat, val] of Object.entries(categories)) {
            const sliceAngle = (val / total) * 2 * Math.PI;
            ctx.beginPath();
            ctx.arc(cx, cy, radius, currentAngle, currentAngle + sliceAngle);
            ctx.lineWidth = 12;
            ctx.strokeStyle = colors[cat] || '#FFFFFF';
            ctx.shadowBlur = 10;
            ctx.shadowColor = colors[cat] || '#FFFFFF';
            ctx.stroke();
            currentAngle += sliceAngle;
        }

        ctx.shadowBlur = 0;
    }

    // --- Weekly & Monthly Views ---
    function renderWeeklyMatrix() {
        const container = document.getElementById('weekly-matrix-container');
        if (!container) return;
        container.innerHTML = '';

        const past7Days = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            past7Days.push(getDateString(d));
        }

        const headerRow = document.createElement('div');
        headerRow.className = 'weekly-header-row';
        const daysHtml = past7Days.map(dateStr => {
            const shortDay = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' });
            return `<div class="weekly-day-label">${shortDay}</div>`;
        }).join('');
        headerRow.innerHTML = `<div class="weekly-habit-name"></div><div class="weekly-days">${daysHtml}</div>`;
        container.appendChild(headerRow);

        state.habits.forEach(habit => {
            const row = document.createElement('div');
            row.className = 'weekly-row glass-card';

            const cellsHtml = past7Days.map(dateStr => {
                const isCompleted = habit.completionsLog.includes(dateStr);
                return `<div class="weekly-cell ${isCompleted ? 'emerald-glow' : ''}" 
                             data-action="toggle-historic" 
                             data-habit-id="${habit.id}" 
                             data-date="${dateStr}"
                             data-completed="${isCompleted}"></div>`;
            }).join('');

            row.innerHTML = `
                <div class="weekly-habit-name">${habit.name}</div>
                <div class="weekly-days">${cellsHtml}</div>
            `;
            container.appendChild(row);
        });
    }

    document.getElementById('weekly-matrix-container')?.addEventListener('click', (e) => {
        const cell = e.target.closest('.weekly-cell');
        if (!cell) return;
        const habitId = cell.dataset.habitId;
        const dateStr = cell.dataset.date;
        const isCompleted = cell.dataset.completed === 'true';
        const habit = state.habits.find(h => h.id === habitId);
        if (habit) {
            handleToggle(habit, dateStr, !isCompleted);
        }
    });

    function renderMonthlyGrid() {
        const container = document.getElementById('monthly-grid-container');
        const monthDisplay = document.getElementById('current-month-display');
        if (!container || !monthDisplay) return;

        const year = state.currentMonthDate.getFullYear();
        const month = state.currentMonthDate.getMonth();
        monthDisplay.textContent = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

        container.innerHTML = '';

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayIndex = new Date(year, month, 1).getDay();

        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        dayNames.forEach(name => {
            const header = document.createElement('div');
            header.className = 'monthly-day-header';
            header.textContent = name;
            container.appendChild(header);
        });

        for (let i = 0; i < firstDayIndex; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.className = 'monthly-cell empty';
            container.appendChild(emptyCell);
        }

        const colors = { 'Fitness': '#F97316', 'Cognition': '#6366F1', 'Code': '#34D399', 'Mindfulness': '#A78BFA' };

        for (let day = 1; day <= daysInMonth; day++) {
            const dateObj = new Date(year, month, day);
            const dateStr = getDateString(dateObj);
            const cell = document.createElement('div');
            cell.className = 'monthly-cell glass-card';

            const num = document.createElement('span');
            num.className = 'monthly-date-num';
            num.textContent = day;
            cell.appendChild(num);

            const dotsContainer = document.createElement('div');
            dotsContainer.className = 'monthly-dots-container';

            state.habits.forEach(habit => {
                if (habit.completionsLog.includes(dateStr)) {
                    const dot = document.createElement('div');
                    dot.className = 'micro-dot';
                    dot.style.backgroundColor = colors[habit.category] || '#FFFFFF';
                    dotsContainer.appendChild(dot);
                }
            });

            cell.appendChild(dotsContainer);
            container.appendChild(cell);
        }
    }

    document.getElementById('prev-month')?.addEventListener('click', () => {
        state.currentMonthDate.setMonth(state.currentMonthDate.getMonth() - 1);
        renderMonthlyGrid();
    });

    document.getElementById('next-month')?.addEventListener('click', () => {
        state.currentMonthDate.setMonth(state.currentMonthDate.getMonth() + 1);
        renderMonthlyGrid();
    });

    function checkProactiveAlerts() {
        if (!window.aiCoachEngineInstance) return;
        const todayStr = getTodayString();
        const neglected = state.habits.find(h => h.streak === 0 && !h.completionsLog.includes(todayStr));
        if (neglected) {
            setTimeout(() => {
                window.aiCoachEngineInstance.triggerProactiveAlert(neglected.name);
            }, 1000);
        }
    }

    // --- Achievements Logic ---
    function checkAchievements() {
        const now = getTodayString();
        let newUnlock = false;

        // 1. First Code Commit: lifetimeCompletions >= 1
        if (state.lifetimeCompletions >= 1 && !state.unlockedAchievements['badge-first-commit']) {
            state.unlockedAchievements['badge-first-commit'] = now;
            newUnlock = true;
        }

        // 2. Pyromaniac: any habit streak >= 7
        if (state.habits.some(h => h.streak >= 7) && !state.unlockedAchievements['badge-pyromaniac']) {
            state.unlockedAchievements['badge-pyromaniac'] = now;
            newUnlock = true;
        }

        // 3. Ascended Status: level >= 3
        if (state.level >= 3 && !state.unlockedAchievements['badge-ascended']) {
            state.unlockedAchievements['badge-ascended'] = now;
            newUnlock = true;
        }

        // 4. Flawless Execution: 100% completion rate today with > 0 habits
        const todayStr = getTodayString();
        const total = state.habits.length;
        if (total > 0) {
            const completed = state.habits.filter(h => h.completionsLog.includes(todayStr)).length;
            if (completed === total && !state.unlockedAchievements['badge-flawless']) {
                state.unlockedAchievements['badge-flawless'] = now;
                newUnlock = true;
            }
        }

        if (newUnlock) {
            AudioEngine.playLevelUpFanfare();
            triggerConfetti();
        }

        renderAchievements();
    }

    function renderAchievements() {
        const badges = ['badge-first-commit', 'badge-pyromaniac', 'badge-ascended', 'badge-flawless'];
        badges.forEach(id => {
            const badgeEl = document.getElementById(id);
            if (!badgeEl) return;

            const unlockTime = state.unlockedAchievements[id];
            const timestampEl = badgeEl.querySelector('.unlock-timestamp');

            if (unlockTime) {
                badgeEl.classList.remove('locked');
                if (timestampEl) timestampEl.textContent = `Unlocked: ${unlockTime}`;
            } else {
                badgeEl.classList.add('locked');
                if (timestampEl) timestampEl.textContent = '';
            }
        });
    }

    // --- Import / Export Telemetry ---
    const btnExport = document.getElementById('btn-export-profile');
    const inputImport = document.getElementById('import-file');

    if (btnExport) {
        btnExport.addEventListener('click', () => {
            const exportData = {
                userId: state.userId,
                level: state.level,
                xp: state.xp,
                lifetimeCompletions: state.lifetimeCompletions,
                habits: state.habits,
                unlockedAchievements: state.unlockedAchievements
            };
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
            const dlAnchorElem = document.createElement('a');
            dlAnchorElem.setAttribute("href", dataStr);
            dlAnchorElem.setAttribute("download", "habitquest-profile.json");
            dlAnchorElem.click();
        });
    }

    if (inputImport) {
        inputImport.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const parsed = JSON.parse(evt.target.result);

                    if (typeof parsed.level !== 'number' || typeof parsed.xp !== 'number' || !Array.isArray(parsed.habits)) {
                        throw new Error("Invalid telemetry schema.");
                    }

                    state.level = parsed.level;
                    state.xp = parsed.xp;
                    state.lifetimeCompletions = parsed.lifetimeCompletions || 0;
                    state.habits = parsed.habits;
                    state.unlockedAchievements = parsed.unlockedAchievements || {};

                    window.BackendStubs.syncHabitsToDB(state.habits);

                    generateMatrixData();
                    renderHabits();
                    renderWeeklyMatrix();
                    renderMonthlyGrid();
                    renderConsistencyMatrix();
                    updateUI();

                    alert("Telemetry Profile Successfully Imported!");
                } catch (err) {
                    alert("Error importing profile: " + err.message);
                }
            };
            reader.readAsText(file);
        });
    }

    // --- Export for AI Coach ---
    window.AppLogic = {
        serializeState: () => {
            const todayStr = getTodayString();
            const activeStreaks = state.habits.filter(h => h.streak > 0).map(h => `${h.name} (${h.streak} days)`).join(', ');
            const completedToday = state.habits.filter(h => h.completionsLog.includes(todayStr)).map(h => h.name).join(', ');
            const remaining = state.habits.filter(h => !h.completionsLog.includes(todayStr)).map(h => h.name).join(', ');

            return `
Level: ${state.level}
XP: ${state.xp}/${state.xpNeeded}
Lifetime Completions: ${state.lifetimeCompletions}
Active Streaks: ${activeStreaks || 'None yet'}
Completed Today: ${completedToday || 'None'}
Remaining Today: ${remaining || 'None'}
            `.trim();
        }
    };

    // --- Rewards Shop Logic ---
    const rewardsShop = document.getElementById('rewards-shop');
    if (rewardsShop) {
        rewardsShop.addEventListener('click', (e) => {
            if (e.target.classList.contains('purchase-btn')) {
                const btn = e.target;
                const item = btn.dataset.item;
                const cost = parseInt(btn.dataset.cost);

                if (item === 'neon-theme' && state.neonThemeUnlocked) {
                    document.body.classList.toggle('neon-overdrive');
                    return;
                }

                if (state.bytecoins >= cost && !btn.disabled) {
                    state.bytecoins -= cost;

                    if (item === 'streak-freeze') {
                        state.streakFreezes += 1;
                        alert('Streak Freeze Matrix Shield acquired!');
                    } else if (item === 'neon-theme') {
                        state.neonThemeUnlocked = true;
                        document.body.classList.add('neon-overdrive');
                        alert('Neon Overdrive Theme Unlocked!');
                    } else if (item === 'ai-token') {
                        alert('AI Coach Priority Token applied. Neural connection boosted!');
                    }

                    updateRewardsShopUI();
                    updateUI();

                    if (window.BackendStubs && window.BackendStubs.syncHabitsToDB) {
                        window.BackendStubs.syncHabitsToDB(state.habits);
                    }
                }
            }
        });
    }
});
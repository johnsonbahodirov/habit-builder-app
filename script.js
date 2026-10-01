const STORAGE_KEY = "habitbuilder-v2";

const state = {
  habits: loadHabits(),
  monthCursor: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
};

const refs = {
  statsGrid: document.getElementById("statsGrid"),
  weeklyChart: document.getElementById("weeklyChart"),
  categoryList: document.getElementById("categoryList"),
  habitList: document.getElementById("habitList"),
  habitForm: document.getElementById("habitForm"),
  habitName: document.getElementById("habitName"),
  habitCategory: document.getElementById("habitCategory"),
  habitColor: document.getElementById("habitColor"),
  todayDateLabel: document.getElementById("todayDateLabel"),
  calendarMonthLabel: document.getElementById("calendarMonthLabel"),
  calendarGrid: document.getElementById("calendarGrid"),
  prevMonthBtn: document.getElementById("prevMonthBtn"),
  nextMonthBtn: document.getElementById("nextMonthBtn"),
  markTodayBtn: document.getElementById("markTodayBtn"),
  resetBtn: document.getElementById("resetBtn"),
};

function loadHabits() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Failed to load habits:", error);
    return [];
  }
}

function saveHabits() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.habits));
}

function formatDateKey(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.toISOString().split("T")[0];
}

function formatDisplayDate(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function getRecentDays(count = 7) {
  const dates = [];
  const base = new Date();
  base.setHours(0, 0, 0, 0);

  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const date = new Date(base);
    date.setDate(base.getDate() - offset);
    dates.push(formatDateKey(date));
  }

  return dates;
}

function getStreak(habit) {
  const completed = new Set(habit.completions || []);
  let streak = 0;
  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (completed.has(formatDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function isDoneToday(habit) {
  return (habit.completions || []).includes(getTodayKey());
}

function getCompletionRate(habit) {
  if (!habit.completions || habit.completions.length === 0) {
    return 0;
  }

  const uniqueDays = new Set(habit.completions);
  const recent = getRecentDays(30);
  const doneInMonth = recent.filter((day) => uniqueDays.has(day)).length;

  return Math.round((doneInMonth / recent.length) * 100);
}

function getBestStreak() {
  if (!state.habits.length) {
    return 0;
  }

  return Math.max(...state.habits.map((habit) => getStreak(habit)));
}

function getTotalCompletionsThisWeek() {
  const recent = getRecentDays(7);

  const count = state.habits.reduce((sum, habit) => {
    const set = new Set(habit.completions || []);
    return sum + recent.filter((day) => set.has(day)).length;
  }, 0);

  return count;
}

function getTodayDoneCount() {
  return state.habits.filter((habit) => isDoneToday(habit)).length;
}

function renderStats() {
  const totalHabits = state.habits.length;
  const completedToday = getTodayDoneCount();
  const bestStreak = getBestStreak();
  const completionRate = state.habits.length
    ? Math.round(
        (state.habits.reduce((sum, habit) => sum + getCompletionRate(habit), 0) / state.habits.length)
      )
    : 0;

  const cards = [
    { label: "Total habits", value: totalHabits },
    { label: "Done today", value: completedToday },
    { label: "Best streak", value: `${bestStreak} days` },
    { label: "Completion rate", value: `${completionRate}%` },
  ];

  refs.statsGrid.innerHTML = cards
    .map(
      (card) => `
        <div class="stat-card">
          <div class="label">${card.label}</div>
          <div class="value">${card.value}</div>
        </div>
      `
    )
    .join("");
}

function renderWeeklyChart() {
  const recent = getRecentDays(7);

  const dayCounts = recent.map((date) => {
    const total = state.habits.reduce((sum, habit) => {
      return sum + ((habit.completions || []).includes(date) ? 1 : 0);
    }, 0);

    return { date, total };
  });

  const maxValue = Math.max(1, ...dayCounts.map((item) => item.total));

  const bars = dayCounts
    .map(({ date, total }) => {
      const displayDate = new Date(date);
      const label = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(displayDate);
      const height = Math.max((total / maxValue) * 100, total > 0 ? 10 : 4);

      return `
        <div class="chart-day">
          <div class="chart-day-total">${total}</div>
          <div class="chart-bar-wrap">
            <div class="chart-bar" style="height: ${height}%"></div>
          </div>
          <div class="chart-day-label">${label}</div>
        </div>
      `;
    })
    .join("");

  refs.weeklyChart.innerHTML = bars;
}

function renderCategoryList() {
  const categories = {};

  state.habits.forEach((habit) => {
    const category = habit.category || "General";
    categories[category] = (categories[category] || 0) + 1;
  });

  const entries = Object.entries(categories);

  if (!entries.length) {
    refs.categoryList.innerHTML = '<div class="empty-state"><strong>No data yet</strong>Your categories will show up here as soon as you add habits.</div>';
    return;
  }

  const palette = ["#4f6ef7", "#26b671", "#f6b73c", "#ef5b58", "#7c5af6", "#2ec4b6"];

  refs.categoryList.innerHTML = entries
    .map(([name, count], index) => {
      const swatch = palette[index % palette.length];
      return `
        <div class="category-item">
          <span class="category-swatch" style="background: ${swatch};"></span>
          <span class="category-name">${escapeHTML(name)}</span>
          <span class="category-pill">${count}</span>
        </div>
      `;
    })
    .join("");
}

function renderCalendar() {
  const currentMonth = new Date(state.monthCursor);
  currentMonth.setDate(1);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(currentMonth);

  refs.calendarMonthLabel.textContent = monthLabel;

  const start = new Date(currentMonth);
  start.setDate(1);
  start.setDate(start.getDate() - start.getDay());

  const days = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    days.push(date);
  }

  refs.calendarGrid.innerHTML = days
    .map((day) => {
      const key = formatDateKey(day);
      const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
      const isToday = formatDateKey(day) === getTodayKey();

      const doneByHabits = state.habits.filter((habit) => (habit.completions || []).includes(key));
      const badges = doneByHabits.slice(0, 4).map((habit) => `<span class="calendar-badge" style="background:${habit.color || "#4f6ef7"};"></span>`).join("");

      return `
        <div class="calendar-day ${isCurrentMonth ? "" : "muted"} ${isToday ? "today" : ""}">
          <div class="calendar-date">${day.getDate()}</div>
          <div class="calendar-badges">${badges}</div>
        </div>
      `;
    })
    .join("");
}

function renderHabits() {
  if (!state.habits.length) {
    refs.habitList.innerHTML = `
      <div class="empty-state">
        <strong>No habits yet</strong>
        Start by adding your first habit above.
      </div>
    `;
    return;
  }

  const recent = getRecentDays(7);

  refs.habitList.innerHTML = state.habits
    .map((habit) => {
      const completeCount = recent.filter((day) => (habit.completions || []).includes(day)).length;
      const totalProgress = (completeCount / recent.length) * 100;
      const streak = getStreak(habit);
      const isDone = isDoneToday(habit);

      const cells = recent
        .map((day) => {
          const done = (habit.completions || []).includes(day);
          return `<div class="heat-cell ${done ? "done" : ""}">${done ? "✓" : ""}</div>`;
        })
        .join("");

      return `
        <div class="habit-card">
          <div class="habit-header">
            <div class="habit-main">
              <span class="habit-color" style="background: ${habit.color || "#4f6ef7"};"></span>
              <div class="habit-name-wrap">
                <p class="habit-name">${escapeHTML(habit.name)}</p>
                <span class="habit-category">${escapeHTML(habit.category || "General")}</span>
              </div>
            </div>

            <div class="habit-actions">
              <button class="habit-toggle-btn ${isDone ? "done" : ""}" type="button" data-action="toggle" data-id="${habit.id}">${isDone ? "Done" : "Mark done"}</button>
              <button class="habit-action-btn" type="button" data-action="edit" data-id="${habit.id}">Edit</button>
              <button class="habit-action-btn" type="button" data-action="delete" data-id="${habit.id}">Delete</button>
            </div>
          </div>

          <div class="habit-progress">
            <div class="habit-progress-bar" style="width: ${Math.min(totalProgress, 100)}%"></div>
          </div>

          <div class="habit-meta">
            <div class="habit-streak">🔥 ${streak} day streak</div>
            <div class="habit-heatmap">${cells}</div>
          </div>
        </div>
      `;
    })
    .join("");
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderTodayLabel() {
  refs.todayDateLabel.textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());
}

function renderAll() {
  renderTodayLabel();
  renderStats();
  renderWeeklyChart();
  renderCategoryList();
  renderCalendar();
  renderHabits();
}

function addHabit(name, category, color) {
  if (!name.trim()) {
    return;
  }

  state.habits.unshift({
    id: Date.now().toString(),
    name: name.trim(),
    category: category || "General",
    color: color || "#4f6ef7",
    completions: [],
  });

  saveHabits();
  renderAll();
}

function toggleHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;

  const today = getTodayKey();
  const completions = new Set(habit.completions || []);

  if (completions.has(today)) {
    completions.delete(today);
  } else {
    completions.add(today);
  }

  habit.completions = Array.from(completions).sort();
  saveHabits();
  renderAll();
}

function editHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;

  const name = prompt("Update habit name:", habit.name);
  if (name === null) return;

  const trimmedName = name.trim();
  if (!trimmedName) {
    alert("Habit name cannot be empty.");
    return;
  }

  habit.name = trimmedName;

  const category = prompt("Update category:", habit.category || "General");
  if (category !== null) {
    habit.category = category.trim() || habit.category || "General";
  }

  saveHabits();
  renderAll();
}

function deleteHabit(id) {
  const habit = state.habits.find((item) => item.id === id);
  if (!habit) return;

  const confirmed = window.confirm(`Delete "${habit.name}"?`);
  if (!confirmed) return;

  state.habits = state.habits.filter((item) => item.id !== id);
  saveHabits();
  renderAll();
}

refs.habitForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const name = refs.habitName.value;
  const category = refs.habitCategory.value;
  const color = refs.habitColor.value;

  addHabit(name, category, color);
  refs.habitForm.reset();
  refs.habitColor.value = "#4f6ef7";
  refs.habitName.focus();
});

refs.habitList.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;

  const { action, id } = button.dataset;
  if (!id) return;

  if (action === "toggle") toggleHabit(id);
  if (action === "edit") editHabit(id);
  if (action === "delete") deleteHabit(id);
});

refs.markTodayBtn.addEventListener("click", () => {
  state.habits = state.habits.map((habit) => {
    const completions = new Set(habit.completions || []);
    completions.add(getTodayKey());
    return {
      ...habit,
      completions: Array.from(completions).sort(),
    };
  });

  saveHabits();
  renderAll();
});

refs.resetBtn.addEventListener("click", () => {
  const confirmed = window.confirm("Reset all habits and progress?");
  if (!confirmed) return;

  state.habits = [];
  saveHabits();
  renderAll();
});

refs.prevMonthBtn.addEventListener("click", () => {
  state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() - 1, 1);
  renderCalendar();
});

refs.nextMonthBtn.addEventListener("click", () => {
  state.monthCursor = new Date(state.monthCursor.getFullYear(), state.monthCursor.getMonth() + 1, 1);
  renderCalendar();
});

renderAll();

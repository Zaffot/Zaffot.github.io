const STORAGE_KEY = "ruutuaika-v1";
const DEFAULT_MINUTES = 30;

const dateKey = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const freshState = () => ({ dailyMinutes: DEFAULT_MINUTES, days: {}, activeSince: null });

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && saved.days ? { ...freshState(), ...saved } : freshState();
  } catch {
    return freshState();
  }
}

let state = loadState();
let showingAll = false;
let tickHandle;
let toastHandle;

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  timeDisplay: document.querySelector("#timeDisplay"),
  progressFill: document.querySelector("#progressFill"),
  progressTrack: document.querySelector(".progress-track"),
  statusMessage: document.querySelector("#statusMessage"),
  timerButton: document.querySelector("#timerButton"),
  timerButtonText: document.querySelector("#timerButtonText"),
  finishButton: document.querySelector("#finishButton"),
  todayTotal: document.querySelector("#todayTotal"),
  historyList: document.querySelector("#historyList"),
  averageUsed: document.querySelector("#averageUsed"),
  daysOnTarget: document.querySelector("#daysOnTarget"),
  streakBadge: document.querySelector("#streakBadge"),
  showHistoryButton: document.querySelector("#showHistoryButton"),
  settingsButton: document.querySelector("#settingsButton"),
  settingsDialog: document.querySelector("#settingsDialog"),
  dailyMinutes: document.querySelector("#dailyMinutes"),
  settingsForm: document.querySelector("#settingsForm"),
  resetDayButton: document.querySelector("#resetDayButton"),
  resetConfirm: document.querySelector("#resetConfirm"),
  confirmResetButton: document.querySelector("#confirmResetButton"),
  cancelResetButton: document.querySelector("#cancelResetButton"),
  toast: document.querySelector("#toast")
};

function ensureToday() {
  const today = dateKey();
  if (state.activeSince && dateKey(new Date(state.activeSince)) !== today) {
    const previousKey = dateKey(new Date(state.activeSince));
    const previous = state.days[previousKey] || { adjustment: 0, usedSeconds: 0, finished: false };
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    previous.usedSeconds += Math.max(0, Math.floor((midnight.getTime() - new Date(state.activeSince).getTime()) / 1000));
    previous.finished = true;
    state.days[previousKey] = previous;
    state.activeSince = null;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  if (!state.days[today]) state.days[today] = { adjustment: 0, usedSeconds: 0, finished: false };
  pruneHistory();
  return state.days[today];
}

function pruneHistory() {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 35);
  Object.keys(state.days).forEach(key => {
    if (new Date(`${key}T12:00:00`) < cutoff) delete state.days[key];
  });
}

function activeElapsed() {
  if (!state.activeSince) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(state.activeSince).getTime()) / 1000));
}

function todayValues() {
  const day = ensureToday();
  const allowanceSeconds = Math.max(0, state.dailyMinutes + day.adjustment) * 60;
  const usedSeconds = day.usedSeconds + activeElapsed();
  return { day, allowanceSeconds, usedSeconds, remainingSeconds: Math.max(0, allowanceSeconds - usedSeconds) };
}

function commitActiveTime() {
  if (!state.activeSince) return;
  const day = ensureToday();
  day.usedSeconds += activeElapsed();
  state.activeSince = null;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.ceil(seconds));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function statusText(remaining, allowance, finished) {
  if (finished) return "Päivän ruutuaika on merkitty valmiiksi. Hienoa! 🌟";
  if (remaining <= 0) return "Tämän päivän ruutuaika on käytetty. Huomenna saat taas lisää! 🌙";
  const ratio = allowance ? remaining / allowance : 0;
  if (ratio > .66) return "Koko päivän ruutuaikaa on vielä mukavasti jäljellä ✨";
  if (ratio > .33) return "Hyvin menee – muista pitää välillä pieni tauko 🌿";
  return "Vielä pieni hetki jäljellä – käytä se kivasti 💛";
}

function render() {
  const now = new Date();
  const { day, allowanceSeconds, usedSeconds, remainingSeconds } = todayValues();
  const allowanceMinutes = Math.round(allowanceSeconds / 60);
  const ratio = allowanceSeconds ? Math.min(1, remainingSeconds / allowanceSeconds) : 0;

  els.todayLabel.textContent = now.toLocaleDateString("fi-FI", { weekday: "long", day: "numeric", month: "long" });
  els.timeDisplay.textContent = formatClock(remainingSeconds);
  els.progressFill.style.width = `${ratio * 100}%`;
  els.progressTrack.setAttribute("aria-valuemax", String(allowanceMinutes));
  els.progressTrack.setAttribute("aria-valuenow", String(Math.ceil(remainingSeconds / 60)));
  els.statusMessage.textContent = statusText(remainingSeconds, allowanceSeconds, day.finished);
  els.todayTotal.textContent = `Tänään ${allowanceMinutes} min`;

  const running = Boolean(state.activeSince);
  els.timerButton.classList.toggle("is-running", running);
  els.timerButtonText.textContent = running ? "Pidä tauko" : usedSeconds > 0 ? "Jatka ruutuaikaa" : "Aloita ruutuaika";
  els.timerButton.disabled = remainingSeconds <= 0 || day.finished;
  els.finishButton.classList.toggle("hidden", usedSeconds <= 0 || day.finished);

  if (remainingSeconds <= 0 && state.activeSince) {
    commitActiveTime();
    day.finished = true;
    save();
  }

  renderHistory();
}

function historyDays() {
  return Array.from({ length: 30 }, (_, index) => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() - index);
    const key = dateKey(date);
    const day = state.days[key] || { adjustment: 0, usedSeconds: 0, finished: false };
    let used = day.usedSeconds;
    if (index === 0) used += activeElapsed();
    return { date, key, day, usedMinutes: Math.round(used / 60), target: Math.max(0, state.dailyMinutes + day.adjustment) };
  });
}

function renderHistory() {
  const days = historyDays();
  const started = days.filter(item => item.usedMinutes > 0 || item.day.finished || item.day.adjustment !== 0);
  const completed = started.filter(item => item.usedMinutes <= item.target);
  const average = started.length ? Math.round(started.reduce((sum, item) => sum + item.usedMinutes, 0) / started.length) : 0;
  let streak = 0;
  for (const item of days) {
    if (item.usedMinutes > 0 && item.usedMinutes <= item.target) streak++;
    else if (item.key !== dateKey()) break;
  }

  els.averageUsed.textContent = `${average} min`;
  els.daysOnTarget.textContent = `${completed.length} / ${started.length || 0}`;
  els.streakBadge.textContent = `${streak} hyvää päivää`;
  els.showHistoryButton.textContent = showingAll ? "Näytä vähemmän" : "Näytä kaikki 30 päivää";

  const visible = days.slice(0, showingAll ? 30 : 7);
  els.historyList.innerHTML = visible.map(({ date, usedMinutes, target }) => {
    const pct = target ? Math.min(100, usedMinutes / target * 100) : 0;
    const over = usedMinutes > target;
    const dateText = date.toLocaleDateString("fi-FI", { weekday: "short", day: "numeric", month: "numeric" });
    return `<div class="history-row">
      <span class="history-date">${dateText}</span>
      <span class="history-bar" aria-hidden="true"><span class="${over ? "over" : ""}" style="width:${pct}%"></span></span>
      <span class="history-value">${usedMinutes} / ${target}</span>
    </div>`;
  }).join("");
}

function showToast(message) {
  clearTimeout(toastHandle);
  els.toast.textContent = message;
  els.toast.classList.add("show");
  toastHandle = setTimeout(() => els.toast.classList.remove("show"), 2400);
}

els.timerButton.addEventListener("click", () => {
  if (state.activeSince) {
    commitActiveTime();
    showToast("Tauko alkoi – ajastin pysäytettiin");
  } else {
    state.activeSince = new Date().toISOString();
    ensureToday().finished = false;
    showToast("Ruutuaika alkoi");
  }
  save();
  render();
});

els.finishButton.addEventListener("click", () => {
  commitActiveTime();
  ensureToday().finished = true;
  save();
  showToast("Päivä merkitty valmiiksi 🌟");
  render();
});

document.querySelectorAll(".adjust-button").forEach(button => {
  button.addEventListener("click", () => {
    const amount = Number(button.dataset.minutes);
    const day = ensureToday();
    day.adjustment += amount;
    if (state.dailyMinutes + day.adjustment < 0) day.adjustment = -state.dailyMinutes;
    day.finished = false;
    save();
    showToast(`${amount > 0 ? "+" : ""}${amount} minuuttia tälle päivälle`);
    render();
  });
});

els.showHistoryButton.addEventListener("click", () => {
  showingAll = !showingAll;
  renderHistory();
});

els.settingsButton.addEventListener("click", () => {
  els.dailyMinutes.value = state.dailyMinutes;
  resetResetConfirmation();
  els.settingsDialog.showModal();
});

function resetResetConfirmation() {
  els.resetDayButton.classList.remove("hidden");
  els.resetConfirm.classList.add("hidden");
}

els.resetDayButton.addEventListener("click", () => {
  els.resetDayButton.classList.add("hidden");
  els.resetConfirm.classList.remove("hidden");
});

els.cancelResetButton.addEventListener("click", resetResetConfirmation);

els.confirmResetButton.addEventListener("click", () => {
  state.activeSince = null;
  state.days[dateKey()] = { adjustment: 0, usedSeconds: 0, finished: false };
  save();
  resetResetConfirmation();
  els.settingsDialog.close();
  showToast("Tämä päivä on resetoitu");
  render();
});

els.settingsForm.addEventListener("submit", event => {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const next = Math.min(240, Math.max(5, Number(els.dailyMinutes.value) || DEFAULT_MINUTES));
  state.dailyMinutes = next;
  save();
  els.settingsDialog.close();
  showToast(`Päivän tavoite on nyt ${next} minuuttia`);
  render();
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) syncFromStorage();
});

function syncFromStorage() {
  state = loadState();
  render();
}

window.addEventListener("focus", syncFromStorage);
window.addEventListener("pageshow", syncFromStorage);
window.addEventListener("pagehide", save);

window.addEventListener("storage", event => {
  if (event.key === STORAGE_KEY) {
    state = loadState();
    render();
  }
});

ensureToday();
save();
render();
tickHandle = setInterval(render, 1000);

(() => {
  'use strict';

  const STORAGE_KEY = 'padelpoints-v1';
  const pointLabels = ['0', '15', '30', '40'];
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const initialState = () => ({
    points: [0, 0], games: [0, 0], sets: [0, 0], server: 0,
    teamNames: ['Tiimi A', 'Tiimi B'], pointHistory: [], undo: [],
    matches: [], mixed: false, players: [], lineups: [[], []], pickTeam: 0,
    playerStats: {}, lineupLocked: false, unlockedTeam: null
  });

  let state = load();
  let deferredInstall = null;
  const $ = (id) => document.getElementById(id);
  const els = {
    scoreA: $('scoreA'), scoreB: $('scoreB'), games: $('gamesScore'), sets: $('setsScore'),
    teamA: $('teamAName'), teamB: $('teamBName'), serveA: $('serveA'), serveB: $('serveB'),
    sideA: $('serveSideA'), sideB: $('serveSideB'), advantageA: $('advantageA'), advantageB: $('advantageB'),
    status: $('statusMessage'), undo: $('undoButton'), history: $('pointHistory'), pointCount: $('pointCount'),
    mixed: $('mixedMode'), mixedContent: $('mixedContent'), playerPool: $('playerPool'), playerStats: $('playerStats'),
    playersA: $('playersA'), playersB: $('playersB'), lineupHint: $('lineupHint'), daily: $('dailyMatches'),
    todayCount: $('todayCount'), install: $('installButton')
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved ? { ...initialState(), ...saved } : initialState();
    } catch { return initialState(); }
  }

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function snapshot() {
    const { undo, ...rest } = state;
    state.undo.push(JSON.stringify(rest));
    if (state.undo.length > 40) state.undo.shift();
  }
  function teamIndex(key) { return key === 'a' ? 0 : 1; }
  function scoreText(index) {
    const own = state.points[index], other = state.points[1 - index];
    if (own >= 3 && other >= 3) return own > other ? 'AD' : '40';
    return pointLabels[Math.min(own, 3)];
  }
  function hasValidLineup() { return !state.mixed || (state.lineups[0].length === 2 && state.lineups[1].length === 2); }

  function addPoint(team) {
    if (!hasValidLineup()) {
      els.status.textContent = 'Valitse ensin kaksi pelaajaa kumpaankin tiimiin.';
      return;
    }
    snapshot();
    state.lineupLocked = state.mixed;
    state.unlockedTeam = null;
    const before = `${scoreText(0)}–${scoreText(1)}`;
    state.points[team] += 1;
    let gameWon = false;
    if (state.points[team] >= 4 && state.points[team] - state.points[1 - team] >= 2) {
      gameWon = true;
      finishGame(team);
    }
    state.pointHistory.unshift({ at: Date.now(), team, before, after: gameWon ? 'Peli' : `${scoreText(0)}–${scoreText(1)}`, lineups: state.lineups.map(x => [...x]) });
    if (state.pointHistory.length > 80) state.pointHistory.pop();
    if (state.mixed) recordPlayerPoint(team);
    els.status.textContent = gameWon ? `${state.teamNames[team]} voitti pelin.` : `${state.teamNames[team]} voitti pisteen.`;
    save(); render();
  }

  function finishGame(team) {
    const loser = 1 - team;
    state.games[team] += 1;
    state.points = [0, 0];
    state.server = 1 - state.server;
    if (state.mixed) { state.lineupLocked = false; state.unlockedTeam = loser; state.pickTeam = loser; }
    const a = state.games[team], b = state.games[loser];
    if ((a >= 6 && a - b >= 2) || a === 7) {
      state.sets[team] += 1;
      state.games = [0, 0];
      if (state.sets[team] >= 2) finishMatch(team);
    }
  }

  function finishMatch(team) {
    state.matches.unshift({ id: Date.now(), date: todayKey(), winner: team, teams: [...state.teamNames], sets: [...state.sets] });
    state.matches = state.matches.slice(0, 100);
    state.points = [0, 0]; state.games = [0, 0]; state.sets = [0, 0]; state.pointHistory = [];
    state.lineupLocked = false; state.unlockedTeam = null;
    els.status.textContent = `${state.teamNames[team]} voitti ottelun!`;
  }

  function recordPlayerPoint(winner) {
    state.lineups.forEach((lineup, team) => lineup.forEach(name => {
      const stats = state.playerStats[name] || { won: 0, played: 0, partners: {} };
      stats.played += 1;
      if (team === winner) stats.won += 1;
      const partner = lineup.find(player => player !== name);
      if (partner) {
        stats.partners[partner] ||= { won: 0, played: 0 };
        stats.partners[partner].played += 1;
        if (team === winner) stats.partners[partner].won += 1;
      }
      state.playerStats[name] = stats;
    }));
  }

  function undo() {
    const previous = state.undo.pop();
    if (!previous) return;
    const remainingUndo = [...state.undo];
    state = { ...initialState(), ...JSON.parse(previous), undo: remainingUndo };
    save(); render();
    els.status.textContent = 'Viimeisin piste kumottiin.';
  }

  function newMatch() {
    if (!confirm('Aloitetaanko uusi ottelu? Nykyinen pistetilanne nollataan.')) return;
    const keep = { matches: state.matches, mixed: state.mixed, players: state.players, lineups: state.lineups, playerStats: state.playerStats, teamNames: state.teamNames };
    state = { ...initialState(), ...keep };
    save(); render();
  }

  function addPlayer(name) {
    const clean = name.trim();
    if (!clean || state.players.some(p => p.toLowerCase() === clean.toLowerCase())) return;
    state.players.push(clean); save(); render();
  }

  function togglePlayer(name) {
    const currentTeam = state.lineups.findIndex(lineup => lineup.includes(name));
    if (state.lineupLocked) return;
    if (currentTeam >= 0) {
      if (state.unlockedTeam !== null && currentTeam !== state.unlockedTeam) return;
      state.lineups[currentTeam] = state.lineups[currentTeam].filter(p => p !== name);
    } else {
      if (state.unlockedTeam !== null && state.pickTeam !== state.unlockedTeam) return;
      if (state.lineups[state.pickTeam].length >= 2) return;
      state.lineups[state.pickTeam].push(name);
    }
    save(); render();
  }

  function render() {
    els.scoreA.textContent = scoreText(0); els.scoreB.textContent = scoreText(1);
    els.games.textContent = `${state.games[0]}–${state.games[1]}`; els.sets.textContent = `${state.sets[0]}–${state.sets[1]}`;
    els.teamA.value = state.teamNames[0]; els.teamB.value = state.teamNames[1];
    els.advantageA.hidden = els.scoreA.textContent !== 'AD'; els.advantageB.hidden = els.scoreB.textContent !== 'AD';
    const side = (state.points[0] + state.points[1]) % 2 === 0 ? 'right' : 'left';
    [els.serveA, els.serveB].forEach((el, index) => { el.hidden = state.server !== index; el.dataset.side = side; });
    [els.sideA, els.sideB].forEach(el => { el.textContent = side === 'right' ? 'OIKEALTA' : 'VASEMMALTA'; });
    els.undo.disabled = state.undo.length === 0;
    els.pointCount.textContent = `${state.pointHistory.length} tapahtumaa`;
    els.history.innerHTML = state.pointHistory.length ? state.pointHistory.slice(0, 30).map(item => `<li><span><strong>${escapeHtml(state.teamNames[item.team])}</strong> voitti pisteen</span><span>${escapeHtml(item.before)} → ${escapeHtml(item.after)}</span></li>`).join('') : '<li>Ei kirjattuja pisteitä.</li>';
    els.mixed.checked = state.mixed; els.mixedContent.hidden = !state.mixed;
    els.playersA.textContent = state.lineups[0].join(' · '); els.playersB.textContent = state.lineups[1].join(' · ');
    renderPlayers(); renderStats(); renderDaily();
  }

  function renderPlayers() {
    els.playerPool.innerHTML = state.players.length ? state.players.map(name => {
      const team = state.lineups[0].includes(name) ? 'a' : state.lineups[1].includes(name) ? 'b' : '';
      const locked = state.lineupLocked || (state.unlockedTeam !== null && team && teamIndex(team) !== state.unlockedTeam);
      return `<button type="button" class="player-chip" data-player="${escapeHtml(name)}" data-team="${team}" ${locked ? 'disabled' : ''}>${escapeHtml(name)}</button>`;
    }).join('') : '<p class="helper">Ei vielä pelaajia.</p>';
    document.querySelectorAll('[data-pick-team]').forEach((button, index) => button.classList.toggle('active', state.pickTeam === index));
    if (state.lineupLocked) els.lineupHint.textContent = 'Kokoonpano on lukittu tämän pelin ajaksi.';
    else if (state.unlockedTeam !== null) els.lineupHint.textContent = `Peli päättyi – ${state.teamNames[state.unlockedTeam]} voidaan vaihtaa.`;
    else els.lineupHint.textContent = `Valitse kaksi pelaajaa tiimiin ${state.pickTeam === 0 ? 'A' : 'B'}.`;
  }

  function renderStats() {
    const rows = Object.entries(state.playerStats).sort((a, b) => b[1].played - a[1].played);
    els.playerStats.innerHTML = rows.length ? rows.map(([name, stats]) => {
      const pct = stats.played ? Math.round(stats.won / stats.played * 100) : 0;
      const partners = Object.entries(stats.partners || {}).sort((a, b) => (b[1].won / b[1].played) - (a[1].won / a[1].played));
      return `<div class="stat-row"><strong>${escapeHtml(name)}</strong><span>${stats.won}/${stats.played} pistettä</span><b>${pct}%</b>${partners[0] ? `<span style="grid-column:1/-1">Paras pari: ${escapeHtml(partners[0][0])}</span>` : ''}</div>`;
    }).join('') : '<p class="helper">Tilastot ilmestyvät, kun pisteitä on pelattu sekapelitilassa.</p>';
  }

  function renderDaily() {
    const today = state.matches.filter(match => match.date === todayKey());
    els.todayCount.textContent = today.length;
    els.daily.innerHTML = today.length ? today.map(match => `<div class="daily-match"><div><strong>${escapeHtml(match.teams[match.winner])}</strong> voitti</div><span>${match.sets[0]}–${match.sets[1]}</span></div>`).join('') : '<div class="empty-state">Tänään ei ole vielä päättyneitä otteluita.</div>';
  }

  function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char])); }

  document.querySelectorAll('[data-score-team]').forEach(button => button.addEventListener('click', () => addPoint(teamIndex(button.dataset.scoreTeam))));
  [els.teamA, els.teamB].forEach((input, index) => input.addEventListener('change', () => { state.teamNames[index] = input.value.trim() || `Tiimi ${index ? 'B' : 'A'}`; save(); render(); }));
  els.undo.addEventListener('click', undo); $('newMatchButton').addEventListener('click', newMatch);
  document.querySelector('.panel-toggle').addEventListener('click', event => { const open = event.currentTarget.getAttribute('aria-expanded') === 'true'; event.currentTarget.setAttribute('aria-expanded', String(!open)); els.history.hidden = open; });
  els.mixed.addEventListener('change', () => { state.mixed = els.mixed.checked; save(); render(); });
  $('playerForm').addEventListener('submit', event => { event.preventDefault(); addPlayer($('playerName').value); $('playerName').value = ''; });
  els.playerPool.addEventListener('click', event => { const button = event.target.closest('[data-player]'); if (button) togglePlayer(button.dataset.player); });
  document.querySelectorAll('[data-pick-team]').forEach(button => button.addEventListener('click', () => { const team = teamIndex(button.dataset.pickTeam); if (state.unlockedTeam === null || state.unlockedTeam === team) { state.pickTeam = team; save(); render(); } }));
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); deferredInstall = event; els.install.hidden = false; });
  els.install.addEventListener('click', async () => { if (!deferredInstall) return; await deferredInstall.prompt(); deferredInstall = null; els.install.hidden = true; });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
  render();
})();

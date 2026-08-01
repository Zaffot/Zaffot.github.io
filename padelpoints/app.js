(() => {
  'use strict';

  const STORAGE_KEY = 'padelpoints-v1';
  const pointLabels = ['0', '15', '30', '40'];
  const localDateKey = (date = new Date()) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const initialState = () => ({
    points: [0, 0], games: [0, 0], sets: [0, 0], server: 0,
    teamNames: ['Tiimi A', 'Tiimi B'], pointHistory: [], undo: [],
    matches: [], mixed: false, players: [], lineups: [[], []], pickTeam: 0,
    playerStats: {}, lineupLocked: false, unlockedTeam: null,
    goldenPoint: false, setResults: [], matchStartedAt: Date.now(), matchComplete: false,
    matchWinsRequired: 2, countedMatchIds: [],
    message: 'Aloita ottelu lisäämällä ensimmäinen piste.'
  });

  let state = load();
  let deferredInstall = null;
  let suppressScoreUntil = 0;
  let suppressPlayerClickUntil = 0;
  let managingPlayer = null;
  const $ = (id) => document.getElementById(id);
  const els = {
    scoreA: $('scoreA'), scoreB: $('scoreB'), games: $('gamesScore'), sets: $('setsScore'),
    teamA: $('teamAName'), teamB: $('teamBName'), serveA: $('serveA'), serveB: $('serveB'),
    sideA: $('serveSideA'), sideB: $('serveSideB'), advantageA: $('advantageA'), advantageB: $('advantageB'),
    status: $('statusMessage'), undo: $('undoButton'), history: $('pointHistory'), pointCount: $('pointCount'),
    mixed: $('mixedMode'), mixedContent: $('mixedContent'), playerPool: $('playerPool'), playerStats: $('playerStats'),
    playersA: $('playersA'), playersB: $('playersB'), lineupHint: $('lineupHint'), daily: $('dailyMatches'),
    todayCount: $('todayCount'), install: $('installButton'), goldenButton: $('goldenPointButton'),
    goldenActive: $('goldenPointActive'), goldenDialog: $('goldenDialog'), goldenDialogText: $('goldenDialogText'),
    confirmGolden: $('confirmGoldenButton'), cancelGolden: $('cancelGoldenButton'), printDaily: $('printDailyButton'),
    lineupQuick: $('lineupQuickControls'), matchTargetButton: $('matchTargetButton'),
    matchTargetLabel: $('matchTargetLabel'), matchTargetDialog: $('matchTargetDialog'),
    matchTargetInput: $('matchTargetInput'), noMatchTarget: $('noMatchTarget'),
    saveMatchTarget: $('saveMatchTargetButton'), cancelMatchTarget: $('cancelMatchTargetButton'),
    playerDialog: $('playerDialog'), playerEditorView: $('playerEditorView'), playerDeleteView: $('playerDeleteView'),
    editPlayerName: $('editPlayerName'), playerDialogError: $('playerDialogError'), playerDeleteText: $('playerDeleteText'),
    savePlayer: $('savePlayerButton'), cancelPlayer: $('cancelPlayerButton'), deletePlayer: $('deletePlayerButton'),
    cancelDeletePlayer: $('cancelDeletePlayerButton'), confirmDeletePlayer: $('confirmDeletePlayerButton')
  };

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const loaded = saved ? { ...initialState(), ...saved } : initialState();
      loaded.setResults = Array.isArray(loaded.setResults) ? loaded.setResults : [];
      loaded.pointHistory = Array.isArray(loaded.pointHistory) ? loaded.pointHistory : [];
      loaded.matches = Array.isArray(loaded.matches) ? loaded.matches : [];
      loaded.countedMatchIds = Array.isArray(loaded.countedMatchIds) ? loaded.countedMatchIds : [];
      loaded.matchWinsRequired = Number.isInteger(loaded.matchWinsRequired) && loaded.matchWinsRequired >= 0
        ? Math.min(loaded.matchWinsRequired, 9) : 2;
      loaded.players.forEach(name => {
        const stats = loaded.playerStats[name] || {};
        loaded.playerStats[name] = {
          won: stats.won || 0, played: stats.played || 0, partners: stats.partners || {},
          matchWins: stats.matchWins || 0, matchesPlayed: stats.matchesPlayed || 0
        };
      });
      loaded.matches.forEach(match => {
        if (loaded.countedMatchIds.includes(match.id)) return;
        const participants = Array.isArray(match.participants) ? match.participants : [[], []];
        const allPlayers = new Set([...(participants[0] || []), ...(participants[1] || [])]);
        allPlayers.forEach(name => {
          if (!loaded.players.includes(name)) return;
          const stats = loaded.playerStats[name] || { won: 0, played: 0, partners: {}, matchWins: 0, matchesPlayed: 0 };
          stats.matchesPlayed = (stats.matchesPlayed || 0) + 1;
          if ((participants[match.winner] || []).includes(name)) stats.matchWins = (stats.matchWins || 0) + 1;
          loaded.playerStats[name] = stats;
        });
        loaded.countedMatchIds.push(match.id);
      });
      return loaded;
    } catch { return initialState(); }
  }

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function snapshot() {
    const { undo, ...rest } = state;
    state.undo.push(JSON.stringify(rest));
    if (state.undo.length > 60) state.undo.shift();
  }
  function teamIndex(key) { return key === 'a' ? 0 : 1; }
  function scoreText(index) {
    if (state.goldenPoint) return '40';
    const own = state.points[index], other = state.points[1 - index];
    if (own >= 3 && other >= 3) return own > other ? 'AD' : '40';
    return pointLabels[Math.min(own, 3)];
  }
  function hasValidLineup() { return !state.mixed || (state.lineups[0].length === 2 && state.lineups[1].length === 2); }
  function hasMatchProgress() { return state.points.some(Boolean) || state.games.some(Boolean) || state.sets.some(Boolean); }

  function prepareNextMatch() {
    state.pointHistory = [];
    state.setResults = [];
    state.matchStartedAt = Date.now();
    state.matchComplete = false;
    state.goldenPoint = false;
    state.message = 'Uusi ottelu alkoi.';
  }

  function addPoint(team) {
    if (Date.now() < suppressScoreUntil) return;
    if (!hasValidLineup()) {
      state.message = 'Valitse ensin kaksi pelaajaa kumpaankin tiimiin.';
      render();
      return;
    }
    if (state.matchComplete) prepareNextMatch();
    snapshot();
    state.lineupLocked = state.mixed;
    state.unlockedTeam = null;
    const before = `${scoreText(0)}–${scoreText(1)}`;
    const lineups = state.lineups.map(lineup => [...lineup]);
    const goldenWasActive = state.goldenPoint;
    state.points[team] += 1;
    const normalGameWin = state.points[team] >= 4 && state.points[team] - state.points[1 - team] >= 2;
    const gameWon = goldenWasActive || normalGameWin;
    if (state.mixed) recordPlayerPoint(team, lineups);

    let outcome = { setWon: false, matchWon: false };
    if (gameWon) outcome = finishGame(team);
    const pointEvent = {
      type: 'point', at: Date.now(), team, teamName: state.teamNames[team], before,
      after: gameWon ? 'PELI' : `${scoreText(0)}–${scoreText(1)}`,
      gameWon, golden: goldenWasActive, lineups
    };
    state.pointHistory.unshift(pointEvent);

    if (outcome.setWon) {
      state.pointHistory.unshift({
        type: 'set', at: Date.now(), number: outcome.setNumber,
        games: outcome.setGames, winner: team, teamName: state.teamNames[team]
      });
    }
    while (state.pointHistory.length > 140) state.pointHistory.pop();

    if (outcome.matchWon) {
      finishMatch(team);
    } else if (outcome.setWon) {
      state.message = `${state.teamNames[team]} voitti ottelun erän ${outcome.setGames[0]}–${outcome.setGames[1]}.`;
    } else if (gameWon) {
      state.message = `${state.teamNames[team]} voitti pelin.`;
    } else {
      state.message = `${state.teamNames[team]} voitti pisteen.`;
    }
    save(); render();
  }

  function finishGame(team) {
    state.games[team] += 1;
    state.points = [0, 0];
    state.goldenPoint = false;
    state.server = 1 - state.server;
    if (state.mixed) {
      state.lineupLocked = false;
      state.unlockedTeam = null;
      state.pickTeam = 1 - team;
    }

    const ownGames = state.games[team];
    const otherGames = state.games[1 - team];
    const setWon = (ownGames >= 6 && ownGames - otherGames >= 2) || ownGames === 7;
    if (!setWon) return { setWon: false, matchWon: false };

    const setGames = [...state.games];
    state.sets[team] += 1;
    const setNumber = state.setResults.length + 1;
    state.setResults.push({ number: setNumber, winner: team, games: setGames });
    state.games = [0, 0];
    const required = state.matchWinsRequired;
    const matchWon = required > 0 && state.sets[team] >= required && state.sets[team] > state.sets[1 - team];
    return { setWon: true, matchWon, setNumber, setGames };
  }

  function finishMatch(team) {
    const participants = [new Set(), new Set()];
    state.pointHistory.forEach(event => {
      if (!event.lineups) return;
      event.lineups.forEach((lineup, index) => lineup.forEach(name => participants[index].add(name)));
    });
    const completedMatch = {
      id: Date.now(), date: localDateKey(), startedAt: state.matchStartedAt, endedAt: Date.now(),
      winner: team, teams: [...state.teamNames], sets: [...state.sets],
      setResults: state.setResults.map(result => ({ ...result, games: [...result.games] })),
      participants: participants.map(teamPlayers => [...teamPlayers]),
      events: state.pointHistory.map(event => ({ ...event }))
    };
    state.matches.unshift(completedMatch);
    if (state.mixed) recordStoredMatchResult(completedMatch);
    state.matches = state.matches.slice(0, 100);
    state.points = [0, 0]; state.games = [0, 0]; state.sets = [0, 0];
    state.setResults = []; state.goldenPoint = false; state.matchComplete = true;
    state.lineupLocked = false; state.unlockedTeam = null;
    state.message = `${state.teamNames[team]} voitti ottelun!`;
  }

  function recordPlayerPoint(winner, lineups) {
    lineups.forEach((lineup, team) => lineup.forEach(name => {
      const stats = state.playerStats[name] || { won: 0, played: 0, partners: {}, matchWins: 0, matchesPlayed: 0 };
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

  function recordStoredMatchResult(match) {
    if (state.countedMatchIds.includes(match.id)) return;
    const participants = match.participants || [[], []];
    const allPlayers = new Set([...(participants[0] || []), ...(participants[1] || [])]);
    allPlayers.forEach(name => {
      const stats = state.playerStats[name] || { won: 0, played: 0, partners: {}, matchWins: 0, matchesPlayed: 0 };
      stats.matchesPlayed = (stats.matchesPlayed || 0) + 1;
      if ((participants[match.winner] || []).includes(name)) stats.matchWins = (stats.matchWins || 0) + 1;
      state.playerStats[name] = stats;
    });
    state.countedMatchIds.push(match.id);
  }

  function undo() {
    const previous = state.undo.pop();
    if (!previous) return;
    const remainingUndo = [...state.undo];
    state = { ...initialState(), ...JSON.parse(previous), undo: remainingUndo };
    state.message = 'Viimeisin toiminto kumottiin.';
    save(); render();
  }

  function newMatch() {
    if (hasMatchProgress() && !confirm('Aloitetaanko uusi ottelu? Nykyinen pistetilanne nollataan.')) return;
    const keep = {
      matches: state.matches, mixed: state.mixed, players: state.players,
      lineups: state.lineups, playerStats: state.playerStats, teamNames: state.teamNames,
      matchWinsRequired: state.matchWinsRequired, countedMatchIds: state.countedMatchIds
    };
    state = { ...initialState(), ...keep, message: 'Uusi ottelu on valmis alkamaan.' };
    save(); render();
  }

  function addPlayer(name) {
    const clean = name.trim();
    if (!clean || state.players.some(player => player.toLowerCase() === clean.toLowerCase())) return;
    state.players.push(clean); save(); render();
  }

  function togglePlayer(name) {
    if (Date.now() < suppressPlayerClickUntil) return;
    if (state.lineupLocked) return;
    suppressScoreUntil = Date.now() + 400;
    const currentTeam = state.lineups.findIndex(lineup => lineup.includes(name));
    if (currentTeam >= 0) {
      state.lineups[currentTeam] = state.lineups[currentTeam].filter(player => player !== name);
    } else if (state.lineups[state.pickTeam].length < 2) {
      state.lineups[state.pickTeam].push(name);
    }
    save(); render();
  }

  function openMatchTargetDialog() {
    const hasTarget = state.matchWinsRequired > 0;
    els.matchTargetInput.value = hasTarget ? state.matchWinsRequired : 2;
    els.noMatchTarget.checked = !hasTarget;
    els.matchTargetInput.disabled = !hasTarget;
    els.matchTargetDialog.hidden = false;
    (hasTarget ? els.matchTargetInput : els.noMatchTarget).focus();
  }

  function closeMatchTargetDialog() {
    els.matchTargetDialog.hidden = true;
    els.matchTargetButton.focus();
  }

  function saveMatchTarget() {
    const required = els.noMatchTarget.checked ? 0 : Math.max(1, Math.min(9, Number.parseInt(els.matchTargetInput.value, 10) || 1));
    state.matchWinsRequired = required;
    state.message = required
      ? `Ottelu päättyy, kun tiimi saavuttaa ${required} erävoittoa.`
      : 'Automaattinen ottelun päättyminen on pois käytöstä.';
    els.matchTargetDialog.hidden = true;

    if (required > 0 && state.sets[0] !== state.sets[1]) {
      const leader = state.sets[0] > state.sets[1] ? 0 : 1;
      if (state.sets[leader] >= required) finishMatch(leader);
    }
    save(); render();
  }

  function ensurePlayerStats(name) {
    state.playerStats[name] ||= { won: 0, played: 0, partners: {}, matchWins: 0, matchesPlayed: 0 };
    state.playerStats[name].matchWins ||= 0;
    state.playerStats[name].matchesPlayed ||= 0;
    state.playerStats[name].partners ||= {};
    return state.playerStats[name];
  }

  function openPlayerDialog(name) {
    if (!state.players.includes(name)) return;
    managingPlayer = name;
    els.playerEditorView.hidden = false;
    els.playerDeleteView.hidden = true;
    els.editPlayerName.value = name;
    els.playerDialogError.textContent = '';
    els.playerDialog.hidden = false;
    els.editPlayerName.focus();
    els.editPlayerName.select();
  }

  function closePlayerDialog() {
    els.playerDialog.hidden = true;
    managingPlayer = null;
  }

  function renamePlayer() {
    if (!managingPlayer) return;
    const oldName = managingPlayer;
    const newName = els.editPlayerName.value.trim();
    if (!newName) {
      els.playerDialogError.textContent = 'Nimi ei voi olla tyhjä.';
      return;
    }
    if (state.players.some(name => name !== oldName && name.toLowerCase() === newName.toLowerCase())) {
      els.playerDialogError.textContent = 'Samanniminen pelaaja on jo lisätty.';
      return;
    }
    if (newName !== oldName) {
      state.players = state.players.map(name => name === oldName ? newName : name);
      state.lineups = state.lineups.map(lineup => lineup.map(name => name === oldName ? newName : name));
      const stats = ensurePlayerStats(oldName);
      delete state.playerStats[oldName];
      state.playerStats[newName] = stats;
      Object.values(state.playerStats).forEach(playerStats => {
        if (!playerStats.partners?.[oldName]) return;
        playerStats.partners[newName] = playerStats.partners[oldName];
        delete playerStats.partners[oldName];
      });
      state.pointHistory.forEach(event => {
        if (event.lineups) event.lineups = event.lineups.map(lineup => lineup.map(name => name === oldName ? newName : name));
      });
    }
    state.message = `${newName} tallennettiin.`;
    closePlayerDialog(); save(); render();
  }

  function showDeletePlayerConfirmation() {
    if (!managingPlayer) return;
    els.playerEditorView.hidden = true;
    els.playerDeleteView.hidden = false;
    els.playerDeleteText.textContent = `${managingPlayer} poistetaan pelaajalistasta ja pelaajatilastoista. Valmiiden otteluiden historia säilyy.`;
    els.cancelDeletePlayer.focus();
  }

  function deletePlayer() {
    if (!managingPlayer) return;
    const name = managingPlayer;
    state.players = state.players.filter(player => player !== name);
    state.lineups = state.lineups.map(lineup => lineup.filter(player => player !== name));
    delete state.playerStats[name];
    Object.values(state.playerStats).forEach(stats => { if (stats.partners) delete stats.partners[name]; });
    state.pointHistory.forEach(event => {
      if (event.lineups) event.lineups = event.lineups.map(lineup => lineup.filter(player => player !== name));
    });
    state.message = `${name} poistettiin.`;
    closePlayerDialog(); save(); render();
  }

  function addPlayerHoldGesture(element, name) {
    let holdTimer = null;
    const cancelHold = () => { if (holdTimer) clearTimeout(holdTimer); holdTimer = null; };
    element.addEventListener('pointerdown', () => {
      cancelHold();
      holdTimer = setTimeout(() => {
        suppressPlayerClickUntil = Date.now() + 700;
        openPlayerDialog(name);
        holdTimer = null;
      }, 650);
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => element.addEventListener(type, cancelHold));
    element.addEventListener('contextmenu', event => {
      event.preventDefault();
      suppressPlayerClickUntil = Date.now() + 700;
      openPlayerDialog(name);
    });
  }

  function openGoldenDialog() {
    const advantageExists = scoreText(0) === 'AD' || scoreText(1) === 'AD';
    els.goldenDialogText.textContent = advantageExists
      ? 'Nykyinen etu poistetaan ja seuraava piste ratkaisee pelin. Oletko varma?'
      : 'Seuraava piste ratkaisee pelin. Oletko varma?';
    els.goldenDialog.hidden = false;
    els.confirmGolden.focus();
  }

  function closeGoldenDialog() {
    els.goldenDialog.hidden = true;
    els.goldenButton.focus();
  }

  function activateGoldenPoint() {
    snapshot();
    state.points = [3, 3];
    state.goldenPoint = true;
    state.message = 'Kultainen piste aktivoitu – seuraava piste ratkaisee pelin.';
    els.goldenDialog.hidden = true;
    save(); render();
  }

  function render() {
    const scoreA = scoreText(0), scoreB = scoreText(1);
    els.scoreA.textContent = scoreA; els.scoreB.textContent = scoreB;
    els.games.textContent = `${state.games[0]}–${state.games[1]}`;
    els.sets.textContent = `${state.sets[0]}–${state.sets[1]}`;
    els.matchTargetLabel.textContent = state.matchWinsRequired ? `${state.matchWinsRequired} voittoon` : 'ei rajaa';
    els.matchTargetButton.setAttribute('aria-label', `Muuta ottelun voittorajaa. Nykyinen asetus: ${els.matchTargetLabel.textContent}`);
    els.teamA.value = state.teamNames[0]; els.teamB.value = state.teamNames[1];
    els.advantageA.classList.toggle('is-visible', scoreA === 'AD');
    els.advantageB.classList.toggle('is-visible', scoreB === 'AD');

    const side = (state.points[0] + state.points[1]) % 2 === 0 ? 'right' : 'left';
    [els.serveA, els.serveB].forEach((element, index) => {
      element.hidden = state.server !== index;
      element.dataset.side = side;
    });
    [els.sideA, els.sideB].forEach(element => {
      element.textContent = side === 'right' ? 'OIKEALTA' : 'VASEMMALTA';
    });

    const canOfferGolden = !state.goldenPoint && state.points[0] >= 3 && state.points[1] >= 3;
    els.goldenButton.hidden = !canOfferGolden;
    els.goldenActive.hidden = !state.goldenPoint;
    els.status.textContent = state.message;
    els.undo.disabled = state.undo.length === 0;
    renderHistory();
    els.mixed.checked = state.mixed;
    els.mixedContent.hidden = !state.mixed;
    els.lineupQuick.hidden = !state.mixed;
    renderPlayers(); renderStats(); renderDaily();
  }

  function renderHistory() {
    const pointEvents = state.pointHistory.filter(event => !event.type || event.type === 'point').length;
    els.pointCount.textContent = `${pointEvents} pistettä`;
    if (!state.pointHistory.length) {
      els.history.innerHTML = '<li>Ei kirjattuja pisteitä.</li>';
      return;
    }
    els.history.innerHTML = state.pointHistory.slice(0, 60).map(event => {
      if (event.type === 'set') {
        return `<li class="history-divider">OTTELUN ERÄ ${event.number} · ${event.games[0]}–${event.games[1]}</li>`;
      }
      const teamName = event.teamName || state.teamNames[event.team];
      const marker = event.golden ? ' · KULTAINEN' : '';
      return `<li><span><strong>${escapeHtml(teamName)}</strong> voitti pisteen${marker}</span><span>${escapeHtml(event.before)} → ${escapeHtml(event.after)}</span></li>`;
    }).join('');
  }

  function renderLineup(team) {
    const lineup = state.lineups[team];
    const buttons = lineup.map(name => `<button type="button" class="lineup-player" data-lineup-player="${escapeHtml(name)}" ${state.lineupLocked ? 'disabled' : ''}>${escapeHtml(name)}${state.lineupLocked ? '' : ' ×'}</button>`);
    while (buttons.length < 2) buttons.push('<span class="lineup-placeholder">VAPAA PAIKKA</span>');
    return buttons.join('');
  }

  function renderPlayers() {
    els.playersA.innerHTML = renderLineup(0);
    els.playersB.innerHTML = renderLineup(1);
    document.querySelectorAll('[data-lineup-player]').forEach(button => {
      addPlayerHoldGesture(button, button.dataset.lineupPlayer);
      button.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        togglePlayer(button.dataset.lineupPlayer);
      });
    });
    const selected = new Set(state.lineups.flat());
    const available = state.players.filter(name => !selected.has(name));
    els.playerPool.innerHTML = available.length
      ? available.map(name => `<button type="button" class="player-chip" data-player="${escapeHtml(name)}">${escapeHtml(name)}</button>`).join('')
      : `<p class="helper">${state.players.length ? 'Kaikki pelaajat ovat tiimeissä.' : 'Ei vielä pelaajia.'}</p>`;
    document.querySelectorAll('[data-player]').forEach(button => addPlayerHoldGesture(button, button.dataset.player));
    document.querySelectorAll('[data-pick-team]').forEach((button, index) => {
      button.classList.toggle('active', state.pickTeam === index);
      button.disabled = state.lineupLocked;
    });
    if (state.lineupLocked) {
      els.lineupHint.textContent = 'Kokoonpano on lukittu tämän pelin ajaksi.';
    } else if (state.matchComplete) {
      els.lineupHint.textContent = 'Ottelu päättyi – voit vaihtaa pelaajia kummastakin tiimistä.';
    } else if (hasMatchProgress()) {
      els.lineupHint.textContent = 'Peli päättyi – voit vaihtaa pelaajia kummastakin tiimistä.';
    } else if (hasValidLineup()) {
      els.lineupHint.textContent = 'Valitse tiimi, jos haluat vaihtaa kokoonpanoa.';
    } else {
      els.lineupHint.textContent = `Valitse kaksi pelaajaa tiimiin ${state.pickTeam === 0 ? 'A' : 'B'}.`;
    }
  }

  function renderStats() {
    const rows = state.players.map(name => [name, ensurePlayerStats(name)])
      .sort((a, b) => (b[1].matchWins - a[1].matchWins) || (b[1].played - a[1].played) || a[0].localeCompare(b[0], 'fi'));
    els.playerStats.innerHTML = rows.length ? rows.map(([name, stats]) => {
      const pct = stats.played ? Math.round(stats.won / stats.played * 100) : 0;
      const partners = Object.entries(stats.partners || {}).sort((a, b) => (b[1].won / b[1].played) - (a[1].won / a[1].played));
      return `<div class="stat-row">
        <strong>${escapeHtml(name)}</strong>
        <span>${stats.matchWins || 0} ${(stats.matchWins || 0) === 1 ? 'otteluvoitto' : 'otteluvoittoa'}</span>
        <button type="button" class="player-manage-button" data-manage-player="${escapeHtml(name)}" aria-label="Muokkaa pelaajaa ${escapeHtml(name)}">•••</button>
        <span>${stats.won}/${stats.played} pistettä · ${pct}%</span>
        ${partners[0] ? `<span>Paras pari: ${escapeHtml(partners[0][0])}</span>` : '<span>Ei vielä paritilastoa</span>'}
      </div>`;
    }).join('') : '<p class="helper">Lisää pelaaja nähdäksesi pelaajatilastot.</p>';
    document.querySelectorAll('[data-manage-player]').forEach(button => {
      button.addEventListener('click', () => openPlayerDialog(button.dataset.managePlayer));
    });
  }

  function matchSetsText(match) {
    const results = match.setResults || [];
    return results.length ? results.map(result => `${result.games[0]}–${result.games[1]}`).join(', ') : `${match.sets?.[0] ?? 0}–${match.sets?.[1] ?? 0}`;
  }

  function matchPlayersText(match) {
    const participants = match.participants || [[], []];
    const teamA = participants[0]?.length ? participants[0].join(', ') : 'ei pelaajatietoja';
    const teamB = participants[1]?.length ? participants[1].join(', ') : 'ei pelaajatietoja';
    return `${teamA} / ${teamB}`;
  }

  function renderDaily() {
    const today = state.matches.filter(match => match.date === localDateKey());
    els.todayCount.textContent = today.length;
    els.printDaily.disabled = today.length === 0;
    els.daily.innerHTML = today.length ? today.map(match => `
      <div class="daily-match">
        <div class="daily-match-main">
          <strong>${escapeHtml(match.teams[match.winner])} voitti</strong>
          <small>${escapeHtml(matchPlayersText(match))}</small>
          <small>${formatClock(match.startedAt)}–${formatClock(match.endedAt)}</small>
        </div>
        <span class="daily-score">${escapeHtml(matchSetsText(match))}</span>
      </div>`).join('') : '<div class="empty-state">Tänään ei ole vielä päättyneitä otteluita.</div>';
  }

  function printDailyReport() {
    const today = state.matches.filter(match => match.date === localDateKey());
    if (!today.length) return;
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      state.message = 'Raportti-ikkuna estettiin. Salli ponnahdusikkunat ja yritä uudelleen.';
      render();
      return;
    }
    const rows = today.map((match, index) => `
      <section>
        <h2>Ottelu ${index + 1}: ${escapeHtml(match.teams[0])} – ${escapeHtml(match.teams[1])}</h2>
        <p><b>Voittaja:</b> ${escapeHtml(match.teams[match.winner])}</p>
        <p><b>Pelaajat:</b> ${escapeHtml(matchPlayersText(match))}</p>
        <p><b>Erät:</b> ${escapeHtml(matchSetsText(match))}</p>
        <p><b>Aika:</b> ${formatClock(match.startedAt)}–${formatClock(match.endedAt)}</p>
      </section>`).join('');
    reportWindow.document.write(`<!doctype html><html lang="fi"><head><meta charset="utf-8"><title>PadelPoints ${localDateKey()}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:32px auto;color:#14251e}header{border-bottom:3px solid #14251e;margin-bottom:24px}h1{margin-bottom:4px}header p{margin-top:0;color:#557266}section{padding:16px 0;border-bottom:1px solid #ccd8d3}h2{font-size:18px}p{margin:6px 0}@media print{body{margin:12mm}button{display:none}}</style></head><body><header><h1>PadelPoints – päivän ottelut</h1><p>${localDateKey()} · ${today.length} ottelua</p></header>${rows}<script>window.addEventListener('load',()=>setTimeout(()=>window.print(),150));<\/script></body></html>`);
    reportWindow.document.close();
  }

  function formatClock(timestamp) {
    if (!timestamp) return '–';
    return new Date(timestamp).toLocaleTimeString('fi-FI', { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[char]));
  }

  document.querySelectorAll('[data-score-team]').forEach(button => button.addEventListener('click', () => addPoint(teamIndex(button.dataset.scoreTeam))));
  [els.teamA, els.teamB].forEach((input, index) => input.addEventListener('change', () => {
    state.teamNames[index] = input.value.trim() || `Tiimi ${index ? 'B' : 'A'}`; save(); render();
  }));
  els.undo.addEventListener('click', undo);
  $('newMatchButton').addEventListener('click', newMatch);
  document.querySelector('.panel-toggle').addEventListener('click', event => {
    const open = event.currentTarget.getAttribute('aria-expanded') === 'true';
    event.currentTarget.setAttribute('aria-expanded', String(!open));
    els.history.hidden = open;
  });
  els.mixed.addEventListener('change', () => { state.mixed = els.mixed.checked; save(); render(); });
  $('playerForm').addEventListener('submit', event => {
    event.preventDefault(); addPlayer($('playerName').value); $('playerName').value = '';
  });
  els.playerPool.addEventListener('click', event => {
    const button = event.target.closest('[data-player]'); if (button) togglePlayer(button.dataset.player);
  });
  document.querySelectorAll('[data-pick-team]').forEach(button => button.addEventListener('click', () => {
    if (state.lineupLocked) return;
    state.pickTeam = teamIndex(button.dataset.pickTeam); save(); render();
  }));
  els.goldenButton.addEventListener('click', openGoldenDialog);
  els.cancelGolden.addEventListener('click', closeGoldenDialog);
  els.confirmGolden.addEventListener('click', activateGoldenPoint);
  els.goldenDialog.addEventListener('click', event => { if (event.target === els.goldenDialog) closeGoldenDialog(); });
  els.matchTargetButton.addEventListener('click', openMatchTargetDialog);
  els.cancelMatchTarget.addEventListener('click', closeMatchTargetDialog);
  els.saveMatchTarget.addEventListener('click', saveMatchTarget);
  els.noMatchTarget.addEventListener('change', () => { els.matchTargetInput.disabled = els.noMatchTarget.checked; });
  els.matchTargetDialog.addEventListener('click', event => { if (event.target === els.matchTargetDialog) closeMatchTargetDialog(); });
  els.cancelPlayer.addEventListener('click', closePlayerDialog);
  els.savePlayer.addEventListener('click', renamePlayer);
  els.deletePlayer.addEventListener('click', showDeletePlayerConfirmation);
  els.cancelDeletePlayer.addEventListener('click', () => {
    els.playerDeleteView.hidden = true; els.playerEditorView.hidden = false; els.deletePlayer.focus();
  });
  els.confirmDeletePlayer.addEventListener('click', deletePlayer);
  els.playerDialog.addEventListener('click', event => { if (event.target === els.playerDialog) closePlayerDialog(); });
  els.editPlayerName.addEventListener('keydown', event => { if (event.key === 'Enter') renamePlayer(); });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!els.goldenDialog.hidden) closeGoldenDialog();
    else if (!els.matchTargetDialog.hidden) closeMatchTargetDialog();
    else if (!els.playerDialog.hidden) closePlayerDialog();
  });
  els.printDaily.addEventListener('click', printDailyReport);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault(); deferredInstall = event; els.install.hidden = false;
  });
  els.install.addEventListener('click', async () => {
    if (!deferredInstall) return; await deferredInstall.prompt(); deferredInstall = null; els.install.hidden = true;
  });
  if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js'));
  render();
})();

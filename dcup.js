// ===== FIREBASE =====
const firebaseConfig = {
  apiKey: "AIzaSyBq749q2LzqqHuS8zCMf48Yy2Y77wpZuGA",
  authDomain: "tournament-bracket-gener-e0767.firebaseapp.com",
  projectId: "tournament-bracket-gener-e0767",
  storageBucket: "tournament-bracket-gener-e0767.firebasestorage.app",
  messagingSenderId: "233208130826",
  appId: "1:233208130826:web:698448adf4c862d3e21ef3",
  databaseURL: "https://tournament-bracket-gener-e0767-default-rtdb.europe-west1.firebasedatabase.app"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// ===== UTILS =====
function escapeHTML(s) {
  if (!s && s !== 0) return '';
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return(c==='x'?r:(r&0x3|0x8)).toString(16);});
}
// P2 #32: toasten ligger nederst, akkurat der et bunnark har knappene sine —
// «1 gruppe · 6 kamper» la seg oppå Lagre. Er en dialog åpen, vises den øverst
// i stedet.
function anyDialogOpen() {
  const ids = ['join-overlay','people-overlay','add-tournament-overlay',
               'start-tournament-overlay','tiebreak-overlay','participation-overlay'];
  if (ids.some(id => {
    const el = document.getElementById(id);
    return el && el.style.display !== 'none' && el.style.display !== '';
  })) return true;
  return !!document.querySelector('.match-dialog-overlay');
}
// Tilbake lukker en åpen dialog i stedet for å navigere — det er det folk
// forventer, og ellers forsvinner hele skjermen bak dialogen.
window.addEventListener('popstate', e => {
  // Oppføringen vi selv nettopp spiste da en dialog ble lukket med knapp
  if (selfBack) { selfBack = false; return; }
  closingFromPopstate = true;
  const closed = closeTopDialog();
  closingFromPopstate = false;
  if (closed) return;   // oppføringen dialogen la igjen er nettopp spist
  const st = e.state || {};
  const onTournament = document.getElementById('screen-tournament').classList.contains('active');
  if (onTournament && st.screen !== 'tournament') { backToEvent(); return; }
  if (st.screen === 'tournament' && st.t && tournaments[st.t]) openTournament(st.t);
});

// Lukker den øverste åpne dialogen, hvis noen. Returnerer om noe ble lukket.
function closeTopDialog() {
  if (document.querySelector('.match-dialog-overlay')) {
    document.getElementById('match-dialog-container').innerHTML = '';
    unlockBodyScroll();
    return true;
  }
  const closers = {
    'participation-overlay': hideParticipation,   // øverst når den er åpen
    'tiebreak-overlay': hideTiebreakDialog,
    'start-tournament-overlay': hideStartDialog,
    'add-tournament-overlay': hideAddTournament,
    'people-overlay': hidePeopleDialog,
    'join-overlay': hideJoinDialog,
  };
  for (const [id, close] of Object.entries(closers)) {
    const el = document.getElementById(id);
    if (el && el.style.display !== 'none' && el.style.display !== '') {
      try { close(); } catch (err) { el.style.display = 'none'; unlockBodyScroll(); }
      return true;
    }
  }
  return false;
}

function showToast(msg) {
  const t=document.getElementById('toast');
  t.textContent=msg;
  t.classList.toggle('toast-top', anyDialogOpen());
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'),2200);
}
// Bunn-modalene har sin egen scroll (overflow-y:auto) for langt innhold —
// uten dette kan siden bak fortsatt scrolle samtidig, som er forvirrende.
// Hver dialog legger igjen en egen historikkoppføring, slik at tilbake spiser
// nettopp den i stedet for å navigere. Å re-pushe state inne i popstate var
// feil: da hadde nettleseren alt flyttet seg, og skjermen byttet under dialogen.
let dialogHistoryDepth = 0;
function pushDialogHistory() {
  dialogHistoryDepth++;
  history.pushState({ dialog: dialogHistoryDepth, screen: (history.state||{}).screen,
                      t: (history.state||{}).t }, '', window.location.href);
}

// Låsen bruker position:fixed, ikke overflow:hidden. Scrolleren er <html>, ikke
// <body>, og iOS-Safari ignorerer overflow:hidden for berøringsscroll uansett —
// det er selve grunnen til at dette trikset finnes. Chromium respekterer
// overflow, så den gamle låsen virket overalt bortsett fra der den trengtes:
// med tastaturet oppe kunne arket scrolles helt ut av bildet (#44).
let scrollLockDepth = 0;
let scrollLockY = 0;

function lockBodyScroll() {
  pushDialogHistory();
  if (scrollLockDepth === 0) {
    scrollLockY = window.scrollY || document.documentElement.scrollTop || 0;
    const b = document.body.style;
    b.position = 'fixed';
    b.top = -scrollLockY + 'px';
    b.left = '0';
    b.right = '0';
    b.width = '100%';
    b.overflow = 'hidden';   // beholdt for nettlesere der den faktisk hjelper
  }
  scrollLockDepth++;
  // Sto det allerede en toast nederst da arket kom opp, havner den under
  // knappene — løft den samme vei som showToast gjør (P2 #32).
  const t = document.getElementById('toast');
  if (t && t.classList.contains('show')) t.classList.add('toast-top');
}

function unlockBodyScroll() {
  // Bare den siste lukkingen slipper låsen. Åpnes et ark oppå et annet, ville
  // en tidlig opphevelse lest scrollY som 0 og sendt siden til toppen.
  if (scrollLockDepth > 0) scrollLockDepth--;
  if (scrollLockDepth === 0) {
    const b = document.body.style;
    b.position = ''; b.top = ''; b.left = ''; b.right = ''; b.width = ''; b.overflow = '';
    // Legg scrollposisjonen tilbake — position:fixed nullstilte den
    window.scrollTo(0, scrollLockY);
  }
  // Ble dialogen lukket med en knapp, ligger dialogoppføringen fortsatt i
  // historikken. Da må den bort, ellers krever det ett ekstra tilbake-trykk
  // å komme videre. popstate setter flagget, siden oppføringen alt er spist.
  if (dialogHistoryDepth > 0 && !closingFromPopstate) {
    dialogHistoryDepth--;
    // Vår egen back() fyrer popstate. Uten flagget tolket lytteren den som et
    // tilbake-trykk og lukket arket under — å lukke det øverste lukket begge.
    selfBack = true;
    history.back();
  } else if (dialogHistoryDepth > 0) {
    dialogHistoryDepth--;
  }
}
let selfBack = false;
let closingFromPopstate = false;

// Turneringsnøklene er UUID-er, så Firebase gir dem tilbake sortert på
// tilfeldig streng — lista hoppet rundt for hver klient. `created` settes på
// alle nye turneringer; mangler den (data laget før feltet fantes), faller vi
// tilbake på nøkkelen, slik at rekkefølgen i det minste er lik overalt.
function sortedTournaments(obj) {
  return Object.entries(obj || {}).sort((a, b) => {
    const ca = typeof a[1]?.created === 'number' ? a[1].created : Infinity;
    const cb = typeof b[1]?.created === 'number' ? b[1].created : Infinity;
    if (ca !== cb) return ca - cb;
    return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0;
  });
}

// ===== SPORTS CONFIG =====
const SPORTS = [
  { id:'pingpong', label:'Bordtennis', icon:'🏓', modes:['wl','score'] },
  { id:'badminton', label:'Badminton', icon:'🏸', modes:['wl','score'] },
  { id:'football', label:'Fotball', icon:'⚽', modes:['wdl','score'] },
  { id:'basketball', label:'Basketball', icon:'🏀', modes:['wl','score'] },
  { id:'tennis', label:'Tennis', icon:'🎾', modes:['wl','score'] },
  { id:'golf', label:'Golf/Putting', icon:'⛳', modes:['score'] },
  { id:'billiards', label:'Biljard', icon:'🎱', modes:['wl'] },
  { id:'hockey', label:'Hockey', icon:'🏒', modes:['wdl','score'] },
  { id:'volleyball', label:'Volleyball', icon:'🏐', modes:['wl','score'] },
  { id:'darts', label:'Dart', icon:'🎯', modes:['wl','score'] },
  { id:'chess', label:'Sjakk', icon:'♟️', modes:['wdl'] },
  { id:'custom', label:'Annet', icon:'🏆', modes:['wdl','wl','score'] },
];

const MODES = {
  wdl: { label:'W / D / T', icon:'🏅', hint:'Seier=3p · Uavgjort=1p · Tap=0p' },
  wl:  { label:'W / T', icon:'⚡', hint:'Seier=3p · Tap=0p · Ingen uavgjort' },
  score: { label:'Score', icon:'🔢', hint:'Skriv inn score · Seier=3p · Tap=0p · Rangert på mål+/-' },
};

const FORMATS = {
  groups: { label:'Grupper', icon:'🅰️', hint:'Gruppespill med playoff på tvers' },
  board:  { label:'Poengtavle', icon:'📋', hint:'Én score per spiller · ingen kamper' },
};
const SCORE_DIRS = {
  high: { label:'Høyest vinner', icon:'⬆️' },
  low:  { label:'Lavest vinner', icon:'⬇️' },
};
let selectedSport = 'pingpong';
let selectedMode = 'wl';
let selectedFormat = 'groups';
let selectedScoreDir = 'high';

function renderSportGrid() {
  document.getElementById('sport-grid').innerHTML = SPORTS.map(s => `
    <button class="sport-btn ${s.id===selectedSport?'selected':''}" onclick="selectSport('${s.id}')">
      <span class="sport-btn-icon">${s.icon}</span>
      <span class="sport-btn-label">${s.label}</span>
    </button>`).join('');
  renderModeGrid();
}

function selectSport(id) {
  selectedSport = id;
  const sport = SPORTS.find(s=>s.id===id);
  if (!sport.modes.includes(selectedMode)) selectedMode = sport.modes[0];
  renderSportGrid();
}

const PREFILL_CHOICES = {
  all:    { label:'Alle deltakere', icon:'👥' },
  none:   { label:'Ingen', icon:'🚫' },
  manual: { label:'Velg manuelt', icon:'✅' },
};
let prefillChoice = 'all';
let prefillManualSelected = {};
// Nye navn lagt til her og nå, mens turneringen opprettes — lagres først
// (som deltakere og som spillere på turneringen) når "Opprett" trykkes.
let newParticipants = [];

function renderPrefillGroup() {
  const people = Object.values(eventPeople).sort((a,b)=>(a.joined||0)-(b.joined||0));
  const choiceWrap = document.getElementById('prefill-choice-wrap');
  choiceWrap.style.display = people.length ? 'block' : 'none';
  if (people.length) {
    document.getElementById('prefill-choice-grid').innerHTML = Object.keys(PREFILL_CHOICES).map(c => `
      <button type="button" class="mode-btn ${c===prefillChoice?'selected':''}" onclick="selectPrefillChoice('${c}')">
        <span class="mode-btn-icon">${PREFILL_CHOICES[c].icon}</span>
        <span class="mode-btn-label">${PREFILL_CHOICES[c].label}</span>
      </button>`).join('');
    renderPrefillList(people);
  }
  renderNewParticipantTags();
}

function selectPrefillChoice(c) {
  prefillChoice = c;
  renderPrefillGroup();
}

function renderPrefillList(people) {
  const list = document.getElementById('prefill-list');
  if (prefillChoice !== 'manual') { list.innerHTML = ''; return; }
  list.innerHTML = people.map(p => {
    const key = safeKey(p.name);
    const checked = !!prefillManualSelected[key];
    return `<label class="signup-row">
      <input type="checkbox" ${checked?'checked':''} data-key="${escapeHTML(key)}" />
      <span class="join-info"><span class="join-name-txt">${escapeHTML(p.name)}</span></span>
    </label>`;
  }).join('');
}

function togglePrefillManual(key) {
  if (prefillManualSelected[key]) delete prefillManualSelected[key];
  else prefillManualSelected[key] = true;
  renderPrefillList(Object.values(eventPeople).sort((a,b)=>(a.joined||0)-(b.joined||0)));
}

// Legger til en helt ny deltaker mens man oppretter turneringen — de er
// alltid med på denne turneringen, uansett alle/ingen/manuelt-valget over,
// siden det å skrive navnet her er en eksplisitt "legg til"-handling.
function addNewParticipant() {
  const input = document.getElementById('new-participant-input');
  const name = input.value.trim();
  if (!name) return;
  const exists = newParticipants.includes(name) || Object.values(eventPeople).some(p=>p.name===name);
  if (exists) { showToast('Allerede lagt til'); return; }
  newParticipants.push(name);
  input.value = '';
  renderNewParticipantTags();
}
document.getElementById('new-participant-input')?.addEventListener('keydown', e=>{
  if (e.key==='Enter') { e.preventDefault(); addNewParticipant(); }
});

function removeNewParticipant(i) {
  newParticipants.splice(i,1);
  renderNewParticipantTags();
}

function renderNewParticipantTags() {
  document.getElementById('new-participant-tags').innerHTML = newParticipants.map((name,i) =>
    `<div class="player-tag">${escapeHTML(name)}<button onclick="removeNewParticipant(${i})">×</button></div>`
  ).join('');
}

function renderFormatGrid() {
  document.getElementById('format-grid').innerHTML = Object.keys(FORMATS).map(f => `
    <button class="mode-btn ${f===selectedFormat?'selected':''}" onclick="selectFormat('${f}')">
      <span class="mode-btn-icon">${FORMATS[f].icon}</span>
      <span class="mode-btn-label">${FORMATS[f].label}</span>
    </button>`).join('');
  // Poengtavla har ingen kamper, så resultatsystem er ikke relevant der
  document.getElementById('mode-group').style.display = selectedFormat==='board' ? 'none' : 'block';
  renderScoreDirGrid();
}
function selectFormat(f) { selectedFormat = f; renderFormatGrid(); }

function renderScoreDirGrid() {
  // Retningen betyr noe når det finnes en score å rangere på
  const relevant = selectedFormat==='board' || selectedMode==='score';
  document.getElementById('scoredir-group').style.display = relevant ? 'block' : 'none';
  if (!relevant) return;
  document.getElementById('scoredir-grid').innerHTML = Object.keys(SCORE_DIRS).map(d => `
    <button class="mode-btn ${d===selectedScoreDir?'selected':''}" onclick="selectScoreDir('${d}')">
      <span class="mode-btn-icon">${SCORE_DIRS[d].icon}</span>
      <span class="mode-btn-label">${SCORE_DIRS[d].label}</span>
    </button>`).join('');
}
function selectScoreDir(d) { selectedScoreDir = d; renderScoreDirGrid(); }

function renderModeGrid() {
  const sport = SPORTS.find(s=>s.id===selectedSport);
  document.getElementById('mode-grid').innerHTML = sport.modes.map(m => `
    <button class="mode-btn ${m===selectedMode?'selected':''}" onclick="selectMode('${m}')">
      <span class="mode-btn-icon">${MODES[m].icon}</span>
      <span class="mode-btn-label">${MODES[m].label}</span>
    </button>`).join('');
}

function selectMode(m) { selectedMode = m; renderModeGrid(); renderScoreDirGrid(); }

// ===== NAVIGATION =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== HOME =====
function boot() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('e');
  const tId = params.get('t');
  const display = params.get('display');

  if (display && eventId) {
    loadDisplayScreen(eventId);
  } else if (eventId) {
    loadEvent(eventId, tId);
  } else {
    showScreen('screen-home');
  }
}


function joinEvent() {
  const val = document.getElementById('join-code').value.trim();
  const errEl = document.getElementById('join-error');
  errEl.style.display = 'none';

  // Extract UUID from URL or raw code
  const match = val.match(/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  if (!match) { errEl.textContent = 'Ugyldig link eller kode.'; errEl.style.display = 'block'; return; }
  window.location.href = window.location.pathname + '?e=' + match[0];
}

// ===== CREATE EVENT =====
async function doCreateEvent() {
  const name = document.getElementById('event-name').value.trim();
  const desc = document.getElementById('event-desc').value.trim();
  const errEl = document.getElementById('event-name-error');
  if (!name) { errEl.textContent = 'Skriv inn et navn'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  const btn = document.getElementById('create-event-btn');
  btn.disabled = true; btn.textContent = 'Oppretter…';
  const id = uuid();
  try {
    await db.ref('events/'+id+'/meta').set({ name, desc, created: Date.now() });
  } catch (err) {
    errEl.textContent = 'Kunne ikke opprette event. Sjekk nettforbindelsen og prøv igjen.';
    errEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Opprett event';
    return;
  }
  window.location.href = window.location.pathname + '?e=' + id;
}

// ===== DELTAKERE =====
// Ingen innlogging, ingen "identitet": alle kan melde på alle, når som helst.
// eventPeople er bare en rullerende liste over navn som er brukt i eventet,
// til bruk når man skal velge deltakere for en ny turnering.
let eventPeople = {};

// ===== LOAD EVENT =====
let currentEventId = null;
let eventMeta = {};
let tournaments = {};
let eventRef = null;
let peopleRef = null;

async function loadEvent(eventId, focusTId) {
  currentEventId = eventId;
  if (peopleRef) peopleRef.off();

  // Uten dette sto brukeren på en tom forside uten et ord — både når nettet er
  // tregt og når reglene nekter lesing. Tjue telefoner på gjestenettet er
  // nettopp der dette merkes.
  const errEl = document.getElementById('home-error');
  if (errEl) errEl.style.display = 'none';   // et nytt forsøk skal ikke vise forrige feil
  setLoading('Laster event…');
  let meta = null;
  try {
    const snap = await db.ref('events/'+eventId+'/meta').once('value');
    meta = snap.val();
  } catch (err) {
    setLoading(null);
    showEventError('Fikk ikke kontakt med basen. Sjekk nettet og prøv igjen.');
    return;
  }
  setLoading(null);
  if (!meta) {
    showEventError('Event ikke funnet. Sjekk at linken er hel.');
    return;
  }
  eventMeta = meta;
  document.getElementById('event-title').textContent = meta.name;
  document.getElementById('event-desc-display').textContent = meta.desc || '';
  document.title = meta.name + ' · dCup';

  peopleRef = db.ref('events/'+eventId+'/people');
  peopleRef.on('value', snap => {
    eventPeople = snap.val() || {};
    peopleSeen = true;
    renderPeopleCount();
    syncPeopleFromTournaments();
    // Står man i turneringsoppsettet skal hakelista få med seg at noen ble
    // lagt til på eventet fra en annen telefon.
    if (currentTId) renderTPeoplePick();
  });

  eventRef = db.ref('events/'+eventId+'/tournaments');
  setSyncStatus('connecting', 'event');
  eventRef.on('value', snap => {
    tournaments = snap.val() || {};
    tournamentsSeen = true;
    setSyncStatus('live', 'event');
    renderTournamentList();
    syncPeopleFromTournaments();
    // Bare ved første snapshot. Callbacken fyrer på hver endring i eventet, så
    // uten dette ble man kastet tilbake til «Grupper» hver gang noen
    // registrerte et resultat — og dratt inn i turneringen igjen etter «Event».
    if (focusTId && tournaments[focusTId]) {
      const tid = focusTId;
      focusTId = null;
      openTournament(tid);
    }
  }, () => setSyncStatus('offline', 'event'));

  showScreen('screen-event');
  updateEventURL(eventId);
}

// Ventetilstand og feilmelding på forsiden, i stedet for alert() og stillhet.
function setLoading(msg) {
  const el = document.getElementById('home-loading');
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}
function showEventError(msg) {
  showScreen('screen-home');
  const el = document.getElementById('home-error');
  if (!el) { showToast(msg); return; }
  el.textContent = msg;
  el.style.display = 'block';
}

function updateEventURL(eventId) {
  const url = new URL(window.location.href);
  url.searchParams.set('e', eventId);
  url.searchParams.delete('t');
  url.searchParams.delete('display');
  window.history.replaceState({}, '', url.toString());
}

function renderTournamentList() {
  const list = document.getElementById('tournament-list');
  const entries = sortedTournaments(tournaments);
  if (!entries.length) {
    list.innerHTML = '<div class="muted" style="text-align:center;padding:1rem;">Ingen turneringer ennå. Legg til en!</div>';
    return;
  }
  list.innerHTML = entries.map(([id, t]) => {
    const sport = SPORTS.find(s=>s.id===t.sport)||SPORTS[SPORTS.length-1];
    const done = isFinished(t);
    let progress;
    if (isBoard(t)) {
      const players = t.players || [];
      const scored = players.filter(n => typeof ((t.scores||{})[safeKey(n)]||{}).score === 'number').length;
      progress = players.length ? `${scored}/${players.length} score` : 'Sett opp';
    } else {
      const gs = groupsOf(t);
      const played = gs.reduce((n,g)=>n+Object.values(g.results).filter(r=>r.winner).length, 0);
      const total = gs.reduce((n,g)=>n+g.fixtures.length, 0);
      progress = total ? `${played}/${total} spilt` : 'Sett opp';
    }
    return `<div class="tournament-card" onclick="openTournament('${id}')">
      <span class="tc-icon">${sport.icon}</span>
      <div class="tc-info">
        <div class="tc-name">${escapeHTML(t.name)}</div>
        <div class="tc-meta">${sport.label} · ${MODES[t.mode]?.label||t.mode}</div>
      </div>
      <span class="tc-badge ${done?'':'pending'}">${done?'Ferdig':progress}</span>
    </div>`;
  }).join('');
}

// Skriver til players-lista med transaksjon: tjue mobiler som melder seg på
// samtidig skal ikke overskrive hverandre slik set(hele turneringen) ville.
//
// Og til people/: dette er det ene stedet alle veier inn i en turnering går
// gjennom (påmeldingsdialogen, spillerfeltet i «ny turnering», poengtavla), så
// det er her personen blir kjent for eventet. Sto den skrivingen bare i
// saveJoin, havnet alle som ble lagt til inne fra en turnering i players uten å
// finnes i «Deltakere» — som er nøyaktig det som skjedde: eventet hadde én
// person i people og resten bare i turneringene.
//
// Avmelding fjerner ikke fra people. Du er på eventet selv om du hopper av en
// konkurranse; å bli slettet fra deltakerlista er noe man gjør bevisst der.
async function setSignup(tid, name, join) {
  const ref = db.ref('events/'+currentEventId+'/tournaments/'+tid+'/players');
  try {
    await ref.transaction(list => {
      const arr = Array.isArray(list) ? list : [];
      // undefined avbryter transaksjonen: ingen skriving når ingenting endres,
      // slik at den kan kalles for alle turneringer uten å røre dem alle
      if (join) return arr.includes(name) ? undefined : [...arr, name];
      return arr.includes(name) ? arr.filter(p => p !== name) : undefined;
    });
    if (join) await upsertPerson(name);
  } catch (err) {
    showToast('Kunne ikke lagre påmeldingen — prøv igjen');
  }
}

// joined settes bare første gang: den er sorteringsnøkkel for deltakerlista, og
// en som melder seg på turnering nummer to skal ikke hoppe til bunnen.
function upsertPerson(name) {
  return db.ref('events/'+currentEventId+'/people/'+safeKey(name))
    .transaction(cur => cur && cur.joined ? { ...cur, name } : { name, joined: Date.now() });
}

// Alle navn som finnes i en turnering, uansett hvor de står. Etter trekningen
// ligger de i gruppene, ikke i players.
function namesInTournament(t) {
  const out = new Set(t.players || []);
  groupsOf(t).forEach(g => g.players.forEach(n => out.add(n)));
  Object.values(t.scores || {}).forEach(sc => { if (sc && sc.name) out.add(sc.name); });
  return out;
}

// Reparerer eventer som ble laget før setSignup skrev til people/: navn som
// står i en turnering, men mangler i deltakerlista, legges inn. Idempotent, så
// den kan kjøre på hvert snapshot og fra alle klienter samtidig — den skriver
// bare når noe faktisk mangler.
let peopleSeen = false, tournamentsSeen = false;
function syncPeopleFromTournaments() {
  if (!peopleSeen || !tournamentsSeen || !currentEventId) return;
  const missing = new Set();
  Object.values(tournaments).forEach(t =>
    namesInTournament(t).forEach(n => { if (n && !eventPeople[safeKey(n)]) missing.add(n); }));
  missing.forEach(n => upsertPerson(n).catch(() => {}));
}

function renderPeopleCount() {
  const btn = document.getElementById('people-count-btn');
  if (btn) btn.textContent = '👥 ' + Object.keys(eventPeople).length;
}

function showPeopleDialog() {
  renderPeopleList();
  document.getElementById('people-overlay').style.display = 'flex';
  lockBodyScroll();
}
function hidePeopleDialog() { document.getElementById('people-overlay').style.display = 'none'; unlockBodyScroll(); }

// Turneringene der navnet er låst fast. Etter trekningen ligger navnet i
// gruppene, kampoppsettet og resultatnøklene, ikke bare i players — fjerner vi
// det bare fra players, står personen igjen i tabellen og i kampkøen uten å
// være deltaker lenger.
//
// Gjelder bare gruppespill. En poengtavle har ingen trekning (det er derfor
// isSignupLocked er usann der), og folk skal fortsatt kunne komme og gå.
function lockedTournamentsFor(name) {
  return sortedTournaments(tournaments)
    .filter(([, t]) => isSignupLocked(t) && tournamentHasName(t, name))
    .map(([, t]) => t.name || 'turnering uten navn');
}

function renderPeopleList() {
  const people = Object.values(eventPeople).sort((a,b)=>(a.joined||0)-(b.joined||0));
  const wrap = document.getElementById('people-list');
  if (!people.length) { wrap.innerHTML = '<p class="muted">Ingen deltakere ennå.</p>'; return; }
  wrap.innerHTML = people.map(p => {
    const sports = sortedTournaments(tournaments)
      .filter(([, t]) => (t.players||[]).includes(p.name))
      .map(([, t]) => (SPORTS.find(s=>s.id===t.sport)||SPORTS[SPORTS.length-1]).icon);
    const key = safeKey(p.name);
    const locked = lockedTournamentsFor(p.name);
    return `<label class="signup-row" style="cursor:default;">
      <span class="join-icon">🙋</span>
      <button class="join-info" data-act="tournaments" data-key="${escapeHTML(key)}"
              title="Endre hvilke turneringer ${escapeHTML(p.name)} er med i">
        <span class="join-name-txt">${escapeHTML(p.name)}</span>
        <span class="join-sub">${sports.length ? sports.join(' ') + ' · endre' : 'Ingen turneringer — trykk for å melde på'}</span>
      </button>
      <button class="board-edit" title="Rediger navn" data-act="rename" data-key="${escapeHTML(key)}">✏️</button>
      ${locked.length
        ? `<button class="people-lock" data-act="locked" data-key="${escapeHTML(key)}"
             title="Med i ${escapeHTML(locked.join(', '))} — kan ikke fjernes">🔒</button>`
        : `<button class="board-del" title="Fjern deltaker" data-act="remove" data-key="${escapeHTML(key)}">×</button>`}
    </label>`;
  }).join('');
}

// Navnet går via data-key og dataset, aldri gjennom en JS-streng i en
// HTML-attributt. safeKey escaper ikke ' eller ", så «O'Brien» drepte knappen
// og et navn som «x');kode;('» kjørte kode ved klikk.
document.getElementById('people-list')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  if (btn.dataset.act === 'tournaments') openParticipation(btn.dataset.key);
  else if (btn.dataset.act === 'rename') renamePerson(btn.dataset.key);
  else if (btn.dataset.act === 'remove') removePerson(btn.dataset.key);
  // Låsen er en knapp og ikke bare et ikon, slik at den kan trykkes: på mobil
  // finnes ingen hover, så en title alene ville aldri forklart noe.
  else if (btn.dataset.act === 'locked') {
    const p = eventPeople[btn.dataset.key];
    const t = p ? lockedTournamentsFor(p.name)[0] : null;
    showToast(t ? `Låst i «${t}» — turneringen er startet` : 'Kan ikke fjernes');
  }
});
document.getElementById('prefill-list')?.addEventListener('change', e => {
  const box = e.target.closest('input[data-key]');
  if (box) togglePrefillManual(box.dataset.key);
});

// Fjerner personen fra eventet og fra players-lista i alle turneringer de er
// med i — ellers ville de stått igjen som spiller uten å være i deltakerlista.
async function removePerson(key) {
  const p = eventPeople[key];
  if (!p) return;

  // Sjekkes her og ikke bare når lista tegnes: en annen telefon kan ha startet
  // turneringen mens deltakerlista sto åpen.
  const locked = lockedTournamentsFor(p.name);
  if (locked.length) {
    showToast(`Låst i «${locked[0]}» — turneringen er startet`);
    renderPeopleList();
    return;
  }

  if (!confirm(`Fjerne ${p.name}? De fjernes også fra turneringene de er med i.`)) return;
  try {
    // Én transaksjon per turnering. Tidligere ble players-listene regnet ut fra
    // den lokale kopien og skrevet blindt, så en påmelding som landet i samme
    // øyeblikk forsvant.
    for (const tid of Object.keys(tournaments)) {
      await setSignup(tid, p.name, false);
    }
    // Poengtavle-scoren ligger under sin egen nøkkel og følger ikke med når
    // navnet fjernes fra players. Uten dette ble den liggende usynlig igjen —
    // og dukket opp som en gammel score hvis navnet ble lagt til på nytt.
    const scoreUpdates = {};
    Object.entries(tournaments).forEach(([tid, t]) => {
      if ((t.scores || {})[safeKey(p.name)]) {
        scoreUpdates['events/'+currentEventId+'/tournaments/'+tid+'/scores/'+safeKey(p.name)] = null;
      }
    });
    if (Object.keys(scoreUpdates).length) await db.ref().update(scoreUpdates);
    await db.ref('events/'+currentEventId+'/people/'+key).set(null);
    showToast('Deltaker fjernet');
    renderPeopleList();
  } catch (err) {
    showToast('Kunne ikke fjerne — prøv igjen');
  }
}

// Bytter ut ett navn med et annet overalt det forekommer i en turnering:
// spillerliste, grupper, kamper, resultater (som har navnet i selve nøkkelen
// via fkey) og poengtavle-scorer (som har navnet som Firebase-nøkkel). En
// omdøping berører altså mange sammenhengende felt på én gang, så den går
// via en transaksjon på hele turneringsdokumentet i stedet for enkeltfelt.
// Alle stedene et navn kan forekomme i en turnering.
function tournamentHasName(t, name) {
  if ((t.players||[]).includes(name)) return true;
  const gs = groupsOf(t);
  if (gs.some(g => g.players.includes(name))) return true;
  const inResults = r => Object.values(r||{}).some(x => x.home===name || x.away===name);
  if (gs.some(g => inResults(g.results))) return true;
  return Object.values(t.scores||{}).some(sc => sc.name===name);
}

function renameInTournament(t, oldName, newName) {
  const swap = n => n === oldName ? newName : n;
  const swapFixtures = arr => Array.isArray(arr) ? arr.map(f => [swap(f[0]), swap(f[1])]) : arr;
  const swapResults = results => {
    if (!results) return results;
    const out = {};
    Object.entries(results).forEach(([, r]) => {
      const renamed = { ...r, home: swap(r.home), away: swap(r.away), loser: r.loser ? swap(r.loser) : r.loser };
      out[fkey([renamed.home, renamed.away])] = renamed;
    });
    return out;
  };
  const next = { ...t };
  if (Array.isArray(t.players)) next.players = t.players.map(swap);
  if (t.groups) next.groups = groupsOf(t).map(g => ({
    name: g.name,
    players: g.players.map(swap),
    fixtures: swapFixtures(g.fixtures),
    results: swapResults(g.results),
  }));
  if (t.playoffResults) {
    const out = {};
    Object.entries(t.playoffResults).forEach(([k, r]) => {
      // home/away er navn, ikke sider — playoffWinner leser dem rett ut. Uten
      // at de også byttes, sto det gamle navnet igjen som finalevinner.
      out[k] = {
        ...r,
        home: r.home !== undefined ? swap(r.home) : r.home,
        away: r.away !== undefined ? swap(r.away) : r.away,
        loser: r.loser ? swap(r.loser) : r.loser,
      };
    });
    next.playoffResults = out;
  }
  if (t.tiebreaks) {
    // Nøkkelen er laget av navnene i klyngen, så den må regnes ut på nytt —
    // ellers ville avgjørelsen blitt liggende under en nøkkel ingen slår opp.
    const out = {};
    Object.entries(t.tiebreaks).forEach(([gk, cluster]) => {
      const g = {};
      Object.values(cluster || {}).forEach(order => {
        if (!Array.isArray(order)) return;
        const renamed = order.map(swap);
        g[tieKey(renamed)] = renamed;
      });
      out[gk] = g;
    });
    next.tiebreaks = out;
  }
  if (t.scores) {
    const out = {};
    Object.entries(t.scores).forEach(([key, s]) => {
      const renamedKey = s.name === oldName ? safeKey(newName) : key;
      out[renamedKey] = s.name === oldName ? { ...s, name: newName } : s;
    });
    next.scores = out;
  }
  return next;
}

async function renamePerson(oldKey) {
  const p = eventPeople[oldKey];
  if (!p) return;
  const input = prompt('Nytt navn:', p.name);
  if (input === null) return;
  const newName = input.trim();
  if (!newName || newName === p.name) return;
  // Må sjekke turneringene også: addTPlayer og addBoardPlayer skriver bare til
  // turneringens players, aldri til people. Et navn lagt til i oppsettet er
  // usynlig for eventPeople, og en omdøping kunne dermed lage to like navn i
  // samme gruppe — da kolliderer fkey og de to kampene deler resultatnøkkel.
  const collides = Object.values(eventPeople).some(x => x.name === newName)
    || Object.values(tournaments).some(t => tournamentHasName(t, newName));
  if (collides) {
    showToast('Navnet er allerede i bruk');
    return;
  }
  const newKey = safeKey(newName);
  const peopleUpdates = {};
  peopleUpdates['events/'+currentEventId+'/people/'+oldKey] = null;
  peopleUpdates['events/'+currentEventId+'/people/'+newKey] = { name: newName, joined: p.joined || Date.now() };

  // Navnet kan ligge i gruppe, kampoppsett, resultatnøkler og scorer selv om
  // det er fjernet fra players — da må turneringen likevel med.
  const affectedTids = Object.entries(tournaments)
    .filter(([, t]) => tournamentHasName(t, p.name))
    .map(([tid]) => tid);

  try {
    // Turneringene først, deltakerlista sist. Feiler noe underveis, står lista
    // igjen med det gamle navnet — og da finner et nytt forsøk den fortsatt.
    // Motsatt rekkefølge gjorde en halvveis omdøping umulig å rette opp.
    for (const tid of affectedTids) {
      await db.ref('events/'+currentEventId+'/tournaments/'+tid).transaction(current => {
        if (!current) return current;
        return renameInTournament(current, p.name, newName);
      });
    }
    await db.ref().update(peopleUpdates);
    showToast('Navn oppdatert');
    renderPeopleList();
  } catch (err) {
    showToast('Kunne ikke oppdatere navn — prøv igjen');
  }
}

// ===== ENDRE PÅMELDING =====
// Egen dialog i stedet for å gjøre saveJoin toveis: «meld på» er additiv med
// vilje — der skal det å legge til én person aldri kunne fjerne dem fra noe
// annet. Her er hele poenget å kunne krysse av og bort.
//
// Startede turneringer kan verken krysses av eller bort: trekningen er gjort,
// så et nytt navn havner ikke i noen gruppe, og et fjernet navn ville stått
// igjen i gruppa, kampoppsettet og resultatene (samme grunn som 🔒 i lista).
let partCtx = null;

// Drill-down fra deltakerlista, ikke et ark oppå. Før dette ble begge stående
// åpne samtidig — og siden participation-overlay ligger før people-overlay i
// DOM-en og begge har z-index 500, havnet det nye arket bak det gamle.
let partFromPeople = false;

function openParticipation(key) {
  const p = eventPeople[key];
  if (!p) return;
  partCtx = { key, name: p.name };
  document.getElementById('participation-sub').textContent =
    `Velg hvilke turneringer ${p.name} skal være med i.`;
  renderParticipationList();

  // Deltakerlista skjules uten å slippe scroll-låsen eller historikk-
  // oppføringen: det er samme ark-plass, så låsen skal bare tas én gang.
  const people = document.getElementById('people-overlay');
  partFromPeople = !!people && people.style.display !== 'none' && people.style.display !== '';
  if (partFromPeople) people.style.display = 'none';

  document.getElementById('participation-overlay').style.display = 'flex';
  if (!partFromPeople) lockBodyScroll();
}

function hideParticipation() {
  partCtx = null;
  document.getElementById('participation-overlay').style.display = 'none';
  if (partFromPeople) {
    // Tilbake til deltakerlista, med ikonene oppdatert etter endringen
    partFromPeople = false;
    renderPeopleList();
    document.getElementById('people-overlay').style.display = 'flex';
  } else {
    unlockBodyScroll();
  }
}

function renderParticipationList() {
  if (!partCtx) return;
  const entries = sortedTournaments(tournaments);
  const wrap = document.getElementById('participation-list');
  if (!entries.length) {
    wrap.innerHTML = '<p class="muted">Ingen turneringer ennå.</p>';
    return;
  }
  wrap.innerHTML = entries.map(([id, t]) => {
    const sport = SPORTS.find(s=>s.id===t.sport)||SPORTS[SPORTS.length-1];
    const locked = isSignupLocked(t);
    const inIt = (t.players||[]).includes(partCtx.name);
    return `<label class="signup-row${locked?' locked':''}">
      <input type="checkbox" data-tid="${id}" ${inIt?'checked':''} ${locked?'disabled':''} />
      <span class="join-icon">${sport.icon}</span>
      <span class="join-info">
        <span class="join-name-txt">${escapeHTML(t.name)}</span>
        <span class="join-sub">${sport.label}${locked?(inIt?' · startet, kan ikke meldes av':' · startet, stengt'):''}</span>
      </span>
    </label>`;
  }).join('');
}

// Skriver bare der avkryssingen faktisk er endret. setSignup er en transaksjon
// per turnering, så to som endrer samtidig ikke overskriver hverandre.
async function saveParticipation() {
  if (!partCtx) return;
  const name = partCtx.name;
  const btn = document.getElementById('participation-save-btn');
  btn.disabled = true; btn.textContent = 'Lagrer…';
  let added = 0, removed = 0, skipped = 0;
  for (const box of document.querySelectorAll('#participation-list input[type=checkbox]')) {
    if (box.disabled) continue;
    const t = tournaments[box.dataset.tid];
    if (!t) continue;
    // Sjekkes på nytt: turneringen kan ha blitt startet mens dialogen sto åpen
    if (isSignupLocked(t)) { skipped++; continue; }
    const isIn = (t.players||[]).includes(name);
    if (box.checked === isIn) continue;
    await setSignup(box.dataset.tid, name, box.checked);
    if (box.checked) added++; else removed++;
  }
  btn.disabled = false; btn.textContent = 'Lagre';
  const parts = [];
  if (added) parts.push(`meldt på ${added}`);
  if (removed) parts.push(`meldt av ${removed}`);
  if (skipped) parts.push(`${skipped} rakk å starte`);
  showToast(parts.length ? parts.join(' · ') : 'Ingen endring');
  hideParticipation();
  renderPeopleList();
}

function showJoinDialog() {
  document.getElementById('join-name').value = '';
  document.getElementById('join-name-error').style.display = 'none';
  renderJoinList();
  document.getElementById('join-overlay').style.display = 'flex';
  lockBodyScroll();
  // P2 #31: å skrive navnet sitt er hele poenget med denne dialogen, så feltet
  // skal ha fokus. Bare her — i «ny turnering» ville tastaturet dekket
  // sportsvalget og deltakerlista med en gang.
  document.getElementById('join-name').focus();
}
function hideJoinDialog() { document.getElementById('join-overlay').style.display = 'none'; unlockBodyScroll(); }

// Alle turneringer er haket av som standard — man klikker bort de man ikke
// vil melde denne personen på.
function renderJoinList() {
  const entries = sortedTournaments(tournaments);
  const wrap = document.getElementById('join-list');
  if (!entries.length) {
    wrap.innerHTML = '<p class="muted">Ingen turneringer å melde seg på ennå.</p>';
    return;
  }
  wrap.innerHTML = entries.map(([id, t]) => {
    const sport = SPORTS.find(s=>s.id===t.sport)||SPORTS[SPORTS.length-1];
    // Startede turneringer er sperret: trekningen er gjort, så et nytt navn i
    // players havner ikke i noen gruppe og ville stått som påmeldt uten å
    // finnes i tabellen, kampene eller oppsettet.
    const started = isSignupLocked(t);
    return `<label class="signup-row${started?' locked':''}">
      <input type="checkbox" data-tid="${id}" ${started?'disabled':'checked'} />
      <span class="join-icon">${sport.icon}</span>
      <span class="join-info">
        <span class="join-name-txt">${escapeHTML(t.name)}</span>
        <span class="join-sub">${sport.label}${started?' · startet':''}</span>
      </span>
    </label>`;
  }).join('');
}

// Alltid additivt: legger navnet til i de valgte turneringene, fjerner aldri
// noen. Alle kan melde på alle, når som helst — ingen identitet å holde styr på.
async function saveJoin() {
  const input = document.getElementById('join-name');
  const name = input.value.trim();
  const errEl = document.getElementById('join-name-error');
  if (!name) { errEl.textContent = 'Skriv inn et navn'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';

  const btn = document.getElementById('join-save-btn');
  btn.disabled = true; btn.textContent = 'Lagrer…';

  try {
    await upsertPerson(name);
    for (const box of document.querySelectorAll('#join-list input[type=checkbox]')) {
      if (box.disabled || !box.checked) continue;
      // Sjekkes på nytt her: turneringen kan ha blitt startet mens dialogen sto åpen
      if (isSignupLocked(tournaments[box.dataset.tid] || {})) continue;
      await setSignup(box.dataset.tid, name, true);
    }
    showToast('Lagt til!');
    hideJoinDialog();
  } catch (err) {
    showToast('Kunne ikke lagre — prøv igjen');
  }
  btn.disabled = false; btn.textContent = 'Lagre';
}

function copyEventLink() {
  const url = window.location.origin + window.location.pathname + '?e=' + currentEventId;
  // navigator.clipboard mangler i flere innebygde nettlesere — Slack, Teams,
  // Facebook, LinkedIn — altså nettopp der en link til et firmaarrangement
  // åpnes. Uten catch kastet den, og brukeren fikk ingen beskjed i det hele
  // tatt. Reserveløsningen viser linken slik at den kan markeres og kopieres.
  const clip = navigator.clipboard;
  if (!clip || !clip.writeText) { showLinkFallback(url); return; }
  clip.writeText(url)
    .then(() => showToast('Link kopiert!'))
    .catch(() => showLinkFallback(url));
}

function showLinkFallback(url) {
  const box = document.getElementById('link-fallback');
  const field = document.getElementById('link-fallback-url');
  if (!box || !field) { showToast(url); return; }
  field.value = url;
  box.style.display = 'block';
  field.focus();
  field.select();
}
function hideLinkFallback() {
  const box = document.getElementById('link-fallback');
  if (box) box.style.display = 'none';
}

// ===== ADD TOURNAMENT =====
function showAddTournament() {
  selectedSport = 'pingpong'; selectedMode = 'wl';
  selectedFormat = 'groups'; selectedScoreDir = 'high';
  prefillChoice = 'all'; prefillManualSelected = {}; newParticipants = [];
  renderSportGrid();
  renderFormatGrid();
  renderPrefillGroup();
  document.getElementById('t-name').value = '';
  document.getElementById('new-participant-input').value = '';
  const overlay = document.getElementById('add-tournament-overlay');
  overlay.style.display = 'flex';
  lockBodyScroll();
}
function hideAddTournament() {
  document.getElementById('add-tournament-overlay').style.display = 'none';
  unlockBodyScroll();
}

async function addTournament() {
  const name = document.getElementById('t-name').value.trim() ||
    SPORTS.find(s=>s.id===selectedSport)?.label || 'Turnering';
  const id = uuid();
  let players = [];
  if (prefillChoice === 'all') {
    players = Object.values(eventPeople).map(p=>p.name);
  } else if (prefillChoice === 'manual') {
    players = Object.values(eventPeople).filter(p=>prefillManualSelected[safeKey(p.name)]).map(p=>p.name);
  }
  newParticipants.forEach(n => { if (!players.includes(n)) players.push(n); });

  // Bevisst IKKE auto-generert: selv med nok spillere skal man alltid
  // innom oppsettsiden og trykke "Generer grupper" selv — det gir rom
  // for at flere kan melde seg på før turneringen faktisk settes i gang.
  const updates = {};
  updates['events/'+currentEventId+'/tournaments/'+id] = {
    name, sport: selectedSport,
    mode: selectedFormat==='board' ? 'score' : selectedMode,
    format: selectedFormat, scoreDir: selectedScoreDir,
    players,
    playoffResults:{}, scores:{}, created: Date.now()
  };
  newParticipants.forEach(n => {
    updates['events/'+currentEventId+'/people/'+safeKey(n)] = { name: n, joined: Date.now() };
  });

  // Uten dette ga et dobbeltklikk to turneringer (id-en lages på nytt hver
  // gang), og en feilet skriving offline ga en uhåndtert rejection: modalen ble
  // stående uten et eneste tegn på at ingenting var lagret.
  const btn = document.getElementById('add-tournament-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Oppretter…'; }
  try {
    await db.ref().update(updates);
  } catch (err) {
    if (btn) { btn.disabled = false; btn.textContent = 'Opprett'; }
    showToast('Kunne ikke opprette — prøv igjen');
    return;
  }
  if (btn) { btn.disabled = false; btn.textContent = 'Opprett'; }
  hideAddTournament();
  openTournament(id);
}

// ===== TOURNAMENT VIEW =====
let currentTId = null;
let tState = {};
let tRef = null;

function openTournament(id) {
  currentTId = id;
  tState = JSON.parse(JSON.stringify(tournaments[id] || {}));
  const sport = SPORTS.find(s=>s.id===tState.sport)||SPORTS[SPORTS.length-1];
  document.getElementById('t-view-name').textContent = tState.name || '';
  document.getElementById('t-view-sport').textContent = sport.icon + ' ' + sport.label;
  document.getElementById('t-scoring-hint').textContent = MODES[tState.mode]?.hint || '';
  // P2 #15: setAttribute('value','') endrer bare default-verdien og tømmer
  // ikke et felt noen har skrevet i — navnet ble stående når man byttet
  // turnering.
  const boardInput = document.getElementById('t-board-input');
  if (boardInput) boardInput.value = '';

  // pushState, ikke replaceState: tilbakeknappen skal føre til eventskjermen.
  // Appen brukte bare replaceState, så «tilbake» hoppet helt ut av eventet og
  // landet på forsiden — og tilbake er den mest brukte bevegelsen på telefon.
  const url = new URL(window.location.href);
  url.searchParams.set('t', id);
  if (new URLSearchParams(window.location.search).get('t') === id) {
    window.history.replaceState({ screen:'tournament', t:id }, '', url.toString());
  } else {
    window.history.pushState({ screen:'tournament', t:id }, '', url.toString());
  }

  // Live listener
  if (tRef) tRef.off();
  // Settes før lytteren registreres: fyrer den første callbacken med en gang
  // (hurtigbufret verdi), overskrev «Kobler…» det ferske «Live» og prikken ble
  // stående gul på en tilkobling som var i orden.
  setSyncStatus('connecting');
  tRef = db.ref('events/'+currentEventId+'/tournaments/'+id);
  tRef.on('value', snap => {
    const data = snap.val();
    // Uten denne grenen ble skjermen stående med gamle data når turneringen ble
    // slettet, og neste tWrite gjenskapte den i basen — en sletting kunne bli
    // ugjort av hvem som helst som tilfeldigvis sto på skjermen. backToEvent
    // nuller tRef, og det er det som hindrer at update() oppretter noden igjen.
    if (data === null) {
      showToast('Turneringen er slettet');
      backToEvent();
      return;
    }
    if (data) {
      tState = data;
      renderTournamentView();
    }
    setSyncStatus('live');
  }, () => setSyncStatus('offline'));

  showScreen('screen-tournament');
  if (!isBoard(tState)) switchTTab('groups');
}

function backToEvent() {
  if (tRef) tRef.off();
  tRef = null;   // hindrer at tWrite gjenskaper en slettet turnering, se #38
  currentTId = null;
  updateEventURL(currentEventId);
  showScreen('screen-event');
}

// Skriver KUN de feltene som faktisk endrer seg (via tRef.update()) — aldri
// hele tState med ett set(). Et set() av hele objektet kan overskrive noe
// en annen bruker nettopp lagret et annet sted i turneringen (en annen
// kamp, en annen sin score, spillerlista) hvis den lokale kopien er
// akkurat bakpå — se confirmStart() for samme problem løst med
// transaction() der skrivingen faktisk avhenger av gjeldende innhold.
function tWrite(patch) {
  if (!tRef) return;
  tRef.update(patch).catch(() => {
    setSyncStatus('offline');
    showToast('Kunne ikke lagre — prøv igjen');
  });
}

// P2 #14: prikken finnes både på event- og turneringsskjermen, men bare
// turneringens ble oppdatert — eventets sto hardkodet grønn og løy om at alt
// var i orden mens telefonen var frakoblet. Skjermene har hver sin lytter
// (eventet på tournaments-noden, turneringen på sin egen), så de settes hver
// for seg via `where`.
function setSyncStatus(s, where) {
  const dot = document.getElementById(where === 'event' ? 'sync-dot' : 't-sync-dot');
  const label = document.getElementById(where === 'event' ? 'sync-label' : 't-sync-label');
  if (!dot) return;
  if (s==='live') { dot.style.background='#16a34a'; label.textContent='Live'; }
  else if (s==='connecting') { dot.style.background='#d97706'; label.textContent='Kobler…'; }
  else { dot.style.background='#dc2626'; label.textContent='Frakoblet'; }
}

function switchTTab(name) {
  document.querySelectorAll('#screen-tournament .tab').forEach((t,i)=>{
    t.classList.toggle('active',['groups','fixtures','standings','playoffs'][i]===name);
  });
  ['groups','fixtures','standings','playoffs'].forEach(n=>{
    const el = document.getElementById('ttab-'+n);
    if (el) el.style.display = n===name?'block':'none';
  });
}

// ===== PLAYERS =====
// addTPlayer/removeTPlayer bruker setSignup() (samme transaksjonsbaserte
// skriving som "Meld på") i stedet for å sette() hele tState — ellers kunne
// noen som meldte seg på akkurat da bli overskrevet av en lokalt utdatert kopi.
// Lokal tState oppdateres først for umiddelbar tilbakemelding i UI-et.
function addTPlayer() {
  const input = document.getElementById('t-player-input');
  const name = input.value.trim();
  const errEl = document.getElementById('t-player-error');
  if (!name) return;
  if ((tState.players||[]).includes(name)) { errEl.textContent='Navn allerede lagt til'; errEl.style.display='block'; return; }
  errEl.style.display='none';
  tState.players = [...(tState.players||[]), name];
  input.value = '';
  renderTPlayers();
  setSignup(currentTId, name, true);
}

function removeTPlayer(i) {
  const name = tState.players[i];
  tState.players.splice(i,1);
  renderTPlayers();
  if (name !== undefined) setSignup(currentTId, name, false);
}

// Fjerner bare navnene som faktisk sto i lista da du trykket, så en påmelding
// som lander i samme øyeblikk ikke blir slettet med.
function clearTPlayers() {
  const known = [...(tState.players||[])];
  tState.players = [];
  renderTPlayers();
  if (!tRef || !known.length) return;
  tRef.child('players').transaction(list => {
    const arr = Array.isArray(list) ? list : [];
    const next = arr.filter(n => !known.includes(n));
    return next.length === arr.length ? undefined : next;
  }).catch(() => { setSyncStatus('offline'); showToast('Kunne ikke lagre — prøv igjen'); });
}

function renderTPlayers() {
  document.getElementById('t-count').textContent = (tState.players||[]).length;
  const minEl = document.getElementById('t-min');
  if (minEl) minEl.textContent = MIN_GROUP;
  renderTPeoplePick();
}

// Hakelista over hvem som er med i turneringen — den eneste lista i oppsettet
// etter #49. De som er med står øverst under sin egen overskrift, resten under
// «Ikke med», så man ser på ett blikk hvem som spiller *denne* konkurransen
// selv om eventet har mange deltakere.
//
// Skrivefeltet over dekker bare den som ikke finnes på eventet ennå. Den som
// alt er registrert skal slippe å skrive navnet sitt på nytt for hver
// konkurranse — et navn skrevet litt annerledes («Ola» mot «Ola Nordmann») ble
// ellers en ny person med egen rad i deltakerlista.
function renderTPeoplePick() {
  const wrap = document.getElementById('t-people-pick');
  const list = document.getElementById('t-people-list');
  if (!wrap || !list) return;

  // Unionen av eventets deltakere og turneringens spillere. Et navn som nettopp
  // ble skrevet inn ligger i players med en gang, men i people/ først når
  // snapshotet lander — uten unionen ville det forsvunnet i mellomtiden, og det
  // var taggene som dekket det før.
  const joinedBy = new Map();
  Object.values(eventPeople).forEach(p => joinedBy.set(p.name, p.joined || 0));
  (tState.players || []).forEach(n => { if (!joinedBy.has(n)) joinedBy.set(n, Infinity); });

  wrap.style.display = joinedBy.size ? 'block' : 'none';
  list.innerHTML = '';
  if (!joinedBy.size) return;

  // Stabil sortering: påmeldingstidspunkt, så navn. Uten det siste leddet
  // hopper rader rundt under fingeren hver gang noen andre melder seg på.
  // (Infinity minus Infinity er NaN, derfor ulikhetssjekken først.)
  const cmp = (a, b) => (a.joined !== b.joined ? a.joined - b.joined
                                               : a.name.localeCompare(b.name, 'no'));
  const inT = new Set(tState.players || []);
  const alle = [...joinedBy].map(([name, joined]) => ({ name, joined }));
  const med = alle.filter(p => inT.has(p.name)).sort(cmp);
  const ikkeMed = alle.filter(p => !inT.has(p.name)).sort(cmp);

  const overskrift = (tekst, antall) => {
    const h = document.createElement('div');
    h.className = 'pick-group-hdr';
    h.append(tekst + ' ');
    const n = document.createElement('span');
    n.className = 'pick-count';
    n.append('(' + antall + ')');
    h.append(n);
    list.append(h);
  };

  const rad = name => {
    const row = document.createElement('label');
    row.className = 'signup-row';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = inT.has(name);
    // Navnet leses fra closure, ikke fra en indeks: lista tegnes på nytt ved
    // hvert snapshot, så en indeks kunne peke på en annen person i det
    // fingeren treffer. Samme mønster som poengtavla (#9).
    box.addEventListener('change', () => toggleTPerson(name, box.checked));
    const info = document.createElement('span');
    info.className = 'join-info';
    const txt = document.createElement('span');
    txt.className = 'join-name-txt';
    txt.append(name);                       // textContent, aldri innerHTML
    info.append(txt);
    row.append(box, info);
    list.append(row);
  };

  if (med.length) { overskrift('Med i turneringen', med.length); med.forEach(p => rad(p.name)); }
  if (ikkeMed.length) { overskrift('Ikke med', ikkeMed.length); ikkeMed.forEach(p => rad(p.name)); }
}

function toggleTPerson(name, join) {
  const players = tState.players || [];
  if (join && !players.includes(name)) tState.players = [...players, name];
  else if (!join) tState.players = players.filter(n => n !== name);
  renderTPlayers();
  setSignup(currentTId, name, join);
}

document.getElementById('t-player-input')?.addEventListener('keydown', e=>{if(e.key==='Enter')addTPlayer();});
// P2 #16: samme oppførsel i poengtavlas navnefelt, som var det eneste av de
// tre feltene der Enter ikke gjorde noe.
document.getElementById('t-board-input')?.addEventListener('keydown', e=>{if(e.key==='Enter')addBoardPlayer();});

// ===== GENERATE =====
function shuffle(arr) {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function roundRobin(g) {
  const f=[];
  for(let i=0;i<g.length-1;i++) for(let j=i+1;j<g.length;j++) f.push([g[i],g[j]]);
  return scheduledFixtures(f);
}
// Sprer kampene: ingen skal spille flere kamper rett etter hverandre, og alle
// skal ha omtrent like lang pause. Velger hele tiden kampen der begge spillerne
// har hvilt lengst — likt resultat avgjøres av hvem som har spilt minst.
function scheduledFixtures(fixtures) {
  const remaining = shuffle(fixtures);
  const scheduled = [];
  const lastSeen = {}, played = {};
  while (remaining.length) {
    const slot = scheduled.length;
    let bestIdx = 0, bestRest = -1, bestLoad = 0;
    remaining.forEach((f, i) => {
      const rest = Math.min(slot - (lastSeen[f[0]] ?? -99), slot - (lastSeen[f[1]] ?? -99));
      const load = (played[f[0]] || 0) + (played[f[1]] || 0);
      if (rest > bestRest || (rest === bestRest && load < bestLoad)) {
        bestIdx = i; bestRest = rest; bestLoad = load;
      }
    });
    const f = remaining.splice(bestIdx, 1)[0];
    scheduled.push(f);
    lastSeen[f[0]] = lastSeen[f[1]] = slot;
    played[f[0]] = (played[f[0]] || 0) + 1;
    played[f[1]] = (played[f[1]] || 0) + 1;
  }
  return scheduled;
}

// ===== GRUPPER =====
const MIN_GROUP = 3;               // minste spillere per gruppe, og gulv for hele turneringen
const ALLOWED_GROUPS = [1, 2, 4];  // symmetriske brackets. 3 er utelatt: én gruppevinner
                                   // måtte fått walkover til finalen, og den fordelen kan
                                   // ingen regel dele ut rettferdig
const TARGET_MATCHES = 20;         // forslaget sikter på ≤ så mange kamper

// Lovlige valg: symmetrisk bracket OG nok folk til hver gruppe
function allowedGroups(n) {
  return ALLOWED_GROUPS.filter(g => Math.floor(n / g) >= MIN_GROUP);
}
function maxGroups(n) {
  const a = allowedGroups(n);
  return a.length ? a[a.length - 1] : 0;
}
function matchCount(n, g) {
  const q = Math.floor(n / g), r = n % g;
  const c = k => k * (k - 1) / 2;
  return r * c(q + 1) + (g - r) * c(q);
}
function suggestGroups(n) {
  const a = allowedGroups(n);
  return a.find(g => matchCount(n, g) <= TARGET_MATCHES) ?? a[a.length - 1];
}
function groupSizes(n, g) {
  const q = Math.floor(n / g), r = n % g;
  return Array.from({ length: g }, (_, i) => i < r ? q + 1 : q);
}

// Normaliserer bare form: Firebase kan levere en array som objekt med numeriske
// nøkler. Ingen bakoverkompatibilitet — databasen er wipet.
// Invariant: groupsOf(t)[i] svarer til databasestien groups/{i}. Aldri filtrer
// eller reindekser lista, skrivestiene er indeksbaserte.
function groupsOf(t) {
  const g = t.groups;
  if (!g) return [];
  const arr = Array.isArray(g) ? g : Object.keys(g).sort((a,b)=>a-b).map(k => g[k]);
  return arr.map(x => ({
    name: (x && x.name) || '?',
    players: (x && x.players) || [],
    fixtures: (x && x.fixtures) || [],
    results: (x && x.results) || {},
  }));
}
function resultsPath(gi) { return 'groups/' + gi + '/results'; }
function groupName(t, gi) { return (groupsOf(t)[gi] || {}).name || '?'; }

// Fargetone per gruppe. Steg 1 bruker bare to; utvides i steg 4.
const GROUP_TONES = ['accent', 'green', 'amber', 'purple'];
function groupTone(gi) { return GROUP_TONES[gi % GROUP_TONES.length]; }

function computeGroups(players, g) {
  const s = shuffle(players);
  const buckets = Array.from({ length: g }, (_, i) => ({
    // name må alltid være satt: Firebase sletter tomme noder, og en slettet
    // gruppe ville etterlatt hull i indeksene lista er avhengig av.
    name: String.fromCharCode(65 + i), players: [],
  }));
  s.forEach((p, i) => buckets[i % g].players.push(p));
  return buckets.map(b => ({ ...b, fixtures: roundRobin(b.players), results: {} }));
}

// ===== START TURNERING =====
// Antallet grupper velges her, ikke ved opprettelsen: da er deltakerlista ukjent.
async function startTournament() {
  if (!tRef) return;
  // Ferskt fra serveren, ikke tState: den lokale kopien kan være bakpå etter en
  // påmelding fra en annen telefon.
  let players = [];
  try {
    const snap = await tRef.child('players').once('value');
    players = snap.val() || [];
  } catch (err) {
    showToast('Kunne ikke hente deltakerlista — prøv igjen');
    return;
  }
  if (players.length < MIN_GROUP) { showToast(`Trenger minst ${MIN_GROUP} deltakere`); return; }
  showStartDialog(players);
}

let startPlayers = [];
let startChoice = 1;
let startAdvance = null;   // null = standarden for det valgte gruppetallet

function showStartDialog(players) {
  startPlayers = players;
  startChoice = suggestGroups(players.length);
  startAdvance = null;   // null = bruk standarden for det valgte gruppetallet
  renderStartDialog();
  document.getElementById('start-tournament-overlay').style.display = 'flex';
  lockBodyScroll();
}
function hideStartDialog() {
  document.getElementById('start-tournament-overlay').style.display = 'none';
  unlockBodyScroll();
}
function selectStartChoice(g) {
  // Gruppetallet endrer hvilke videre-valg som finnes, så et valg som ikke
  // lenger går opp må falle tilbake til standarden i stedet for å bli med
  // videre og gi en bracket som ikke går i hop.
  if (g !== startChoice) startAdvance = null;
  startChoice = g;
  renderStartDialog();
}
function selectStartAdvance(a) { startAdvance = a; renderStartDialog(); }

// Standarden per gruppetall: to grupper spiller hele plasseringsstigen som før,
// fire grupper sender gruppevinnerne videre som før.
function defaultAdvance(groups) { return groups === 2 ? 'all' : 1; }
function currentAdvance() {
  return startAdvance === null ? defaultAdvance(startChoice) : startAdvance;
}

function renderStartDialog() {
  const n = startPlayers.length;
  const allowed = allowedGroups(n);
  const only = allowed.length === 1;

  document.getElementById('start-sub').textContent = only
    ? `${n} deltakere · ${allowed[0]} gruppe · ${matchCount(n, allowed[0])} kamper — start?`
    : `${n} deltakere er påmeldt`;

  // Navnene, ikke bare tallet: dette er siste sjanse til å se at noen mangler
  document.getElementById('start-players').innerHTML =
    startPlayers.map(p => `<div class="player-tag">${escapeHTML(p)}</div>`).join('');

  // 3 vises ikke i det hele tatt — den er sperret av designet, ikke av antallet.
  // De andre vises deaktivert med grunn, ellers ser knappen bare ødelagt ut.
  document.getElementById('start-choice-group').style.display = only ? 'none' : 'block';
  if (!only) {
    document.getElementById('start-choice-grid').innerHTML = ALLOWED_GROUPS.map(g => {
      const ok = allowed.includes(g);
      const need = g * MIN_GROUP;
      return `<button type="button" class="mode-btn ${g===startChoice?'selected':''}"
        ${ok?'':'disabled'} onclick="selectStartChoice(${g})">
        <span class="mode-btn-icon">${g}</span>
        <span class="mode-btn-label">${g===1?'gruppe':'grupper'}</span>
      </button>`;
    }).join('');
    const sizes = groupSizes(n, startChoice);
    // Grunnen står som tekst, ikke i en title: hover finnes ikke på mobil, og
    // en deaktivert knapp kan ikke trykkes for å avsløre den.
    const blocked = ALLOWED_GROUPS.filter(g => !allowed.includes(g))
      .map(g => `${g} grupper krever minst ${g * MIN_GROUP} deltakere`);
    document.getElementById('start-detail').innerHTML =
      `${sizes.join(' + ')} · ${matchCount(n, startChoice)} kamper`
      + blocked.map(b => `<br><span style="opacity:0.7;">${b}</span>`).join('');
  }

  // Hvor mange som går videre. Bare relevant med minst to grupper — med én
  // gruppe avgjør tabellen alt, og det finnes ikke noe sluttspill.
  const advGroup = document.getElementById('start-advance-group');
  const sizesNow = groupSizes(n, startChoice);
  const advAllowed = allowedAdvance(startChoice, Math.min(...sizesNow));
  advGroup.style.display = startChoice > 1 && advAllowed.length > 1 ? 'block' : 'none';
  if (startChoice > 1 && advAllowed.length > 1) {
    const cur = advAllowed.includes(currentAdvance()) ? currentAdvance() : advAllowed[0];
    document.getElementById('start-advance-grid').innerHTML = advAllowed.map(a => `
      <button type="button" class="mode-btn ${a===cur?'selected':''}"
        onclick="selectStartAdvance(${a==='all'?"'all'":a})">
        <span class="mode-btn-icon">${a==='all'?'∗':a}</span>
        <span class="mode-btn-label">${a==='all'?'alle' : a===1?'vinneren':'beste'}</span>
      </button>`).join('');
    document.getElementById('start-advance-detail').textContent = advanceBlurb(startChoice, cur);
  }

  // En treergruppe uten uavgjort kan ende i en tresykel som ingen innbyrdes
  // regel kan løse. I score-modus sorterer målforskjell først, så der er det
  // ikke noe problem.
  const warn = document.getElementById('start-warning');
  const sizes = groupSizes(n, startChoice);
  const small = sizes.indexOf(MIN_GROUP);
  if (small !== -1 && (tState.mode === 'wl' || tState.mode === 'wdl')) {
    warn.style.display = 'block';
    warn.textContent = `⚠️ Gruppe ${String.fromCharCode(65 + small)} får ${MIN_GROUP} spillere. `
      + `Ved ${MODES[tState.mode].label} kan tre like resultater ikke skilles sportslig — `
      + `da kan dere avgjøre det selv i tabellen når det skjer.`;
  } else {
    warn.style.display = 'none';
  }
}

// Forklarer valget i klartekst i stedet for å la folk gjette hva «2» betyr.
function advanceBlurb(groups, adv) {
  if (adv === 'all') return 'Hver plass i tabellen møter samme plass i den andre gruppa — alle får en kamp, og hele rekkefølgen avgjøres.';
  const q = groups * adv;
  const round = q === 2 ? 'rett til finale' : q === 4 ? 'semifinaler, finale og bronsekamp'
    : q === 8 ? 'kvartfinaler, semifinaler, finale og bronsekamp' : `${q} i sluttspillet`;
  return (adv === 1 ? 'Gruppevinnerne går videre' : `De ${adv} beste fra hver gruppe går videre`)
    + ` — ${q} spillere, ${round}.`;
}

function confirmStartClicked() { confirmStart(startChoice); }

async function confirmStart(g) {
  const btn = document.getElementById('start-confirm-btn');
  btn.disabled = true; btn.textContent = 'Starter…';
  let rejectedPlayers = null, made = null, res;
  try {
    res = await tRef.transaction(current => {
      if (!current) return current;
      const players = current.players || [];
      // Avbryt bare når valget er blitt ulovlig, ikke fordi tallet har endret
      // seg: 12 → 13 med 4 grupper valgt er helt greit (4/3/3/3).
      if (!allowedGroups(players.length).includes(g)) { rejectedPlayers = players; return; }
      made = players.length;
      const groups = computeGroups(players, g);
      // Valget lagres sammen med gruppene, i samme transaksjon: da kan de ikke
      // komme i utakt om noen melder seg på i samme øyeblikk. advanceCount
      // klemmer det ned igjen hvis gruppene skulle bli mindre enn valget
      // forutsatte. tiebreaks nullstilles — de gjaldt den forrige trekningen.
      const adv = startAdvance === null ? defaultAdvance(g) : startAdvance;
      return { ...current, groups, advance: adv, playoffResults: {}, tiebreaks: null };
    });
  } catch (err) {
    btn.disabled = false; btn.textContent = 'Start';
    showToast('Kunne ikke starte — prøv igjen');
    return;
  }
  btn.disabled = false; btn.textContent = 'Start';

  if (rejectedPlayers !== null) {
    // Tegn dialogen på nytt med den ferske lista fra transaksjonen. Uten dette
    // sto den med knappene fra det gamle antallet og det nå ulovlige valget
    // fortsatt aktivt, så «velg på nytt» ga samme avvisning i evig løkke.
    startPlayers = rejectedPlayers;
    startChoice = suggestGroups(rejectedPlayers.length);
    renderStartDialog();
    showToast(`${rejectedPlayers.length} deltakere nå — velg på nytt`);
    return;
  }
  // Avbrutt av en annen grunn enn et ulovlig valg — turneringen forsvant mens
  // dialogen sto åpen. Uten denne falt koden gjennom til suksessgrenen og
  // meldte «0 kamper».
  if (!res || !res.committed) { showToast('Kunne ikke starte — prøv igjen'); return; }

  hideStartDialog();
  showToast(`${g} ${g===1?'gruppe':'grupper'} · ${matchCount(made, g)} kamper`);
}

function resetTournament() {
  if (!confirm('Nullstille turneringen? Dette sletter alle grupper og resultater.')) return;
  // tiebreaks gjaldt den gamle trekningen: nye grupper betyr nye klynger, og
  // en gammel avgjørelse ville dukket opp igjen på et tilfeldig par.
  tState.groups = null; tState.playoffResults = {}; tState.tiebreaks = null;
  tWrite({ groups: null, playoffResults: {}, tiebreaks: null });
}

// ===== STANDINGS =====
// Firebase-nøkler kan ikke inneholde . # $ / [ ] — spillernavn som "Ola N." må derfor escapes
function safeKey(s){ return String(s).replace(/[.#$/[\]]/g, c => '~'+c.charCodeAt(0).toString(16)); }
function fkey(f){return safeKey(f[0])+'|||'+safeKey(f[1]);}

// ===== POENGTAVLE =====
function isBoard(t) { return (t.format||'groups')==='board'; }
function scoreDirOf(t) { return t.scoreDir==='low' ? 'low' : 'high'; }

// En turnering regnes som "startet" når trekningen er gjort (grupper), eller
// når noen har levert score (poengtavle). Liveskjermen skal ikke vise noe
// som ikke er i gang ennå, og heller ikke noe som er markert som fullført.
function isStarted(t) {
  if (isBoard(t)) return Object.keys(t.scores||{}).length > 0;
  return groupsOf(t).length > 0;
}

// Påmeldingssperren gjelder bare gruppespill: der er trekningen gjort, så et
// nytt navn havner ikke i noen gruppe. En poengtavle har ingen trekning, og
// addBoardPlayer tillater alt at folk kommer til underveis.
function isSignupLocked(t) { return !isBoard(t) && isStarted(t); }

// Motstykket til isStarted: alt som skal spilles er spilt. For grupper betyr
// det alle gruppekamper, for poengtavle at hver deltaker har levert en score.
// Merk at "ferdig gruppespill" ikke er det samme som "finalen er spilt".
function isFinished(t) {
  if (isBoard(t)) {
    const players = t.players || [];
    if (!players.length) return false;
    return players.every(n => typeof ((t.scores||{})[safeKey(n)]||{}).score === 'number');
  }
  const order = playOrder(t);
  if (!order.length) return false;
  if (!order.every(m => isPlayed(t, m))) return false;
  // P2 #17: med flere grupper er gruppespillet bare halve turneringen —
  // «Ferdig» skal ikke stå på en turnering der finalen ikke er spilt.
  // Plasseringskampene teller ikke med: de hoppes ofte over, og da ville
  // merket aldri kommet. Finalen har alltid nøkkelen match_0.
  if (groupsOf(t).length > 1) {
    const final = (t.playoffResults || {})['match_0'];
    // 'draw' er et resultat, men ingen vinner. Uten dette sto kortet «Ferdig»
    // på en turnering der podium() var null — ferdig uten vinner.
    if (!final || !final.winner || final.winner === 'draw') return false;
  }
  return true;
}

// ===== SLUTTSPILL =====
// playoffResults lagrer home/away som navn, slik gruppekampene alltid har
// gjort. Lagret man bare vinnersiden, pekte den på en tabellplass — og endret
// noen et gruppekampresultat etterpå, kunne vinneren bytte person i etterkant.
function playoffWinner(pr, key) {
  const r = pr && pr[key];
  if (!r || !r.winner || r.winner === 'draw') return undefined;
  return r.winner === 'a' ? r.home : r.away;
}
function playoffLoser(pr, key) {
  const r = pr && pr[key];
  if (!r || !r.winner || r.winner === 'draw') return undefined;
  const derived = r.winner === 'a' ? r.away : r.home;
  return derived !== undefined ? derived : r.loser;
}

// Hvor mange som går videre fra hver gruppe. 'alle' er plasseringsstigen med
// to grupper, der hver tabellplass møter samme plass i den andre gruppa — det
// har alltid vært oppførselen der, så den er fortsatt standard. Med fire
// grupper er standarden gruppevinnerne, som før.
//
// Antallet kvalifiserte (grupper × videre) må være en toerpotens for at
// braketten skal gå opp, og ingen gruppe kan sende flere videre enn den har
// spillere. Begge deler klemmes ned her, så en verdi som ikke går opp aldri
// kan gi en halvbygget bracket.
function isPow2(n) { return n >= 2 && (n & (n - 1)) === 0; }
function advanceCount(t) {
  const gs = groupsOf(t);
  if (gs.length < 2) return 1;
  const raw = t && t.advance;
  if (raw === undefined || raw === null || raw === 'all') return gs.length === 2 ? 'all' : 1;
  let n = Math.floor(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 1;
  n = Math.min(n, Math.min(...gs.map(g => (g.players || []).length)) || 1);
  while (n > 1 && !isPow2(gs.length * n)) n--;
  return Math.max(1, n);
}

// Valgene som gir en bracket som går opp, til bruk i startdialogen.
// groupSize er størrelsen på den minste gruppa.
function allowedAdvance(groupCount, groupSize) {
  if (groupCount < 2) return [];
  const out = [];
  for (let n = 1; n <= Math.min(4, groupSize); n++) if (isPow2(groupCount * n)) out.push(n);
  if (groupCount === 2) out.push('all');
  return out;
}

// Gruppene pares vilkårlig, ikke etter rangering på tvers: computeGroups
// stokker før den deler ut, så A–D er tilfeldig sammensatt og parringen blir
// tilfeldig av seg selv. Da slipper vi å sammenligne poeng mellom grupper av
// ulik størrelse, som ikke er sammenlignbare når de har spilt ulikt antall kamper.
// match_0 er finalen uansett antall grupper — podium() hviler på det.
function playoffMatches(t) {
  const gs = groupsOf(t);
  if (gs.length < 2) return [];
  const st = gs.map((g, gi) => calcStandings(g.players, g.results, t.mode, scoreDirOf(t), tiebreaksFor(t, gi)));
  const pr = t.playoffResults || {};
  const top = i => ((st[i] || [])[0] || {}).name;

  // Er kampen alt spilt, vis de lagrede navnene. Endrer noen et gruppe-
  // resultat i etterkant, skal ikke en ferdigspilt kamp late som den var
  // mellom to andre.
  const withStored = m => {
    const r = pr[m.key];
    return r && r.home !== undefined && r.away !== undefined
      ? { ...m, home: r.home, away: r.away }
      : m;
  };

  const adv = advanceCount(t);

  // 'alle' = plasseringsstigen: hver tabellplass i A møter samme plass i B, så
  // alle får en kamp og hele rekkefølgen avgjøres. Finnes bare med to grupper.
  if (adv === 'all') {
    const size = Math.min(st[0].length, st[1].length);
    return Array.from({ length: size }, (_, i) => withStored({
      key: 'match_' + i,
      label: i === 0 ? 'FINALE' : `${2 * i + 1}. PLASS`,
      home: (st[0][i] || {}).name, away: (st[1][i] || {}).name,
      homeFrom: `A${i + 1}`, awayFrom: `B${i + 1}`,
    }));
  }

  // Kvalifiserte, seedet radvis: alle gruppevinnerne først, så alle
  // andreplassene. Antallet er alltid en toerpotens (advanceCount sørger for
  // det), så braketten går opp uten frikamper.
  const seeds = [];
  for (let r = 0; r < adv; r++) {
    for (let gi = 0; gi < gs.length; gi++) {
      seeds.push({
        name: ((st[gi] || [])[r] || {}).name,
        from: adv === 1 ? `Vinner gruppe ${gs[gi].name}` : `Nr ${r + 1} gruppe ${gs[gi].name}`,
      });
    }
  }

  // Med bare gruppevinnere er alle seedene like gode, og nabo-paring (A mot B,
  // C mot D) er det som alltid har vært brukt. Går det flere videre fra hver
  // gruppe, speilvendes lista i stedet, slik at en gruppevinner møter en
  // andreplass fra en annen gruppe i første runde.
  let round = [];
  if (adv === 1) {
    for (let i = 0; i < seeds.length; i += 2) round.push([seeds[i], seeds[i + 1]]);
  } else {
    for (let i = 0; i < seeds.length / 2; i++) round.push([seeds[i], seeds[seeds.length - 1 - i]]);
  }

  const out = [];
  let semiKeys = null;
  while (round.length) {
    const size = round.length;                       // kamper i denne runden
    const isFinal = size === 1;
    const prefix = isFinal ? 'match' : size === 2 ? 'semi' : size === 4 ? 'qf' : 'r' + size * 2;
    const label = n => isFinal ? 'FINALE'
      : size === 2 ? `SEMIFINALE ${n + 1}`
      : size === 4 ? `KVARTFINALE ${n + 1}`
      : `${size * 2}-DELS ${n + 1}`;

    const keys = round.map((_, i) => prefix + '_' + i);
    round.forEach(([h, a], i) => out.push(withStored({
      key: keys[i], label: label(i),
      home: h.name, away: a.name, homeFrom: h.from, awayFrom: a.from,
    })));
    if (size === 2) semiKeys = keys;

    if (isFinal) break;
    round = [];
    for (let i = 0; i < keys.length; i += 2) {
      round.push([
        { name: playoffWinner(pr, keys[i]), from: 'Vinner av ' + shortLabel(prefix, i) },
        { name: playoffWinner(pr, keys[i + 1]), from: 'Vinner av ' + shortLabel(prefix, i + 1) },
      ]);
    }
  }

  // Bronsefinale bare når det faktisk fantes semifinaler å tape.
  if (semiKeys) {
    out.push(withStored({
      key: 'match_1', label: 'BRONSE',
      home: playoffLoser(pr, semiKeys[0]), away: playoffLoser(pr, semiKeys[1]),
      homeFrom: 'Taper av semi 1', awayFrom: 'Taper av semi 2',
    }));
  }
  return out;
}

function shortLabel(prefix, i) {
  if (prefix === 'semi') return 'semi ' + (i + 1);
  if (prefix === 'qf') return 'kvartfinale ' + (i + 1);
  return 'kamp ' + (i + 1);
}

// Pallen for begge formater, delt mellom appen og liveskjermen. Returnerer
// null når det ikke finnes en vinner ennå — for grupper betyr det at finalen
// ikke er spilt, for poengtavle at ikke alle har levert score.
function podium(t) {
  if (isBoard(t)) {
    if (!isFinished(t)) return null;
    const rows = boardStandings(t).filter(r => r.score !== null);
    if (!rows.length) return null;
    return { champion: rows[0].name, runnerUp: (rows[1]||{}).name, third: (rows[2]||{}).name };
  }
  const dir = scoreDirOf(t);
  const gs = groupsOf(t);
  if (!gs.length) return null;

  // Én gruppe: alle møter alle, og tabelltoppen er vinneren. Ingen finale å
  // spille, så pallen leses rett av tabellen når alt er ferdig.
  if (gs.length === 1) {
    if (!isFinished(t)) return null;
    const rows = calcStandings(gs[0].players, gs[0].results, t.mode, dir, tiebreaksFor(t, 0));
    if (!rows.length) return null;
    return { champion: rows[0].name, runnerUp: (rows[1]||{}).name, third: (rows[2]||{}).name };
  }

  // To eller fire grupper: finalen er alltid match_0. Navnene leses fra
  // home/away i resultatet, ikke fra tabellen — det er hele poenget med å
  // lagre dem.
  const pr = t.playoffResults || {};
  const champion = playoffWinner(pr, 'match_0');
  if (!champion) return null;
  return {
    champion,
    runnerUp: playoffLoser(pr, 'match_0'),
    third: playoffWinner(pr, 'match_1'),
  };
}

// Kommentatorlinja. Alt her er hentet fra faktiske tall — ingen påstander
// appen ikke kan belegge.
function winnerBlurb(t, name) {
  if (isBoard(t)) {
    const rows = boardStandings(t).filter(r => r.score !== null);
    const me = rows[0], next = rows[1];
    if (!me) return '';
    if (!next) return `${me.score} — det eneste registrerte resultatet.`;
    const diff = Math.abs(me.score - next.score);
    if (!diff) return `${me.score}, delt beste resultat av ${rows.length} — men først til å levere.`;
    return `${me.score}, ${diff} ${scoreDirOf(t)==='low'?'mindre':'mer'} enn nestemann av ${rows.length} deltakere.`;
  }
  const myGi = groupsOf(t).findIndex(g => g.players.includes(name));
  const mine = groupsOf(t)[myGi];
  if (!mine) return 'Seier i finalen.';
  const me = calcStandings(mine.players, mine.results, t.mode, scoreDirOf(t), tiebreaksFor(t, myGi))
    .find(r => r.name === name);
  if (!me || !me.p) return 'Seier i finalen.';
  if (!me.l && me.w === me.p) return `Ubeslått gjennom hele gruppespillet — ${me.w} av ${me.p} ${me.p===1?'kamp':'kamper'} vunnet, og finalen med.`;
  if (!me.l) return `Ikke tapt en kamp i gruppa på ${me.p} forsøk, og så finalen.`;
  return `${me.w} av ${me.p} ${me.p===1?'kamp':'kamper'} vunnet i gruppa, og seier i finalen.`;
}

function toggleDisplayDone() {
  tState.hideFromDisplay = !tState.hideFromDisplay;
  renderTournamentView();
  tWrite({ hideFromDisplay: tState.hideFromDisplay });
}

// Rangert tavle. Spillere uten score havner nederst, uansett retning.
function boardStandings(t) {
  const scores = t.scores||{};
  const dir = scoreDirOf(t);
  const rows = (t.players||[]).map(name=>{
    const e = scores[safeKey(name)];
    return { name, score: e && typeof e.score==='number' ? e.score : null, ts: e?e.ts:0 };
  });
  rows.sort((a,b)=>{
    if (a.score===null && b.score===null) return 0;
    if (a.score===null) return 1;
    if (b.score===null) return -1;
    if (a.score!==b.score) return dir==='low' ? a.score-b.score : b.score-a.score;
    return (a.ts||0)-(b.ts||0); // lik score: den som leverte først står øverst
  });
  let pos=0, prev=null;
  return rows.map((r,i)=>{
    if (r.score!==null && r.score!==prev) { pos=i+1; prev=r.score; }
    return { ...r, pos: r.score===null ? null : pos };
  });
}

// Raden lages i DOM-et, ikke som HTML-streng: navnet havner i textContent og
// i en closure, aldri i en onclick-streng (samme grunn som P0 #1). Indeksen
// slås opp når hendelsen skjer — den kan ha flyttet seg siden raden ble laget.
function buildBoardRow(name) {
  const row = document.createElement('div');
  row.className = 'board-row';
  row.dataset.name = name;

  const pos = document.createElement('span');
  pos.className = 'pos px';

  const nameEl = document.createElement('span');
  nameEl.className = 'board-name';
  nameEl.textContent = name;

  const input = document.createElement('input');
  input.className = 'board-score';
  input.type = 'text';
  input.inputMode = 'numeric';
  input.pattern = '[0-9-]*';
  input.placeholder = '—';
  input.onchange = () => saveBoardScore((tState.players||[]).indexOf(name), input.value);

  const del = document.createElement('button');
  del.className = 'board-del';
  del.title = 'Fjern spiller';
  del.textContent = '×';
  del.onclick = () => removeBoardPlayer((tState.players||[]).indexOf(name));

  row.append(pos, nameEl, input, del);
  return row;
}

// Bygger ikke lista på nytt ved hver oppdatering: kommer det en score fra en
// annen mobil mens du taster inn din egen, ville innerHTML byttet ut feltet
// under fingrene dine og spist det du hadde skrevet (P1 #9). Radene gjenbrukes
// per spiller, feltet du står i røres ikke, og rekkefølgen endres bare når den
// faktisk har endret seg — å flytte en node blurrer den i de fleste nettlesere.
function renderBoard() {
  const rows = boardStandings(tState);
  const scored = rows.filter(r=>r.score!==null).length;
  document.getElementById('t-board-hint').textContent =
    `${scored} av ${rows.length} har score · ${SCORE_DIRS[scoreDirOf(tState)].label.toLowerCase()}`;

  const list = document.getElementById('t-board-list');
  const active = document.activeElement;
  const editing = active && active.classList && active.classList.contains('board-score') && list.contains(active)
    ? { input: active, start: active.selectionStart, end: active.selectionEnd }
    : null;

  if (!rows.length) {
    list.innerHTML = '<p class="muted">Ingen spillere ennå.</p>';
  } else {
    const existing = new Map();
    Array.from(list.children).forEach(el => {
      const n = el.dataset && el.dataset.name;
      if (n) existing.set(n, el); else el.remove();   // «ingen spillere»-teksten
    });

    const ordered = rows.map(r => {
      const row = existing.get(r.name) || buildBoardRow(r.name);
      existing.delete(r.name);
      const pc = r.pos===1?'p1':r.pos===2?'p2':r.pos===3?'p3':'px';
      row.className = 'board-row' + (r.score===null ? ' unscored' : '');
      const pos = row.firstElementChild;
      pos.className = 'pos ' + pc;
      pos.textContent = r.pos || '–';
      const input = row.querySelector('.board-score');
      // Feltet som redigeres akkurat nå skal beholde det som er tastet inn
      if (!editing || editing.input !== input) input.value = r.score===null ? '' : r.score;
      return row;
    });

    existing.forEach(el => el.remove());              // spillere som er fjernet

    const sameOrder = ordered.length === list.children.length
      && ordered.every((row, i) => list.children[i] === row);
    if (!sameOrder) {
      ordered.forEach(row => list.appendChild(row));
      // appendChild flytter noden, og en flyttet node mister fokus i de fleste
      // nettlesere. Verdien overlever (samme node), fokus og markør settes tilbake.
      if (editing && document.activeElement !== editing.input) {
        editing.input.focus();
        try { editing.input.setSelectionRange(editing.start, editing.end); } catch (err) {}
      }
    }
  }

  const displayBtn = document.getElementById('t-board-display-btn');
  displayBtn.textContent = tState.hideFromDisplay ? '✓ Skjult fra liveskjerm — vis igjen' : 'Merk som fullført (skjul fra liveskjerm)';
}

// Poengtavla er nettopp der flere folk skriver inn sin egen score samtidig
// — akkurat scenarioet som må tåle samtidighet. saveBoardScore/removeBoard-
// Player skriver derfor bare til sin egen nøkkel under scores/, aldri hele
// tState, så to samtidige innsendinger aldri kan overskrive hverandre.
function addBoardPlayer() {
  const input = document.getElementById('t-board-input');
  const name = input.value.trim();
  const errEl = document.getElementById('t-board-error');
  if (!name) return;
  if ((tState.players||[]).includes(name)) { errEl.textContent='Navn allerede lagt til'; errEl.style.display='block'; return; }
  errEl.style.display='none';
  tState.players = [...(tState.players||[]), name];
  input.value='';
  renderBoard();
  setSignup(currentTId, name, true);
}

function removeBoardPlayer(pi) {
  const name = (tState.players||[])[pi];
  if (name===undefined) return;
  if (!confirm(`Fjerne ${name} fra poengtavla?`)) return;
  tState.players = (tState.players||[]).filter((_,i)=>i!==pi);
  const key = safeKey(name);
  if (tState.scores) delete tState.scores[key];
  renderBoard();
  setSignup(currentTId, name, false);
  tWrite({ ['scores/'+key]: null });
}

function saveBoardScore(pi, raw) {
  const name = (tState.players||[])[pi];
  if (name===undefined) return;
  if (!tState.scores) tState.scores = {};
  const key = safeKey(name);
  const txt = String(raw).trim();
  if (txt==='') { delete tState.scores[key]; renderBoard(); tWrite({ ['scores/'+key]: null }); return; }
  const n = parseInt(txt, 10);
  if (isNaN(n)) { renderBoard(); return; }
  const entry = { name, score: n, ts: Date.now() };
  tState.scores[key] = entry;
  renderBoard();
  tWrite({ ['scores/'+key]: entry });
}

function resetBoard() {
  if (!confirm('Nullstille alle scorer? Spillerne beholdes.')) return;
  tState.scores = {};
  renderBoard();
  tWrite({ scores: {} });
}

// Kampene i den rekkefølgen de faktisk spilles: A1, B1, C1, A2, B2, C2 ...
// Gruppene går parallelt.
function playOrder(t) {
  const gs = groupsOf(t);
  const max = Math.max(0, ...gs.map(g => g.fixtures.length));
  const order = [];
  for (let i = 0; i < max; i++)
    gs.forEach((g, gi) => { if (g.fixtures[i]) order.push({ gi, idx: i, f: g.fixtures[i] }); });
  return order;
}
function matchResult(t, m) {
  const g = groupsOf(t)[m.gi];
  return g ? (g.results[fkey(m.f)] || null) : null;
}
function isPlayed(t, m) { const r=matchResult(t,m); return !!(r&&r.winner); }
function lastPlayed(t) {
  const played = playOrder(t).filter(m=>isPlayed(t,m)).map(m=>({...m,r:matchResult(t,m)}));
  if(!played.length) return null;
  // Nyeste tidsstempel vinner. Resultater lagret før ts fantes har 0 og faller
  // dermed tilbake på spillerekkefølgen, som er nærmeste tilgjengelige sannhet.
  return played.reduce((a,b)=>(b.r.ts||0)>=(a.r.ts||0)?b:a);
}

// ===== UAVGJORT SOM MÅ AVGJØRES =====
// Står to spillere helt likt etter poeng, seire, målforskjell OG den innbyrdes
// miniligaen, kan de ikke skilles sportslig. Før avgjorde alfabetisk
// rekkefølge i stillhet. Nå kan hvem som helst registrere hvem som gikk videre
// — spilt omkamp, stein-saks-papir, myntkast, det er opp til dem — og valget
// lagres på turneringen slik at alle skjermer viser det samme.
//
// Nøkkelen er navnene i klyngen, sortert, ikke plasseringen: flytter klyngen
// seg opp eller ned i tabellen fordi noen andre spiller en kamp, gjelder
// avgjørelsen fortsatt.
function tieKey(names) { return safeKey([...names].sort().join('|')); }
function tiebreaksFor(t, gi) { return ((t && t.tiebreaks) || {})['g' + gi] || {}; }

function calcStandings(group, results, mode, dir, tiebreaks) {
  return rankGroup(group, results, mode, dir, tiebreaks).rows;
}

// Alle klyngene som ikke kan skilles sportslig, både de som er avgjort
// manuelt og de som venter på en avgjørelse.
function tieClusters(group, results, mode, dir, tiebreaks) {
  return rankGroup(group, results, mode, dir, tiebreaks).ties;
}
function unresolvedTies(group, results, mode, dir, tiebreaks) {
  return tieClusters(group, results, mode, dir, tiebreaks).filter(c => !c.resolved);
}

function rankGroup(group, results, mode, dir, tiebreaks) {
  mode = mode || tState.mode;
  dir = dir || scoreDirOf(tState);
  const s={};
  group.forEach(p=>{s[p]={p:0,w:0,d:0,l:0,pts:0,gf:0,ga:0,gd:0};});
  Object.values(results).forEach(r=>{
    if(!r.winner) return;
    if(!s[r.home]||!s[r.away]) return; // resultat fra en spiller som ikke er i gruppa lenger
    s[r.home].p++; s[r.away].p++;
    if(typeof r.homeScore==='number'&&typeof r.awayScore==='number') {
      s[r.home].gf+=r.homeScore; s[r.home].ga+=r.awayScore;
      s[r.away].gf+=r.awayScore; s[r.away].ga+=r.homeScore;
      s[r.home].gd=s[r.home].gf-s[r.home].ga;
      s[r.away].gd=s[r.away].gf-s[r.away].ga;
    }
    if(r.winner==='a'){s[r.home].w++;s[r.home].pts+=3;s[r.away].l++;}
    else if(r.winner==='b'){s[r.away].w++;s[r.away].pts+=3;s[r.home].l++;}
    else{s[r.home].d++;s[r.home].pts++;s[r.away].d++;s[r.away].pts++;}
  });

  // Innbyrdes oppgjør regnes som en miniliga blant de likestilte, ikke parvis.
  // En parvis komparator er ikke transitiv: i en tresykel (A slår B, B slår C,
  // C slår A) gir den motstridende svar for hvert par, og Array.sort returnerer
  // da ulikt resultat avhengig av rekkefølgen spillerne ligger i gruppa.
  // Miniligaen gir én verdi per spiller og er transitiv av konstruksjon.
  function miniLeague(names) {
    const set = new Set(names);
    const m = {};
    names.forEach(n => { m[n] = { pts:0, gf:0, ga:0 }; });
    Object.values(results).forEach(r => {
      if (!r.winner || !set.has(r.home) || !set.has(r.away)) return;
      if (typeof r.homeScore==='number' && typeof r.awayScore==='number') {
        m[r.home].gf += r.homeScore; m[r.home].ga += r.awayScore;
        m[r.away].gf += r.awayScore; m[r.away].ga += r.homeScore;
      }
      if (r.winner==='a') m[r.home].pts += 3;
      else if (r.winner==='b') m[r.away].pts += 3;
      else { m[r.home].pts++; m[r.away].pts++; }
    });
    return m;
  }

  // Nøklene som er transitive kan sorteres direkte. Rekkefølgen inne i en
  // gjenstående likhet avgjøres etterpå, av miniligaen.
  const primary = (a, b) => {
    const sa=s[a], sb=s[b];
    if(sb.pts!==sa.pts) return sb.pts-sa.pts;
    if(sb.w!==sa.w) return sb.w-sa.w;
    if(mode==='score') {
      if(dir==='low') { if(sa.gf!==sb.gf) return sa.gf-sb.gf; }
      else { if(sb.gd!==sa.gd) return sb.gd-sa.gd; if(sb.gf!==sa.gf) return sb.gf-sa.gf; }
    }
    return 0;
  };

  const sorted = [...group].sort((a,b) => primary(a,b) || a.localeCompare(b,'no'));

  // Del i klynger som er like etter de transitive nøklene, og sorter hver
  // klynge på miniligaen. Er også den lik, er de uskillelige sportslig: da
  // gjelder en registrert avgjørelse hvis den finnes, ellers alfabetisk —
  // forutsigbart og likt på alle skjermer inntil noen avgjør det.
  const out = [];
  const ties = [];
  for (let i = 0; i < sorted.length; ) {
    let j = i + 1;
    while (j < sorted.length && primary(sorted[i], sorted[j]) === 0) j++;
    const cluster = sorted.slice(i, j);
    if (cluster.length === 1) { out.push(cluster[0]); i = j; continue; }

    const m = miniLeague(cluster);
    // Alt her er én verdi per spiller, altså transitivt: klyngen kan deles på
    // «secondary === 0» uten at rekkefølgen i lista påvirker svaret.
    const secondary = (a,b) => {
      if (m[b].pts !== m[a].pts) return m[b].pts - m[a].pts;
      if (mode==='score') {
        if (dir==='low') { if (m[a].gf !== m[b].gf) return m[a].gf - m[b].gf; }
        else {
          const da=m[a].gf-m[a].ga, db=m[b].gf-m[b].ga;
          if (db !== da) return db - da;
        }
      }
      if (s[a].l !== s[b].l) return s[a].l - s[b].l;
      return 0;
    };
    cluster.sort((a,b) => secondary(a,b) || a.localeCompare(b,'no'));

    for (let k = 0; k < cluster.length; ) {
      let l = k + 1;
      while (l < cluster.length && secondary(cluster[k], cluster[l]) === 0) l++;
      const tied = cluster.slice(k, l);
      if (tied.length > 1) {
        const order = (tiebreaks || {})[tieKey(tied)];
        const resolved = Array.isArray(order) && order.length > 0;
        if (resolved) {
          // Et navn som ikke står i den registrerte rekkefølgen (lagt til
          // etterpå) havner bakerst i klyngen, ikke først.
          const ix = n => { const p = order.indexOf(n); return p < 0 ? Infinity : p; };
          tied.sort((a,b) => (ix(a) - ix(b)) || a.localeCompare(b,'no'));
        }
        // En klynge meldes først når alle i den har spilt ferdig gruppa si.
        // Uten dette ville hele gruppa stått som «uavgjort» før første kamp,
        // der alle har null poeng — teknisk sant, men bare støy.
        const settled = tied.every(n => s[n].p === group.length - 1);
        if (resolved || settled) ties.push({ names: tied.slice(), key: tieKey(tied), resolved });
      }
      out.push(...tied);
      k = l;
    }
    i = j;
  }
  return { rows: out.map((name,i)=>({pos:i+1,name,...s[name]})), ties };
}

// ===== RENDER TOURNAMENT =====
function renderTournamentView() {
  if (isBoard(tState)) {
    document.getElementById('t-setup').style.display = 'none';
    document.getElementById('t-main').style.display = 'none';
    document.getElementById('t-board').style.display = 'block';
    renderBoard();
    return;
  }
  document.getElementById('t-board').style.display = 'none';
  const has = groupsOf(tState).length > 0;
  document.getElementById('t-setup').style.display = has?'none':'block';
  document.getElementById('t-main').style.display = has?'block':'none';
  if (!has) { renderTPlayers(); return; }

  // Groups
  const gs = groupsOf(tState);
  // Kolonnetallet i CSS følger data-n: én gruppe full bredde, ellers 2×2
  ['t-groups-grid','t-fixtures-wrap','t-standings-wrap'].forEach(id =>
    document.getElementById(id).dataset.n = gs.length);
  document.getElementById('t-groups-grid').innerHTML = gs.map((g, gi) => `
    <div class="group-card">
      <div class="group-hdr ${groupTone(gi)}">Gruppe ${escapeHTML(g.name)} · ${g.players.length} spillere</div>
      ${g.players.map(p=>`<div class="group-member">${escapeHTML(p)}</div>`).join('')}
    </div>`).join('');

  // Fixtures
  const fWrap = document.getElementById('t-fixtures-wrap');
  fWrap.innerHTML = gs.map((g, gi)=>{
    const fixtures = g.fixtures, results = g.results;
    const played = Object.values(results).filter(r=>r.winner||(typeof r.homeScore==='number'&&typeof r.awayScore==='number')).length;
    const total = fixtures.length;
    const rows = fixtures.map((f,i)=>{
      const r = results[fkey(f)]||{};
      let badge='';
      if(tState.mode==='score'&&typeof r.homeScore==='number'&&typeof r.awayScore==='number') {
        const cls=r.winner==='a'?'res-a':r.winner==='b'?'res-b':'res-d';
        badge=`<span class="fix-badge ${cls}">${r.homeScore}–${r.awayScore}</span>`;
      } else if(r.winner==='a') badge=`<span class="fix-badge res-a">${escapeHTML(f[0])} vinner</span>`;
      else if(r.winner==='b') badge=`<span class="fix-badge res-b">${escapeHTML(f[1])} vinner</span>`;
      else if(r.winner==='draw') badge=`<span class="fix-badge res-d">Uavgjort</span>`;
      else badge=`<span class="fix-badge res-none">Trykk for å registrere</span>`;
      return `<div class="fixture-row" onclick="openMatchDialog(${gi},${i})">
        <span class="fix-num">${i+1}.</span>
        <span class="fix-team r">${escapeHTML(f[0])}</span>
        <span class="fix-vs">vs</span>
        <span class="fix-team">${escapeHTML(f[1])}</span>
        ${badge}
      </div>`;
    }).join('');
    return `<div class="card">
      <div style="font-weight:700;font-size:14px;color:var(--${groupTone(gi)}-text);margin-bottom:4px;">Gruppe ${escapeHTML(g.name)}</div>
      <div class="prog-label">${played} av ${total} spilt</div>
      <div class="prog-wrap"><div class="prog-bar" style="width:${total?Math.round(played/total*100):0}%;background:var(--${groupTone(gi)});"></div></div>
      ${rows}
    </div>`;
  }).join('');

  // Standings
  const sWrap = document.getElementById('t-standings-wrap');
  const showGD = tState.mode==='score';
  const showD = tState.mode==='wdl';
  sWrap.innerHTML = gs.map((g, gi)=>{
    const tb = tiebreaksFor(tState, gi);
    const ranked = rankGroup(g.players, g.results, tState.mode, scoreDirOf(tState), tb);
    const rows = ranked.rows;
    return `<div class="card">
      <div style="font-weight:700;font-size:14px;color:var(--${groupTone(gi)}-text);margin-bottom:0.75rem;">Gruppe ${escapeHTML(g.name)}</div>
      <table class="stand-table">
        <thead><tr>
          <th style="width:28px;">#</th><th class="name">Spiller</th>
          <th>K</th><th>S</th>${showD?'<th>U</th>':''}<th>T</th>
          ${showGD?'<th>M+/-</th>':''}
          <th>Pkt</th>
        </tr></thead>
        <tbody>${rows.map(r=>{
          const pc=r.pos===1?'p1':r.pos===2?'p2':r.pos===3?'p3':'px';
          const gdStr=r.gd>0?'+'+r.gd:r.gd;
          return `<tr>
            <td><span class="pos ${pc}">${r.pos}</span></td>
            <td class="name">${escapeHTML(r.name)}</td>
            <td>${r.p}</td><td>${r.w}</td>${showD?`<td>${r.d}</td>`:''}<td>${r.l}</td>
            ${showGD?`<td>${gdStr}</td>`:''}
            <td style="font-weight:700;">${r.pts}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
      ${ranked.ties.map(c => tieNoteHTML(gi, c)).join('')}
    </div>`;
  }).join('');

  // Playoffs
  const pod = podium(tState) || {};
  const { champion, runnerUp, third } = pod;

  const displayBtn = document.getElementById('t-display-btn');
  if (displayBtn) displayBtn.textContent = tState.hideFromDisplay
    ? '✓ Skjult fra liveskjerm — vis igjen'
    : 'Merk som fullført (skjul fra liveskjerm)';

  const winnerSection = document.getElementById('t-winner-section');
  if (champion) {
    winnerSection.innerHTML = `
      <div class="winner-banner">
        <span class="winner-trophy">🏆</span>
        <div class="winner-label">Turneringsvinner</div>
        <div class="winner-name">${escapeHTML(champion)}</div>
        <div class="muted" style="font-size:13px;">Gratulerer!</div>
      </div>
      <div class="podium-row">
        <div class="podium-item silver"><span class="podium-medal">🥈</span><div class="podium-pos">2. plass</div><div class="podium-name">${escapeHTML(runnerUp||'—')}</div></div>
        <div class="podium-item gold"><span class="podium-medal">🥇</span><div class="podium-pos">1. plass</div><div class="podium-name">${escapeHTML(champion)}</div></div>
        <div class="podium-item bronze"><span class="podium-medal">🥉</span><div class="podium-pos">3. plass</div><div class="podium-name">${escapeHTML(third||'—')}</div></div>
      </div>`;
  } else { winnerSection.innerHTML = ''; }

  const pm = playoffMatches(tState);
  const pr = tState.playoffResults || {};
  const hint = document.getElementById('t-playoff-hint');
  const drawnFinal = (pr['match_0'] || {}).winner === 'draw';
  if (hint) hint.textContent = !pm.length
    ? 'Én gruppe — vinneren er den som topper tabellen.'
    : drawnFinal
      ? 'Finalen står likt — den må avgjøres før turneringen har en vinner.'
      : 'Trykk på en kamp for å registrere resultat';

  document.getElementById('t-playoff-matches').innerHTML = pm.map(m=>{
    const r = pr[m.key] || {};
    // Navnet mangler så lenge kampen foran ikke er spilt — vis hvor spilleren
    // kommer fra i stedet for et tomt felt.
    const home = m.home, away = m.away;
    const ready = home !== undefined && away !== undefined;
    const hName = home !== undefined ? escapeHTML(home) : `<span class="playoff-from">${escapeHTML(m.homeFrom||'?')}</span>`;
    const aName = away !== undefined ? escapeHTML(away) : `<span class="playoff-from">${escapeHTML(m.awayFrom||'?')}</span>`;
    let badge='';
    if(tState.mode==='score'&&typeof r.homeScore==='number'&&typeof r.awayScore==='number') {
      const cls=r.winner==='a'?'res-a':r.winner==='b'?'res-b':'res-d';
      badge=`<span class="fix-badge ${cls}">${r.homeScore}–${r.awayScore}</span>`;
    } else if(r.winner==='a') badge=`<span class="fix-badge res-a">${escapeHTML(home)} vinner</span>`;
    else if(r.winner==='b') badge=`<span class="fix-badge res-b">${escapeHTML(away)} vinner</span>`;
    else if(!ready) badge=`<span class="fix-badge res-none">Venter</span>`;
    else badge=`<span class="fix-badge res-none">Trykk for å registrere</span>`;
    return `<div class="playoff-card${ready?'':' pending'}" ${ready?`onclick="openPlayoffDialog('${m.key}')"`:''}>
      <div class="playoff-label ${m.key==='match_0'?'final':''}">${m.label}</div>
      <div class="fixture-row" style="border:none;padding:0;pointer-events:none;cursor:default;">
        <span class="fix-team r" style="font-size:17px;font-weight:700;">${hName}</span>
        <span class="fix-vs">vs</span>
        <span class="fix-team" style="font-size:17px;font-weight:700;">${aName}</span>
        ${badge}
      </div>
    </div>`;
  }).join('');
}

// ===== AVGJØR UAVGJORT =====
// Navnene går aldri gjennom en onclick-streng — bare gruppeindeksen og den
// escapede klyngenøkkelen, og klyngen slås opp på nytt når man trykker.
// (Samme grunn som i deltakerlista: safeKey escaper ikke ' eller ".)
function listNames(names) {
  if (names.length < 2) return names[0] || '';
  return names.slice(0, -1).join(', ') + ' og ' + names[names.length - 1];
}

function tieNoteHTML(gi, c) {
  const names = c.names.map(escapeHTML);
  const attrs = `data-tie-gi="${gi}" data-tie-key="${escapeHTML(c.key)}"`;
  if (c.resolved) {
    return `<div class="tie-note resolved">
      <span class="tie-note-txt">Avgjort manuelt: ${names.join(' foran ')}</span>
      <button ${attrs}>Endre</button>
    </div>`;
  }
  return `<div class="tie-note">
    <span class="tie-note-txt">⚠️ ${listNames(names)} står helt likt — resultatene skiller dem ikke.</span>
    <button ${attrs}>Avgjør</button>
  </div>`;
}

document.getElementById('t-standings-wrap')?.addEventListener('click', e => {
  const btn = e.target.closest('[data-tie-key]');
  if (!btn) return;
  openTiebreakDialog(Number(btn.dataset.tieGi), btn.dataset.tieKey);
});

let tieCtx = null;

// Klyngen slås opp på nytt fra gjeldende tabell, ikke fra det som ble tegnet:
// et resultat kan ha landet fra en annen telefon i mellomtiden, og da er
// klyngen en annen — eller borte.
function findTieCluster(gi, key) {
  const g = groupsOf(tState)[gi];
  if (!g) return null;
  const tb = tiebreaksFor(tState, gi);
  return rankGroup(g.players, g.results, tState.mode, scoreDirOf(tState), tb)
    .ties.find(c => c.key === key) || null;
}

function openTiebreakDialog(gi, key) {
  const c = findTieCluster(gi, key);
  if (!c) { showToast('Stillingen har endret seg — de står ikke likt lenger'); return; }
  tieCtx = { gi, key, names: c.names.slice(), picked: [], resolved: c.resolved };
  const g = groupsOf(tState)[gi];
  document.getElementById('tiebreak-sub').textContent =
    `${listNames(c.names)} i gruppe ${g.name} kan ikke skilles på resultatene. ` +
    'Spill en omkamp, ta stein-saks-papir eller kast mynt — og registrer hvem som havner øverst.';
  document.getElementById('tiebreak-label').textContent = c.names.length > 2
    ? 'Trykk i den rekkefølgen de skal stå'
    : 'Hvem havner øverst?';
  document.getElementById('tiebreak-clear-btn').style.display = c.resolved ? 'block' : 'none';
  renderTiebreakList();
  document.getElementById('tiebreak-overlay').style.display = 'flex';
  lockBodyScroll();
}
function hideTiebreakDialog() {
  tieCtx = null;
  document.getElementById('tiebreak-overlay').style.display = 'none';
  unlockBodyScroll();
}

function renderTiebreakList() {
  if (!tieCtx) return;
  const wrap = document.getElementById('tiebreak-list');
  wrap.innerHTML = tieCtx.names.map((n, i) => {
    const pos = tieCtx.picked.indexOf(n);
    return `<button class="tie-row${pos >= 0 ? ' picked' : ''}" data-tie-idx="${i}">
      <span class="tie-rank">${pos >= 0 ? pos + 1 : '·'}</span>
      <span>${escapeHTML(n)}</span>
    </button>`;
  }).join('');
  const done = tieCtx.picked.length === tieCtx.names.length;
  const save = document.getElementById('tiebreak-save-btn');
  save.disabled = !done;
  save.textContent = done ? 'Lagre' : 'Velg rekkefølge';
}

document.getElementById('tiebreak-list')?.addEventListener('click', e => {
  const row = e.target.closest('[data-tie-idx]');
  if (!row || !tieCtx) return;
  const name = tieCtx.names[Number(row.dataset.tieIdx)];
  if (tieCtx.picked.includes(name)) {
    // Trykk på nytt = angre, og alt etter den faller også bort
    tieCtx.picked = tieCtx.picked.slice(0, tieCtx.picked.indexOf(name));
  } else {
    tieCtx.picked.push(name);
    // Er det bare én igjen, er rekkefølgen gitt — da slipper man et ekstra
    // trykk for å si det åpenbare (og med to spillere er det ett trykk totalt).
    const left = tieCtx.names.filter(n => !tieCtx.picked.includes(n));
    if (left.length === 1) tieCtx.picked.push(left[0]);
  }
  renderTiebreakList();
});

function saveTiebreak() {
  if (!tieCtx || tieCtx.picked.length !== tieCtx.names.length) return;
  // Målrettet skriving, ikke hele turneringen: et resultat som lagres i samme
  // øyeblikk fra en annen telefon skal ikke forsvinne.
  tWrite({ ['tiebreaks/g' + tieCtx.gi + '/' + tieCtx.key]: tieCtx.picked.slice() });
  showToast(tieCtx.picked[0] + ' står øverst');
  hideTiebreakDialog();
}

function clearTiebreak() {
  if (!tieCtx) return;
  tWrite({ ['tiebreaks/g' + tieCtx.gi + '/' + tieCtx.key]: null });
  showToast('Avgjørelsen er fjernet');
  hideTiebreakDialog();
}

// ===== MATCH DIALOG =====
function openMatchDialog(gi, idx) {
  const g = groupsOf(tState)[gi];
  if (!g) return;
  const fixtures = g.fixtures, results = g.results;
  const f = fixtures[idx];
  // Oppsettet kan være nullstilt eller trukket på nytt fra en annen telefon i
  // det fingeren treffer raden. Uten dette kastet fkey(f) på f[0].
  if (!f) { showToast('Kampoppsettet er endret — prøv igjen'); return; }
  const r = (results||{})[fkey(f)]||{};
  let scoreH = typeof r.homeScore==='number'?r.homeScore:0;
  let scoreA = typeof r.awayScore==='number'?r.awayScore:0;
  let hasScore = typeof r.homeScore==='number';

  showMatchDialog(f[0], f[1], tState.mode,
    // onResult — skriver kun denne ene kampens resultat, aldri hele
    // turneringen: to ulike kamper kan lagres samtidig uten å krysse hverandre.
    (winner, loser, hs, as_) => {
      const field = resultsPath(gi) + '/' + fkey(f);
      const value = winner===null ? null : {winner,loser,home:f[0],away:f[1],homeScore:hs,awayScore:as_,ts:Date.now()};
      tWrite({ [field]: value });
    },
    r, scoreH, scoreA, hasScore
  );
}

function openPlayoffDialog(key) {
  const m = playoffMatches(tState).find(x => x.key === key);
  if (!m || m.home === undefined || m.away === undefined) {
    showToast('Kampen foran må spilles først');
    return;
  }
  const r = (tState.playoffResults || {})[key] || {};
  let scoreH = typeof r.homeScore==='number'?r.homeScore:0;
  let scoreA = typeof r.awayScore==='number'?r.awayScore:0;
  let hasScore = typeof r.homeScore==='number';

  showMatchDialog(m.home, m.away, tState.mode,
    (winner, loser, hs, as_) => {
      // home/away lagres som navn: en ferdigspilt kamp skal ikke bytte
      // deltakere fordi et gruppekampresultat endres i etterkant.
      const value = winner===null ? null
        : { winner, loser, home: m.home, away: m.away, homeScore: hs, awayScore: as_, ts: Date.now() };
      tWrite({ ['playoffResults/' + key]: value });
    },
    r, scoreH, scoreA, hasScore, true   // sluttspill: må kåre en vinner
  );
}

// noDraw: en sluttspillkamp må kåre en vinner. Uavgjort der ga et resultat uten
// vinner, som låste turneringen i «Ferdig uten pall».
function showMatchDialog(p1, p2, mode, onResult, r, scoreH, scoreA, hasScore, noDraw) {
  let sh = scoreH, sa = scoreA, hs = hasScore;
  const container = document.getElementById('match-dialog-container');

  function render() {
    const low = scoreDirOf(tState)==='low';
    const hwin = hs&&(low?sh<sa:sh>sa), awin = hs&&(low?sa<sh:sa>sh);
    let body = '';
    if (mode==='score') {
      body = `<div class="score-grid">
        <div class="score-col">
          <div class="score-name">${escapeHTML(p1)}</div>
          <button class="score-step-btn" onclick="stepScore('h',1)" tabindex="-1">+</button>
          <input id="si-h" class="score-val ${hwin?'winning':''}" type="text" inputmode="numeric" pattern="[0-9]*" ${hs?`value="${sh}"`:''}  placeholder="—" />
          <button class="score-step-btn" onclick="stepScore('h',-1)" tabindex="-1">−</button>
        </div>
        <span class="score-sep">:</span>
        <div class="score-col">
          <div class="score-name">${escapeHTML(p2)}</div>
          <button class="score-step-btn" onclick="stepScore('a',1)" tabindex="-1">+</button>
          <input id="si-a" class="score-val ${awin?'winning':''}" type="text" inputmode="numeric" pattern="[0-9]*" ${hs?`value="${sa}"`:''}  placeholder="—" />
          <button class="score-step-btn" onclick="stepScore('a',-1)" tabindex="-1">−</button>
        </div>
      </div>
      <button class="score-save-btn" onclick="saveScore()">Lagre resultat</button>`;
    } else {
      const wdl = mode==='wdl' && !noDraw;
      const selA = r.winner==='a', selD = r.winner==='draw', selB = r.winner==='b';
      body = `<div class="match-result-btns">
        <button class="match-result-btn ${selA?'sel-a':''}" onclick="dlgSetWinner('a')">
          <span>${escapeHTML(p1)} vinner</span><span class="match-result-btn-pts">3 pkt</span>
        </button>
        ${wdl?`<button class="match-result-btn ${selD?'sel-d':''}" onclick="dlgSetWinner('draw')">
          <span>Uavgjort</span><span class="match-result-btn-pts">1 pkt hver</span>
        </button>`:''}
        <button class="match-result-btn ${selB?'sel-b':''}" onclick="dlgSetWinner('b')">
          <span>${escapeHTML(p2)} vinner</span><span class="match-result-btn-pts">3 pkt</span>
        </button>
      </div>`;
    }

    container.innerHTML = `
      <div class="match-dialog-overlay" id="dlg-overlay">
        <div class="match-dialog">
          <div class="match-dialog-handle"></div>
          <div class="match-dialog-players">
            <span>${escapeHTML(p1)}</span>
            <span class="match-dialog-vs">vs</span>
            <span>${escapeHTML(p2)}</span>
          </div>
          ${body}
          <button class="dialog-clear-btn" onclick="dlgClear()">Slett resultat</button>
        </div>
      </div>`;

    document.getElementById('dlg-overlay').addEventListener('click', e=>{
      if (e.target.id==='dlg-overlay') {
        // Lagre bare hvis noe faktisk er tastet inn. Før ble tomme felt lest
        // som 0, så et uhellsklikk utenfor registrerte 0–0 uavgjort.
        if (mode==='score' && hs) saveScore();
        else closeDlg();
      }
    });

    if (mode==='score') {
      setTimeout(()=>{
        const hEl=document.getElementById('si-h'), aEl=document.getElementById('si-a');
        function upd() {
          hs=true;
          sh=Math.max(0,parseInt(hEl?.value)||0);
          sa=Math.max(0,parseInt(aEl?.value)||0);
          if(hEl) hEl.className='score-val'+(sh>sa?' winning':'');
          if(aEl) aEl.className='score-val'+(sa>sh?' winning':'');
        }
        if(hEl) hEl.addEventListener('input', upd);
        if(aEl) aEl.addEventListener('input', upd);
      }, 30);
    }
  }

  window.stepScore = function(side, delta) {
    const hEl=document.getElementById('si-h'), aEl=document.getElementById('si-a');
    if(side==='h') sh=Math.max(0,(parseInt(hEl?.value)||0)+delta);
    else sa=Math.max(0,(parseInt(aEl?.value)||0)+delta);
    hs=true;
    if(hEl) { hEl.value=sh; hEl.className='score-val'+(sh>sa?' winning':''); }
    if(aEl) { aEl.value=sa; aEl.className='score-val'+(sa>sh?' winning':''); }
  };

  window.saveScore = function() {
    const hEl=document.getElementById('si-h'), aEl=document.getElementById('si-a');
    const h=Math.max(0,parseInt(hEl?.value)||0), a=Math.max(0,parseInt(aEl?.value)||0);
    const hBest = scoreDirOf(tState)==='low' ? h<a : h>a;
    const aBest = scoreDirOf(tState)==='low' ? a<h : a>h;
    const winner=hBest?'a':aBest?'b':'draw', loser=hBest?p2:aBest?p1:null;
    if (noDraw && winner === 'draw') {
      showToast('Kampen må ha en vinner — kan ikke ende likt');
      return;
    }
    onResult(winner, loser, h, a);
    closeDlg();
  };

  window.dlgSetWinner = function(side) {
    const loser=side==='a'?p2:side==='b'?p1:null;
    onResult(side==='draw'?'draw':side, loser, null, null);
    closeDlg();
  };

  window.dlgClear = function() { onResult(null, null, null, null); closeDlg(); };
  function closeDlg() { container.innerHTML=''; }
  render();
}

// ===== LIVE DISPLAY =====
let displayIntervals = [];
let displayTimers = [];
let dispEventId = null;
let dispTournaments = {};
let dispCurrent = 0;
let dispRef = null;

function openDisplayScreen() {
  const url = window.location.origin + window.location.pathname + '?e=' + currentEventId + '&display=1';
  window.open(url, '_blank');
}

function exitDisplay() {
  clearReveal();
  displayIntervals.forEach(clearInterval);
  displayIntervals=[];
  displayTimers.forEach(clearTimeout);
  displayTimers=[];
  if (saverWakeTimer) { clearTimeout(saverWakeTimer); saverWakeTimer = null; }
  if (dispRef) dispRef.off();
  releaseWakeLock();
  // P2 #21: «Avslutt» sendte deg til forsiden, altså ut av eventet du sto i.
  window.location.href = window.location.pathname + (dispEventId ? '?e=' + dispEventId : '');
}

// ===== SKJERMEN SKAL IKKE SOVNE =====
// Liveskjermen står på en TV eller en projektor i timevis uten at noen rører
// den. wakeLock finnes ikke i alle nettlesere (bl.a. ikke iOS-Safari før 16.4),
// så alt her er «hvis det går, fint» — feiler det, oppfører appen seg som før.
let wakeLock = null;
async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try { wakeLock = await navigator.wakeLock.request('screen'); } catch (err) { wakeLock = null; }
}
function releaseWakeLock() {
  if (!wakeLock) return;
  const w = wakeLock; wakeLock = null;
  try { w.release(); } catch (err) { /* allerede sluppet */ }
}
// Låsen slippes automatisk når fanen skjules (bytte av fane, låst skjerm).
// Uten dette ville den ikke kommet tilbake når TV-en vekkes igjen.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'visible') return;
  if (!document.getElementById('screen-display')?.classList.contains('active')) return;
  requestWakeLock();
});

async function loadDisplayScreen(eventId) {
  dispEventId = eventId;
  const snap = await db.ref('events/'+eventId+'/meta').once('value');
  const meta = snap.val();
  if (!meta) { showScreen('screen-home'); return; }
  document.getElementById('disp-event-name').textContent = meta.name;
  document.title = meta.name + ' · dCup Live';

  dispRef = db.ref('events/'+eventId+'/tournaments');
  dispRef.on('value', snap=>{
    dispTournaments = snap.val()||{};
    renderDisplay();
    checkForReveal();
  });
  showScreen('screen-display');
  // Fyrte lytteren over før skjermen ble aktiv, ble alt tegnet i et skjult
  // element. Mål og tegn på nytt nå som den faktisk har en høyde.
  dispPerPage = null;
  renderDisplay();
  startDisplayRotation();
  requestWakeLock();
}

// Skjuler turneringer som ikke er startet ennå, eller som er markert
// fullført — liveskjermen skal bare vise det som faktisk pågår.
function visibleDispTournaments() {
  return sortedTournaments(dispTournaments).filter(([,t]) => isStarted(t) && !t.hideFromDisplay);
}

// ===== VINNERAVSLØRING =====
// Spilles én gang, når skjermen ser en vinner dukke opp mens den står på.
// Ved oppstart merkes vinnere som alt finnes som avslørt, slik at en
// oppfriskning av TV-en ikke spiller av gamle finaler på nytt.
let revealedWinners = new Set();
let revealSeeded = false;
let revealBusy = false;
let revealTimers = [];
let fireworks = null;

function seedRevealed() {
  Object.entries(dispTournaments).forEach(([tid, t]) => {
    if (podium(t)) revealedWinners.add(tid);
  });
  revealSeeded = true;
}

function checkForReveal() {
  if (!revealSeeded) { seedRevealed(); return; }

  // P2 #13: nullstilles en turnering (eller endres finaleresultatet slik at
  // det ikke lenger finnes en vinner), skal en ny vinner avsløres på nytt.
  // Uten dette lå tid-en i settet for alltid og avsløringen kom aldri igjen.
  // Samme for turneringer som er borte fra eventet.
  for (const tid of [...revealedWinners]) {
    const t = dispTournaments[tid];
    if (!t || !podium(t)) revealedWinners.delete(tid);
  }

  if (revealBusy) return;
  for (const [tid, t] of Object.entries(dispTournaments)) {
    if (t.hideFromDisplay || revealedWinners.has(tid)) continue;
    const pod = podium(t);
    if (pod) { revealedWinners.add(tid); playReveal(tid); return; }
  }
}

function clearReveal() {
  revealTimers.forEach(clearTimeout);
  revealTimers = [];
  if (fireworks) { fireworks.stop(); fireworks = null; }
  revealBusy = false;
  const el = document.getElementById('disp-reveal');
  if (el) el.style.display = 'none';
}

function playReveal(tid) {
  const el = document.getElementById('disp-reveal');
  const t = dispTournaments[tid];
  const pod = t && podium(t);
  if (!el || !pod) return;
  revealBusy = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const eyebrow = document.getElementById('reveal-eyebrow');
  const line = document.getElementById('reveal-line');
  const nameEl = document.getElementById('reveal-name');
  const podEl = document.getElementById('reveal-podium');

  const setLine = txt => {
    line.textContent = txt;
    line.classList.remove('fade');
    void line.offsetWidth; // tvinger animasjonen til å starte på nytt
    line.classList.add('fade');
  };

  eyebrow.textContent = '';
  line.textContent = '';
  nameEl.textContent = '';
  nameEl.classList.remove('in');
  podEl.innerHTML = '';
  podEl.classList.remove('in');
  el.style.display = 'flex';

  const step = (ms, fn) => revealTimers.push(setTimeout(fn, reduce ? Math.min(ms, 600) : ms));

  const showName = () => {
    eyebrow.textContent = 'Vinneren er';
    line.textContent = '';
    nameEl.textContent = pod.champion;
    nameEl.classList.add('in');
    if (!reduce) fireworks = startFireworks(document.getElementById('disp-fireworks'));
  };

  const showPodium = () => {
    const fresh = podium(dispTournaments[tid] || {}) || pod;
    const rows = [
      { cls: 'silver', medal: '🥈', pos: '2. plass', name: fresh.runnerUp },
      { cls: 'gold', medal: '🥇', pos: '1. plass', name: fresh.champion },
      { cls: 'bronze', medal: '🥉', pos: '3. plass', name: fresh.third },
    ].filter(r => r.name);
    podEl.innerHTML = rows.map(r => `
      <div class="reveal-step ${r.cls}">
        <span class="reveal-medal">${r.medal}</span>
        <div class="reveal-step-pos">${r.pos}</div>
        <div class="reveal-step-name">${escapeHTML(r.name)}</div>
      </div>`).join('');
    podEl.classList.add('in');
  };

  eyebrow.textContent = 'Og vi har en vinner i';
  setLine(t.name || 'turneringen');
  step(3400, () => { eyebrow.textContent = ''; setLine(winnerBlurb(t, pod.champion)); });
  step(7400, () => { eyebrow.textContent = ''; setLine('Vinneren er…'); });
  step(9600, showName);
  step(12200, showPodium);
  // P2 #12: kom det en vinner nummer to mens denne spilte, ble den aldri vist
  // — checkForReveal kjørte bare på snapshot, og der returnerte den med en
  // gang fordi revealBusy sto. Se etter neste når denne er ferdig.
  step(reduce ? 9000 : 22000, () => { clearReveal(); checkForReveal(); });
}

// Enkelt partikkelsystem på canvas. Ingen bibliotek, ingen SVG-baner.
function startFireworks(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  let raf = null, burstTimer = null, running = true;
  let particles = [];
  const COLORS = ['#fcd34d', '#93c5fd', '#86efac', '#f9a8d4', '#fdba74', '#ffffff'];

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  function burst() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    const x = w * (0.15 + Math.random() * 0.7);
    const y = h * (0.12 + Math.random() * 0.4);
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const count = 60 + Math.floor(Math.random() * 40);
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.2;
      const speed = 1.6 + Math.random() * 3.4;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.008 + Math.random() * 0.012,
        color,
        size: 1.4 + Math.random() * 1.8,
      });
    }
    if (particles.length > 2200) particles = particles.slice(-2200);
  }

  function frame() {
    if (!running) return;
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => {
      p.vy += 0.035;          // tyngdekraft
      p.vx *= 0.985;          // luftmotstand
      p.vy *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      ctx.globalAlpha = Math.max(p.life, 0);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    raf = requestAnimationFrame(frame);
  }

  burst();
  burstTimer = setInterval(burst, 620);
  frame();
  window.addEventListener('resize', resize);

  return {
    stop() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
      if (burstTimer) clearInterval(burstTimer);
      window.removeEventListener('resize', resize);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      particles = [];
    }
  };
}

function startDisplayRotation() {
  const STAY = 12000; // 12s per side
  displayIntervals.push(setInterval(()=>{
    if (revealBusy) return; // ikke bytt noe midt i en avsløring
    const tList = visibleDispTournaments();
    if (!tList.length) return;
    const [, t] = tList[Math.min(dispCurrent, tList.length-1)];

    // Er det flere grupper å vise på denne turneringen, bla side først.
    // Ellers nullstill siden og gå videre til neste turnering.
    if (dispGroupPage + 1 < groupPages(t)) {
      dispGroupPage++;
    } else if (tList.length > 1) {
      dispGroupPage = 0;
      dispCurrent = (dispCurrent+1)%tList.length;
    } else {
      syncProgressBar(); // én turnering, én side: ingenting å rullere mellom
      return;
    }
    renderDisplay();
    animateProgressBar(STAY);
  }, STAY));

  // Første side skal ha en levende bar med en gang, ikke først etter 12s.
  // Litt forsinket fordi sidetellingen måles under første rendring.
  displayTimers.push(setTimeout(() => {
    syncProgressBar();
    if (willRotate()) animateProgressBar(STAY);
  }, 60));
}

function animateProgressBar(duration) {
  const fill = document.getElementById('disp-next-fill');
  if (!fill) return;
  fill.style.transition = 'none'; fill.style.width = '0%';
  setTimeout(()=>{ fill.style.transition = `width ${duration}ms linear`; fill.style.width='100%'; }, 50);
}

// Hvor mange grupper som får plass samtidig måles, ikke antas: fire grupper à
// tre spillere får plass på 720p, fire à fem gjør ikke. Å hardkode «maks 2 om
// gangen» ville bladd når det ikke var nødvendig.
let dispGroupPage = 0;
let dispPerPage = null;   // null = ikke målt for denne turneringen ennå
let dispPageKey = null;   // hvilken turnering og form målingen gjelder

// Formen som avgjør om målingen fortsatt holder: bytter turnering, antall
// grupper eller antall spillere, må den gjøres på nytt.
function groupShapeKey(tid, t) {
  return tid + ':' + groupsOf(t).map(g => g.players.length).join(',');
}

function measurePerPage(t, paint) {
  const gs = groupsOf(t);
  for (let per = gs.length; per > 1; per--) {
    // Tegn først, slå opp elementet etterpå: ved første rendring finnes det
    // ikke ennå, og en oppslag før paint ga «alle får plass» uten å måle.
    paint(gs.slice(0, per));
    const col = document.getElementById('disp-tables-col');
    if (!col) return per;
    // Skjermen kan være skjult ennå: loadDisplayScreen registrerer lytteren
    // før showScreen. Da er clientHeight 0, «alt får plass», og resultatet
    // ville blitt cachet slik at liveskjermen sluttet å bla. Svar null —
    // ingen måling å lagre, prøv igjen ved neste rendring.
    if (!col.clientHeight) return null;
    // Lesing av scrollHeight tvinger layout, så målingen gjelder det som
    // nettopp ble tegnet.
    if (col.scrollHeight <= col.clientHeight + 1) return per;
  }
  return 1;
}

function groupPages(t) {
  const n = groupsOf(t).length;
  return dispPerPage ? Math.ceil(n / dispPerPage) : 1;
}

// Målingen gjelder viewporten den ble gjort i. Går skjermen til fullskjerm på
// TV-en fortsetter den ellers å bla selv om alt får plass — og motsatt vei blir
// gruppe C og D klippet bort av .display-col { overflow:hidden } uten et pip,
// fordi målingen fortsatt sier at alle får plass.
// Debounces: resize fyrer per frame når man drar i vinduet, og measurePerPage
// tvinger layout opptil én gang per gruppe.
let dispResizeTimer = null;
window.addEventListener('resize', () => {
  const shown = document.getElementById('screen-display');
  if (!shown || !shown.classList.contains('active') || dispPageKey === null) return;
  clearTimeout(dispResizeTimer);
  dispResizeTimer = setTimeout(() => {
    dispPerPage = null;
    renderDisplay();
  }, 250);
});

// P2 #22: fremdriftsbaren lovet «neste om litt». Den ble aldri animert før
// første rotasjon, og med én turnering på én side kom den rotasjonen aldri —
// da skal baren ikke stå der i det hele tatt. willRotate() svarer på om det
// finnes noe å bla til, og syncProgressBar() skjuler eller viser baren etter
// det. Kalles ved hver rendring, siden både antall turneringer og antall
// sider kan endre seg mens skjermen står på.
function willRotate() {
  const tList = visibleDispTournaments();
  if (!tList.length) return false;
  if (tList.length > 1) return true;
  return groupPages(tList[0][1]) > 1;
}
function syncProgressBar() {
  const bar = document.querySelector('.display-next-bar');
  if (bar) bar.style.visibility = willRotate() ? 'visible' : 'hidden';
}

function renderDisplay() {
  renderDisplayContent();
  syncProgressBar();
  syncSaver();
}

function idleMessage() {
  return Object.keys(dispTournaments).length
    ? 'Venter på at en turnering skal starte'
    : 'Ingen turneringer ennå';
}

// ===== SKJERMSPARER =====
// Når ingen turnering er i gang er liveskjermen bare et bilde på veggen, ikke
// en app som venter. Skjermspareren legger seg over hele liveskjermen — også
// header og footer — så TV-en viser kick-off-banneret i stedet for en tom
// ramme. Den forsvinner av seg selv i det første kampoppsettet dukker opp.
//
// Et trykk vekker skjermen i SAVER_WAKE ms. Det må finnes: uten det ligger
// «Avslutt» under bildet, og da er det ingen vei ut av visningsmodus.
const SAVER_WAKE = 30000;
let saverWakeTimer = null;
function syncSaver() {
  const el = document.getElementById('disp-saver');
  if (!el) return;
  const show = !visibleDispTournaments().length && !saverWakeTimer;
  if (show) document.getElementById('disp-saver-msg').textContent = idleMessage();
  el.style.display = show ? 'flex' : 'none';
}
function wakeSaver() {
  if (saverWakeTimer) clearTimeout(saverWakeTimer);
  saverWakeTimer = setTimeout(() => { saverWakeTimer = null; syncSaver(); }, SAVER_WAKE);
  syncSaver();
}

function renderDisplayContent() {
  const tList = visibleDispTournaments();
  if (!tList.length) {
    // Selve tomtilstanden dekkes av skjermspareren (syncSaver), men teksten
    // ligger her likevel: den er det man ser i de 30 sekundene skjermen er
    // vekket, og hvis bildet ikke finnes.
    document.getElementById('disp-content').innerHTML = `<div style="opacity:0.3;text-align:center;padding:3rem;font-size:18px;">${escapeHTML(idleMessage())}</div>`;
    return;
  }
  dispCurrent = Math.min(dispCurrent, tList.length-1);
  const [tid, t] = tList[dispCurrent];
  const sport = SPORTS.find(s=>s.id===t.sport)||SPORTS[SPORTS.length-1];

  document.getElementById('disp-t-name').textContent = t.name||'';
  document.getElementById('disp-sport-icon').textContent = sport.icon;
  document.getElementById('disp-indicator').innerHTML = tList.map((_,i)=>
    `<div class="display-dot ${i===dispCurrent?'active':''}"></div>`
  ).join('');


  const board = isBoard(t);
  const pod = podium(t);
  const content = document.getElementById('disp-content');

  // Ferdig turnering: pallen er det som betyr noe, ikke tabellen. Den blir
  // stående til noen merker turneringen som fullført.
  if (pod) {
    const rows = [
      { cls:'silver', medal:'🥈', pos:'2. plass', name:pod.runnerUp },
      { cls:'gold',   medal:'🥇', pos:'1. plass', name:pod.champion },
      { cls:'bronze', medal:'🥉', pos:'3. plass', name:pod.third },
    ].filter(r => r.name);
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:1.5rem;">
        <div class="display-section-title" style="margin:0;">🏆 ${escapeHTML(t.name||'')} er avgjort</div>
        <div class="reveal-name" style="opacity:1;margin:0;font-size:clamp(34px,6vw,76px);">${escapeHTML(pod.champion)}</div>
        <div class="display-card-sub" style="font-size:15px;opacity:0.55;max-width:46ch;text-align:center;">${escapeHTML(winnerBlurb(t, pod.champion))}</div>
        <div class="reveal-podium" style="margin:0;opacity:1;">
          ${rows.map(r => `
            <div class="reveal-step ${r.cls}">
              <span class="reveal-medal">${r.medal}</span>
              <div class="reveal-step-pos">${r.pos}</div>
              <div class="reveal-step-name">${escapeHTML(r.name)}</div>
            </div>`).join('')}
        </div>
      </div>`;
    return;
  }

  const paint = (subset, label, offset) => {
    content.innerHTML = `
      <div class="display-main">
        <div class="display-col" id="disp-tables-col">
          <div class="display-section-title">${board?'Poengtavle':'Tabell'}${label||''}</div>
          ${board?renderDisplayBoard(t):renderDisplayTables(t, subset, offset)}
        </div>
        <div class="display-col">${board?renderDisplayBoardSide(t):renderDisplaySide(t)}</div>
      </div>`;
  };

  if (board) { paint(); return; }

  const gs = groupsOf(t);
  const key = groupShapeKey(tid, t);
  if (key !== dispPageKey) {
    dispPageKey = key;
    dispGroupPage = 0;
    dispPerPage = null;
  }
  if (dispPerPage === null) dispPerPage = measurePerPage(t, paint);
  // Ikke målt ennå (skjermen var skjult): vis alt, og la dispPerPage stå null
  // så neste rendring måler på nytt.
  const per = dispPerPage || gs.length;

  const pages = groupPages(t);
  if (dispGroupPage >= pages) dispGroupPage = 0;
  const from = dispGroupPage * per;
  const subset = gs.slice(from, from + per);
  // Sidetelleren står bare når det faktisk er mer enn én side
  paint(subset, pages > 1 ? ` · side ${dispGroupPage+1} av ${pages}` : '', from);
}

function renderDisplayBoard(t) {
  const rows = boardStandings(t);
  if (!rows.length) return '<div style="opacity:0.3;font-size:18px;">Ingen spillere ennå</div>';
  return `<table class="display-table">
    <thead><tr><th style="width:30px;">#</th><th class="name">Spiller</th><th>Score</th></tr></thead>
    <tbody>${rows.map(r=>{
      const pc=r.pos===1?'p1':r.pos===2?'p2':r.pos===3?'p3':'px';
      return `<tr>
        <td><span class="display-pos ${pc}">${r.pos||'–'}</span></td>
        <td class="name">${escapeHTML(r.name)}</td>
        <td style="font-weight:700;">${r.score===null?'—':r.score}</td>
      </tr>`;
    }).join('')}</tbody>
  </table>`;
}

function renderDisplayBoardSide(t) {
  const rows = boardStandings(t);
  const scored = rows.filter(r=>r.score!==null);
  const missing = rows.filter(r=>r.score===null);
  const last = scored.slice().sort((a,b)=>(b.ts||0)-(a.ts||0))[0];

  const lastCard = `<div class="display-card">
    <div class="display-card-label">Siste registrering</div>
    ${last
      ? `<div class="display-result-line">${escapeHTML(last.name)}<span class="display-score">${last.score}</span></div>
         <div class="display-card-sub">${scored.length} av ${rows.length} har levert</div>`
      : `<div class="display-result-line" style="opacity:0.3;">—</div>
         <div class="display-card-sub">Ingen scorer ennå</div>`}
  </div>`;

  const doneCard = `<div class="display-card next">
    <div class="display-card-label">${missing.length?'Mangler score':'Ferdig'}</div>
    ${missing.length
      ? missing.slice(0,DISP_QUEUE_MAX).map(r=>
          `<div class="display-queue-item"><span class="display-queue-teams">${escapeHTML(r.name)}</span></div>`).join('')
        + (missing.length>DISP_QUEUE_MAX
            ? `<div class="display-card-sub">+ ${missing.length-DISP_QUEUE_MAX} flere</div>` : '')
      : `<div class="display-result-line">🏆 ${escapeHTML((rows[0]||{}).name||'—')}</div>
         <div class="display-card-sub">${SCORE_DIRS[scoreDirOf(t)].label} · score ${(rows[0]||{}).score ?? '—'}</div>`}
  </div>`;

  return lastCard + doneCard;
}

function renderDisplayTables(t, subset, offset) {
  const showGD = t.mode==='score';
  const showD = t.mode==='wdl';
  const gs = subset || groupsOf(t);
  const from = offset || 0;
  return `<div class="display-grid">
    ${gs.map((g, i)=>{
      if(!g.players.length) return '';
      // from + i er gruppas ekte indeks i turneringen — subset er en utsnitt
      // av sidevisningen, så i alene ville pekt på feil gruppes avgjørelser.
      const rows=calcStandings(g.players, g.results, t.mode, scoreDirOf(t), tiebreaksFor(t, from + i));
      return `<div>
        <div class="display-group-title">Gruppe ${escapeHTML(g.name)}</div>
        <table class="display-table">
          <thead><tr>
            <th style="width:30px;">#</th><th class="name">Spiller</th>
            <th>K</th><th>S</th>${showD?'<th>U</th>':''}<th>T</th>${showGD?'<th>M+/-</th>':''}
            <th>Pkt</th>
          </tr></thead>
          <tbody>${rows.map(r=>{
            const pc=r.pos===1?'p1':r.pos===2?'p2':r.pos===3?'p3':'px';
            const gdStr=r.gd>0?'+'+r.gd:r.gd;
            return `<tr>
              <td><span class="display-pos ${pc}">${r.pos}</span></td>
              <td class="name">${escapeHTML(r.name)}</td>
              <td>${r.p}</td><td>${r.w}</td>${showD?`<td>${r.d}</td>`:''}<td>${r.l}</td>
              ${showGD?`<td>${gdStr}</td>`:''}
              <td style="font-weight:700;">${r.pts}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>`;
    }).join('')}
  </div>`;
}

// Høyre kolonne: siste resultat, og køen slik at folk ser når de selv skal spille
const DISP_QUEUE_MAX = 6;
// Køen fortsetter inn i sluttspillet. Før dette stoppet liveskjermen på
// «Alle kamper spilt» mens semifinaler, bronse og finale gjensto — og det er
// nettopp de kampene folk samler seg rundt skjermen for.
// Kamper som venter på den foran tas ikke med: «Vinner av semi 1» er ingen kø.
function playoffQueue(t) {
  const pr = t.playoffResults || {};
  return playoffMatches(t)
    .filter(m => m.home !== undefined && m.away !== undefined)
    .filter(m => { const r = pr[m.key]; return !r || !r.winner || r.winner === 'draw'; })
    .map(m => ({ playoff: true, key: m.key, label: m.label, f: [m.home, m.away] }));
}

function lastPlayoffPlayed(t) {
  const pr = t.playoffResults || {};
  const played = playoffMatches(t)
    .map(m => ({ m, r: pr[m.key] }))
    .filter(x => x.r && x.r.winner);
  if (!played.length) return null;
  const best = played.reduce((a, b) => (b.r.ts || 0) >= (a.r.ts || 0) ? b : a);
  return { playoff: true, label: best.m.label, f: [best.r.home, best.r.away], r: best.r };
}

function renderDisplaySide(t) {
  const order = playOrder(t);
  if (!order.length) return `<div class="display-card">
    <div class="display-card-label">Neste kamper</div>
    <div class="display-result-line" style="opacity:0.3;">Ikke satt opp ennå</div>
  </div>`;

  const groupLast = lastPlayed(t);
  const poLast = lastPlayoffPlayed(t);
  // Nyeste av de to. Sluttspillet spilles sist, så uten dette ville skjermen
  // vist en gruppekamp som «siste resultat» lenge etter finalen.
  const last = !poLast ? groupLast
    : !groupLast ? poLast
    : ((poLast.r.ts || 0) >= (groupLast.r.ts || 0) ? poLast : groupLast);
  const queue = order.filter(m=>!isPlayed(t,m)).concat(playoffQueue(t));

  const lastCard = `<div class="display-card">
    <div class="display-card-label">Siste resultat</div>
    ${last
      ? `<div class="display-result-line">${displayMatchLine(t,last.f,last.r)}</div>
         <div class="display-card-sub">${last.playoff
             ? escapeHTML(last.label)
             : `Gruppe ${escapeHTML(groupName(t, last.gi))} · ${order.filter(m=>isPlayed(t,m)).length} av ${order.length} spilt`}</div>`
      : `<div class="display-result-line" style="opacity:0.3;">—</div>
         <div class="display-card-sub">Ingen kamper spilt ennå</div>`}
  </div>`;

  const queueCard = `<div class="display-card next">
    <div class="display-card-label">${queue.length?'Neste kamper':'Ferdig'}</div>
    ${queue.length
      ? queue.slice(0,DISP_QUEUE_MAX).map((m,i)=>`
          <div class="display-queue-item${i===0?' up-next':''}">
            <span class="display-queue-num">${i===0?'▶':i+1}</span>
            <span class="display-queue-teams">${escapeHTML(m.f[0])}<span class="display-vs">vs</span>${escapeHTML(m.f[1])}</span>
            ${m.playoff
              ? `<span class="display-queue-grp po">${escapeHTML(m.label)}</span>`
              : `<span class="display-queue-grp g${m.gi}">${escapeHTML(groupName(t, m.gi))}</span>`}
          </div>`).join('')
        + (queue.length>DISP_QUEUE_MAX
            ? `<div class="display-card-sub">+ ${queue.length-DISP_QUEUE_MAX} kamper etter dette</div>` : '')
      : (t.playoffResults||{})['match_0'] && (t.playoffResults||{})['match_0'].winner === 'draw'
        ? `<div class="display-result-line">Finalen står likt</div>
           <div class="display-card-sub">Må avgjøres før turneringen har en vinner</div>`
        : `<div class="display-result-line">🏁 Alle kamper spilt</div>
           <div class="display-card-sub">${order.length} av ${order.length} ferdig</div>`}
  </div>`;

  return lastCard + queueCard;
}

function displayMatchLine(t, f, r) {
  if (t.mode==='score' && typeof r.homeScore==='number' && typeof r.awayScore==='number')
    return `${escapeHTML(f[0])}<span class="display-score">${r.homeScore}–${r.awayScore}</span>${escapeHTML(f[1])}`;
  if (r.winner==='draw')
    return `${escapeHTML(f[0])}<span class="display-vs">uavgjort</span>${escapeHTML(f[1])}`;
  const w = r.winner==='a'?f[0]:f[1], l = r.winner==='a'?f[1]:f[0];
  return `${escapeHTML(w)}<span class="display-vs">slo</span>${escapeHTML(l)}`;
}

// ===== OPPSTART =====
// Kalles helt til slutt, ikke der boot() er definert: variabler som
// currentEventId deklareres med let lenger ned, og et synkront kall midt i
// fila treffer temporal dead zone.
// dcup.js lastes dynamisk for å få et unikt versjonsnummer, og kjører derfor
// først etter at DOMContentLoaded har fyrt — å bare lytte på hendelsen ville
// gjort at appen aldri bootet.
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', boot);
else boot();

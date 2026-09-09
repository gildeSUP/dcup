# Plan: valgfritt antall grupper (1, 2 eller 4)

Overleveringsdokument. Skrevet for en økt som ikke har vært med på diskusjonen —
alt du trenger å vite skal stå her.

**Status:** spesifisert og klar. Ingen uløste designspørsmål.

---

## 0. Kontekst

dCup er en enkeltside-app uten byggesteg: `index.html` + `dcup.js` + `dcup.css`,
deployet via GitHub Pages til `dcup.tveras.no`. Firebase Realtime Database
(compat-SDK fra CDN) er eneste backend. Ingen innlogging — den som har
event-linken kan endre alt.

Kjør lokalt med `.claude/launch.json`-konfigurasjonen `dcup`
(`python3 -m http.server 8931`).

I dag deles enhver turnering i **nøyaktig to** grupper. Målet er at antallet
velges når turneringen startes, ikke når den opprettes — for når den opprettes
vet man ikke hvem som kommer.

---

## 1. Beslutninger som er tatt

Disse er avklart med eier. Ikke ta dem opp igjen uten grunn.

| Beslutning | Begrunnelse |
|---|---|
| Én `groups`-liste, ikke parallelle felt | Parallelle lister kan komme i utakt; Firebase sletter tomme noder og lager hull i indeksene |
| **Databasen wipes.** Ingen bakoverkompatibilitet | Fjerner behovet for en adapter med doble skrivestier — den var refaktoreringens største risiko |
| Antall grupper velges ved start, i en dialog | Ved opprettelse er deltakerlista ukjent |
| Deltakerantallet hentes ferskt ved klikk | Lokal `tState` kan være utdatert |
| Minst 3 spillere per gruppe | Under det er det en utslagskamp, ikke en gruppe. **Følge: 4 deltakere gir én gruppe**, ikke to à to som i dag. De mister finalekampen, men ikke vinneren — tabelltoppen kåres |
| Bare **1, 2 eller 4** grupper er lov | Alle tre gir et symmetrisk sluttspill. 3 grupper ville krevd at én gruppevinner fikk walkover til finalen — en fordel ingen regel kan fordele rettferdig |
| Sluttspillet parer grupper vilkårlig — ingen rangering på tvers | Trekningen er allerede tilfeldig, så parringen er det også. Fjerner behovet for å sammenligne poeng mellom grupper av ulik størrelse |

---

## 2. Datamodell

### Etter

```js
events/<eventId>/tournaments/<tid> = {
  name, sport, mode, format, scoreDir, created,
  players: ['Anna', 'Bjørn', ...],     // påmeldingspulje — uendret
  groups: [                             // finnes først etter «Start turnering»
    {
      name: 'A',                        // ALLTID satt, se invariant under
      players: ['Anna', 'Cecilie', ...],
      fixtures: [['Anna','Cecilie'], ...],
      results: { '<fkey>': { winner, loser, home, away, homeScore, awayScore, ts } }
    },
    ...
  ],
  playoffResults: { '<nøkkel>': { winner, loser, home, away, homeScore, awayScore, ts } },
  scores: {},                           // kun format:'board'
  hideFromDisplay: bool
}
```

**Fjernes helt:** `groupA`, `groupB`, `fixturesA`, `fixturesB`, `resultsA`, `resultsB`.

### To invarianter som må holdes

1. **Hver gruppe har alltid en ikke-tom `name`.** Firebase sletter noder som blir
   tomme. En gruppe uten innhold ville forsvunnet og etterlatt `{0:…, 2:…}` der
   koden forventer en array. `name` gjør noden usletbar. Skriv aldri en gruppe
   uten navn.
2. **`groupsOf(t)[i]` svarer til databasestien `groups/{i}`.** Ikke filtrer eller
   reindekser lista — skrivestiene er indeksbaserte.

### Endring i `playoffResults`

Lagre `home`/`away` som **navn**, slik gruppekampene alltid har gjort. I dag
lagres bare `winner: 'a'|'b'`, som peker på en seedingsplass. Endres et
gruppekampresultat etter finalen, endres tabellen — og dermed hvem `podium()`
mener vant. Vinneren kan bytte person i etterkant. Dette er P1 #6 i
`PRIORITERINGER.md`; det ligger midt i blastradiusen for steg 3 og er billigere
å ta nå.

---

## 3. Regler og konstanter

```js
const MIN_GROUP = 3;             // minste spillere per gruppe — og gulv for hele turneringen
const ALLOWED_GROUPS = [1, 2, 4]; // symmetriske brackets. 3 er utelatt med vilje
const TARGET_MATCHES = 20;       // forslaget sikter på ≤ så mange kamper
```

`MIN_GROUP` styrer både sperren og minste turnering: finnes det ikke rom for
én lovlig gruppe, finnes det ingen turnering. Dagens hardkodede «minst 4
spillere» i `generateTournament` forsvinner.

`TARGET_MATCHES = 20` er ca. halvannen til to timer på én stasjon. Det er den
bindende begrensningen på en firmafest — ikke gruppestørrelsen. Én konstant å
skru på.

```js
// Lovlige valg for n deltakere: symmetrisk bracket OG nok folk til hver gruppe
function allowedGroups(n) {
  return ALLOWED_GROUPS.filter(g => Math.floor(n / g) >= MIN_GROUP);
}
function maxGroups(n) {
  const a = allowedGroups(n);
  return a.length ? a[a.length - 1] : 0;
}

function matchCount(n, g) {          // eksakt, ikke omtrentlig
  const q = Math.floor(n / g), r = n % g;
  const c = k => k * (k - 1) / 2;
  return r * c(q + 1) + (g - r) * c(q);
}

function suggestGroups(n) {
  const a = allowedGroups(n);
  return a.find(g => matchCount(n, g) <= TARGET_MATCHES) ?? a[a.length - 1];
}

function groupSizes(n, g) {          // til visning: «4 + 4 + 3»
  const q = Math.floor(n / g), r = n % g;
  return Array.from({ length: g }, (_, i) => i < r ? q + 1 : q);
}
```

Kontroll av `matchCount` mot 12 deltakere: 66 / 30 / 18 / 12.

Lovlige valg og forslag:

| n | lovlig | foreslår | kamper |
|---|---|---|---|
| 3 | 1 | 1 | 3 |
| 6 | 1, 2 | 1 | 15 |
| 8 | 1, 2 | 2 | 12 |
| 9 | 1, 2 | 2 | 16 |
| 12 | 1, 2, 4 | 4 | 12 |
| 16 | 1, 2, 4 | 4 | 24 |
| 20 | 1, 2, 4 | 4 | 40 |

Merk at 12 deltakere ikke lenger kan velge 3 grupper (18 kamper). Valget står
mellom 30 og 12. Det er prisen for at sluttspillet alltid er symmetrisk.

### Treergrupper skal advares mot, ikke forbys

I en gruppe på tre uten uavgjort er **25 % av alle utfall en tresykel** — A slår
B, B slår C, C slår A. Alle står med 3 poeng og én seier, og innbyrdes oppgjør
kan ikke skille dem. Verifisert ved å kjøre alle åtte utfall gjennom
`calcStandings`: to av dem er sykler, og hver av dem gir tre forskjellige
tabeller avhengig av hvilken rekkefølge spillerne ligger i gruppa.

I `score`-modus er det ikke noe problem — målforskjell sorterer før innbyrdes
oppgjør og bryter sykelen nesten alltid.

Med 3 eller 7 deltakere finnes det ikke noe bedre alternativ, så treergrupper
skal være lov. Men dialogen skal si fra når det valgte antallet lager en gruppe
på `MIN_GROUP` **og** `mode` er `wl` eller `wdl`:

> ⚠️ Gruppe B får tre spillere. Ved W/T kan tre like resultater ikke skilles —
> da avgjør trekningen.

---

## 4. Nye og endrede funksjoner

### Nye

```js
// Normaliserer bare form (Firebase kan levere objekt med numeriske nøkler
// i stedet for array). Ingen bakoverkompatibilitet — databasen er wipet.
function groupsOf(t) {
  const g = t.groups;
  if (!g) return [];
  const arr = Array.isArray(g) ? g : Object.keys(g).sort((a,b)=>a-b).map(k => g[k]);
  return arr.map(x => ({
    name: x.name, players: x.players || [], fixtures: x.fixtures || [], results: x.results || {}
  }));
}

function resultsPath(gi) { return `groups/${gi}/results`; }
```

### Endret signatur — husk kallstedene i generert HTML

| Funksjon | Før | Etter |
|---|---|---|
| `computeGroups` | `(players)` → `{groupA, groupB, fixturesA, fixturesB}` | `(players, g)` → `[{name, players, fixtures, results}]` |
| `playOrder` | `[{grp:'a', idx, f}]` | `[{gi:0, idx, f}]` |
| `matchResult` | leser `t.resultsA`/`resultsB` | leser `groupsOf(t)[m.gi].results` |
| `openMatchDialog` | `(grp, idx)` | `(gi, idx)` — kalles fra `onclick` i `renderTournamentView` |

`generateTournament` erstattes av `startTournament` + `confirmStart`.

### Fordeling

```js
function computeGroups(players, g) {
  const s = shuffle(players);
  const buckets = Array.from({ length: g }, (_, i) => ({
    name: String.fromCharCode(65 + i), players: []
  }));
  s.forEach((p, i) => buckets[i % g].players.push(p));
  return buckets.map(b => ({ ...b, fixtures: roundRobin(b.players), results: {} }));
}
```

Stokk, så del ut rundt og rundt. Gir størrelser som skiller maks én, og bøtte
`0..r-1` får den ekstra — samme rekkefølge som `groupSizes()`.

### `playOrder` — kampene i spillerekkefølge

```js
function playOrder(t) {
  const gs = groupsOf(t);
  const max = Math.max(0, ...gs.map(g => g.fixtures.length));
  const order = [];
  for (let i = 0; i < max; i++)
    gs.forEach((g, gi) => { if (g.fixtures[i]) order.push({ gi, idx: i, f: g.fixtures[i] }); });
  return order;
}
```

Gruppene går fortsatt parallelt: A1, B1, C1, A2, B2, C2 …
Gruppebokstav til visning: `groupsOf(t)[m.gi].name`.

### Sluttspillet — `playoffMatches(t)`

Gruppene pares **vilkårlig**, ikke etter rangering på tvers. `computeGroups`
stokker før den deler ut, så gruppe A–D er tilfeldig sammensatt — da er
parringen tilfeldig av seg selv, og det trengs ingen regel for å sammenligne
poeng mellom grupper av ulik størrelse.

| Grupper | Bracket | Kamper |
|---|---|---|
| 1 | Ingen sluttspill — tabelltoppen vinner | 0 |
| 2 | Som i dag: én kamp per tabellplass, A*i* mot B*i* | n |
| 4 | A–B og C–D i semi, så finale og bronse | 4 |

Begge brackets er symmetriske — ingen får walkover. Det er derfor 3 grupper er
sperret; se § 1.

`match_0` er finalen uansett antall grupper. Hold den invarianten — `podium()`
hviler på den.

```js
function playoffMatches(t) {
  const gs = groupsOf(t);
  if (gs.length < 2) return [];
  const st = gs.map(g => calcStandings(g.players, g.results, t.mode, scoreDirOf(t)));
  const pr = t.playoffResults || {};
  const top   = i => ((st[i] || [])[0] || {}).name;
  const win   = k => { const r = pr[k]; return r && r.winner && r.winner !== 'draw'
                         ? (r.winner === 'a' ? r.home : r.away) : undefined; };
  const lose  = k => (pr[k] || {}).loser;

  if (gs.length === 2) {                       // uendret oppførsel
    const size = Math.min(st[0].length, st[1].length);
    return Array.from({ length: size }, (_, i) => ({
      key: 'match_' + i,
      label: i === 0 ? 'FINALE' : `${2 * i + 1}. PLASS`,
      home: (st[0][i] || {}).name, away: (st[1][i] || {}).name,
    }));
  }
  return [                                     // 4 grupper
    { key:'semi_0',  label:'SEMIFINALE 1', home: top(0), away: top(1) },
    { key:'semi_1',  label:'SEMIFINALE 2', home: top(2), away: top(3) },
    { key:'match_0', label:'FINALE', home: win('semi_0'), away: win('semi_1'),
      homeFrom:'Vinner av semi 1', awayFrom:'Vinner av semi 2' },
    { key:'match_1', label:'BRONSE', home: lose('semi_0'), away: lose('semi_1'),
      homeFrom:'Taper av semi 1', awayFrom:'Taper av semi 2' },
  ];
}
```

`home`/`away` er `undefined` så lenge kampen foran ikke er spilt — vis
`homeFrom`/`awayFrom` som plassholder i stedet for et navn.
Sluttspillfanen blir en `map()` over denne lista, og `openPlayoffDialog` tar
`key` i stedet for indeks.

### `podium(t)`

| Grupper | Vinner | 2. plass | 3. plass |
|---|---|---|---|
| 1 | `calcStandings(gruppa)[0]`, når `isFinished(t)` | `[1]` | `[2]` |
| 2 | Vinner av `match_0` | Taper av `match_0` | Vinner av `match_1` |
| 4 | Vinner av `match_0` | Taper av `match_0` | Vinner av `match_1` |

Navnene leses fra `home`/`away` i `playoffResults`, ikke fra tabellen — det er
hele poenget med å lagre dem (se § 2).

---

## 5. Startdialogen

Ny bunnark-overlay i `index.html`, samme mønster som `#add-tournament-overlay`
(~linje 113): `#start-tournament-overlay`. Bruk `lockBodyScroll()` /
`unlockBodyScroll()` som de andre.

Knappen i oppsettskortet heter **«Start turnering»**, ikke «Generer grupper».
Oppsettskortet ellers er urørt.

### Innhold

- «**9 deltakere er påmeldt**»
- **Navnene**, ikke bare tallet. Dette er siste øyeblikk for å oppdage at Kari
  mangler — det var hele poenget med å legge valget hit.
- Knapper for `ALLOWED_GROUPS`. De som ikke er i `allowedGroups(n)` er
  deaktiverte med grunn: «4 grupper krever minst 12 deltakere». Ellers ser
  knappen bare ødelagt ut. **3 vises ikke i det hele tatt** — den er sperret av
  designet, ikke av deltakerantallet, og en permanent grå knapp inviterer bare
  til spørsmål.
- Per valg: størrelser og kampantall — «4 + 3 · 9 kamper»
- Treergruppe-advarselen når den gjelder (se § 3)
- Når `maxGroups(n) === 1`: la dialogen lese som en bekreftelse, ikke et valg —
  «3 deltakere · 1 gruppe · 3 kamper — start?»

### Flyt

```js
async function startTournament() {
  const snap = await tRef.child('players').once('value');   // fersk, ikke tState
  const players = snap.val() || [];
  if (players.length < MIN_GROUP) { showToast(`Trenger minst ${MIN_GROUP} deltakere`); return; }
  showStartDialog(players);
}

async function confirmStart(g) {
  let rejected = null;
  await tRef.transaction(current => {
    if (!current) return current;
    const players = current.players || [];
    if (g > maxGroups(players.length)) { rejected = players.length; return; }
    return { ...current, groups: computeGroups(players, g), playoffResults: {} };
  });
  if (rejected !== null) { showToast(`${rejected} deltakere nå — velg på nytt`); return; }
  hideStartDialog();
}
```

**Avbryt bare når valget er blitt ulovlig**, ikke når tallet har endret seg.
Går 12 → 13 med 4 grupper valgt er det helt greit (4/3/3/3). Avbryter du på hver
påmelding blir det uutholdelig midt i en påmeldingsrunde.

**Ikke klem `g` stille ned til ny maks.** Da får man to grupper etter å ha valgt
tre, uten å få vite det.

Bekreftelsen bør si hva det faktisk ble: «4 grupper · 12 kamper». Kampantallet i
dialogen kan være utdatert hvis `n` endret seg — det er kosmetisk, man valgte
formatet, ikke tallet.

---

## 6. Steg

Hvert steg skal kunne stå alene og verifiseres.

### Steg 0 — commit det som ligger i arbeidstreet

`dcup.js` og `index.html` har ucommittede fikser (XSS via `data-key`,
`focusTId`-nullstilling, deterministisk tiebreak, `isSignupLocked`,
cache-busting). De er ferdige og verifiserte. Commit dem for seg — de har
ingenting med gruppeendringen å gjøre, og de neste stegene skriver oppå de
samme funksjonene.

Slett samtidig `nextUp()` (linje ~1052). Den er definert og brukes ingen steder.

### Steg 1 — datamodell, uten å endre atferd

Innfør `groups[]`, `groupsOf`, `resultsPath`, ny `playOrder`. Konverter alle
lesesteder. La `computeGroups` fortsatt lage **nøyaktig 2** grupper.

Legg inn `tests.html` her (se § 7) — steg 1 er nettopp en endring som skal
bevise at den *ikke* endrer noe, og da er tester det billigste verktøyet.

*Ferdig når:* en fersk 2-gruppers turnering oppfører seg identisk med i dag —
grupper, kamper, tabell, sluttspill, liveskjerm, vinneravsløring.

### Steg 2 — antallet velges

`MIN_GROUP`/`ALLOWED_GROUPS`/`TARGET_MATCHES`, `allowedGroups`, `maxGroups`, `matchCount`,
`suggestGroups`, `groupSizes`, `computeGroups(players, g)`, dialogen,
`startTournament`/`confirmStart`.

**Avklar her:** oppfører en avbrutt transaksjon seg som beskrevet i § 7? Test med
to faner mot samme turnering — meld på i den ene, start i den andre, og se om
`confirmStart` avviser et lovlig valg fordi cachen er bakpå. Er svaret ja, må
`confirmStart` hente ferskt før transaksjonen i stedet for å stole på cachen.

*Ferdig når:* 3 deltakere gir bare valget «1». 12 deltakere tilbyr 1/2/4 og
foreslår 4. En turnering med 4 grupper får fire grupper med riktige størrelser.

### Steg 3 — vinner og sluttspill for alle antall

`playoffMatches(t)`, `podium`, `isStarted`, `isFinished`, `winnerBlurb` over
`groupsOf`. `playoffResults` lagrer navn i `home`/`away`. `openPlayoffDialog`
tar `key` i stedet for indeks.

*Ferdig når:* én gruppe kårer tabelltoppen. To grupper oppfører seg nøyaktig som
før. Fire grupper gir to semier, finale og bronse. Vinneravsløringen spiller på
liveskjermen i alle tre tilfellene.

### Steg 4 — rendring og CSS

Gruppekort, kampliste, tabeller og sluttspillfanen for n grupper.
Sluttspillfanen viser en forklaring i stedet for kamper når `groups.length > 2`.

CSS som må røres:
- `.groups-grid` er `1fr 1fr` (~linje 138 i `dcup.css`) → `repeat(auto-fit, minmax(200px, 1fr))`
- `.two-col` og `.display-grid` samme sted
- Gruppefarger: i dag `--accent`/`--accent-text` for A og `--green`/`--green-text`
  for B. Trengs fire. `--amber` finnes; en fjerde (`--purple`/`--purple-bg`/`--purple-text`)
  må legges til i `:root` **og** i `@media (prefers-color-scheme: dark)`.
  Merk at mørk modus bare omdefinerer `-bg`- og `-text`-variantene, ikke
  grunnfargene.
- `.display-queue-grp.a` / `.b` → `.g0`–`.g3`

*Ferdig når:* fire grupper er lesbare på mobil og på liveskjermen, i lys og mørk modus.

### Steg 5 — liveskjermen blar mellom gruppene

`renderDisplayTables` viser maks 2 grupper om gangen. Ny `dispGroupPage`.
På hvert 12s-tikk: er det flere sider igjen på denne turneringen, bla side;
ellers nullstill siden og gå til neste turnering.

`dispGroupPage` må nullstilles når `dispCurrent` endres og når turneringslista
endres. Rotasjonen skal fortsatt stå stille mens `revealBusy` er `true`.

*Ferdig når:* en turnering med 4 grupper viser alle fire før skjermen går videre.

### Steg 6 — wipe og deploy

Tøm `events` i Firebase-konsollen, deploy, opprett et testevent.

**Gjør dette når ingen bruker appen.** En telefon som allerede har siden åpen
kjører gammel JS videre og skriver gammel form — resultater ville forsvunnet
uten feilmelding. Cache-bustingen hjelper bare ved neste sidelast.

Gamle bokmerkede event-linker vil gi «Event ikke funnet.» etter wipen. Det er
akseptert.

---

## 7. Feller

**Transaksjoner som avbryter, prøver ikke på nytt.** Returnerer
oppdateringsfunksjonen `undefined`, avbrytes hele transaksjonen — den henter
ikke serververdien og prøver igjen. Den første kjøringen bruker Firebase sin
lokale cache. Er cachen utdatert, kan `confirmStart` avvise et helt lovlig valg.
`once('value')` rett før dialogen varmer cachen, så de skal være like i praksis,
men **verifiser dette mot en ekte database** — det lot seg ikke teste uten.
Samme mønster finnes allerede i `generateTournament` med `notEnough`-flagget.

**Transaksjonsfunksjonen kan kjøre flere ganger.** `computeGroups` stokker med
`Math.random()`, så hver kjøring gir en ny trekning. Det er greit — den som
committer er den som gjelder — men ikke bygg noe som antar at den kjørte én gang.

**`onclick` i generert HTML.** `openMatchDialog` kalles fra en streng bygget i
`renderTournamentView`. Endrer du signaturen må begge sider følge med.

**Navn skal aldri inn i en `onclick`-streng.** `safeKey` escaper ikke `'` eller
`"`. Bruk indeks eller `data-*` + `addEventListener`, slik `renderBoard` og
`renderPeopleList` gjør.

**`tests.html`** må stubbe `firebase` *før* `dcup.js` lastes — fila kaller
`firebase.initializeApp()` på toppnivå. `dcup.js` kaller også `boot()` helt til
slutt (linje ~1825), som treffer `showScreen('screen-home')`, så testsiden
trenger minst `<div id="screen-home" class="screen">`. Uten `?e=` i URL-en gjør
`boot()` ikke noe annet. Test de rene funksjonene: `computeGroups`, `maxGroups`,
`matchCount`, `suggestGroups`, `groupSizes`, `playOrder`, `calcStandings`,
`podium`, `boardStandings`, `groupsOf`.

**Ingen egen utviklingsdatabase.** Lokal kjøring skriver til samme Firebase som
produksjon. Testevents lagd underveis blir liggende — de forsvinner i wipen i
steg 6.

---

## 8. Åpne spørsmål

**1. Seeding på tvers av grupper (fase B).** Dette er det egentlige hinderet, og
det er et designspørsmål, ikke kode. Å rangere gruppevinnere fra grupper med
ulik størrelse: poeng er ikke sammenlignbart når den ene har spilt 3 kamper og
den andre 6. Poeng per kamp er nesten sammenlignbart. Selve bracketen — semi
(1–4, 2–3), finale, bronse for 4 grupper; bye til beste vinner for 3 — er
kanskje 150 linjer. Regelen er det vanskelige.

**2. Ekte tresykel kan ikke løses av noen innbyrdes regel.** `PRIORITERINGER.md`
foreslår å løse innbyrdes oppgjør på miniligaen mellom de like i stedet for
parvis. Det fikser tre like inne i en større gruppe, men **ikke** en ren
tresykel i en treergruppe — der *er* miniligaen hele gruppa, og alle står 1–1.
Ingenting kan skille dem sportslig. Spørsmålet er hva UI-et skal si: markere
dem som genuint delt plass, eller la trekningen avgjøre stille slik i dag?
Utenfor scope her, men advarselen i § 3 forutsetter at det ikke er løst.

**3. Handikapp som seeding.** Kommer handikapp inn senere, kan det brukes til å
sette sammen eller seede gruppene i stedet for ren stokking. Ikke nå — notert så det ikke går tapt.

**4. Manuell justering av grupper.** Første ting folk kommer til å be om når de
ser en skjev trekning: flytte en spiller, eller trekke på nytt. Ikke med i denne
planen. Verdt å vite at det kommer.

**4. En 3–4-gruppers turnering blir aldri «ferdig».** Uten sluttspill gir
`podium()` `null`, så avsløringen spiller ikke og turneringen blir stående på
liveskjermen til noen trykker «merk som fullført». Akseptabelt i fase A, men det
bør stå i dialogteksten.

**5. Bør `nextUp()` fjernes?** Den er definert (linje ~1052) og ikke brukt noe
sted. Enten ta den i bruk på liveskjermen eller slette den.

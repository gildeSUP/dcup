# dCup — prioriteringer

Gjennomgang 2026-09-09, oppdatert etter `6369ca8`.

**Linjenumrene er fra før gruppe-refaktoreringen og stemmer ikke lenger.**
Bruk funksjonsnavnene — de er uendret. Nummereringen av punktene ligger fast
fordi `PLAN-GRUPPER.md` viser til «P0 #5», «P1 #6» og «P2 #23».

---

## P0 — bør fikses før neste event

### 1–4. ✅ Fikset i `22b7f0a`
Navn i `onclick` (XSS), `focusTId` som kastet deg tilbake ved hver endring,
0–0 ved klikk utenfor score-dialogen, og `Math.random()` som tiebreak.
Numrene beholdes fordi `PLAN-GRUPPER.md` viser til dem.

### 5. ⚠️ Verifiser Firebase-reglene — SJEKK FØR EVENTET
Reglene er endret, men **ikke verifisert ennå**. Kan ikke leses av repoet, så
dette må gjøres i Firebase-konsollen.

Sjekkliste:
- [ ] `.read`/`.write` ligger på `events/$eventId`, ikke på roten — ellers kan
      hvem som helst lese ut *alle* events i basen med ett kall
- [ ] Åpne et event i appen og bekreft at påmelding, resultat og liveskjerm
      fortsatt virker med de nye reglene (en for streng regel er like ille som
      en for åpen: da feiler skrivingene midt i eventet)
- [ ] Gjerne `.validate` for strenglengder, så en tom database ikke kan fylles opp

Merk: en regelendring kan ikke testes fra denne kodebasen, bare i praksis mot
den ekte basen. Test med en throwaway-event før den ekte brukes.

---

## P1 — reelle hull

### 6. ✅ Fikset i `4bffb0c` (Steg 3)
`openPlayoffDialog` lagrer nå `home`/`away` som navn på playoff-resultatet,
og `podium()`/`playoffMatches()` leser de lagrede navnene via
`playoffWinner`/`playoffLoser` i stedet for å regne finalisten ut på nytt fra
gjeldende tabell.

**Verifisert i egen økt:** spilte en finale (mester = spiller X), endret
deretter et gruppekampresultat slik at en annen spiller (Y) overtok
tabelltoppen i gruppa. `podium()` viste fortsatt X som mester, og
finale-oppsettet viste fortsatt «X mot [motstander]» — ikke det nye Y.

### 7. Turneringslista har vilkårlig rekkefølge
`dcup.js:308` itererer `Object.entries(tournaments)`. Nøklene er UUID-er, så
Firebase returnerer dem sortert på tilfeldig streng. `created` finnes allerede
på hver turnering — sorter på den. Gjelder også rotasjonsrekkefølgen på
liveskjermen (`visibleDispTournaments`, `dcup.js:1409`).

### 8. ✅ Fikset i `22b7f0a`
Ny `isSignupLocked()` — sperren gjelder bare gruppespill.

### 9. ✅ Fikset
`renderBoard` bygde hele lista på nytt med `innerHTML` ved hver oppdatering.
Nå gjenbrukes raden per spiller (`buildBoardRow` lager den én gang), feltet som
har fokus får aldri `value` overskrevet, og rekkefølgen endres bare når den
faktisk har endret seg — en flyttet node blurres av nettleseren, så fokus og
markørposisjon settes tilbake når en omsortering var nødvendig.

Raden bygges i DOM-et i stedet for som HTML-streng, så navnet ligger i
`textContent` og i en closure, aldri i en `onclick`-streng (beholder
egenskapen fra P0 #1). Indeksen i `players` slås opp når hendelsen skjer, ikke
når raden lages — den kunne flyttet seg i mellomtiden.

**Verifisert med to klienter:** telefon A taster «42» i sitt eget felt uten å
forlate det, telefon B lagrer sin score samtidig. Før: feltet ble tømt og
fokus forsvant. Etter: «42» står, fokus står i samme felt, og B sin score
vises. Regresjonstestet sortering ved endret score, tømming av score,
fjerning av spiller, nullstilling og tom tavle.

### 10. Ingen måte å slette en turnering eller et event
`resetTournament` nullstiller, men en turnering opprettet ved et uhell blir
stående for alltid. Trenger minst «slett turnering».

### 11. `addTournament` uten feilhåndtering
`dcup.js:617`: `await db.ref().update(updates)` står uten `try/catch`, i
motsetning til alt annet. Offline → uhåndtert rejection, ingen tilbakemelding,
modalen blir stående. Knappen deaktiveres heller ikke, så dobbeltklikk lager
to turneringer.

---

## P2 — forbedringer

| # | Sak | Sted |
|---|---|---|
| 12 | Andre vinner hoppes over hvis den kommer mens en avsløring spilles — `checkForReveal` kjøres bare på snapshot, aldri etter `clearReveal` | `dcup.js:1430`, `1440` |
| 13 | `revealedWinners` tømmes ikke når en turnering nullstilles → avsløringen spilles aldri på nytt | `dcup.js:1417` |
| 14 | Sync-prikken på event-skjermen er hardkodet grønn; `setSyncStatus` rører bare turneringsskjermen | `index.html:63`, `dcup.js:679` |
| 15 | `t-board-input` tømmes med `setAttribute('value','')` — det tømmer ikke et felt brukeren har skrevet i | `dcup.js:634` |
| 16 | Enter i poengtavlas navnefelt gjør ingenting (fungerer i de to andre feltene) | `index.html:198` |
| 17 | «Ferdig»-merket settes når gruppespillet er ferdig, før finalen er spilt | `dcup.js:843`, `332` |
| 18 | Liveskjermen lar TV-en sovne — `navigator.wakeLock` er noen få linjer | `dcup.js:1389` |
| 19 | Blokkeres jsDelivr på gjestenettet dør appen uten feilmelding. Sjekk at `firebase` finnes før `initializeApp` | `index.html:286` |
| 20 | Event-sider er offentlige og kan indekseres av Google — `<meta name="robots" content="noindex">` | `index.html:6` |
| 21 | «Avslutt» på liveskjermen går til forsiden, ikke tilbake til eventet | `dcup.js:1386` |
| 22 | Fremdriftsbaren animeres ikke før første rotasjon, og ikke i det hele tatt med bare én turnering | `dcup.js:1587` |
| 23 | ◐ Delvis. `tests.html` har 89 tester over de rene funksjonene. Rendring og alt som rører Firebase er udekket — `renderTournamentView` er skrevet nesten helt om uten en eneste test | `tests.html` |

---

## P3 — hvis dCup skal brukes til ekte konkurranser

Dette er hull som firmafest-bruk tåler, men en reell konkurranseplattform ikke gjør.

### 24. Navn er identitet
`people/<safeKey(navn)>` er hele identitetsmodellen. Konsekvenser:
- to deltakere som heter «Ola» er samme person
- «ola» og «Ola» er to personer
- `safeKey` kolliderer: `Ola.` og `Ola~2e` gir samme nøkkel

Trengs en faktisk `participantId` før noe skal telles som et resultat.

### 25. Heltallsscore
`saveBoardScore` (`dcup.js:991`) bruker `parseInt`. `13.450` blir `13`, og
`12abc` blir `12` uten feilmelding. Turnpoeng er desimaltall — poengtavla er
ellers akkurat primitivet turn trenger, men den kan ikke lagre en turnscore.

### 26. Ingen roller, ingen autentisering
Alle med linken kan endre alle resultater, døpe om alle og nullstille alt.
Riktig for en firmafest, umulig for en konkurranse. Dommerrolle + låsing av
ferdigsignerte resultater.

### 27. Formatet er låst til to grupper
**Under arbeid:** `PLAN-GRUPPER.md` gjør antallet valgbart (1, 2 eller 4).
Steg 1 ligger i `6369ca8`. Cup-bracket for vilkårlig størrelse og seeding på
tvers står fortsatt åpent.

---

## Nye funn

### 28–29. ✅ Fikset i `c56f2ea`

**28** — `h2h` som parvis komparator er erstattet av en **miniliga** blant de
likestilte i `calcStandings`: poeng regnet bare på kampene mellom dem. Én verdi
per spiller, altså transitiv av konstruksjon. Klyngene deles etter de transitive
nøklene (poeng, seire, målforskjell) og sorteres internt på miniligaen, med
alfabetisk som siste utgang. Løser også tre like inne i en større gruppe.
Advarselen i startdialogen lover ikke lenger trekning. Testet at alle seks
permutasjoner av en tresykel gir samme rekkefølge.

**29** — kollisjonssjekken i `renamePerson` ser nå i `eventPeople` **og** i alle
turneringer via `tournamentHasName`.

**Gjenstår fra #29:** `addTPlayer` og `addBoardPlayer` skriver aldri til
`people/`. Utover kollisjonssjekken betyr det at en spiller lagt til i
turneringsoppsettet ikke finnes i deltakerlista — hun kan ikke omdøpes eller
fjernes sentralt, og dukker ikke opp i forhåndsvalget for neste turnering. Det
er nok den egentlige buggen bak #29, men å registrere dem endrer atferd utover
det som ble rapportert.

---

## Rapportert 9. september, ikke fikset

### 30. Bunnark er festet til bunnen også på store skjermer

Alle fire dialogene (`#join-overlay`, `#people-overlay`,
`#add-tournament-overlay`, `#start-tournament-overlay`) har
`align-items:flex-end` som **inline** stil, og arket har
`border-radius: var(--radius-lg) var(--radius-lg) 0 0` med
`padding-bottom: 2.5rem`. På en 2000px bred skjerm klistrer dialogen seg til
nederste kant med avrundede hjørner bare øverst. Skal være bunnark på mobil,
sentrert på desktop.

Samme gjelder `.match-dialog-overlay` / `.match-dialog` i `dcup.css:182-183`,
som har det i CSS i stedet for inline.

Fiksen krever at de inline stilene flyttes til klasser — en media query kan ikke
overstyre inline `align-items` uten `!important`. Foreslått: `.sheet-overlay` og
`.sheet`, brukt på alle fem, med `@media (min-width: 640px)` som sentrerer og
runder alle hjørner.

### 31. Navnefeltet får ikke fokus når dialogen åpnes

`showJoinDialog` tømmer feltet men kaller ikke `focus()`. Samme i
`showAddTournament` og `showStartDialog`. Merk at `focus()` på iOS bare virker
i en brukerinitiert hendelse — det er tilfellet her, siden dialogen åpnes av et
klikk.

---

## Resize-lytter på liveskjermen — ✅ verifisert i `da767a6`

`dispPerPage` ble tidligere bare invalidert av `groupShapeKey` (turnering og
spillerantall), ikke av viewporten. Går skjermen til fullskjerm fortsatte den å
bla selv om alt fikk plass; motsatt vei sa målingen «alle får plass» og
`.display-col { overflow:hidden }` klippet bort gruppe C og D uten feilmelding.

Lytteren er debounced med 250ms — `resize` fyrer per frame under en vindusdrag,
og `measurePerPage` tvinger layout opptil én gang per gruppe. Den er også
guardet på at display-skjermen faktisk er aktiv.

**Verifisert i egen økt** med akkurat den foreslåtte testen: turnering med
fire grupper à fem spillere (20 deltakere). På 1280×720 målte den 2 grupper
per side («side 1 av 2», så «side 2 av 2» ved neste rotasjon). Endret vinduet
til 1280×1400 → målte om til alle fire på én side, ingen sidetelling. Endret
tilbake til 1280×600 → målte korrekt ned til 2 per side igjen, altså
re-måling begge veier, ikke bare ved første last. `scrollHeight` var lik
`clientHeight` ved endelig størrelse — ingen usynlig avklipt gruppe.

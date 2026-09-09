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

### 7. ✅ Fikset
Ny `sortedTournaments(obj)` i UTILS sorterer på `created` stigende. Mangler
`created` (data fra før feltet fantes), havner turneringen sist, og like
verdier faller tilbake på nøkkelen — rekkefølgen er dermed lik på alle
klienter, ikke bare stabil lokalt.

Tatt i bruk fire steder: `renderTournamentList`, `renderJoinList`,
`renderPeopleList` (ikonene per deltaker) og `visibleDispTournaments`
(rotasjonsrekkefølgen på liveskjermen).

**Verifisert** ved å skrive fire turneringer i en annen rekkefølge enn
`created` — inkludert én uten `created`: rå-rekkefølgen fra basen var
`Sist, Først, Uten created, Midten`, mens lista, meld på-dialogen og
liveskjermens rotasjon alle viste `Først, Midten, Sist, Uten created`.

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

### 11. ✅ Fikset
`addTournament` følger nå samme mønster som `saveJoin` og `confirmStart`:
knappen (`#add-tournament-btn`) deaktiveres og får teksten «Oppretter…», og
`db.ref().update()` ligger i `try/catch`. Feiler den, vises «Kunne ikke
opprette — prøv igjen», knappen blir aktiv igjen og dialogen står åpen med alt
utfylt, så et nytt forsøk er ett klikk unna.

**Verifisert** med skrivingen tvunget til å feile: toast vises, dialogen står
åpen, ingen turnering opprettes, og vi hopper ikke inn i turneringsvisningen
for noe som ikke ble lagret. Nytt forsøk uten feil lykkes. Tre raske klikk på
«Opprett» ga én turnering, ikke tre.

---

## P2 — forbedringer

| # | Sak | Sted |
|---|---|---|
| 12 | ✅ Fikset. Siste steg i `playReveal` kjører `clearReveal()` og deretter `checkForReveal()`, så vinner nummer to spilles av rett etter den første i stedet for å bli borte | `dcup.js` |
| 13 | ✅ Fikset. `checkForReveal` glemmer en tid som ikke lenger har en pall (nullstilt turnering, endret finaleresultat) eller som er borte fra eventet | `dcup.js` |
| 14 | ✅ Fikset. `setSyncStatus(status, where)` — `'event'` treffer `#sync-dot`, ellers turneringens. `loadEvent` setter «Kobler…» før lytteren, «Live» ved hvert snapshot og «Frakoblet» i error-callbacken. Begge prikkene starter gule i markupen i stedet for å love «Live» før noe er koblet opp | `index.html`, `dcup.js` |
| 15 | ✅ Fikset. `openTournament` setter `.value = ''` i stedet | `dcup.js` |
| 16 | ✅ Fikset. `t-board-input` har fått samme `keydown`-lytter som `t-player-input` | `dcup.js` |
| 17 | ✅ Fikset. `isFinished` krever nå at finalen (`playoffResults.match_0`) er spilt når turneringen har flere grupper. Plasseringskampene teller ikke med — de hoppes ofte over, og da ville merket aldri kommet | `dcup.js` |
| 18 | ✅ Fikset. `requestWakeLock()` ved åpning, `releaseWakeLock()` i `exitDisplay`, og ny forespørsel på `visibilitychange` (låsen slippes automatisk når fanen skjules). Alt i try/catch og bak en `'wakeLock' in navigator`-sjekk — uten støtte oppfører liveskjermen seg nøyaktig som før | `dcup.js` |
| 19 | ✅ Fikset. `index.html` sjekker `firebase` **og** `firebase.database` før `dcup.js` i det hele tatt injiseres, og viser en forklarende side med «Prøv igjen» i stedet. Verifisert med CDN-en blokkert, med bare app-compat lastet, og normalt | `index.html` |
| 20 | ✅ Fikset. `<meta name="robots" content="noindex, nofollow">` | `index.html` |
| 21 | ✅ Fikset. `exitDisplay` går til `?e=<dispEventId>` | `dcup.js` |
| 22 | ✅ Fikset. `willRotate()` svarer på om det finnes en neste side eller turnering; `syncProgressBar()` (kalt ved hver rendring) skjuler baren når svaret er nei, og rotasjonen setter i gang animasjonen med en gang i stedet for etter første 12s-runde | `dcup.js` |
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

### 30. ✅ Fikset — med en bevisst snarvei

Alle fem dialogene er nå bunnark under 640px og sentrert over. Kampdialogen
manglet dessuten `max-width` og strakk seg over hele skjermbredden; den er
kappet til 540px som de andre.

**Snarveien:** fiksen ligger som én `@media (min-width: 640px)` nederst i
`dcup.css`, med `!important` på de fire inline-stilte dialogene i stedet for at
inline-stilene ble flyttet til `.sheet-overlay`/`.sheet`. Grunnen var
tidspunktet — 17 timer før et event skulle ikke markupen til fem dialoger røres.
Kampdialogen ligger i CSS og trengte ingen `!important`.

**Opprydningen står igjen:** flytt inline-stilene til klasser og fjern
`!important`-ene. Da forsvinner også behovet for å liste fire id-er i
selektoren.

**Verifisert** på 390px og 1440px for alle fem dialogene (ny turnering, start
turnering, kampdialog, meld på, deltakere): mobil er uendret (bunnfestet, rette
bunnhjørner, full bredde), desktop er sentrert med runde hjørner og 540px.
`dcup.css?v=` er bumpet til 8 — uten det ville nettleseren servert gammel CSS.

### 33. `#screen-display` er alltid synlig — 100vh tomrom under hver side

`.display-layout` setter `display: flex` (`dcup.css:233`) og overstyrer
`.screen { display: none }` (`dcup.css:28`): samme spesifisitet, men senere i
fila. Liveskjermen står derfor alltid åpen, rett under den aktive skjermen.
Målt på 390×800: `document.scrollHeight` er 1600, altså nøyaktig én ekstra
skjermhøyde med svart under hjemskjermen, som man kan scrolle ned i.

Ikke nytt, og maskert av at ingen scroller dit — men det traff offline-skjermen
i #19, som måtte plasseres først i `body` for å ikke havne under liveskjermen.

**Fiksen ser ut som én linje, men er det ikke:**
```css
.screen.display-layout:not(.active) { display: none; }
```
`loadDisplayScreen` registrerer `dispRef.on('value')` *før* den kaller
`showScreen('screen-display')`. Fyrer callbacken før skjermen er aktiv, måler
`measurePerPage` et skjult element: `clientHeight` er 0, alt «får plass», og
liveskjermen slutter å bla. Med ekte Firebase fyrer callbacken asynkront og
rekker det ikke — men det er tilfeldig, ikke garantert. Fiks derfor CSS-en og
målingen sammen: ikke cache et resultat målt på `clientHeight === 0`.

### 32. ✅ Fikset

`showToast` sjekker om en av de fem dialogene er åpen (`anyDialogOpen()`) og
setter i så fall klassen `toast-top`, som flytter toasten til `top: 1.5rem`.
Uten dialog ligger den nederst som før.

**Verifisert** på 390px: med startdialogen åpen lå toasten 24px fra toppen og
overlappet null av de fem synlige knappene i arket — før lå «1 gruppe · 6
kamper» midt oppå Start-knappen. Uten dialog lå den 24px fra bunnen som før.

### 31. ✅ Fikset — men bare i «meld på»

`showJoinDialog` kaller nå `focus()` på navnefeltet. Der er å skrive navnet sitt
hele poenget med dialogen, og feltet ligger øverst.

**Bevisst ikke gjort i `showAddTournament` og `showStartDialog`:** der ville
tastaturet på mobil dekket sportsvalget og deltakerlista i det dialogen åpnes,
og turneringsnavnet er valgfritt (tomt navn gir sportens navn). Fokus der
gjør dialogen verre å bruke, ikke bedre.

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

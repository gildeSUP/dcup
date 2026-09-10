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

### 5. ✅ Verifisert utenfra 10. september — reglene er riktig avgrenset

Reglene kan ikke leses av repoet, men de kan **måles** utenfra med REST-kall mot
basen. Det ble gjort, og alle tre punktene på sjekklista er besvart:

- [x] **`.read` er avgrenset til `events/$eventId`.** Rot `/` og `events`
      (liste alle) gir `Permission denied`. `events/<id>/meta` leses fint. Ingen
      kan altså hente ut alle events med ett kall.
- [x] **Skrivingene appen trenger virker.** Opprettet `events/<ny>/meta` og
      `events/<ny>/people/x` — begge godtatt. En for streng regel som ville
      feilet midt i eventet er dermed utelukket på datanivå.
- [x] **`.validate` på strenglengde finnes.** `meta.name` godtas på 80 tegn og
      avvises på 100 (fersk event-id per måling, så resultatene ikke smitter).
      Grensen ligger altså mellom 80 og 100, godt under noe som kan fylle basen.

**Og den skarpe kanten i #34 er lukket:** `PATCH` mot rota og oppretting av en
ny toppnivånode gir begge `Permission denied`. Skriving er innesluttet i
`events/`.

**Det som gjenstår er en kjent begrensning, ikke en feil:** har du event-linken,
kan du skrive vilkårlige felter og undernoder *inne i det eventet*
(`events/<id>/tilfeldig`, `meta/tilfeldig` — begge godtatt). Størrelsen er
begrenset, antallet nøkler er ikke. Det er «noen som er invitert kan rable i
festens egne data», som er nøyaktig rammen #34 selv setter opp for en
ett-event-tjeneste. Vil man stramme det, er veien `.validate` med
`$other: false` på `events/$eventId`.

Alle testnodene ble slettet etterpå.

### 34. 🔴 Sikkerhetsgjennomgang av tjenesten — HØY PRIORITET

Ikke gjort. Gjelder tjenesten som helhet, ikke bare reglene i #5.

**Rammen, slik den er nå:** deltakernavn er ikke sensitive opplysninger i seg
selv, og tjenesten er per i dag ment for **ett event**. Basen inneholder altså
det eventet alle deltakerne uansett har linken til. «Noen kan lese hele basen»
betyr derfor i praksis «noen kan lese det eventet de allerede er invitert til»
— ubehagelig, men ikke en lekkasje. Dette handler om at tjenesten skal være
solid, ikke om lekkasjepanikk.

Det betyr at lista under deler seg i to.

**Gjelder allerede i dag, med ett event:**

- [ ] **Kan noen skrive hvor som helst?** Dette er den skarpe kanten nå. Uten
      `.write` bundet til `events/$eventId` og uten `.validate` kan hvem som
      helst som finner databaseadressen (den ligger i `index.html`, som seg hør
      og bør for en Firebase-webklient — den er ikke en hemmelighet) skrive
      søppel inn i det pågående eventet, eller fylle opp basen.
- [ ] **Er XSS-en fortsatt lukket?** P0 #1 fjernet navn fra `onclick`-strenger.
      Alt som er skrevet siden bruker `escapeHTML`, `textContent` eller
      `data-`-attributter, men det er verdt en gjennomgang av alle `innerHTML`
      med brukerdata i seg — særlig de nyeste (`tieNoteHTML`, sluttspillkortene).
      Et navn er det eneste stedet en fremmed får skrive fritt inn i appen.
- [ ] **Kan et event ødelegges?** Det finnes ingen sletting (#10) og ingen
      roller (#26). Alle med linken kan nullstille alt, midt under eventet.
      Riktig for en firmafest, men det bør være et valg vi har tatt.

**Blir viktig i det øyeblikket det finnes event nummer to:**

- [ ] **Leser reglene på tvers av events?** `.read` må ligge på
      `events/$eventId`, ikke på roten — ellers kan deltakerne på ett event
      lese alle de andre.
- [ ] **Holder event-ID-en som sperre?** `uuid()` bruker `Math.random()`, ikke
      `crypto.getRandomValues()`. Med ett event spiller det ingen rolle; med
      mange er ID-en det eneste som skiller dem. Et par linjer å bytte.
- [ ] **Lekker vi ID-en videre?** `Referer` mot `cdn.jsdelivr.net` inneholder
      hele URL-en inkludert `?e=<id>`. `<meta name="referrer" content="no-referrer">`
      lukker det med én linje.
- [ ] **Hva ligger igjen etterpå?** Ingen sletting, ingen utløpstid. Basen
      vokser med hvert event og alt blir stående for alltid.

### 35 og 36 — ✅ Fikset i `7f29fbc`

Begge er lukket. Se «Kodegjennomgang 10. september» nederst for detaljene:
uavgjort i en sluttspillkamp kan ikke lagres lenger og låser dermed ikke
turneringen, og liveskjermen viser sluttspillkampene i køen.

---

### 48. Liveskjermen har ingen feilhåndtering
*(bevisst utsatt 10. sept, rett før event — begrunnelse nederst i punktet)*

`loadEvent` fikk `setLoading`, `try/catch` og `showEventError` da #43 ble
fikset, og både `eventRef.on` og `tRef.on` fikk error-callback. Liveskjermen
fikk ingenting av det. Tre hull, alle verifisert kjørende i nettleser:

1. **`loadDisplayScreen` mangler `try/catch`** rundt meta-lesingen. Simulert
   `PERMISSION_DENIED` ga uhåndtert rejection, og TV-en ble stående på
   forsiden med «Opprett nytt event».
2. **Event ikke funnet** gir `showScreen('screen-home')` — samme forside, uten
   forklaring. Aktuelt straks basen wipes eller noen har et gammelt bokmerke.
3. **`dispRef.on('value', cb)` er registrert uten error-callback.** Verifisert:
   med meta OK og turneringslesingen feilende viser TV-en riktig eventnavn og
   deretter **«Ingen turneringer ennå»** — en selvsikker usannhet på storskjerm.

Fiksen er å speile det `loadEvent` alt gjør, med tekst stor nok til å leses
tvers over rommet.

**Hvorfor utsatt:** en nettverksglipp utløser *ikke* error-callbacken — RTDB
holder på siste data og synker opp igjen. #48 dekker i praksis bare
tilgangsfeil, og dem fanger røyktesten av Firebase-reglene. Går den gjennom,
ligger #48 i dvale gjennom kvelden.

**Operativt tell så lenge den står åpen:** sier TV-en «Ingen turneringer ennå»
om et event du vet har en turnering, er det ikke sant — last lenken på nytt.

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
| 23 | ◐ Delvis. `tests.html` har **183 tester** over de rene funksjonene. Rendring og alt som rører Firebase er fortsatt udekket — `renderTournamentView` er skrevet nesten helt om uten en eneste test. Nye seksjoner skal blokk-scopes (`{ ... }`): fila er én toppnivå-scope, og en navnekollisjon velter hele suiten stille, med «kjører…» stående i stedet for et resultat | `tests.html` |

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
Steg 1 ligger i `6369ca8`. Sluttspillet er nå en ekte bracket som bygges av
antall grupper × antall videre (se «Videre fra hver gruppe» nederst) — det som
står igjen er seeding på tvers av grupper (i dag pares gruppene vilkårlig,
fordi `computeGroups` stokker først) og frikamper når antallet ikke er en
toerpotens.

---

## Nye funn

### 28–29. ✅ Fikset i `c56f2ea`

**28** — `h2h` som parvis komparator er erstattet av en **miniliga** blant de
likestilte i `calcStandings`: poeng regnet bare på kampene mellom dem. Én verdi
per spiller, altså transitiv av konstruksjon. Klyngene deles etter de transitive
nøklene (poeng, seire, målforskjell) og sorteres internt på miniligaen, med
alfabetisk som siste utgang. **Alfabetisk er nå bare fallback fram til noen
avgjør det — se «Avgjør uavgjort» nederst.** Løser også tre like inne i en større gruppe.
Advarselen i startdialogen lover ikke lenger trekning. Testet at alle seks
permutasjoner av en tresykel gir samme rekkefølge.

**29** — kollisjonssjekken i `renamePerson` ser nå i `eventPeople` **og** i alle
turneringer via `tournamentHasName`.

**Gjenstår fra #29:** ingenting — `setSignup` skriver nå til `people/`, se
listen nederst under 10. september.

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

### 33. ✅ Fikset

`.screen.display-layout:not(.active) { display: none; }` — høyere spesifisitet
enn `.display-layout { display: flex }`, så liveskjermen er skjult overalt
unntatt når den faktisk er aktiv. På 390×800 gikk `scrollHeight` fra 1600 til
800: den ekstra svarte skjermhøyden under hjem- og event-skjermen er borte.

**Målingen er fikset i samme slengen**, som notatet krevde: `measurePerPage`
returnerer nå `null` i stedet for et tall når `clientHeight` er 0 (skjermen er
ikke synlig ennå — `loadDisplayScreen` registrerer lytteren før `showScreen`).
Da caches ingenting, `renderDisplayContent` viser alle gruppene inntil videre,
og neste rendring måler på nytt. `loadDisplayScreen` nullstiller dessuten
målingen og tegner én gang til rett etter `showScreen`, så den første ekte
målingen skjer på et element som har høyde.

**Verifisert:** liveskjermen er `display:none` på hjem- og event-skjermen og
`display:flex` når den er aktiv, og fyller nøyaktig én skjerm. Sidevisningen
er regresjonstestet med fire grupper à fem spillere på 1280×720 (2 per side),
1280×1400 (alle fire, ingen sidetelling) og tilbake til 1280×600 (2 per side).

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


---

## Bygget 9. september, etter ønske

### Avgjør uavgjort — alfabetisk er ikke lenger siste ord

To spillere som står helt likt etter poeng, seire, målforskjell **og** den
innbyrdes miniligaen kan ikke skilles sportslig. Før avgjorde `localeCompare` i
stillhet, uten at noen fikk vite det.

Nå melder tabellen fra: gruppekortet får en varselrad — «⚠️ Golf, Hotel og Lima
står helt likt — resultatene skiller dem ikke» — med en «Avgjør»-knapp. Dialogen
lar hvem som helst trykke navnene i den rekkefølgen de skal stå. Hvordan det
avgjøres fysisk (omkamp, stein-saks-papir, myntkast) er opp til dem; appen
lagrer bare svaret. Med to spillere er det ett trykk: siste navn fylles ut av
seg selv. Avgjørelsen kan endres eller fjernes etterpå.

Detaljer som er verdt å vite:
- **Nøkkelen er navnene i klyngen, ikke plasseringen** (`tieKey`). Flytter
  klyngen seg opp eller ned i tabellen fordi noen andre spiller en kamp, gjelder
  avgjørelsen fortsatt.
- **Varselet kommer først når klyngen har spilt ferdig.** Før første kamp står
  alle på null poeng — teknisk uavgjort, men bare støy.
- **Avgjørelsen gjelder bare innad i klyngen.** Den kan ikke løfte noen forbi en
  spiller som faktisk står over dem.
- **Skrivingen er målrettet** (`tiebreaks/g<gi>/<key>`), ikke hele turneringen,
  så et resultat som lagres samtidig fra en annen telefon ikke forsvinner.
- **Nullstilling og ny start tømmer `tiebreaks`** — de gjaldt den forrige
  trekningen, og ville ellers dukket opp igjen på et tilfeldig par.
- `renameInTournament` regner nøkkelen ut på nytt ved navnebytte. Samme runde
  fikset at `playoffResults.home/away` ikke ble omdøpt i det hele tatt — der sto
  det gamle navnet igjen som finalevinner.

### Videre fra hver gruppe

Nytt valg i startdialogen ved siden av antall grupper: **1**, **2** eller
**alle**. Vises bare når det finnes mer enn ett lovlig valg.

- **alle** (standard med to grupper) er plasseringsstigen som før: hver
  tabellplass møter samme plass i den andre gruppa.
- **1** (standard med fire grupper) er gruppevinnerne, som før.
- Ellers bygges en ekte bracket av `grupper × videre` kvalifiserte:
  2×2 og 4×1 gir semifinaler, finale og bronse; 4×2 gir kvartfinaler først.

`advanceCount` klemmer valget ned hvis det ikke går opp: ingen gruppe kan sende
flere videre enn den har spillere, og antallet kvalifiserte må være en
toerpotens. En verdi som ikke går opp kan dermed ikke gi en halvbygget bracket.
`match_0` er fortsatt finalen og `match_1` fortsatt bronse/3.-plass, som
`podium()` og `isFinished()` hviler på.

Med bare gruppevinnere pares naboer (A mot B, C mot D) som før. Går flere
videre, speilvendes seedlista, slik at en gruppevinner møter en andreplass fra
en **annen** gruppe i første runde.

Valget lagres i samme transaksjon som gruppene, så de aldri kan komme i utakt
om noen melder seg på i samme øyeblikk.


---

## Kodegjennomgang 10. september

Gjennomgang av hele `dcup.js` + utforskende testing i nettleser mot en mock.
Alle de eksisterende testene (167 i `tests.html` + åtte browser-tester) var
grønne før og etter. Alt under er **bekreftet kjørende**, ikke bare lest ut av
koden, med mindre annet står.

### Feil

#### 35. ✅ Fikset i `7f29fbc` — uavgjort i en sluttspillkamp

**Var:** `wdl`-modus viste «Uavgjort» også i sluttspillsdialogen, og lik score i
`score`-modus ga `winner: 'draw'`. Da returnerte `playoffWinner` `undefined`, så
`podium()` ble `null` — men `isFinished()` så bare at `match_0.winner` fantes
(`'draw'` er sant), og **kortet sa «Ferdig» uten at turneringen hadde en
vinner**. Ingenting i UI-et forklarte hvorfor.

**Nå:** `showMatchDialog` tar et `noDraw`-flagg som `openPlayoffDialog` setter.
Sluttspillkamper viser ingen «Uavgjort»-knapp, og lik score avvises med «Kampen
må ha en vinner — kan ikke ende likt». `isFinished` krever `winner !== 'draw'`.
Sluttspillfanen sier «Finalen står likt — den må avgjøres før turneringen har en
vinner», og liveskjermen skriver det samme i stedet for «Alle kamper spilt».

**Verifisert i nettleser:** sjakkturnering (`wdl`), gruppespill ferdig. Finalen
viser bare de to vinnerknappene, gruppekampen har fortsatt «Uavgjort · 1 pkt
hver». Med et uavgjort skrevet rett i basen — slik gammel data ser ut:
`isFinished: false`, `podium: null`, kortet «6/6 spilt», hintet forklarer.
Normalveien urørt: avgjort finale gir pall og «er avgjort» på skjermen.

#### 36. ✅ Fikset i `7f29fbc` — liveskjermen viser sluttspillet

**Var:** `renderDisplaySide` viste bare gruppekampene, så TV-en sto på «🏁 Alle
kamper spilt / Ferdig» mens semifinaler, bronse og finale gjensto. Ordet
«finale» forekom ikke ett sted i `#disp-content`. Det er nettopp de kampene folk
samler seg rundt skjermen for.

**Nå:** `playoffQueue(t)` legger uspilte sluttspillkamper i køen, med eget
ambergult merke (`.display-queue-grp.po`) som viser «FINALE», «SEMIFINALE 1»,
«BRONSE». Kamper som venter på den foran tas ikke med — «Vinner av semi 1» er
ingen kø. `lastPlayoffPlayed(t)` gjør at «Siste resultat» velger nyeste av
gruppe- og sluttspillkamp på `ts`, ellers ville skjermen vist en gruppekamp
lenge etter finalen.

**Verifisert på 1280×720:** gruppespill ferdig ga «▶ A2 vs B3 [FINALE], A1 vs A3
[3. PLASS], B1 vs B2 [5. PLASS]», tre ambergule merker. Med fire grupper står
bare semiene i køen først, og finalen og bronsen kommer inn når semiene er
spilt.

#### 37. ✅ Fikset — en deltaker i en startet turnering kan ikke fjernes

**Var:** `removePerson` kalte `setSignup(tid, navn, false)`, som bare rører
`players`. Var turneringen alt trukket, ble personen stående i
`groups[].players`, i kampoppsettet og i resultatene — synlig i tabellen og i
kampkøen på TV-en, men uten å være deltaker og uten å kunne omdøpes sentralt.

**Nå:** ny `lockedTournamentsFor(navn)` finner turneringene der navnet er låst
fast. I deltakerlista bytter krysset til et 🔒 for de som er låst, og
`removePerson` sjekker det samme på nytt før den gjør noe — en annen telefon
kan ha startet turneringen mens lista sto åpen.

Låsen er en **knapp**, ikke bare et ikon: trykker du på den, sier den «Låst i
«Bordtennis» — turneringen er startet». På mobil finnes ingen hover, så en
`title` alene ville aldri forklart hvorfor krysset var borte.

**Gjelder bare gruppespill** (`isSignupLocked`), ikke poengtavler. En
poengtavle har ingen trekning — det er nettopp derfor `addBoardPlayer` lar folk
komme til underveis — og der skal man fortsatt kunne fjernes. Å låse en
poengtavle så snart én person hadde levert score ville tatt bort noe som
fungerer i dag.

**Omdøping er fortsatt lov** på en låst deltaker: `renameInTournament` bytter
navnet overalt det forekommer, også i grupper, kampoppsett, resultatnøkler,
`playoffResults` og `tiebreaks`. Det er bare *fjerning* som er farlig.

**Ryddet samtidig:** fjerner du noen fra en poengtavle, slettes også
`scores/<nøkkel>`. Den fulgte ikke med `players` før, så scoren ble liggende
usynlig igjen — og dukket opp som en gammel score hvis navnet ble lagt til på
nytt.

**Verifisert** med seks deltakere i et startet gruppespill og tre på en
poengtavle: ingen låser før start, seks låser og tre kryss etter, låsen
navngir turneringen, `removePerson` kalt direkte lar seg ikke lure, og
poengtavla lar seg fortsatt fjerne fra — med scoren ryddet bort.

#### 38. ✅ Fikset i `7f29fbc` — slettet turnering merkes og gjenoppstår ikke

**Var:** lytteren i `openTournament` gjorde `if (data)` og ignorerte `null`.
Skjermen ble stående med gamle data, og et påfølgende `tWrite` **gjenskapte
turneringen i basen** — en sletting kunne bli ugjort av hvem som helst som
tilfeldigvis sto på den skjermen.

**Nå:** lytteren behandler `data === null`, viser «Turneringen er slettet» og går
tilbake til eventet. `backToEvent` nuller `tRef`, og det er det som hindrer at
`update()` oppretter noden igjen.

Jeg skrev først et eget `tGone`-flagg som `tWrite` sjekket, men tok det ut:
`backToEvent()` kjører synkront i samme callback og nuller både flagget og
`tRef`, så flagget var aldri sant når det ble lest. Et flagg som alltid er falskt
antyder en beskyttelse som ikke finnes.

**Verifisert:** noden satt til `null` mens skjermen sto inne i turneringen →
`screen-tournament` → `screen-event`, toast, og et `tWrite` etterpå gjenskapte
den ikke. **Forutsetningen for #10 er dermed på plass.**

#### 39. ✅ Fikset — `openMatchDialog` tåler at kampen er borte

**Var:** `const f = fixtures[idx]` ble ikke sjekket, så `fkey(f)` kastet på
`f[0]`. `openMatchDialog(0, 99)` ga `Cannot read properties of undefined`.

**Nå:** `if (!f) { showToast('Kampoppsettet er endret — prøv igjen'); return; }`

**Verifisert:** `openMatchDialog(0, 99)` kaster ikke, gir toasten, og dialogen
åpnes ikke.

#### 40. ✅ Fikset — fjern-knappen slår opp navnet, ikke indeksen

**Var:** `renderTPlayers` skrev `onclick="removeTPlayer(${i})"`. Lista tegnes på
nytt ved hvert snapshot, så indeksen kunne bety en annen person i det fingeren
traff — og det skjer nettopp under påmelding, når alle legger til navn samtidig.

**Nå:** raden bygges i DOM-et med `textContent` og en closure over navnet, og
indeksen slås opp med `indexOf(navn)` når hendelsen skjer — samme mønster som
poengtavla fikk i #9. Er navnet borte, sier den «Spilleren er alt fjernet».

Bieffekt: dette var **det siste stedet med brukerdata i en `onclick`-streng**,
så et hjørne av #34 er lukket samtidig.

**Verifisert:** knappen laget da E2 lå på indeks 1 fjernet E2 etter at lista
forskjøv seg (E1 fjernet fra en annen klient). Før fiksen ville den tatt E3.

#### 41. ✅ Fikset — «Del link» feiler ikke stille lenger

**Var:** `copyEventLink` gjorde `navigator.clipboard.writeText(url).then(...)`
uten `catch` og uten å sjekke at `navigator.clipboard` finnes. Uten den kastet
den, og **brukeren fikk ingen beskjed i det hele tatt**. `navigator.clipboard`
mangler i flere innebygde nettlesere — Slack, Teams, Facebook, LinkedIn — altså
nettopp der en link til et firmaarrangement åpnes.

**Nå:** sjekk på at API-et finnes, `catch` på løftet, og en reserveboks
(`#link-fallback`) som viser linken i et readonly-felt med teksten markert, slik
at den kan kopieres manuelt.

**Verifisert:** med `navigator.clipboard` satt til `undefined` kaster den ikke,
og boksen kommer opp med hel URL. Samme når `writeText` avviser.

#### 42. ✅ Fikset — tilbakeknappen går til eventet

**Var:** appen brukte bare `history.replaceState`. Sto du inne i en turnering og
trykket tilbake, havnet du på **forsiden**, ute av eventet. På telefon er tilbake
den mest brukte bevegelsen som finnes.

**Nå:** `openTournament` bruker `pushState`, og en `popstate`-lytter går til
eventskjermen. Hver dialog legger igjen sin **egen** historikkoppføring via
`lockBodyScroll`, så tilbake lukker dialogen uten å bytte skjerm.
`unlockBodyScroll` rydder oppføringen med `history.back()` når lukkingen kom fra
en knapp — ellers ville det krevd to tilbake-trykk å komme videre.

Første forsøk re-pushet state inne i `popstate`, som er feil mønster: når
`popstate` fyrer har nettleseren alt flyttet seg, så det pushet forrige
oppføring, og å lukke en dialog byttet skjerm (`screen-event` →
`screen-tournament`, bekreftet i test). Derfor ligger oppføringen nå på
*åpningen* av dialogen i stedet.

**Verifisert:** tilbake fra turnering → eventskjermen. Tilbake med dialog oppe →
dialogen lukkes, skjermen står, `body.overflow` frigjøres. Lukket med knapp →
ett tilbake-trykk går videre til eventet, ikke to.

#### 43. ✅ Fikset — ventetilstand og feilmelding når et event åpnes

**Var:** `loadEvent` gjorde `await ... .once('value')` uten `try/catch`. Nektet
reglene lesing, ble det en uhåndtert rejection og brukeren sto på forsiden uten
et ord. Ingen «Laster event…» heller, bare en tom forside inntil svaret kom.

**Nå:** `try/catch` rundt lesingen, `setLoading('Laster event…')` mens den
pågår, og `showEventError()` som skiller de to tilfellene: «Fikk ikke kontakt med
basen. Sjekk nettet og prøv igjen.» mot «Event ikke funnet. Sjekk at linken er
hel.» `alert()` er borte. En gammel feilmelding ryddes ved nytt forsøk.

**Verifisert:** `?e=finnes-ikke` gir meldingen på forsiden, ventetilstanden er
skjult etterpå, ingen `alert`, ingen uhåndtert rejection.

#### Fortsatt åpent fra før, som denne gjennomgangen bekrefter

- ✅ **`addTPlayer`/`addBoardPlayer` skriver aldri til `people/`** — fikset.
  Slo ut i praksis 10. september: arrangøren var eneste navn i `people/` mens
  alle andre lå i turneringene. `setSignup` er det ene stedet alle veier inn i
  en turnering går gjennom, så `upsertPerson(name)` ligger nå der.
  `syncPeopleFromTournaments()` reparerer eventer som alt sto skjevt — den
  plukker navn fra `players`, `groups[].players` og `scores`, er idempotent og
  kjører på hvert snapshot fra alle klienter. Avmelding fjerner **ikke** fra
  `people/`; du er på eventet selv om du hopper av en konkurranse.
  **Verifisert:** turnering seedet med tre navn på tre ulike steder, alle tre
  dukket opp i deltakerlista innen ett snapshot; to ekstra kall skrev ingenting
  nytt, og `joined` på en eksisterende person var uendret.
- **XSS ser fortsatt lukket ut.** Testet med `O'Brien`,
  `<img src=x onerror=alert(1)>`, `Ærlig Å` og et 40 tegns navn i
  spillerlista: alt rendres som tekst, ingen `img`-tagg havner i DOM-et,
  ingen JS-feil. (Dekker ett av punktene i #34.)

#### 44. ✅ Fikset mot diagnosen — må bekreftes på telefon

**Var:** `lockBodyScroll()` satte `overflow: hidden` på `<body>`, men scrolleren
er `<html>` — og iOS-Safari ignorerer `overflow: hidden` for berøringsscroll
uansett. Samtidig krympet ikke `max-height: 85vh` når tastaturet kom opp, fordi
`vh` er den *store* viewporten på iOS. Arket var dermed dimensjonert for hele
skjermen mens rundt 40 % var synlig, siden bak lot seg dra, og arket gled ut av
bildet.

**Nå:** to endringer, begge velkjente.
- Låsen bruker `position: fixed` på `<body>` med `top: -scrollY`, og legger
  scrollposisjonen tilbake ved lukking. Det er den eneste låsen iOS respekterer.
  `overflow: hidden` er beholdt for nettlesere der den faktisk hjelper.
- `max-height: 85vh; max-height: 85dvh` på alle fem dialoger og på
  `.match-dialog` (som manglet høydetak helt). `dvh` følger den dynamiske
  viewporten og krymper med tastaturet, `vh` står først som reserve for iOS
  under 16.4.

**Fant en annen feil underveis:** låsen teller nå dybde, så et ark oppå et annet
ikke slipper låsen for tidlig og sender siden til toppen. Da viste det seg at
`unlockBodyScroll` sin `history.back()` (fra #42) fyrte `popstate`, som lukket
arket under — å lukke det øverste lukket begge. Vår egen `back()` merkes nå med
et flagg som lytteren hopper over.

**Verifisert i Chromium (375px):** scrollet til 400, åpnet ark → `position:
fixed`, `top: -400px`; forsøk på å scrolle bakgrunnen ga `scrollY: 0`; lukking
la posisjonen tilbake på 400. Nøstet: to ark ga dybde 2, lukking av det øverste
lot det nederste stå åpent med låsen intakt, og begge lukket ga 500 tilbake.
#42-stiene holder fortsatt: tilbake lukker dialog uten å bytte skjerm, neste
tilbake går til eventet.

**⚠️ Ikke reprodusert eller bekreftet på iOS.** Sandkassen har bare Chromium,
der den gamle låsen allerede virket. Fiksen er skrevet mot diagnosen, ikke mot
en observert feil — **Christian må bekrefte på telefon** at arket ikke lenger
kan scrolles vekk med tastaturet oppe.

### Funksjonalitet som mangler eller ville vært fint

Sortert etter hva jeg tror betyr mest for et faktisk arrangement.

1. **QR-kode til eventet på liveskjermen.** Den raskeste veien fra «folk står
   i rommet» til «folk er påmeldt» er en kode på TV-en de kan skanne. I dag
   må linken deles i en chat, og «Del link» er akkurat funksjonen som feiler
   stille i innebygde nettlesere (#41). Hører sammen med #36: TV-en har god
   plass når den først står der.
2. **Sluttspillet på liveskjermen** (#36) — det er finalen folk samler seg om.
3. **Flere baner samtidig.** Kampkøen antar at én kamp spilles av gangen
   («▶ neste»). Har dere to bordtennisbord, stemmer ikke køen med
   virkeligheten. Et valg for antall baner, og «spilles nå» med like mange
   kamper, ville gjort køen riktig.
4. **Del resultatet etterpå.** Når pallen er klar finnes det ingen måte å ta
   den med seg — en «kopier resultat»-knapp som gir en ferdig tekstblokk til
   Slack, eller et bilde av pallen.
5. **Ikon og «legg til på hjemskjerm».** `index.html` har verken favicon,
   `theme-color` eller manifest. Åpner tjue personer linken på telefonen, får
   alle en tom fane uten ikon, og de som legger den på hjemskjermen får en
   blank rute.
6. **Angre et resultat.** Du kan åpne kampen på nytt og endre den, men det
   finnes ingen historikk og ingen «hvem endret hva» — ved uenighet under et
   arrangement er det ingen fasit å se tilbake på.
7. **«Hva skjer med meg nå?»** En deltaker som åpner linken ser alle
   turneringer og alle kamper. Et enkelt «du står for tur i …» ville spart
   mye leting — men det forutsetter en form for «hvem er jeg», som er
   bevisst valgt bort (se #24 og beslutningen om ingen falsk identitet).
   Kan løses uten identitet: et søkefelt eller «trykk på navnet ditt».


---

## Besluttet under eventet 10. september — gjøres ETTER

### 49. ✅ Fikset — én liste i turneringsoppsettet

Oppsettskjermen viste spillerne som tagger *og* rett under som avhakingsliste.
Etter `525d0b3` skriver alle veier inn i en turnering til `people/`, så lista
var blitt et supersett av taggene: hvert navn med en tagg hadde også en avhaket
rad rett under. Det leste som en feil på telefon.

**Nå:** taggene er borte, og lista er delt i to grupper — «MED I TURNERINGEN
(n)» øverst, «IKKE MED (n)» under. Da ser man på ett blikk hvem som spiller
akkurat denne konkurransen, også når eventet har mange deltakere. Å hake av
eller på flytter raden mellom gruppene.

Tre ting det var verdt å passe på, alle løst og testet:
- **Lista bygges på unionen** av `eventPeople` og `tState.players`. Et navn som
  nettopp ble skrevet inn ligger i `players` med en gang, men i `people/` først
  når snapshotet lander — uten unionen ville det forsvunnet i mellomtiden, og
  det var nettopp taggene som dekket det hullet før.
- **`t-count` er urørt.** Den styrer om man kan starte.
- **Sorteringen er stabil:** `joined`, så navn. Uten det siste leddet hopper
  rader rundt under fingeren hver gang noen andre melder seg på.

`removeTPlayer` er ikke lenger i bruk fra UI-et (avhakingen går via
`toggleTPerson`), men står igjen som motstykket til `addTPlayer`.

**Verifisert** med 18 sjekker: at taggene er borte fra DOM-en, at lista er
skjult på et tomt event, at et nyskrevet navn vises *før* snapshotet lander, at
gruppene og tallene stemmer, at av- og påhaking flytter raden riktig vei og
oppdaterer `players`, at ingen eksisterende rad bytter plass når en ny person
melder seg på, at «Tøm» flytter alle ned, og at turneringen fortsatt lar seg
starte. Sett i både lys og mørk modus. `dcup.css` er bumpet til v=23.


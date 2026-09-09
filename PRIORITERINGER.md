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

### 5. Verifiser Firebase-reglene
Kan ikke leses av repoet. Sjekk minst at `.read`/`.write` ligger på
`events/$eventId`, ikke på roten — ellers kan hvem som helst lese ut *alle*
events i basen med ett kall. Legg gjerne på `.validate` for strenglengder,
så en tom database ikke kan fylles opp.

---

## P1 — reelle hull

### 6. Playoff-resultater lagrer side, ikke navn
**Planlagt:** løses i steg 3 i `PLAN-GRUPPER.md`.

`dcup.js:1254` lagrer `{winner:'a'|'b'}` uten `home`/`away`. Gruppekampene
lagrer navnene (`dcup.js:1233`). Endrer noen et gruppekampresultat etter at
finalen er spilt, endres tabellen — og dermed hvem `podium()` mener vant
(`dcup.js:866`). Vinneren kan bytte person i etterkant. Lagre navnene, slik
gruppekampene gjør.

### 7. Turneringslista har vilkårlig rekkefølge
`dcup.js:308` itererer `Object.entries(tournaments)`. Nøklene er UUID-er, så
Firebase returnerer dem sortert på tilfeldig streng. `created` finnes allerede
på hver turnering — sorter på den. Gjelder også rotasjonsrekkefølgen på
liveskjermen (`visibleDispTournaments`, `dcup.js:1409`).

### 8. ✅ Fikset i `22b7f0a`
Ny `isSignupLocked()` — sperren gjelder bare gruppespill.

### 9. Innskriving i poengtavla blir slettet av andres oppdateringer
`renderBoard` (`dcup.js:930`) bytter ut hele `innerHTML`. Kommer det en
oppdatering fra en annen mobil mens du taster inn din egen score, forsvinner
det du har skrevet. Nettopp poengtavla er stedet der mange skriver samtidig.
Behold fokusert felt, eller oppdater radene i stedet for å bygge dem på nytt.

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

### 28. Innbyrdes oppgjør er ikke transitivt — tresykler får vilkårlig rekkefølge
`calcStandings` bruker `h2h` som parvis sammenligning. I en tresykel (A slår B,
B slår C, C slår A) står alle tre likt på poeng og seire, og `h2h` gir
motstridende svar for hvert par. `Array.sort` med en inkonsistent komparator gir
da ulikt resultat avhengig av hvilken rekkefølge spillerne ligger i gruppa.

Verifisert mot alle åtte utfall av en treergruppe uten uavgjort: **to av dem er
sykler**, og hver av dem gir tre forskjellige tabeller. `localeCompare`-fiksen i
P0 #4 hjelper ikke — koden når aldri dit.

Rekkefølgen er stabil for en gitt turnering, siden trekningen ligger lagret. Men
den er avgjort av trekningen, ikke av resultatene: **én av fire treergrupper i
W/T får gruppevinneren utpekt av loddtrekning.** I `score`-modus bryter
målforskjell sykelen først.

Riktig fiks for tre like inne i en *større* gruppe er å avgjøre på miniligaen
mellom dem i stedet for parvis. En ren tresykel i en treergruppe kan ikke løses
sportslig — der er miniligaen hele gruppa. Da er det ærligere å vise delt plass,
slik `boardStandings` gjør ved lik score.

### 29. Omdøping kan lage to spillere med samme navn
`renamePerson` sperrer mot kollisjon ved å sjekke `eventPeople`. Men `addTPlayer`
og `addBoardPlayer` skriver bare til turneringens `players` via `setSignup` —
aldri til `people`. En spiller lagt til direkte i turneringsoppsettet finnes
altså ikke i `eventPeople`.

Døp om «Kari» til «Ola» når en annen «Ola» ble lagt til i oppsettet: sjekken
slipper det gjennom, gruppa får to like navn, og `fkey` kolliderer slik at to
kamper deler resultatnøkkel. Tabellen blir feil.

Fiksen er å utvide sjekken til alle turneringers `players`, ikke bare `people`.

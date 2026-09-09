# dCup — prioriteringer

Gjennomgang 2026-09-09. Linjereferanser mot `dcup.js` slik den står nå
(inkludert de ucommittede race-condition-fiksene).

---

## P0 — bør fikses før neste event

### 1. Deltakernavn injiseres rått i `onclick` (XSS + døde knapper)
`renderPeopleList` (`dcup.js:381`) og `renderPrefillList` (`dcup.js:121`) putter
`safeKey(navn)` rett inn i en HTML-attributt. `safeKey` escaper bare `. # $ / [ ]`
— ikke `'` eller `"`.

```
"O'Brien"            -> onclick="renamePerson('O'Brien')"        // knappen dør
'Ola "Tiger" N'      -> onclick="renamePerson('Ola "Tiger" N')"  // bryter ut av attributten
"x');alert(1);('"    -> kjører alert(1) ved klikk
```

Hvem som helst med event-linken kan melde på en deltaker med et slikt navn.
Resten av koden løste dette ved å sende **indeks** i stedet for navn (se
`renderBoard`, `dcup.js:939`) — gjør det samme her, eller bytt til
`data-key` + `addEventListener`.

### 2. Direktelenke til turnering (`?e=…&t=…`) kaster deg tilbake ved hver endring
`dcup.js:289` kaller `openTournament(focusTId)` inne i `eventRef.on('value')`.
Den callbacken fyrer på **hver eneste endring** i hele eventet. Konsekvens for
alle som åpnet en turneringslenke direkte:

- står du på «Kamper» og noen registrerer et resultat → du kastes til «Grupper»
  (`openTournament` avslutter med `switchTTab('groups')`)
- går du tilbake til eventlista → neste endring drar deg inn i turneringen igjen
- listeneren rives ned og settes opp på nytt hver gang

Fiks: nullstill `focusTId` etter første bruk.

### 3. Tap utenfor score-dialogen lagrer 0–0
`dcup.js:1318`: klikk på bakgrunnen kaller `saveScore()`, som leser tomme felt
som `0`. Åpner du en kamp ved et uhell og tapper utenfor for å lukke, registreres
et 0–0 uavgjort. Bør bare lagre hvis noe faktisk er tastet inn (`hs`-flagget
finnes allerede, det brukes bare ikke i `saveScore`).

### 4. `Math.random()` som siste tiebreak gjør tabellen ustabil
`dcup.js:1066`. Målt på fire spillere i samme gruppe:

| situasjon | antall ulike rekkefølger over 200 rendringer |
|---|---|
| ingen kamper spilt | 23 |
| to spillere 1–0, har ikke møtt hverandre | 4 |

To problemer:
- **Kosmetisk:** tabellen på liveskjermen stokker om seg selv ved hver
  oppdatering så lenge folk er likt.
- **Reelt:** playoff-kortene henter navn fra `sA[i]`/`sB[i]` (`dcup.js:1196`),
  så «FINALE: Anna vs Cecilie» kan bli «Cecilie vs Anna» mellom to rendringer.

Bytt til en deterministisk siste tiebreak (navn alfabetisk, eller rekkefølgen
i gruppa).

### 5. Verifiser Firebase-reglene
Kan ikke leses av repoet. Sjekk minst at `.read`/`.write` ligger på
`events/$eventId`, ikke på roten — ellers kan hvem som helst lese ut *alle*
events i basen med ett kall. Legg gjerne på `.validate` for strenglengder,
så en tom database ikke kan fylles opp.

---

## P1 — reelle hull

### 6. Playoff-resultater lagrer side, ikke navn
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

### 8. Poengtavler låses for påmelding så snart én score er levert
`isStarted` (`dcup.js:836`) sier at en poengtavle er startet når `scores` ikke
er tom, og `renderJoinList` (`dcup.js:524`) sperrer startede turneringer.
Begrunnelsen (trekningen er gjort) gjelder bare grupper — en poengtavle tåler
fint at noen kommer til underveis, og `addBoardPlayer` inne i turneringen
tillater det allerede. Inkonsistent: låsen bør bare gjelde `format: 'groups'`.

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
| 23 | Ingen tester. Den rene logikken (`calcStandings`, `boardStandings`, `podium`, `scheduledFixtures`, `renameInTournament`) er lett å teste og er akkurat der feilene sitter | — |

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
`computeGroups` deler alltid i to (`dcup.js:783`). 20 deltakere gir to grupper
à 10 = 45 kamper per gruppe. Ingen cup-bracket, ingen puljestørrelse, ingen
seeding.

---

## Ucommittet

`dcup.js` har ucommittede race-condition-fikser (`setSignup` med avbrutt
transaksjon, `removePerson`, `renamePerson`-rekkefølge, `clearTPlayers`,
`saveJoin`). **Disse bør pushes før noe nytt bygges** — de fikser reell
datatap i produksjon.

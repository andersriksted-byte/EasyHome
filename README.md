# easyHome – version 1

Et touch-dashboard til væggen med kalender, vejr (DMI m.fl.), nyheder (DR, TV 2, Jyllands-Posten …), Sonos og DR TV.
Det er en web-app, ligesom Madro, så den kan ligge gratis på GitHub Pages. Senere kan Home Assistant overtage styringen af huset, uden at designet skal laves om.

## Hvad virker med det samme, og hvad kræver opsætning

| Del | Kræver |
|---|---|
| Vejret (DMI, Yr, DWD, ECMWF) | Intet – virker med det samme |
| Ur, nedtælling, temaer, forside, DR TV-knapper | Intet |
| Nyheder | Workeren (trin 2). Til afprøvning kan du slå "offentlig test-proxy" til under Indstillinger |
| Kalendere | Workeren + iCal-links (trin 4) |
| Sonos | Workeren + en gratis Sonos-udviklerkonto (trin 3) |

**Hvorfor en worker?** Browsere må af sikkerhedshensyn ikke hente nyhedsfeeds og kalendere direkte fra andre sider, og Sonos kræver et login, der ikke må ligge i browseren. En Cloudflare Worker er en lille gratis server (100.000 kald om dagen gratis), som kun I ejer og som kun svarer, når den får jeres hemmelige nøgle.

---

## Trin 1 – Læg dashboardet på GitHub Pages (ca. 5 min)

1. Opret et nyt repository på GitHub med navnet `easyHome` (Public – Pages kræver offentligt repo på gratis-kontoen).
2. Upload alle filerne (der er ingen undermapper, så du kan bare markere alt og trække det ind).
3. Gå til **Settings → Pages**, vælg branch `main` og mappen `/ (root)`, og tryk Save.
4. Efter et minut ligger dashboardet på `https://andersriksted-byte.github.io/easyHome/`.

Vejret virker allerede nu. Åbn **Indstillinger** og søg jeres by under "Sted for vejret".

## Trin 2 – Opret workeren hos Cloudflare (ca. 10 min)

1. Opret en gratis konto på cloudflare.com.
2. Gå til **Workers & Pages → Create → Create Worker**. Kald den `easyhome` og tryk Deploy.
3. Tryk **Edit code**, slet alt og indsæt hele indholdet af `cloudflare-worker.js`. Tryk Deploy.
4. Gå til **Storage & Databases → KV → Create**, og kald den `easyhome`.
5. Tilbage i workeren: **Settings → Bindings → Add → KV namespace**. Variabelnavn: `DASH_KV`, vælg `easyhome`.
6. **Settings → Variables and Secrets**, tilføj:
   - `DASH_KEY` (type *Secret*): en lang tilfældig tekst, fx 30 tegn. Gem den – den skal også ind i dashboardet.
   - `APP_ORIGIN` (type *Text*): `https://andersriksted-byte.github.io`
7. Kopiér workerens adresse (fx `https://easyhome.ditnavn.workers.dev`).
8. I dashboardet: **Indstillinger → Forbindelse**: indsæt adressen og nøglen, og tryk **Test forbindelse**.

Nu virker nyhederne. Vælg kilder under **Indstillinger → Nyhedskilder** eller direkte på siden Nyheder.

## Trin 3 – Sonos (ca. 10 min)

1. Opret en gratis konto på developer.sonos.com og log ind.
2. Opret en ny integration af typen **Control Integration** (menunavnene kan variere lidt). Udfyld navn (fx "easyHome") og en kontakt-mail.
3. Opret en **API Key**. Under *Redirect URIs* skriver du: `https://easyhome.ditnavn.workers.dev/sonos/callback` (din egen worker-adresse + `/sonos/callback`).
4. Kopiér **Key** og **Secret** ind i workeren under **Settings → Variables and Secrets**:
   - `SONOS_CLIENT_ID` (Text) = Key
   - `SONOS_CLIENT_SECRET` (Secret) = Secret
5. I dashboardet: gå til **Musik → Forbind Sonos**, log ind med jeres almindelige Sonos-konto og tryk Tillad.

Rum, grupper og favoritter hentes automatisk. Grupper (fx Køkken + Stue) laves stadig i Sonos-appen.

## Trin 4 – Kalendere (Apple / iCloud)

Under **Indstillinger → Kalendere** tilføjer du én linje pr. kalender med navn, farve og link. Brug fx én kalender pr. familiemedlem plus en fælles familiekalender, så hver person får sin egen farve på skærmen.

**Sådan får du linket fra iPhone eller iPad**
1. Åbn **Kalender** → tryk **Kalendere** nederst.
2. Tryk **ⓘ** ud for kalenderen.
3. Slå **Offentlig kalender** til, og tryk **Del link … → Kopiér**.
4. Send linket til dig selv (fx i Beskeder) og indsæt det i dashboardet.

**Fra en Mac:** Kalender → højreklik på kalenderen i venstre side → **Del kalender …** → sæt flueben i **Offentlig kalender** → kopiér adressen.

Godt at vide:
- Linket starter med `webcal://` – det klarer dashboardet selv.
- Kun den, der *ejer* en kalender, kan gøre den offentlig. En delt familiekalender skal altså gøres offentlig af den, der har oprettet den.
- "Offentlig" betyder, at alle med linket kan se kalenderen. Linket er langt og tilfældigt, så ingen kan gætte det, men behandl det som en adgangskode. Linket kan altid slås fra igen samme sted, og så holder det op med at virke.
- Ændringer i kalenderen dukker op på dashboardet inden for ca. 10–15 minutter.
- Google- og Outlook-kalendere virker også (Google: "Hemmelig adresse i iCal-format", Outlook: ICS-link fra "Udgiv en kalender").

## Trin 5 – Tabletten på væggen

**iPad**
1. Åbn dashboardets adresse i Safari → Del-knappen → **Føj til hjemmeskærm**. Så åbner det i fuld skærm uden adresselinje, som en app.
2. **Indstillinger → Skærm og lysstyrke → Autolås → Aldrig**, og hav iPad'en i en vægholder med strøm.
3. **Indstillinger → Tilgængelighed → Guidet adgang** → slå til. Åbn dashboardet og tryk tre gange på side-/hjemknappen for at låse iPad'en til dashboardet, så børn ikke kan skifte app.
4. Overvej **Indstillinger → Batteri → Batteritilstand → Optimeret opladning**, da iPad'en hænger i strøm hele tiden.

Bemærk: iPad'en kan ikke tænde skærmen af sig selv, når man går forbi. Det kan en Android-tablet med *Fully Kiosk Browser* (*Motion detection*), hvis det er vigtigt for jer.

Indstillingerne gemmes i den enkelte skærms browser. Har du flere skærme, så brug **Indstillinger → Sikkerhedskopi** til at kopiere dem over.

---

## Kilder

**Vejret** kommer fra Open-Meteo, som samler de nationale vejrtjenesters modeller (gratis til privat brug, data under CC BY 4.0):
- **DMI** – HARMONIE-modellen, 2 km opløsning, de første 2,5 døgn (derefter suppleret med ECMWF)
- **Yr / MET Norge** – MET Nordic
- **DWD** – den tyske vejrtjenestes ICON-model
- **ECMWF** – det europæiske vejrcenter
- Siden *Vejret → Sammenlign kilder* viser dem side om side.

**Nyheder** (RSS):
- DR: Seneste nyt, Alle nyheder, Indland, Sporten, Penge, P4 København
- TV 2 Nyheder
- Jyllands-Posten (topnyheder)
- Politiken og Berlingske er med, men adresserne er ikke bekræftet endnu – virker de ikke, vises en fejl ved kilden.
- Du kan selv tilføje andre RSS-feeds. Ligger de på et nyt domæne, skal domænet også tilføjes i workerens variabel `EXTRA_HOSTS` (fx `nyheder.lokalavis.dk`).

**DR TV:** DR tillader ikke deres afspiller inde i andre sider, så knapperne åbner DRTV. Live-tv kræver ikke login. Adresserne kan rettes under Indstillinger.

## Næste skridt (fase 2 – Home Assistant)

Når der kommer en Home Assistant-boks i huset (fx Home Assistant Green), tilføjes en forbindelse til Home Assistant i workeren/appen. Så kan dashboardet også vise og styre:
- **UniFi Protect-kameraer** (live-billede og dørklokke) – kræver en lokal server, fordi kameraerne kun er tilgængelige på jeres eget netværk
- WiZ-lys, Somfy-gardiner, Tesla, Worx, elforbrug og strømpriser
- Sonos kan så også køre lokalt i stedet for via Sonos' cloud

## Filer

```
index.html            siden
app.css               udseende
app.js                layout, sider, forside, indstillinger
weather.js            vejr (Open-Meteo)
news.js               nyhedskilder (RSS)
calendar.js           kalendere (iCal)
sonos.js              Sonos
util.js               indstillinger og hjælpefunktioner
icon-180.png / -512   app-ikon
cloudflare-worker.js  koden til Cloudflare Worker (bruges ikke af selve siden)
```

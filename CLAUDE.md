# easyHome – arbejdsregler

Familie-dashboard (web-app på GitHub Pages) til en touchskærm/iPad på væggen. Brugeren skriver dansk; al tekst i app'en er på dansk.

## Ved HVER ændring der sendes op (push til main)
1. Hæv `APP_VERSION` i `updater.js` (1.2.0 → 1.3.0 for nye funktioner, 1.2.1 for rettelser).
2. Sæt samme nummer i `"version"` i `version.json`, og tilføj en ny note ØVERST i `"notes"`:
   `{ "version", "date" (fx "25. november 2026"), "title" (kort, på dansk), "items" (2–4 korte punkter på dansk, skrevet til familien – ikke teknisk) }`.
3. Er der kommet en ny fil, så tilføj den til `"files"` i `version.json`.
4. Commit og push til `main`. Fortæl brugeren i chatten: der kommer en besked "Ny opdatering klar" på skærmen inden for 2 minutter → tryk **Opdater** → "Det er nyt" viser ændringerne.

## Designregler fra brugeren
- Ændringer af indstillinger (steder, kilder, kalendere, forbindelser osv.) sker KUN under Indstillinger. Forsiden og de andre sider viser og styrer (fx afspil, skift sted med pile) – de har ingen "tilføj"- eller opsætningsknapper.
- Indstillinger er delt i faner efter emne (`SET_TABS` i app.js). Nye indstillinger lægges i den fane, de hører til.
- Nye funktioner må ikke selv tilføje kort til forsiden. Kun brugeren vælger kort under "Tilpas forside".
- Forsiden er et gitter (rækkehøjden tilpasses skærmen, så 3 rækker kort altid kan ses uden scroll; Store/Mellem/Små = 4/5/6 i bredden, skaleret med zoom); kort har w×h (1–4 i bredden, 1–4 i højden eller 2×2). Hvert kort SKAL udfylde sin form (brug `shapeKind`: tiny/wide/tall/big) – intet tomt hvidt rum, og intet indhold må skæres over (lister bruger `data-trim`, kalenderen `FIT` – kompakt visning og derefter scroll inde i kortet). Kortets størrelse er brugerens valg og må ALDRIG ændres automatisk.

- Strenge rammer for udseendet: alle kort bruger `cardHead(titel, højre)` – én linje i fast højde (36px); for lang tekst forkortes med … (aldrig ombrydning, der flytter indholdet). Tekster i kort har fast maks. antal linjer (line-clamp) eller ellipsis, så lange navne aldrig ændrer opsætningen.
- Tjenester (Indstillinger → Tjenester) slår KUN sidens punkt i sidemenuen til/fra – aldrig kort, indstillinger, header eller bundlinje. Har tjenesten kort på forsiden, spørges der (som valg), om de også skal fjernes.
- Ingen forklaringstekster i UI'et (brugeren læser dem ikke). Kun korte etiketter; nødvendige vejledninger gemmes bag et fold-ud-punkt.
- Indstillinger er kompakte: kort står to og to; kun sektioner med meget indhold er `wide`.

## Workeren
`cloudflare-worker.js` deployes automatisk af Cloudflare Workers Builds ved push til main (opsætning i `wrangler.toml`, `keep_vars = true` bevarer variabler/secrets fra dashboardet). Hvis Builds ikke er forbundet, skal brugeren kopiere filen ind manuelt (Workers & Pages → easyhome → Edit code). Rør ikke KV-id'et i wrangler.toml.
Variabler i Cloudflare: DASH_KEY (secret), APP_ORIGIN, SONOS_CLIENT_ID, SONOS_CLIENT_SECRET (secret). KV-binding: DASH_KV (Sonos-login + fælles indstillinger `shared_settings`).

## Deling mellem skærme
`sync.js` deler alle indstillinger undtagen `LOCAL_ONLY` (proxy, navOpen) via workerens `/settings`. Nye indstillingsfelter deles automatisk; skal noget være pr. skærm, tilføj det til `LOCAL_ONLY` i util.js.

## Struktur
Alle filer ligger i roden (Safari kan ikke uploade mapper til GitHub). ES-moduler uden byggetrin.
- `app.js` layout, sider, forside-widgets, indstillinger · `util.js` indstillinger (localStorage) · `updater.js` opdateringsbesked · `sync.js` deling mellem skærme
- `weather.js` Open-Meteo (DMI m.fl.) · `news.js` RSS · `calendar.js` iCal (iCloud offentlige links) · `sonos.js` Sonos Control API
- `cloudflare-worker.js` proxy til RSS/iCal, Sonos-login og fælles indstillinger (deployes automatisk af Cloudflare Builds – bruges ikke af selve siden)

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

## Struktur
Alle filer ligger i roden (Safari kan ikke uploade mapper til GitHub). ES-moduler uden byggetrin.
- `app.js` layout, sider, forside-widgets, indstillinger · `util.js` indstillinger (localStorage) · `updater.js` opdateringsbesked
- `weather.js` Open-Meteo (DMI m.fl.) · `news.js` RSS · `calendar.js` iCal (iCloud offentlige links) · `sonos.js` Sonos Control API
- `cloudflare-worker.js` proxy til RSS/iCal + Sonos-login (deployes manuelt i Cloudflare – bruges ikke af siden)

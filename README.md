# RacunKem

Kalkulator zlitin: izračun dolegiranja in razredčevanja taline. Spletna različica aplikacije iz Expo Snacka (»lite«, brez prepoznavanja iz slike) – deluje v brskalniku na telefonu ali računalniku, brez Expo Go.

## Uporaba

- Vpiši maso taline in izberi cilj dodajanja (spodnja meja ali sredina med Min in Max).
- Za vsak element vpiši Min, Max in trenutno vsebnost (%). Čistost legure je predizpolnjena po simbolu in jo lahko spremeniš.
- Premalo: pokaže potrebne kg legure. Preveč: pokaže kg čistega Al za znižanje na Max.
- Ročni vnos kg pokaže novo vsebnost po dodatku.
- Vnosi ostanejo shranjeni v telefonu (v brskalniku); »Ponastavi« jih izbriše.

## Enačbe (`alloyMath.js`)

- Dolegiranje: `kg = M · (C_cilj − C_trenutni) / (P − C_cilj)`
- Razredčevanje na Max s čistim Al: `kg = M · (C_trenutni − Max) / Max`
- Nova vsebnost po dodatku: `(M · C/100 + kg · P/100) / (M + kg) · 100`

`M` masa taline (kg), `C` vsebnost (%), `P` čistost legure (%). Enačbe so prenesene iz `alloyMath.ts` brez sprememb; če je čistost legure manjša ali enaka cilju, aplikacija namesto števila pokaže opozorilo.

## Objava

Stran je statična (`index.html`). GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root. Po objavi jo na telefonu odpri v brskalniku in izberi »Dodaj na začetni zaslon«; nato deluje tudi brez interneta.

Ob spremembi datotek povečaj `RAZLICICA` v `sw.js`.

## Testi

`node tests/alloyMath.test.js`

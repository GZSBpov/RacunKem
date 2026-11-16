# RacunKem

Kalkulator zlitin: izračun dolegiranja in razredčevanja taline. Spletna različica aplikacije iz Expo Snacka: postavitev iz različice »lite«, prepoznavanje analize iz slike iz polne različice – deluje v brskalniku na telefonu ali računalniku, brez Expo Go.

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

## Prepoznavanje iz slike

Gumba »Slikaj list« in »Iz galerije« pošljeta sliko tabele kemijske sestave strežniški skripti, ta pokliče OpenAI in vrne prebrane elemente (Min, Max, trenutna). Ključ OpenAI je samo v skripti, nikoli v kodi strani. Uporabnik potrebuje osebno kodo; brez nje kalkulator deluje, slika pa ne.

### Enkratna namestitev skripte

1. Odpri <https://script.new> (Google Apps Script), projekt poimenuj `RacunKem`.
2. Vsebino `Code.gs` zamenjaj z vsebino datoteke `streznik/Koda.gs` in shrani.
3. Nastavitve projekta (zobnik) → Lastnosti skripta → dodaj:
   - `OPENAI_API_KEY` = nov ključ OpenAI (starega, ki je bil v javnem Snacku, prej prekliči),
   - `ADMIN_GESLO` = geslo za upravljanje kod, vsaj 8 znakov.
4. V urejevalniku izberi funkcijo `preizkus` in klikni Zaženi; odobri dovoljenja. V dnevniku mora pisati »Ključ OpenAI deluje.«
5. Uvedi → Nova uvedba → vrsta: Spletna aplikacija → Izvedi kot: Jaz → Dostop: Vsakdo → Uvedi. Kopiraj naslov, ki se konča z `/exec`.
6. Naslov vpiši v `config.js` (`window.RACUNKEM_STREZNIK = '…/exec';`) in v `sw.js` povečaj `RAZLICICA`.

Ob spremembi kode skripte: Uvedi → Upravljanje uvedb → Uredi → Nova različica (naslov ostane enak).

### Kode uporabnikov

V aplikaciji spodaj: Prepoznavanje iz slike → Upravljanje kod (skrbnik) → vpiši `ADMIN_GESLO`. Tam ustvariš kodo za osebo, jo pošlješ z gumbom Deli (povezava jo sama shrani v telefon) ali jo prekličeš. Vsaka koda ima dnevno omejitev slik (privzeto 40; lastnost `DNEVNA_OMEJITEV`). Model se zamenja z lastnostjo `MODEL` (privzeto `gpt-4o-mini`).

Prebrane vrednosti vedno preveri s tabelo, preden dodajaš v talino.

## Objava

Stran je statična (`index.html`). GitHub Pages: Settings → Pages → Deploy from a branch → `main` / root. Po objavi jo na telefonu odpri v brskalniku in izberi »Dodaj na začetni zaslon«; nato deluje tudi brez interneta.

Ob spremembi datotek povečaj `RAZLICICA` v `sw.js`.

## Testi

`node tests/alloyMath.test.js` (enačbe), `node tests/streznik.test.js` (strežniška skripta v simulatorju), `python3 tests/stran.e2e.py` in `python3 tests/slika.e2e.py` (stran v brskalniku).

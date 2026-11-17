// RacunKem - izračuni legiranja (prenos iz alloyMath.ts v Expo Snacku, enačbe nespremenjene).
// Deluje v brskalniku (window.RacunKem) in v Node (testi).
(function (global) {
    'use strict';

    /** Besedilo iz vnosnega polja v število; decimalna vejica ali pika; prazno ali neveljavno = 0. */
    function vStevilo(besedilo) {
        const n = parseFloat(String(besedilo === undefined || besedilo === null ? '' : besedilo).replace(',', '.'));
        return isNaN(n) ? 0 : n;
    }

    /** Privzeta čistost legure (%) po simbolu elementa. */
    function privzetaCistost(simbol) {
        switch (String(simbol || '').trim().toUpperCase()) {
            case 'CR': return 80;
            case 'TI': return 10;
            case 'NI': return 80;
            case 'MN': return 80;
            case 'V': return 10;
            case 'B': return 5;
            case 'BI': return 100;
            case 'FE': return 80;
            case 'ZR': return 10;
            case 'SN': return 99.9;
            case 'PB': return 99.8;
            case 'MG': return 99.8;
            default: return 99.5;
        }
    }

    /**
     * Potreben dodatek legure ali čistega Al glede na stanje elementa.
     * elem: { current, min, max, purity } v odstotkih; masaTaline v kg;
     * ciljProcent: 0 = Min, 50 = sredina, 100 = Max; cistaOsnova: vsebnost elementa v čistem Al (privzeto 0 %).
     * Vrne { status: 'OK' | 'PREMALO' | 'PREVEČ', cilj, kg, mogoce }.
     */
    function izracunaj(elem, masaTaline, ciljProcent, cistaOsnova) {
        ciljProcent = ciljProcent || 0;
        cistaOsnova = cistaOsnova || 0;
        const current = elem.current, min = elem.min, max = elem.max, purity = elem.purity;

        // 1. V mejah
        if (current >= min && current <= max) return { status: 'OK', cilj: current, kg: 0, mogoce: true };

        // 2. Premalo: dolegiranje. Δm = M * (C_cilj - C_trenutni) / (P - C_cilj)
        if (current < min) {
            const cilj = min + (ciljProcent / 100) * (max - min);
            const mogoce = purity > cilj; // legura mora biti bogatejša od cilja
            const kg = mogoce ? masaTaline * ((cilj - current) / (purity - cilj)) : 0;
            return { status: 'PREMALO', cilj: cilj, kg: Math.max(0, kg), mogoce: mogoce };
        }

        // 3. Preveč: razredčevanje s čistim Al na zgornjo mejo. M_dodatek = M * (C_trenutni - C_cilj) / (C_cilj - C_čisti)
        const cilj = max - (ciljProcent / 100) * (max - min);
        const mogoce = cilj > cistaOsnova;
        const kg = mogoce ? masaTaline * ((current - cilj) / (cilj - cistaOsnova)) : 0;
        return { status: 'PREVEČ', cilj: cilj, kg: Math.max(0, kg), mogoce: mogoce };
    }

    /** Razredčevanje s čistim Al do zgornje meje (kot v aplikaciji): M * (C - Max) / Max. Brez presežka ali brez Max = 0. */
    function razredcenjeNaMax(elem, masaTaline) {
        if (!(elem.current > elem.max) || !(elem.max > 0)) return 0;
        return masaTaline * ((elem.current - elem.max) / elem.max);
    }

    /** Nova vsebnost (%) po ročnem dodatku kg legure: (čista masa prej + dodana čista masa) / nova masa taline. */
    function novaVsebnost(elem, masaTaline, dodanoKg) {
        if (!(dodanoKg > 0) || !(masaTaline > 0)) return null;
        const cistaPrej = masaTaline * (elem.current / 100);
        const cistaDodana = dodanoKg * (elem.purity / 100);
        return ((cistaPrej + cistaDodana) / (masaTaline + dodanoKg)) * 100;
    }

    /** Vsebnost (%) po dodatku kg čistega Al (brez tega elementa): M * C / (M + kg). */
    function poRazredcenju(elem, masaTaline, kgAl) {
        if (!(masaTaline > 0) || !(kgAl > 0)) return elem.current;
        return (masaTaline * elem.current) / (masaTaline + kgAl);
    }

    const API = { vStevilo: vStevilo, privzetaCistost: privzetaCistost, izracunaj: izracunaj, razredcenjeNaMax: razredcenjeNaMax, novaVsebnost: novaVsebnost, poRazredcenju: poRazredcenju };
    if (typeof module !== 'undefined' && module.exports) module.exports = API;
    else global.RacunKem = API;
})(typeof window !== 'undefined' ? window : globalThis);

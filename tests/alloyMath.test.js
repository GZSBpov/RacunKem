// Zagon: node tests/alloyMath.test.js
const R = require('../alloyMath.js');
let ok = 0, fail = 0;
function pri(ime, pogoj, p) { if (pogoj) ok++; else { fail++; console.log('NAPAKA:', ime, p === undefined ? '' : JSON.stringify(p)); } }
const blizu = (a, b, e) => Math.abs(a - b) <= (e || 1e-9);

pri('vejica in pika', R.vStevilo('0,25') === 0.25 && R.vStevilo('1.5') === 1.5 && R.vStevilo('') === 0 && R.vStevilo('abc') === 0 && R.vStevilo(undefined) === 0);
pri('privzete čistosti', R.privzetaCistost('cr') === 80 && R.privzetaCistost(' Ti ') === 10 && R.privzetaCistost('Zr') === 10 && R.privzetaCistost('Cu') === 99.5 && R.privzetaCistost('Mg') === 99.8 && R.privzetaCistost('B') === 5);

// v mejah
let r = R.izracunaj({ current: 0.3, min: 0.2, max: 0.4, purity: 99.5 }, 26000, 0);
pri('v mejah: OK, 0 kg', r.status === 'OK' && r.kg === 0);
pri('na meji je še v mejah', R.izracunaj({ current: 0.2, min: 0.2, max: 0.4, purity: 99.5 }, 26000, 0).status === 'OK' && R.izracunaj({ current: 0.4, min: 0.2, max: 0.4, purity: 99.5 }, 26000, 0).status === 'OK');

// premalo, cilj Min: 26000 * (0.2 - 0.1) / (99.5 - 0.2)
r = R.izracunaj({ current: 0.1, min: 0.2, max: 0.4, purity: 99.5 }, 26000, 0);
pri('premalo, cilj Min', r.status === 'PREMALO' && blizu(r.cilj, 0.2) && blizu(r.kg, 26000 * 0.1 / 99.3) && blizu(r.kg, 26.183, 0.001), r);
// premalo, cilj sredina: 26000 * (0.3 - 0.1) / (99.5 - 0.3)
r = R.izracunaj({ current: 0.1, min: 0.2, max: 0.4, purity: 99.5 }, 26000, 50);
pri('premalo, cilj sredina', blizu(r.cilj, 0.3) && blizu(r.kg, 26000 * 0.2 / 99.2), r);
// predzlitina 10 % (Ti): 26000 * (0.05 - 0.01) / (10 - 0.05)
r = R.izracunaj({ current: 0.01, min: 0.05, max: 0.1, purity: 10 }, 26000, 0);
pri('predzlitina z nizko čistostjo', blizu(r.kg, 26000 * 0.04 / 9.95) && blizu(r.kg, 104.52, 0.01), r);
// kontrola: po dodatku izračunane količine je vsebnost natanko cilj
pri('kontrola: dodatek pripelje natanko na cilj', blizu(R.novaVsebnost({ current: 0.01, purity: 10 }, 26000, r.kg), 0.05, 1e-9));
// čistost ni večja od cilja -> ni mogoče
r = R.izracunaj({ current: 1, min: 12, max: 14, purity: 10 }, 26000, 0);
pri('legura revnejša od cilja: ni mogoče', r.status === 'PREMALO' && r.mogoce === false && r.kg === 0, r);

// preveč: razredčevanje na Max: 26000 * (0.5 - 0.4) / 0.4
r = R.izracunaj({ current: 0.5, min: 0.2, max: 0.4, purity: 99.5 }, 26000, 0);
pri('preveč: razredčevanje na Max', r.status === 'PREVEČ' && blizu(r.kg, 6500), r);
pri('razredčenje (kot v aplikaciji) enako', blizu(R.razredcenjeNaMax({ current: 0.5, max: 0.4 }, 26000), 6500));
pri('kontrola: po razredčenju je vsebnost Max', blizu(26000 * 0.5 / (26000 + 6500), 0.4));
pri('brez presežka ali brez Max ni razredčevanja', R.razredcenjeNaMax({ current: 0.3, max: 0.4 }, 26000) === 0 && R.razredcenjeNaMax({ current: 0.3, max: 0 }, 26000) === 0);

// ročni vnos kg: (26000*0.1% + 600*99.5%) / 26600
pri('ročni vnos: nova vsebnost', blizu(R.novaVsebnost({ current: 0.1, purity: 99.5 }, 26000, 600), (26 + 597) / 26600 * 100) && blizu(R.novaVsebnost({ current: 0.1, purity: 99.5 }, 26000, 600), 2.3421, 0.0001));
pri('ročni vnos: brez kg ali mase ni rezultata', R.novaVsebnost({ current: 0.1, purity: 99.5 }, 26000, 0) === null && R.novaVsebnost({ current: 0.1, purity: 99.5 }, 0, 100) === null);

console.log('RacunKem: ' + ok + ' uspešnih, ' + fail + ' napak.');
process.exit(fail ? 1 : 0);

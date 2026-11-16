// Zagon: node tests/streznik.test.js  (prava koda streznik/Koda.gs v simulatorju)
const { ustvari } = require('./streznik-mock.js');
let ok = 0, fail = 0;
function pri(ime, pogoj, p) { if (pogoj) ok++; else { fail++; console.log('NAPAKA:', ime, p === undefined ? '' : JSON.stringify(p).slice(0, 400)); } }
const SLIKA = Buffer.from('lazna slika').toString('base64');
const koda = require('fs').readFileSync(require('path').join(__dirname, '..', 'streznik', 'Koda.gs'), 'utf8');

pri('v kodi ni ključa', !/sk-[A-Za-z0-9_-]{10,}/.test(koda));

const m = ustvari();
// brez nastavitev
pri('upravljanje brez nastavljenega gesla zavrnjeno', m.post({ akcija: 'admin.nov', geslo: '', ime: 'A' }).koda === 'geslo' && m.post({ akcija: 'admin.nov', geslo: 'karkoli', ime: 'A' }).koda === 'geslo');
m.lastnosti.ADMIN_GESLO = 'kratko';
pri('prekratko geslo za upravljanje ne velja', m.post({ akcija: 'admin.nov', geslo: 'kratko', ime: 'A' }).koda === 'geslo');
m.lastnosti.ADMIN_GESLO = 'DolgoGeslo#1';
pri('napačno geslo zavrnjeno', m.post({ akcija: 'admin.seznam', geslo: 'DolgoGeslo#2' }).koda === 'geslo');
pri('ime je obvezno', m.post({ akcija: 'admin.nov', geslo: 'DolgoGeslo#1', ime: '  ' }).status === 'error');
const a = m.post({ akcija: 'admin.nov', geslo: 'DolgoGeslo#1', ime: 'Tim' });
const b = m.post({ akcija: 'admin.nov', geslo: 'DolgoGeslo#1', ime: 'Sodelavec' });
pri('nova koda', a.status === 'success' && /^[0-9a-f]{20}$/.test(a.zeton) && a.zeton !== b.zeton, a);
pri('preverjanje kode', m.post({ akcija: 'preveri', zeton: a.zeton }).ime === 'Tim' && m.post({ akcija: 'preveri', zeton: 'x' }).koda === 'zeton' && m.post({ akcija: 'preveri' }).koda === 'zeton');
pri('koda "__proto__" ni veljavna', m.post({ akcija: 'preveri', zeton: '__proto__' }).koda === 'zeton' && m.post({ akcija: 'preveri', zeton: 'constructor' }).koda === 'zeton');

// branje slike
pri('brez kode: zavrnjeno, OpenAI ni klican', m.post({ akcija: 'preberi', zeton: 'napacna', slika: SLIKA }).koda === 'zeton' && m.stanje.klici.length === 0);
pri('brez ključa na strežniku', m.post({ akcija: 'preberi', zeton: a.zeton, slika: SLIKA }).koda === 'nastavitve' && m.stanje.klici.length === 0);
m.lastnosti.OPENAI_API_KEY = 'testni-kljuc';
pri('slika manjka / ni base64', m.post({ akcija: 'preberi', zeton: a.zeton }).status === 'error' && m.post({ akcija: 'preberi', zeton: a.zeton, slika: '<script>' }).status === 'error' && m.stanje.klici.length === 0);
m.model('```json\n[{"symbol":"Si","current":0.10,"min":0.10,"max":0.25},{"symbol":"Fe","current":"0,28","min":"0.40","max":0.6},{"symbol":"","current":1},{"symbol":"Cu ","current":2.72,"min":5.4,"max":5.8}]\n```');
const r = m.post({ akcija: 'preberi', zeton: a.zeton, slika: SLIKA });
pri('prebrani elementi (vejica, markdown, prazen simbol izpuščen)', r.status === 'success' && JSON.stringify(r.elementi) === JSON.stringify([{ symbol: 'Si', current: 0.1, min: 0.1, max: 0.25 }, { symbol: 'Fe', current: 0.28, min: 0.4, max: 0.6 }, { symbol: 'Cu', current: 2.72, min: 5.4, max: 5.8 }]), r);
const klic = m.stanje.klici[0], telo = JSON.parse(klic.moznosti.payload);
pri('klic OpenAI: ključ v glavi, privzeti model, slika in navodilo', klic.url === 'https://api.openai.com/v1/chat/completions' && klic.moznosti.headers.Authorization === 'Bearer testni-kljuc' && telo.model === 'gpt-4o-mini' && telo.messages[0].content[1].image_url.url === 'data:image/jpeg;base64,' + SLIKA && telo.messages[0].content[0].text.includes('Preberi vodoravno tabelo'));
pri('odgovor strani ne vsebuje ključa', !JSON.stringify(r).includes('testni-kljuc'));
m.lastnosti.MODEL = 'drug-model';
m.post({ akcija: 'preberi', zeton: a.zeton, slika: SLIKA });
pri('model iz nastavitev', JSON.parse(m.stanje.klici[1].moznosti.payload).model === 'drug-model');
m.model('Oprostite, tabele ne vidim.');
pri('neberljiv odgovor modela', m.post({ akcija: 'preberi', zeton: a.zeton, slika: SLIKA }).koda === 'branje');
m.model('Tukaj je: [{"symbol":"Mg","current":1.2,"min":1,"max":1.5}] Lep pozdrav');
pri('seznam sredi besedila se prebere', m.post({ akcija: 'preberi', zeton: a.zeton, slika: SLIKA }).elementi[0].symbol === 'Mg');
m.stanje.odgovor = { status: 401, telo: JSON.stringify({ error: { message: 'Incorrect API key' } }) };
const e1 = m.post({ akcija: 'preberi', zeton: a.zeton, slika: SLIKA });
pri('napaka OpenAI se sporoči', e1.koda === 'openai' && e1.message.includes('Incorrect API key'));
m.stanje.odgovor = { status: 502, telo: '<html>Bad gateway</html>' };
pri('neberljiv HTTP odgovor', m.post({ akcija: 'preberi', zeton: a.zeton, slika: SLIKA }).status === 'error');

// dnevna omejitev
m.model('[{"symbol":"Si","current":1,"min":1,"max":2}]');
m.lastnosti.DNEVNA_OMEJITEV = '3'; m.stanje.zdaj = '2026-11-17'; m.lastnosti.STEVCI = '{}';
const brez = [1, 2, 3, 4].map(() => m.post({ akcija: 'preberi', zeton: b.zeton, slika: SLIKA }));
pri('dnevna omejitev na kodo', brez.slice(0, 3).every(x => x.status === 'success') && brez[3].koda === 'omejitev', brez.map(x => x.status));
pri('omejitev velja ločeno za vsako kodo', m.post({ akcija: 'preberi', zeton: a.zeton, slika: SLIKA }).status === 'success');
const sez = m.post({ akcija: 'admin.seznam', geslo: 'DolgoGeslo#1' });
pri('seznam kod s porabo', sez.kode.length === 2 && sez.kode.find(k => k.ime === 'Sodelavec').danes === 3 && sez.kode.find(k => k.ime === 'Tim').danes === 1, sez);
m.stanje.zdaj = '2026-11-18';
pri('naslednji dan se števec začne znova', m.post({ akcija: 'preberi', zeton: b.zeton, slika: SLIKA }).status === 'success');

// preklic
pri('preklic kode', m.post({ akcija: 'admin.preklici', geslo: 'DolgoGeslo#1', zeton: b.zeton }).status === 'success' && m.post({ akcija: 'preberi', zeton: b.zeton, slika: SLIKA }).koda === 'zeton' && m.post({ akcija: 'preveri', zeton: a.zeton }).status === 'success');
pri('preklic neobstoječe kode', m.post({ akcija: 'admin.preklici', geslo: 'DolgoGeslo#1', zeton: 'ni' }).status === 'error');
pri('neznana akcija in pokvarjena zahteva', m.post({ akcija: 'x' }).status === 'error' && m.post('{pokvarjeno').status === 'error');

console.log('RacunKem strežnik: ' + ok + ' uspešnih, ' + fail + ' napak.');
process.exit(fail ? 1 : 0);

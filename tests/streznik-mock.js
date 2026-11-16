// Simulator okolja Google Apps Script za streznik/Koda.gs (testi). OpenAI je nadomeščen z nastavljivim odgovorom.
const fs = require('fs'), path = require('path'), vm = require('vm'), http = require('http'), crypto = require('crypto');

function ustvari() {
    const lastnosti = {};
    const stanje = { klici: [], odgovor: { status: 200, telo: JSON.stringify({ choices: [{ message: { content: '[]' } }] }) }, zdaj: null };
    const sandbox = {
        PropertiesService: { getScriptProperties: () => ({
            getProperty: (k) => (Object.prototype.hasOwnProperty.call(lastnosti, k) ? lastnosti[k] : null),
            setProperty: (k, v) => { lastnosti[k] = String(v); }, deleteProperty: (k) => { delete lastnosti[k]; } }) },
        ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (t) => ({ besedilo: t, setMimeType() { return this; } }) },
        LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
        Utilities: { sleep() {}, getUuid: () => crypto.randomUUID(), formatDate: () => stanje.zdaj || new Date().toISOString().slice(0, 10) },
        UrlFetchApp: { fetch: (url, moznosti) => { stanje.klici.push({ url, moznosti }); return { getResponseCode: () => stanje.odgovor.status, getContentText: () => stanje.odgovor.telo }; } },
        Logger: { log() {} }, JSON, Math, Date, parseInt, parseFloat, isFinite, isNaN, String, Object, Array, Error
    };
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'streznik', 'Koda.gs'), 'utf8'), sandbox);
    const post = (telo) => JSON.parse(sandbox.doPost({ postData: { contents: typeof telo === 'string' ? telo : JSON.stringify(telo) } }).besedilo);
    return { lastnosti, stanje, sandbox, post, model(odgovorBesedilo) { stanje.odgovor = { status: 200, telo: JSON.stringify({ choices: [{ message: { content: odgovorBesedilo } }] }) }; } };
}

/** HTTP strežnik: datoteke repozitorija + /exec kot skripta. */
function zagon(mock, vrata, koren) {
    const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
    return http.createServer((zahteva, odgovor) => {
        const pot = zahteva.url.split('?')[0];
        const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' };
        if (zahteva.method === 'OPTIONS') { odgovor.writeHead(204, cors); odgovor.end(); return; }
        if (pot === '/exec' && zahteva.method === 'POST') {
            let telo = ''; zahteva.on('data', (d) => { telo += d; });
            zahteva.on('end', () => { odgovor.writeHead(200, Object.assign({ 'Content-Type': 'application/json' }, cors)); odgovor.end(JSON.stringify(mock.post(telo))); });
            return;
        }
        if (pot === '/__nastavi' && zahteva.method === 'POST') {
            let telo = ''; zahteva.on('data', (d) => { telo += d; });
            zahteva.on('end', () => { const n = JSON.parse(telo); if (n.model !== undefined) mock.model(n.model); if (n.lastnosti) Object.assign(mock.lastnosti, n.lastnosti); odgovor.writeHead(200, cors); odgovor.end(JSON.stringify({ lastnosti: mock.lastnosti, klicev: mock.stanje.klici.length })); });
            return;
        }
        const datoteka = path.join(koren, decodeURIComponent(pot === '/' ? '/index.html' : pot));
        if (!datoteka.startsWith(koren) || !fs.existsSync(datoteka) || fs.statSync(datoteka).isDirectory()) { odgovor.writeHead(404); odgovor.end('ni'); return; }
        odgovor.writeHead(200, { 'Content-Type': mime[path.extname(datoteka)] || 'application/octet-stream' });
        odgovor.end(fs.readFileSync(datoteka));
    }).listen(vrata, '127.0.0.1');
}
module.exports = { ustvari, zagon };
if (require.main === module) { const m = ustvari(); zagon(m, parseInt(process.argv[2], 10) || 8851, path.join(__dirname, '..')); }

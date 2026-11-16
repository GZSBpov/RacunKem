// ==========================================================================
// RacunKem - strežniška skripta za prepoznavanje analize iz slike (Google Apps Script, samostojna)
//
// Ključ OpenAI je SAMO tukaj (Nastavitve projekta -> Lastnosti skripta), nikoli v kodi strani.
// Stran pošlje sliko in kodo uporabnika; skripta preveri kodo, pokliče OpenAI in vrne prebrane elemente.
//
// Lastnosti skripta (Project Settings -> Script properties):
//   OPENAI_API_KEY   ključ OpenAI (obvezno)
//   ADMIN_GESLO      geslo za upravljanje kod uporabnikov v aplikaciji (obvezno, vsaj 8 znakov)
//   MODEL            model OpenAI (neobvezno, privzeto gpt-4o-mini)
//   DNEVNA_OMEJITEV  največ slik na kodo na dan (neobvezno, privzeto 40)
// Kode uporabnikov (ZETONI) in dnevni števci (STEVCI) se vpisujejo sami.
//
// NAMESTITEV: glej README.md.
// ==========================================================================

var PRIVZETI_MODEL = "gpt-4o-mini";
var PRIVZETA_DNEVNA_OMEJITEV = 40;
var NAJVEC_ZNAKOV_SLIKE = 6000000; // base64; stran sliko pred pošiljanjem pomanjša

var NAVODILO = [
  "Preberi vodoravno tabelo kemijske sestave s slike.",
  "Stolpci so kemijski elementi (Si, Fe, Cu, Mn, Mg, Cr, Zn, Ti, Pb, Zr, Bi, Sn, Ni).",
  "Vrstice so:",
  "- Max (zgornja meja)",
  "- Sredinska vrstica z barvnimi polji (trenutna vrednost / vsebnost)",
  "- Min (spodnja meja)",
  "",
  "Za vsak element vrni objekt z:",
  "- symbol: simbol elementa (npr. \"Si\", \"Fe\", \"Cu\")",
  "- current: trenutna vrednost iz sredinske vrstice kot številka (uporabi piko namesto vejice, npr. 0.10, 0.28, 2.72)",
  "- min: spodnja meja iz vrstice Min kot številka (npr. 0.10, 0.40)",
  "- max: zgornja meja iz vrstice Max kot številka (npr. 0.25, 0.60)",
  "",
  "Odgovori IZKLJUČNO v veljavnem JSON formatu (polje objektov) brez kakršnihkoli markdown oznak (brez ```json)."
].join("\n");

// ---------- pomožno ----------

function lastnosti() { return PropertiesService.getScriptProperties(); }
function vrniJson(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function napaka(sporocilo, koda) { return vrniJson({ status: "error", message: sporocilo, koda: koda || "" }); }

function beriJson(kljuc) {
  try { return JSON.parse(lastnosti().getProperty(kljuc) || "{}") || {}; } catch (e) { return {}; }
}
function danes() { return Utilities.formatDate(new Date(), "Europe/Ljubljana", "yyyy-MM-dd"); }

function stevilo(v) {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var n = parseFloat(String(v === undefined || v === null ? "" : v).replace(",", "."));
  return isNaN(n) ? 0 : n;
}

/** Odgovor modela -> seznam elementov { symbol, current, min, max }. Vrže napako, če odgovor ni seznam. */
function razcleniOdgovor(besedilo) {
  var cisto = String(besedilo || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  var zacetek = cisto.indexOf("["), konec = cisto.lastIndexOf("]");
  if (zacetek >= 0 && konec > zacetek) cisto = cisto.slice(zacetek, konec + 1);
  var seznam = JSON.parse(cisto);
  if (!Array.isArray(seznam)) throw new Error("Odgovor ni seznam elementov.");
  var rezultat = [];
  seznam.forEach(function (e) {
    if (!e || typeof e !== "object") return;
    var simbol = String(e.symbol || "").trim().replace(/[^A-Za-z]/g, "").slice(0, 3);
    if (!simbol) return;
    rezultat.push({ symbol: simbol, current: stevilo(e.current), min: stevilo(e.min), max: stevilo(e.max) });
  });
  return rezultat.slice(0, 40);
}

// ---------- kode uporabnikov ----------

/** Vrne zapis kode ali null. */
function najdiZeton(zeton) {
  if (!zeton) return null;
  var vsi = beriJson("ZETONI");
  return Object.prototype.hasOwnProperty.call(vsi, zeton) ? vsi[zeton] : null;
}

function jeAdmin(geslo) {
  var pravo = lastnosti().getProperty("ADMIN_GESLO") || "";
  if (pravo.length >= 8 && geslo && String(geslo) === pravo) return true;
  Utilities.sleep(500); // upočasni ugibanje
  return false;
}

/** Poveča dnevni števec kode; vrne false, če je dnevna omejitev dosežena. Stari dnevi se pobrišejo. */
function porabi(zeton) {
  var omejitev = parseInt(lastnosti().getProperty("DNEVNA_OMEJITEV"), 10) || PRIVZETA_DNEVNA_OMEJITEV;
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return false;
  try {
    var stevci = beriJson("STEVCI");
    var d = danes();
    if (stevci.dan !== d) stevci = { dan: d, st: {} };
    var n = stevci.st[zeton] || 0;
    if (n >= omejitev) return false;
    stevci.st[zeton] = n + 1;
    lastnosti().setProperty("STEVCI", JSON.stringify(stevci));
    return true;
  } finally {
    lock.releaseLock();
  }
}

// ---------- prepoznavanje ----------

function preberiSliko(vnos) {
  var zapis = najdiZeton(vnos.zeton);
  if (!zapis) { Utilities.sleep(500); return napaka("Koda za prepoznavanje ni veljavna.", "zeton"); }
  var slika = String(vnos.slika || "");
  if (!slika) return napaka("Slika manjka.");
  if (slika.length > NAJVEC_ZNAKOV_SLIKE) return napaka("Slika je prevelika.");
  if (!/^[A-Za-z0-9+/=]+$/.test(slika)) return napaka("Slika ni v pričakovani obliki.");
  var kljuc = lastnosti().getProperty("OPENAI_API_KEY");
  if (!kljuc) return napaka("Na strežniku ni nastavljen ključ OpenAI.", "nastavitve");
  if (!porabi(vnos.zeton)) return napaka("Dnevna omejitev slik za to kodo je dosežena.", "omejitev");

  var odgovor = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", {
    method: "post",
    contentType: "application/json",
    headers: { Authorization: "Bearer " + kljuc },
    muteHttpExceptions: true,
    payload: JSON.stringify({
      model: lastnosti().getProperty("MODEL") || PRIVZETI_MODEL,
      messages: [{ role: "user", content: [
        { type: "text", text: NAVODILO },
        { type: "image_url", image_url: { url: "data:image/jpeg;base64," + slika } }
      ] }],
      max_tokens: 1500
    })
  });
  var podatki;
  try { podatki = JSON.parse(odgovor.getContentText()); } catch (e) { return napaka("OpenAI je vrnil neberljiv odgovor (HTTP " + odgovor.getResponseCode() + ")."); }
  if (podatki.error) return napaka("OpenAI: " + (podatki.error.message || "napaka"), "openai");
  var besedilo = podatki.choices && podatki.choices[0] && podatki.choices[0].message ? podatki.choices[0].message.content : "";
  var elementi;
  try { elementi = razcleniOdgovor(besedilo); } catch (e) { return napaka("Tabele s slike ni bilo mogoče prebrati. Poskusi z ostrejšo sliko.", "branje"); }
  if (!elementi.length) return napaka("Na sliki ni bilo najdenih elementov.", "branje");
  return vrniJson({ status: "success", elementi: elementi });
}

// ---------- upravljanje kod (z geslom ADMIN_GESLO) ----------

function upravljanje(vnos) {
  if (!jeAdmin(vnos.geslo)) return napaka("Napačno geslo za upravljanje.", "geslo");
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return napaka("Strežnik je zaseden, poskusi znova.");
  try {
    var vsi = beriJson("ZETONI");
    if (vnos.akcija === "admin.nov") {
      var ime = String(vnos.ime || "").trim().slice(0, 40);
      if (!ime) return napaka("Vpiši ime uporabnika.");
      var zeton = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, "").slice(0, 20);
      vsi[zeton] = { ime: ime, ustvarjen: danes() };
      lastnosti().setProperty("ZETONI", JSON.stringify(vsi));
      return vrniJson({ status: "success", zeton: zeton, ime: ime });
    }
    if (vnos.akcija === "admin.preklici") {
      if (!Object.prototype.hasOwnProperty.call(vsi, vnos.zeton)) return napaka("Koda ni najdena.");
      delete vsi[vnos.zeton];
      lastnosti().setProperty("ZETONI", JSON.stringify(vsi));
      return vrniJson({ status: "success" });
    }
    // admin.seznam
    var stevci = beriJson("STEVCI");
    var danesSt = stevci.dan === danes() ? (stevci.st || {}) : {};
    var seznam = Object.keys(vsi).map(function (z) { return { zeton: z, ime: vsi[z].ime, ustvarjen: vsi[z].ustvarjen, danes: danesSt[z] || 0 }; });
    return vrniJson({ status: "success", kode: seznam });
  } finally {
    lock.releaseLock();
  }
}

// ---------- vstopni točki ----------

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return napaka("Prazna zahteva.");
    var vnos = JSON.parse(e.postData.contents);
    switch (vnos.akcija) {
      case "preberi": return preberiSliko(vnos);
      case "preveri": {
        var zapis = najdiZeton(vnos.zeton);
        if (!zapis) { Utilities.sleep(500); return napaka("Koda za prepoznavanje ni veljavna.", "zeton"); }
        return vrniJson({ status: "success", ime: zapis.ime });
      }
      case "admin.seznam":
      case "admin.nov":
      case "admin.preklici": return upravljanje(vnos);
      default: return napaka("Neznana akcija.");
    }
  } catch (err) {
    return napaka("Napaka strežnika: " + String(err && err.message ? err.message : err));
  }
}

function doGet() {
  return vrniJson({ status: "success", storitev: "RacunKem" });
}

// ---------- preizkus (zaženi ročno v urejevalniku: odobri dovoljenja in preveri ključ) ----------

function preizkus() {
  var kljuc = lastnosti().getProperty("OPENAI_API_KEY");
  var admin = lastnosti().getProperty("ADMIN_GESLO") || "";
  if (!kljuc) { Logger.log("MANJKA lastnost OPENAI_API_KEY."); return; }
  if (admin.length < 8) Logger.log("POZOR: lastnost ADMIN_GESLO manjka ali ima manj kot 8 znakov - upravljanje kod ne bo delovalo.");
  var odgovor = UrlFetchApp.fetch("https://api.openai.com/v1/models", { headers: { Authorization: "Bearer " + kljuc }, muteHttpExceptions: true });
  Logger.log(odgovor.getResponseCode() === 200 ? "Ključ OpenAI deluje." : "OpenAI je zavrnil ključ (HTTP " + odgovor.getResponseCode() + ").");
}

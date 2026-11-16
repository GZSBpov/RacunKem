# Zagon: python3 tests/slika.e2e.py (potrebuje Playwright, Pillow in Node)
import os, tempfile
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
LIST = os.path.join(tempfile.gettempdir(), 'racunkem-list.jpg')
import subprocess, time, json, io, urllib.request
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw
P=8851; B=f'http://127.0.0.1:{P}'
srv=subprocess.Popen(['node',os.path.join(ROOT, 'tests', 'streznik-mock.js'),str(P)]); time.sleep(0.8)
def nastavi(**k): return json.loads(urllib.request.urlopen(urllib.request.Request(B+'/__nastavi', data=json.dumps(k).encode(), method='POST')).read())
ok=fail=0
def pri(ime,p,x=''):
    global ok,fail
    if p: ok+=1
    else: fail+=1; print('NAPAKA:',ime,str(x)[:300])
def cakaj(f,t=8):
    k=time.time()+t
    while time.time()<k:
        try:
            if f(): return True
        except Exception: pass
        time.sleep(0.1)
    return False
im=Image.new('RGB',(3000,2000),(250,250,250)); ImageDraw.Draw(im).text((100,100),'Si Fe Cu',fill=(0,0,0)); buf=io.BytesIO(); im.save(buf,'JPEG'); open(LIST,'wb').write(buf.getvalue())
nastavi(lastnosti={'ADMIN_GESLO':'DolgoGeslo#1','OPENAI_API_KEY':'testni-kljuc'}, model='[{"symbol":"Si","current":0.10,"min":0.10,"max":0.25},{"symbol":"Fe","current":0.28,"min":0.40,"max":0.60},{"symbol":"Cu","current":6.1,"min":5.4,"max":5.8}]')
try:
  with sync_playwright() as pw:
    b=pw.chromium.launch()
    def stran(streznik=True, hash_=''):
        ctx=b.new_context(viewport={'width':390,'height':844})
        if streznik: ctx.route('**/config.js', lambda r: r.fulfill(status=200, content_type='application/javascript', body=f"window.RACUNKEM_STREZNIK='{B}/exec';"))
        p=ctx.new_page(); p.nap=[]; p.on('pageerror', lambda e: p.nap.append(str(e)))
        p.goto(B+'/index.html'+hash_); return p
    # brez strežnika: kalkulator deluje, slika izklopljena
    p=stran(False)
    p.click('#btn-kamera')
    pri('brez strežnika: obvestilo, kalkulator deluje', 'ni vklopljeno' in p.inner_text('#foto-stanje') and p.locator('#elementi .card').count()==4 and p.evaluate("document.getElementById('nastavitve').open"))
    # s strežnikom, brez kode
    p=stran()
    p.click('#btn-galerija')
    pri('brez kode: odpre nastavitve', p.evaluate("document.getElementById('nastavitve').open") and 'vpiši kodo' in p.inner_text('#foto-stanje'))
    p.fill('#koda','napacna'); p.click('#btn-koda')
    pri('napačna koda zavrnjena', cakaj(lambda: 'ni veljavna' in p.inner_text('#foto-stanje')), p.inner_text('#foto-stanje'))
    # skrbnik
    p.evaluate("document.getElementById('skrbnik').open = true")
    p.fill('#admin-geslo','napacno'); p.click('#btn-admin')
    pri('skrbnik: napačno geslo', cakaj(lambda: 'Napačno geslo' in p.inner_text('#admin-stanje')) and p.is_hidden('#admin-vsebina'))
    p.fill('#admin-geslo','DolgoGeslo#1'); p.click('#btn-admin')
    pri('skrbnik: prazen seznam', cakaj(lambda: p.is_visible('#admin-vsebina') and 'Ni izdanih kod' in p.inner_text('#admin-seznam')))
    p.fill('#admin-ime','Janez'); p.click('#btn-admin-nov')
    pri('skrbnik: nova koda', cakaj(lambda: 'Janez' in p.inner_text('#admin-seznam')) and 'ustvarjena' in p.inner_text('#admin-stanje'), p.inner_text('#admin-stanje'))
    zeton=list(json.loads(nastavi()['lastnosti']['ZETONI']).keys())[0]
    pri('stran ne vsebuje ključa OpenAI', 'testni-kljuc' not in p.content())
    # sodelavec odpre povezavo s kodo
    s=stran(True, '#koda='+zeton)
    pri('povezava s kodo: koda shranjena in umaknjena iz naslova', cakaj(lambda: 'Koda velja (Janez)' in s.text_content('#foto-stanje')) and 'koda=' not in s.url and s.evaluate("localStorage.getItem('racunkem_koda_v1')")==zeton, (s.text_content('#foto-stanje'), s.url))
    s.set_input_files('#vnos-galerija',LIST)
    pri('slika: prebrani trije elementi', cakaj(lambda: s.locator('#elementi .card').count()==3 and 'Prebranih 3' in s.inner_text('#sporocilo')), s.inner_text('#sporocilo'))
    k=s.locator('#elementi .card')
    pri('slika: vrednosti in čistost po simbolu', k.nth(1).locator('.symbol').inner_text()=='Fe' and k.nth(1).locator('[data-polje=minInput]').input_value()=='0.4' and k.nth(1).locator('[data-polje=purityInput]').input_value()=='80' and k.nth(0).locator('[data-polje=currentInput]').input_value()=='0.1')
    pri('slika: izračuni in značke', 'OK' in k.nth(0).inner_text() and 'POD MEJO' in k.nth(1).inner_text() and '39.20 kg' in k.nth(1).inner_text() and 'NAD MEJO' in k.nth(2).inner_text() and 'kg Al' in k.nth(2).inner_text(), k.nth(1).inner_text())
    pri('slika: predogled in gumbi spet aktivni', s.is_visible('#predogled') and s.is_enabled('#btn-kamera') and s.is_hidden('#nalaganje'))
    poslano=s.evaluate("document.getElementById('predogled').naturalWidth")
    pri('slika pomanjšana pred pošiljanjem (1600 točk)', poslano==1600, poslano)
    # napaka branja
    nastavi(model='Tabele ne vidim.')
    s.set_input_files('#vnos-galerija',LIST)
    pri('neberljiva slika: sporočilo, elementi ostanejo', cakaj(lambda: 'ni bilo mogoče prebrati' in s.inner_text('#sporocilo')) and s.locator('#elementi .card').count()==3, s.inner_text('#sporocilo'))
    # preklic kode
    p.locator('[data-preklici]').first.click(); p.locator('[data-preklici]').first.click()
    pri('skrbnik: preklic kode', cakaj(lambda: 'Ni izdanih kod' in p.inner_text('#admin-seznam')))
    s.set_input_files('#vnos-galerija',LIST)
    pri('preklicana koda: zavrnjeno z navodilom', cakaj(lambda: 'ni veljavna' in s.inner_text('#sporocilo')) and s.evaluate("document.getElementById('nastavitve').open"), s.inner_text('#sporocilo'))
    pri('brez JS napak', not p.nap and not s.nap, (p.nap, s.nap))
    b.close()
finally:
    srv.terminate()
print(f'RacunKem slika: {ok} uspešnih, {fail} napak.')

# Zagon: python3 tests/stran.e2e.py (potrebuje Playwright)
import os
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
import functools, http.server, threading
from playwright.sync_api import sync_playwright
class T(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*a): pass
s=http.server.ThreadingHTTPServer(('127.0.0.1',8841),functools.partial(T,directory=ROOT)); threading.Thread(target=s.serve_forever,daemon=True).start()
ok=fail=0
def pri(ime,p,x=''):
    global ok,fail
    if p: ok+=1
    else: fail+=1; print('NAPAKA:',ime,str(x)[:300])
with sync_playwright() as pw:
    b=pw.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
    p=ctx.new_page(); nap=[]; p.on('pageerror', lambda e: nap.append(str(e))); p.on('console', lambda m: nap.append(m.text) if m.type=='error' else None)
    p.goto('http://127.0.0.1:8841/index.html')
    pri('štirje privzeti elementi', p.locator('#elementi .card').count()==4 and p.input_value('#masa')=='26000')
    k=p.locator('#elementi .card').nth(0)
    k.locator('[data-polje=minInput]').fill('0,2'); k.locator('[data-polje=maxInput]').fill('0,4'); k.locator('[data-polje=currentInput]').fill('0,1')
    pri('premalo: 26,18 kg (cilj Min)', '26.18 kg' in k.inner_text() and 'premalo' in k.get_attribute('class'), k.inner_text())
    pri('polje med tipkanjem ohrani fokus', p.evaluate("document.activeElement.dataset.polje")=='currentInput')
    p.click('#cilj-sredina')
    pri('cilj sredina: 52,42 kg', '52.42 kg' in k.inner_text(), k.inner_text())
    k.locator('[data-polje=customKgInput]').fill('600')
    pri('ročni vnos 600 kg: 2,342 %', '2.342 %' in k.inner_text(), k.inner_text())
    k.locator('[data-polje=currentInput]').fill('0.5')
    pri('presežek: 6500 kg Al', '6500.00 kg Al' in k.inner_text() and 'prevec' in k.get_attribute('class'), k.inner_text())
    k.locator('[data-polje=currentInput]').fill('0.3')
    pri('v mejah: brez rezultata', 'kg Al' not in k.inner_text() and 'potrebno' not in k.inner_text() and 'ok' in k.get_attribute('class').split())
    p.fill('#nov-simbol','ti'); p.fill('#nov-min','0,05'); p.fill('#nov-max','0,1'); p.fill('#nov-trenutno','0,01'); p.click('#btn-dodaj')
    n=p.locator('#elementi .card').nth(4)
    pri('dodan Ti s čistostjo 10', p.locator('#elementi .card').count()==5 and n.locator('.symbol').inner_text()=='TI' and n.locator('[data-polje=purityInput]').input_value()=='10')
    pri('Ti sredina: 26000*(0,075-0,01)/(10-0,075) = 170,28 kg', '170.28 kg' in n.inner_text(), n.inner_text())
    n.locator('[data-polje=purityInput]').fill('0,05')
    pri('prenizka čistost: opozorilo namesto števila', 'ni mogoče' in n.inner_text(), n.inner_text())
    p.reload()
    pri('stanje ostane po ponovnem odprtju', p.locator('#elementi .card').count()==5 and p.locator('#elementi .card').nth(0).locator('[data-polje=minInput]').input_value()=='0,2' and 'active' in p.get_attribute('#cilj-sredina','class'))
    p.locator('#elementi .card').nth(4).locator('[data-odstrani]').click()
    pri('odstranitev elementa', p.locator('#elementi .card').count()==4)
    p.click('#btn-ponastavi'); p.click('#btn-ponastavi')
    pri('ponastavitev', p.locator('#elementi .card').nth(0).locator('[data-polje=minInput]').input_value()=='0' and 'active' in p.get_attribute('#cilj-min','class'))
    pri('brez napak', not nap, nap)
    b.close()
print(f'RacunKem stran: {ok} uspešnih, {fail} napak.')

/* Browser regression test for Triangle Thing: node browser_test.js [playwright-path]
 *
 * Loads index.html in headless Chromium and checks, over random and exact-right triangles at several Decimals settings:
 *   1. the built-in calcAudit (every sidebar number re-derived a second way) reports no failures
 *   2. every trig table cell matches Math.sin / cos / tan / csc / sec / cot of the angle
 *   3. every explanation panel's per-angle result matches the table
 *   4. edge cases: a corner that only READS 90 keeps its finite tan / sec, a true 90° is undefined, a flat triangle is Degenerate
 * Exits non-zero on any failure. (stress_test.js is the older script for the pre-split triangle.html.) */
const path = require('path');
const { chromium } = require(process.argv[2] || 'playwright');

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const fns = ['sin', 'cos', 'tan', 'csc', 'sec', 'cot'], fails = [];
    let seed = 987; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const num = t => { const m = t.replace('−', '-').match(/-?\d+(\.\d+)?(e[+-]?\d+)?/); return m ? parseFloat(m[0]) : NaN; };
    const tests = [];
    for (let i = 0; i < 300; i++) tests.push({ P: [0, 1, 2].map(() => ({ x: rnd() * 10 - 5, y: rnd() * 8 - 4 })), prec: [0, 1, 2, 4, 6, 8][i % 6] });
    for (let i = 0; i < 80; i++) {
      const th = rnd() * 6.283, s = 0.5 + rnd() * 5, l = [0.3, 0.75, 1, Math.sqrt(3), 2.2][i % 5] * s;
      const R = (x, y) => ({ x: x * Math.cos(th) - y * Math.sin(th) + 1, y: x * Math.sin(th) + y * Math.cos(th) - 1 });
      tests.push({ P: [R(0, 0), R(s, 0), R(0, l)], prec: [2, 4, 6][i % 3] });
    }
    let audits = 0, cells = 0, panels = 0;
    for (const [n, tc] of tests.entries()) {
      S.prec = tc.prec; S.P = tc.P; renderNow();
      const au = calcAudit(derive()); audits += au.total;
      if (au.failed.length) fails.push('audit #' + n + ': ' + au.failed[0].group + '/' + au.failed[0].label);
      const P = tc.P;
      for (let i = 0; i < 3; i++) {
        const j = (i + 1) % 3, k = (i + 2) % 3, ux = P[j].x - P[i].x, uy = P[j].y - P[i].y, vx = P[k].x - P[i].x, vy = P[k].y - P[i].y;
        const ang = Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy));
        const tru = { sin: Math.sin(ang), cos: Math.cos(ang) }; tru.tan = tru.sin / tru.cos; tru.csc = 1 / tru.sin; tru.sec = 1 / tru.cos; tru.cot = tru.cos / tru.sin;
        for (const fn of fns) {
          const txt = document.getElementById('tg_' + fn + '_' + i).textContent.trim(); cells++;
          const want = Math.abs(tru[fn]) < 1e-12 ? 0 : tru[fn], tol = 0.5 * Math.pow(10, -tc.prec) * 1.0001;
          const ok = !isFinite(want) || Math.abs(want) > 1e6 ? txt === 'undefined' || Math.abs(num(txt)) > 1e5
                   : Math.abs(want) >= 1e7 ? true : Math.abs(num(txt) - want) <= tol;
          if (!ok) fails.push('table prec ' + tc.prec + ' ' + fn + ' ' + 'ABC'[i] + ': "' + txt + '" want ' + want);
        }
      }
      if (n % 3 === 0) for (const fn of fns) {
        openTrigExplain(fn); panels++;
        for (const row of modalRoot.innerText.split('\n').join(' ').split(/(?=\b(?:sin|cos|tan|csc|sec|cot)\([ABC]\) =)/)) {
          const m = row.match(/^(sin|cos|tan|csc|sec|cot)\(([ABC])\) =/); if (!m || m[1] !== fn) continue;
          const parts = row.split('='), last = parts[parts.length - 1].trim().split(/\s\(|\s{2,}|\s[a-z]+\(/)[0];
          const cell = document.getElementById('tg_' + fn + '_' + 'ABC'.indexOf(m[2])).textContent.trim();
          if (last !== cell && !(Math.abs(num(last) - num(cell)) <= 1e-12)) fails.push('panel ' + fn + ' ' + m[2] + ': "' + last + '" vs table "' + cell + '"');
        }
        if (typeof closeModal === 'function') closeModal();
      }
    }
    const edge = (P, prec) => { S.prec = prec; S.P = P.map(([x, y]) => ({ x, y })); renderNow(); return { D: derive(), tan: refs.tg_tan_0.textContent, sec: refs.tg_sec_0.textContent, cls: refs.class.textContent }; };
    const rad = d => d * Math.PI / 180;
    let e = edge([[0, 0], [3, 0], [4 * Math.cos(rad(89.52)), 4 * Math.sin(rad(89.52))]], 0);
    if (e.tan !== '119' || e.sec !== '119') fails.push('89.52° at 0 dp: tan ' + e.tan + ' sec ' + e.sec + ' (want 119)');
    e = edge([[0, 0], [3, 0], [0, 4]], 4);
    if (e.tan !== 'undefined' || e.sec !== 'undefined') fails.push('3-4-5: tan/sec of 90° should be undefined, got ' + e.tan + ' / ' + e.sec);
    e = edge([[0, 0], [2, 0], [1, 0]], 4);
    if (e.D.kind !== 'Degenerate') fails.push('flat triangle classified ' + e.D.kind);
    return { fails, audits, cells, panels };
  });
  console.log('audit checks ' + r.audits + ', trig cells ' + r.cells + ', explanation panels ' + r.panels + ', page errors ' + errors.length);
  r.fails.slice(0, 20).forEach(f => console.log('FAIL ' + f));
  await browser.close();
  process.exit(r.fails.length || errors.length ? 1 : 0);
})();

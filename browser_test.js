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
          if (last !== cell && !(Math.abs(num(last) - num(cell)) <= 0.5 * Math.pow(10, -tc.prec) * 1.0001 + 1e-12)) fails.push('panel ' + fn + ' ' + m[2] + ': "' + last + '" vs table "' + cell + '"');
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
    /* typed values: units, fractions, thousands separators and the π forms the app prints in Approx mode */
    const near = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(y));
    const cases = [['side', '3 1/2 in', 3.5], ['side', '1/2', 0.5], ['side', '5\'6"', 66], ['side', '1,500', 1500], ['side', '1,5', 1.5], ['side', '1,500.5', 1500.5], ['side', '1.500,5', 1500.5], ['side', '2 cm', 2 / 2.54],
      ['side', '25.4 mm', 1], ['side', '1 ft', 12], ['angle', 'π/2', Math.PI / 2], ['angle', '0.5 pi', Math.PI / 2], ['angle', '3π/4 rad', 3 * Math.PI / 4], ['angle', '100 gon', Math.PI / 2], ['angle', '45', Math.PI / 4]];
    for (const [k, txt, want] of cases) { const r = parseMeasure(txt, k, k === 'side' ? 'in' : 'deg'); if (!r || !near(r.value, want)) fails.push('parseMeasure(' + JSON.stringify(txt) + ') = ' + (r && r.value) + ', want ' + want); }
    for (const [k, txt] of [['side', '3 apples'], ['side', '1/0'], ['side', 'abc'], ['angle', 'π/0'], ['side', '--3']]) if (parseMeasure(txt, k, 'in')) fails.push('parseMeasure(' + JSON.stringify(txt) + ') should be refused');
    /* the changelog: one entry per day, each a single short sentence, newest first, top entry = the version shown */
    const cl = window.__TRIANGLE.changelog, days = cl.map(e => e.date);
    if (new Set(days).size !== days.length) fails.push('changelog has more than one entry on a day');
    if (cl[0].v !== window.__TRIANGLE.version) fails.push('changelog top entry ' + cl[0].v + ' is not the version ' + window.__TRIANGLE.version);
    if (days.some((d, i) => i && d >= days[i - 1])) fails.push('changelog is not newest first');
    for (const e of cl) { if (e.items.length !== 1) fails.push('changelog ' + e.v + ' has ' + e.items.length + ' sentences'); else if (e.items[0].split(/[.!?]\s/).length !== 1 || e.items[0].length > 120) fails.push('changelog ' + e.v + ' is not one short sentence'); }
    /* the working is abbreviated to at most four decimals, every calculation used the exact values, and the final answer carries the note */
    S.P = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1.3, y: 2.9 }];
    const NOTE_TXT = 'Please note that the values used in equations are abbreviated, but, the exact value of it was used in the calculation';
    for (const prec of [0, 2, 4, 8]) {
      S.prec = prec; renderNow();
      const ids = ['R', 'r', 'A', 'C', 'area', 'per', 'semi', 'h0', 'm0', 't0', 'inc', 'cir', 'ort', 'slope0', 'line0', 'exr0', 'tl0', 'nine', 'oh', 'class', 'arcC0', 'arcI0', 'seg0', 'ext0'];
      const open = [...ids.map(id => () => openExplain(id)), ...fns.map(fn => () => openTrigExplain(fn))];
      open.forEach((go, k) => {
        go(); const b = document.getElementById('mBody'), name = k < ids.length ? ids[k] : fns[k - ids.length];
        const work = [...b.querySelectorAll('.eqn-line:not(.eqn-final):not(.eqn-note)')].map(e => e.textContent).join(' ');
        if (/\d+\.\d{5,}/.test(work)) fails.push('the working of ' + name + ' shows more than four decimals at ' + prec + ' decimals: ' + (work.match(/\d+\.\d{5,}/) || [''])[0]);
        const notes = [...b.querySelectorAll('.eqn-note')].filter(e => e.textContent.trim() === NOTE_TXT);
        if (notes.length !== 1) fails.push(name + ': the abbreviation note appears ' + notes.length + ' times, not once');
        else { const fin = b.querySelector('.eqn-final'), nt = notes[0]; if (fin && !(fin.compareDocumentPosition(nt) & Node.DOCUMENT_POSITION_FOLLOWING)) fails.push(name + ': the note is not after the final answer'); }
        if (/[\uE000-\uE002]/.test(b.textContent)) fails.push(name + ': an unsettled number token leaked into the explanation');
      });
      closeModal();
    }
    S.prec = 8; renderNow(); openExplain('R'); const fin8 = document.querySelector('#mBody .eqn-final').textContent;
    if (!/R = \d+\.\d{8} in/.test(fin8)) fails.push('the final answer of R is not rounded to the 8 decimals set: ' + fin8);
    if (Math.abs(parseFloat(fin8.match(/= ([\d.]+)/)[1]) - derive().R) > 5e-9) fails.push('the final answer of R is not the exact value: ' + fin8);
    S.prec = 4; renderNow(); openTrigExplain('cot'); const cb = document.getElementById('mBody');
    if (!cb.querySelector('.var-sin') || !cb.querySelector('.var-cos')) fails.push('the sin and cos sub-final answers have no colour of their own in the cot working');
    closeModal();
    /* one theme: the light theme is gone */
    if (document.getElementById('btnTheme')) fails.push('the theme button is still there');
    if (document.documentElement.hasAttribute('data-theme')) fails.push('the page still sets a theme');
    if ([...document.styleSheets].some(sh => { try { return [...sh.cssRules].some(r => /data-theme|prefers-color-scheme:\s*light/.test(r.cssText)); } catch (e) { return false; } })) fails.push('a stylesheet still has theme rules');
    /* decisions are never made on rounded values either: a corner that reads 90° at 0 decimals is not a right angle, equal-looking sides are not equal */
    S.prec = 0; const t = Math.PI / 180 * 89.6; S.P = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 4 * Math.cos(t), y: 4 * Math.sin(t) }]; renderNow();
    if (derive().kind === 'Right') fails.push('89.6° was classified Right at 0 decimals');
    S.P = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 1.5, y: Math.sqrt(3.0004 * 3.0004 - 2.25) }]; renderNow(); if (derive().shape !== 'Scalene' && derive().shape !== 'Isosceles') fails.push('shape'); 
    S.P = [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 4 }]; for (const pr of [0, 4, 8]) { S.prec = pr; renderNow(); if (derive().kind !== 'Right') fails.push('the 3-4-5 triangle is not Right at ' + pr + ' decimals'); }
    S.prec = 4;
    return { fails, audits, cells, panels };
  });
  console.log('audit checks ' + r.audits + ', trig cells ' + r.cells + ', explanation panels ' + r.panels + ', page errors ' + errors.length);
  r.fails.slice(0, 20).forEach(f => console.log('FAIL ' + f));
  await browser.close();
  process.exit(r.fails.length || errors.length ? 1 : 0);
})();

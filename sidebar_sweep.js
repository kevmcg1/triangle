/* Sidebar sweep: node sidebar_sweep.js [playwright-path]
 *
 * Twelve different triangles (right, equilateral, 30-60-90, 45-45-90, obtuse, acute, isosceles, a thin sliver, a huge one, a tiny one, a turned and
 * mirrored one, one far from the origin), in different length units (in, cm, mm, ft), angle units (deg, rad, grad) and Decimals settings (2 to 8).
 * For each, every number in the left sidebar (the 61 measurement rows and the 18 trig cells) is read off the page, and compared with the value
 * worked out HERE, from the corner coordinates alone, with formulas written separately from the app's (nothing is imported from the app):
 * a printed value must equal the true value rounded to the Decimals setting. Exits non-zero on any disagreement.
 */
const path = require('path');
const { chromium } = require(process.argv[2] || 'playwright');

/* ---------------- the independent mathematics (inches, radians) ---------------- */
function work(P) {
  const [A, B, C] = P, d = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const a = d(B, C), b = d(C, A), c = d(A, B), cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x), dot = (p, q, r) => (q.x - p.x) * (r.x - p.x) + (q.y - p.y) * (r.y - p.y);
  const ang = [0, 1, 2].map(i => Math.atan2(Math.abs(cross(P[i], P[(i + 1) % 3], P[(i + 2) % 3])), dot(P[i], P[(i + 1) % 3], P[(i + 2) % 3])));
  const sides = [a, b, c], K = Math.abs(cross(A, B, C)) / 2, per = a + b + c, s = per / 2, R = a * b * c / (4 * K), r = K / s;
  const D2 = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
  const O = { x: ((A.x ** 2 + A.y ** 2) * (B.y - C.y) + (B.x ** 2 + B.y ** 2) * (C.y - A.y) + (C.x ** 2 + C.y ** 2) * (A.y - B.y)) / D2, y: ((A.x ** 2 + A.y ** 2) * (C.x - B.x) + (B.x ** 2 + B.y ** 2) * (A.x - C.x) + (C.x ** 2 + C.y ** 2) * (B.x - A.x)) / D2 };
  const G = { x: (A.x + B.x + C.x) / 3, y: (A.y + B.y + C.y) / 3 }, I = { x: (a * A.x + b * B.x + c * C.x) / per, y: (a * A.y + b * B.y + c * C.y) / per }, H = { x: A.x + B.x + C.x - 2 * O.x, y: A.y + B.y + C.y - 2 * O.y };
  const mid = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const cs = ang.map(Math.cos), sn = ang.map(Math.sin);
  return { P, a, b, c, sides, ang, K, per, s, R, r, O, G, I, H, cs, sn,
    ext: ang.map(x => Math.PI - x), alt: sides.map(x => 2 * K / x),
    med: [0, 1, 2].map(i => 0.5 * Math.sqrt(2 * sides[(i + 1) % 3] ** 2 + 2 * sides[(i + 2) % 3] ** 2 - sides[i] ** 2)),
    bis: [0, 1, 2].map(i => { const p = sides[(i + 1) % 3], q = sides[(i + 2) % 3], o = sides[i]; return Math.sqrt(p * q * ((p + q) ** 2 - o * o)) / (p + q); }),
    tl: sides.map(x => s - x), exr: sides.map(x => K / (s - x)), nine: R / 2, OH: d(O, H),
    arcC: ang.map(x => 2 * x * R), arcI: ang.map(x => r * (Math.PI - x)),
    mids: [mid(B, C), mid(C, A), mid(A, B)], seg: sides.map(x => x / 2),
    slope: [[B, C], [C, A], [A, B]].map(([p, q]) => (Math.abs(q.x - p.x) < 1e-12 * Math.max(a, b, c) ? null : (q.y - p.y) / (q.x - p.x))),
    line: [[B, C], [C, A], [A, B]].map(([p, q]) => { if (Math.abs(q.x - p.x) < 1e-12 * Math.max(a, b, c)) return null; const m = (q.y - p.y) / (q.x - p.x); return { m, b: p.y - m * p.x }; }) };
}

/* ---------------- the variations ---------------- */
const rot = (P, th, mirror) => P.map(p => { const y = mirror ? -p.y : p.y; return { x: p.x * Math.cos(th) - y * Math.sin(th), y: p.x * Math.sin(th) + y * Math.cos(th) }; });
const pts = a => a.map(([x, y]) => ({ x, y }));
const VARIATIONS = [
  ['3-4-5 right triangle', pts([[0, 0], [3, 0], [0, 4]]), 'in', 'deg', 4],
  ['equilateral, side 2', pts([[0, 0], [2, 0], [1, Math.sqrt(3)]]), 'in', 'deg', 4],
  ['30-60-90 in centimetres', pts([[0, 0], [Math.sqrt(3), 0], [0, 1]]), 'cm', 'deg', 4],
  ['45-45-90 in millimetres', pts([[0, 0], [2, 0], [0, 2]]), 'mm', 'deg', 3],
  ['obtuse, angles in radians', pts([[0, 0], [6, 0], [1, 1]]), 'in', 'rad', 4],
  ['acute scalene in feet', pts([[0, 0], [5, 0], [2, 3]]), 'ft', 'deg', 6],
  ['tall isosceles, 2 decimals', pts([[0, 0], [4, 0], [2, 5]]), 'in', 'deg', 2],
  ['thin sliver, 8 decimals', pts([[0, 0], [10, 0], [5, 0.05]]), 'in', 'deg', 8],
  ['large triangle, gradians', pts([[0, 0], [1200, 0], [400, 900]]), 'in', 'grad', 4],
  ['small triangle in millimetres', pts([[0, 0], [0.12, 0], [0.04, 0.07]]), 'mm', 'deg', 4],
  ['obtuse, turned 37° and mirrored', rot(pts([[0, 0], [6, 0], [1, 1]]), 37 * Math.PI / 180, true), 'in', 'deg', 5],
  ['far from the origin, in cm', pts([[1000, 1000], [1003.5, 1000], [1001, 1004.2]]), 'cm', 'deg', 4]
];
const INCH = { in: 1, cm: 1 / 2.54, mm: 1 / 25.4, ft: 12 };

(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(String(e)));
  await page.goto('file://' + path.join(__dirname, 'index.html')); await page.waitForTimeout(1500);
  if (process.env.SWEEP_MUTATE) await page.evaluate(() => { const d0 = derive; derive = function () { const D = d0(); D.R *= 1.0004; D.exr = D.exr.map(x => x * 1.001); return D; }; });   /* self-test: a deliberately wrong app must be caught */
  let failed = 0, grand = 0;
  for (const [name, P, lu, au, prec] of VARIATIONS) {
    const rows = await page.evaluate(([P, lu, au, prec]) => {
      S.lenUnit = lu; S.units.side = [lu, lu, lu]; S.angUnit = au; S.units.angle = [au, au, au]; S.prec = prec; S.exact = true; S.P = P.map(q => ({ x: q.x, y: q.y })); renderNow();
      const r = [...document.querySelectorAll('#stats .row')].map(e => [(e.querySelector('.k') || {}).textContent || '', (e.querySelector('.v') || {}).textContent || '']);
      const t = [...document.querySelectorAll('#stats .trow')].map(e => [e.querySelector('.fn').textContent, [...e.querySelectorAll('.c')].map(c => c.textContent)]);
      return { rows: r, trig: t };
    }, [P, lu, au, prec]);
    const W = work(P), f = INCH[lu], AF = { deg: 180 / Math.PI, rad: 1, grad: 200 / Math.PI }[au], tol = Math.pow(10, -prec) * 0.5000001;
    const fails = []; let n = 0;
    const num = t => { const m = /-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/i.exec(String(t).replace(/−/g, '-')); return m ? parseFloat(m[0]) : NaN; };
    const chk = (label, got, want, scale) => { n++; const ok = Number.isFinite(got) && Number.isFinite(want) && Math.abs(got - want) <= tol + 1e-9 * Math.max(1, Math.abs(want)); if (!ok) fails.push(label + ': page shows ' + got + ', the true value is ' + want); };
    const text = new Map(rows.rows.map(([k, v]) => [k.replace(/\s+/g, ' ').trim(), v]));
    const L = x => x / f, A2 = x => x / (f * f), ANG = x => x * AF;
    const pair = (label, p) => { const v = text.get(label); const m = /\(\s*(-?[\d.e+-]+),\s*(-?[\d.e+-]+)\)/i.exec((v || '').replace(/−/g, '-')); n += 2; if (!m) { fails.push(label + ': no coordinates in "' + v + '"'); return; } chk(label + ' x', +m[1], L(p.x)); chk(label + ' y', +m[2], L(p.y)); n -= 2; };
    const val = (label, want, conv) => { const v = text.get(label); if (v === undefined) { fails.push('missing row ' + label); return; } chk(label, num(v), conv(want)); };
    ['a (BC)', 'b (CA)', 'c (AB)'].forEach((k, i) => val('Side ' + k, W.sides[i], L));
    ['A', 'B', 'C'].forEach((k, i) => { val('Angle ' + k, W.ang[i], ANG); val('Exterior angle at ' + k, W.ext[i], ANG); });
    val('Sum', Math.PI, ANG); val('Area', W.K, A2); val('Perimeter', W.per, L); val('Semiperimeter', W.s, L);
    val('Circumradius R', W.R, L); val('Circumdiameter', 2 * W.R, L); val('Inradius r', W.r, L); val('Incircle diameter', 2 * W.r, L); val('R / r', W.R / W.r, x => x);
    val('Incircle area', Math.PI * W.r ** 2, A2); val('Circumcircle area', Math.PI * W.R ** 2, A2);
    ['BC (opp. A)', 'CA (opp. B)', 'AB (opp. C)'].forEach((k, i) => val('Circumarc ' + k, W.arcC[i], L));
    ['A', 'B', 'C'].forEach((k, i) => val('Incircle arc at ' + k, W.arcI[i], L));
    ['hₐ', 'hᵇ', 'hᶜ'].forEach((k, i) => val('Altitude ' + k, W.alt[i], L));
    ['mₐ', 'mᵇ', 'mᶜ'].forEach((k, i) => val('Median ' + k, W.med[i], L));
    ['tₐ', 'tᵇ', 'tᶜ'].forEach((k, i) => val('Bisector ' + k, W.bis[i], L));
    ['A', 'B', 'C'].forEach((k, i) => pair(k, P[i]));
    pair('Centroid', W.G); pair('Incenter', W.I); pair('Circumcenter', W.O); pair('Orthocenter', W.H);
    ['A (s − a)', 'B (s − b)', 'C (s − c)'].forEach((k, i) => val('Tangent length from ' + k, W.tl[i], L));
    ['ra (opposite A)', 'rb (opposite B)', 'rc (opposite C)'].forEach((k, i) => val('Exradius ' + k, W.exr[i], L));
    val('Nine-point circle radius (R/2)', W.nine, L); val('Orthocenter ↔ circumcenter (OH)', W.OH, L);
    ['a (BC)', 'b (CA)', 'c (AB)'].forEach((k, i) => { pair('Midpoint of ' + k, W.mids[i]); });
    ['a (= a/2)', 'b (= b/2)', 'c (= c/2)'].forEach((k, i) => val('Midsegment ∥ ' + k, W.seg[i], L));
    ['a (BC)', 'b (CA)', 'c (AB)'].forEach((k, i) => { if (W.slope[i] === null) { n++; if (!/vertical/.test(text.get('Slope of ' + k) || '')) fails.push('Slope of ' + k + ' should be vertical'); } else val('Slope of ' + k, W.slope[i], x => x); });
    ['BC', 'CA', 'AB'].forEach((k, i) => { const v = text.get('Line ' + k) || ''; const ln = W.line[i]; if (!ln) { n++; if (!/x =/.test(v)) fails.push('Line ' + k + ' should be x = …'); return; } const m = /y = (-?[\d.e+-]+)x ([+-]) ([\d.e+-]+)/i.exec(v.replace(/−/g, '-')); n += 2; if (!m) { fails.push('Line ' + k + ': cannot read "' + v + '"'); return; } chk('Line ' + k + ' slope', +m[1], ln.m); chk('Line ' + k + ' intercept', (m[2] === '-' ? -1 : 1) * +m[3], L(ln.b)); n -= 2; });
    /* classification */
    const maxA = Math.max(...W.ang), near = (x, y) => Math.abs(x - y) <= 1e-9 * Math.max(x, y), kind = Math.abs(maxA * 180 / Math.PI - 90) < 1e-9 ? 'Right' : maxA > Math.PI / 2 ? 'Obtuse' : 'Acute';
    const eq = [near(W.a, W.b), near(W.b, W.c), near(W.c, W.a)], shape = eq[0] && eq[1] ? 'Equilateral' : eq.some(Boolean) ? 'Isosceles' : 'Scalene'; n++;
    if ((text.get('Classification') || '') !== kind + ' · ' + shape) fails.push('Classification: page says "' + text.get('Classification') + '", the truth is "' + kind + ' · ' + shape + '"');
    /* the trigonometry table */
    const rightAt = i => Math.abs(W.ang[i] * 180 / Math.PI - 90) < 1e-9, trigWant = (fn, i) => { const s = rightAt(i) ? 1 : W.sn[i], c = rightAt(i) ? 0 : W.cs[i]; return { sin: s, cos: c, tan: s / c, csc: 1 / s, sec: 1 / c, cot: c / s }[fn]; };
    for (const [fn, cells] of rows.trig) cells.forEach((txt, i) => { const want = trigWant(fn, i); n++; if (!Number.isFinite(want) || Math.abs(want) > 1e12) { if (!/undefined|e/.test(txt)) fails.push('trig ' + fn + ' ' + 'ABC'[i] + ' should be undefined, page shows ' + txt); } else if (!/e/.test(txt)) { const got = num(txt); if (!(Math.abs(got - want) <= tol + 1e-9 * Math.max(1, Math.abs(want)))) fails.push('trig ' + fn + ' ' + 'ABC'[i] + ': page shows ' + txt + ', the true value is ' + want); } });
    n--; /* (the classification and trig loops each counted themselves) */
    grand += n;
    if (rows.rows.length < 61 || rows.trig.length !== 6) fails.push('only ' + rows.rows.length + ' rows and ' + rows.trig.length + ' trig rows were found');
    console.log((fails.length ? 'FAIL ' : 'ok   ') + name + '  [' + lu + ', ' + au + ', ' + prec + ' decimals]  ' + n + ' values checked' + fails.slice(0, 5).map(x => '\n       ' + x).join(''));
    if (fails.length) failed++;
  }
  console.log('\n' + VARIATIONS.length + ' variations, ' + grand + ' values checked against independent maths, ' + failed + ' variation(s) with a disagreement' + (errors.length ? ', page errors: ' + errors[0] : ''));
  await browser.close(); process.exit(failed || errors.length ? 1 : 0);
})();

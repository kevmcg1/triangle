/* Dev mode: the mathematician's review.
 *
 * calc_audit.js re-derives every sidebar number a second way. This file reads the same numbers the way a mathematician would, asking
 * whether they are the kind of numbers a triangle can have at all:
 *
 *   domain       every value finite and in its range (angles in (0, π), the triangle inequality is strict, R ≥ 2r, ...)
 *   identities   classical relations nobody re-derives from the corners: area = rs = abc/4R = 2R² sin A sin B sin C, r = 4R·∏sin(A/2),
 *                cos A + cos B + cos C = 1 + r/R, Σmedians² = ¾Σsides², Feuerbach (the nine-point circle touches the incircle),
 *                |OI|² = R² − 2Rr, AH = 2R|cos A|, the nine points really lie on one circle, every foot really is where it says
 *   invariance   an isometry changes no length, angle or area; a scaling by k multiplies lengths by k and areas by k²; relabelling the
 *                corners only permutes the answers. Every number is recomputed on a moved, turned, mirrored, scaled and relabelled copy
 *   units        the length and angle unit factors are the exact definitions, and a printed fraction or multiple of π really is the value
 *   working      the worked solution in an open explanation panel: each "= number" step is checked against the step before it, allowing
 *                for exactly the rounding the digits on screen carry (so a wrong step is caught, a rounded one is not)
 *
 * review(D) -> { total, failed: [{ group, label, expected, actual, err }], skipped }   (nothing here changes the app's state)
 */
(function () {
  'use strict';
  const PI = Math.PI;
  const withPoints = (P, fn) => { const keep = S.P; S.P = P; try { return fn(); } finally { S.P = keep; } };
  const derivedAt = P => withPoints(P, () => derive());

  function review(D) {
    const checks = [];
    const R_ = { total: 0, failed: [], skipped: 0, degenerate: false };
    const finite = v => typeof v === 'number' && Number.isFinite(v);
    const add = (group, label, expected, actual, o) => {
      o = o || {};
      let err;
      if (!finite(expected) || !finite(actual)) err = expected === actual ? 0 : Infinity;
      else err = Math.abs(expected - actual) / (o.abs !== undefined ? o.abs : Math.max(Math.abs(expected), Math.abs(actual), 1e-300));
      const tol = o.tol === undefined ? 1e-9 : o.tol;
      R_.total++;
      if (!(err <= tol)) R_.failed.push({ group, label, expected, actual, err, tol });
    };
    const truth = (group, label, cond, note) => { R_.total++; if (!cond) R_.failed.push({ group, label, expected: true, actual: false, err: Infinity, tol: 0, note }); };

    /* ---- domain: always ---- */
    const num = ['a', 'b', 'c', 'A', 'B', 'C', 'area', 'per', 's', 'R', 'r'];
    for (const k of num) truth('domain', k + ' is a finite number', finite(D[k]), D[k]);
    if (!num.every(k => finite(D[k]))) { R_.degenerate = true; return R_; }
    const { a, b, c, A, B, C, area: K, R, r, s } = D;
    const sc = Math.max(a, b, c), mn = Math.min(a, b, c);
    const mag = Math.max(...D.P.map(q => Math.max(Math.abs(q.x), Math.abs(q.y))));
    const cond = Math.min(1e15, Math.max(1, sc * sc / Math.max(K, 1e-300)) * (1 + mag / sc));
    if (!(K > 1e-9 * sc * sc) || !(mn > 1e-9 * sc) || cond > 1e8 || mag > 1e6 * sc) { R_.degenerate = true; return R_; }   /* too thin or too far out for a float to carry these identities */
    const TOL = Math.min(1e-2, 1e-10 * cond), T2 = Math.min(1e-2, 1e-9 * cond);

    truth('domain', 'every side is positive', a > 0 && b > 0 && c > 0);
    truth('domain', 'every angle is strictly between 0 and π', [A, B, C].every(x => x > 0 && x < PI));
    truth('domain', 'a, b, c are the three entries of sides', D.sides[0] === a && D.sides[1] === b && D.sides[2] === c);
    truth('domain', 'the triangle inequality is strict', a < b + c && b < a + c && c < a + b);
    truth('domain', 'the area is positive', K > 0);
    truth('domain', 'Euler’s inequality: R ≥ 2r', R >= 2 * r * (1 - 1e-9));
    truth('domain', 'every exradius exceeds the inradius', D.exr.every(x => x > r * (1 - 1e-9)));
    truth('domain', 'the circumradius is at least half the longest side', R >= sc / 2 * (1 - 1e-9));
    truth('domain', 'the inradius is less than half the shortest altitude', r < Math.min(...D.alt) / 2 * (1 + 1e-9));
    truth('domain', 'tangent lengths s − a, s − b, s − c are positive', D.tl.every(x => x > 0));
    const acute = Math.max(A, B, C) < PI / 2 - 1e-9, obtuse = Math.max(A, B, C) > PI / 2 + 1e-9;
    const inside = pt => { const [p, q, w] = D.P, sg = (u, v, x) => (u.x - x.x) * (v.y - x.y) - (v.x - x.x) * (u.y - x.y), d1 = sg(pt, p, q), d2 = sg(pt, q, w), d3 = sg(pt, w, p); return !((d1 < -1e-9 * sc * sc || d2 < -1e-9 * sc * sc || d3 < -1e-9 * sc * sc) && (d1 > 1e-9 * sc * sc || d2 > 1e-9 * sc * sc || d3 > 1e-9 * sc * sc)); };
    truth('domain', 'the incenter is inside the triangle', inside(D.incenter));
    truth('domain', 'the centroid is inside the triangle', inside(D.centroid));
    if (acute) { truth('domain', 'acute: the circumcenter is inside', inside(D.circum)); truth('domain', 'acute: the orthocenter is inside', inside(D.ortho)); }
    if (obtuse) { truth('domain', 'obtuse: the circumcenter is outside', !inside(D.circum)); truth('domain', 'obtuse: the orthocenter is outside', !inside(D.ortho)); }

    /* ---- identities ---- */
    const sin = Math.sin, cos = Math.cos, hyp = Math.hypot;
    const dist = (p, q) => hyp(p.x - q.x, p.y - q.y);
    const ang = [A, B, C], sides = [a, b, c];
    add('identities', 'area = r · s', K, r * s, { tol: TOL });
    add('identities', 'area = abc ÷ 4R', K, a * b * c / (4 * R), { tol: TOL });
    add('identities', 'area = ½ · a · b · sin C', K, 0.5 * a * b * sin(C), { tol: TOL });
    add('identities', 'area = 2R² · sin A sin B sin C', K, 2 * R * R * sin(A) * sin(B) * sin(C), { tol: TOL });
    add('identities', 'r = 4R · sin(A/2) sin(B/2) sin(C/2)', r, 4 * R * sin(A / 2) * sin(B / 2) * sin(C / 2), { tol: TOL });
    add('identities', 'cos A + cos B + cos C = 1 + r/R', cos(A) + cos(B) + cos(C), 1 + r / R, { abs: 1, tol: TOL });
    add('identities', 'sin A + sin B + sin C = s/R', sin(A) + sin(B) + sin(C), s / R, { tol: TOL });
    add('identities', 'a = b · cos C + c · cos B (projection formula)', a, b * cos(C) + c * cos(B), { tol: TOL });
    add('identities', 'a = 2R · sin A', a, 2 * R * sin(A), { tol: TOL });
    add('identities', 'm_a² + m_b² + m_c² = ¾(a² + b² + c²)', D.med[0] ** 2 + D.med[1] ** 2 + D.med[2] ** 2, 0.75 * (a * a + b * b + c * c), { tol: TOL });
    add('identities', 'h_a · h_b · h_c = 2·area² ÷ R', D.alt[0] * D.alt[1] * D.alt[2], 2 * K * K / R, { tol: TOL });
    add('identities', 'r_a + r_b + r_c = 4R + r', D.exr[0] + D.exr[1] + D.exr[2], 4 * R + r, { tol: TOL });
    add('identities', '1/r_a + 1/r_b + 1/r_c = 1/r', 1 / D.exr[0] + 1 / D.exr[1] + 1 / D.exr[2], 1 / r, { tol: TOL });
    add('identities', 'r · r_a · r_b · r_c = area²', r * D.exr[0] * D.exr[1] * D.exr[2], K * K, { tol: TOL });
    add('identities', 'the tangent lengths add up to s', D.tl[0] + D.tl[1] + D.tl[2], s, { tol: TOL });
    if (!ang.some(x => Math.abs(cos(x)) < 1e-6)) add('identities', 'tan A + tan B + tan C = tan A · tan B · tan C', Math.tan(A) + Math.tan(B) + Math.tan(C), Math.tan(A) * Math.tan(B) * Math.tan(C), { abs: Math.max(1, Math.abs(Math.tan(A) * Math.tan(B) * Math.tan(C))), tol: T2 });
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3, k = (i + 2) % 3, bs = sides[j], cs = sides[k], as = sides[i];
      add('identities', 'bisector from ' + 'ABC'[i] + ': 2bc·cos(A/2) ÷ (b + c)', D.bis[i], 2 * bs * cs * cos(ang[i] / 2) / (bs + cs), { tol: TOL });
      add('identities', 'bisector from ' + 'ABC'[i] + ': √(bc((b + c)² − a²)) ÷ (b + c)', D.bis[i], Math.sqrt(Math.max(0, bs * cs * ((bs + cs) ** 2 - as * as))) / (bs + cs), { tol: TOL });
      add('identities', 'AH = 2R·|cos A| at ' + 'ABC'[i], dist(D.P[i], D.ortho), 2 * R * Math.abs(cos(ang[i])), { abs: 2 * R, tol: TOL });
      /* the feet really are where they claim to be */
      const F = D.altFoot[i], u = D.P[j], w = D.P[k], side = hyp(w.x - u.x, w.y - u.y);
      add('feet', 'altitude foot from ' + 'ABC'[i] + ' lies on its side', ((F.x - u.x) * (w.y - u.y) - (F.y - u.y) * (w.x - u.x)) / side, 0, { abs: sc, tol: TOL });
      add('feet', 'altitude from ' + 'ABC'[i] + ' is perpendicular to its side', ((D.P[i].x - F.x) * (w.x - u.x) + (D.P[i].y - F.y) * (w.y - u.y)) / side, 0, { abs: sc, tol: TOL });
      add('feet', 'altitude length from ' + 'ABC'[i] + ' is the distance to its foot', D.alt[i], dist(D.P[i], F), { tol: TOL });
      add('feet', 'median length from ' + 'ABC'[i] + ' is the distance to the midpoint', D.med[i], dist(D.P[i], D.medFoot[i]), { tol: TOL });
      const BF = D.bisFoot[i];
      add('feet', 'bisector length from ' + 'ABC'[i] + ' is the distance to its foot', D.bis[i], dist(D.P[i], BF), { tol: TOL });
      add('feet', 'angle bisector theorem at ' + 'ABC'[i] + ' (the foot splits the side as c : b)', dist(u, BF) * bs, dist(BF, w) * cs, { tol: TOL });
      add('feet', 'bisector foot from ' + 'ABC'[i] + ' lies on its side', ((BF.x - u.x) * (w.y - u.y) - (BF.y - u.y) * (w.x - u.x)) / side, 0, { abs: sc, tol: TOL });
      const Tp = D.touch[i];   /* touch[i] is on side i (opposite corner i) */
      add('feet', 'incircle touch point on side ' + 'abc'[i] + ' is r from the incenter', dist(Tp, D.incenter), r, { tol: TOL });
      add('feet', 'incircle touch point on side ' + 'abc'[i] + ' is s − b from corner ' + 'ABC'[j], dist(Tp, D.P[j]), D.tl[j], { abs: sc, tol: TOL });
      add('feet', 'incircle touch point on side ' + 'abc'[i] + ' is s − c from corner ' + 'ABC'[k], dist(Tp, D.P[k]), D.tl[k], { abs: sc, tol: TOL });
      add('feet', 'the radius to the touch point on side ' + 'abc'[i] + ' is perpendicular to it', ((Tp.x - D.incenter.x) * (w.x - u.x) + (Tp.y - D.incenter.y) * (w.y - u.y)) / side, 0, { abs: r, tol: TOL });
    }
    add('identities', 'Euler: |OI|² = R² − 2Rr', dist(D.circum, D.incenter) ** 2, R * R - 2 * R * r, { abs: R * R, tol: TOL });
    const N = { x: (D.circum.x + D.ortho.x) / 2, y: (D.circum.y + D.ortho.y) / 2 };
    add('identities', 'Feuerbach: |NI| = R/2 − r (the nine-point circle touches the incircle)', dist(N, D.incenter), R / 2 - r, { abs: R, tol: TOL });
    add('identities', 'the nine-point radius is R/2', D.nine, R / 2, { tol: TOL });
    for (let i = 0; i < 3; i++) {
      add('nine points', 'midpoint of side ' + 'abc'[i] + ' is on the nine-point circle', dist(N, D.sideMid[i]), R / 2, { abs: R, tol: TOL });
      add('nine points', 'altitude foot from ' + 'ABC'[i] + ' is on the nine-point circle', dist(N, D.altFoot[i]), R / 2, { abs: R, tol: TOL });
      add('nine points', 'midpoint of ' + 'ABC'[i] + 'H is on the nine-point circle', dist(N, { x: (D.P[i].x + D.ortho.x) / 2, y: (D.P[i].y + D.ortho.y) / 2 }), R / 2, { abs: R, tol: TOL });
    }
    add('identities', 'Euler line: OH² = 9R² − (a² + b² + c²)', D.oh * D.oh, Math.max(0, 9 * R * R - (a * a + b * b + c * c)), { abs: 9 * R * R + a * a + b * b + c * c, tol: T2 });

    /* ---- invariance: move, turn, mirror, scale and relabel the corners, and recompute everything ---- */
    const similarity = (th, k, tx, ty, mirror) => p => { const x = p.x, y = mirror ? -p.y : p.y, ct = Math.cos(th), st = Math.sin(th); return { x: k * (ct * x - st * y) + tx, y: k * (st * x + ct * y) + ty }; };
    const scalar = ['per', 's', 'R', 'r', 'nine', 'oh'], keep = ['A', 'B', 'C'], vec = ['sides', 'alt', 'med', 'bis', 'tl', 'exr', 'seg', 'arcCirc', 'arcIn'], pts1 = ['circum', 'centroid', 'incenter', 'ortho'], ptsN = ['sideMid', 'altFoot', 'medFoot', 'bisFoot', 'touch'], angVec = ['ang', 'ext'];
    const posAbs = k => Math.max(1, k) * sc + 1e-9 * mag;
    const compare = (tag, E, k, map, perm) => {
      const P = perm || [0, 1, 2], pi = i => P[i];
      for (const key of scalar) add('invariance', tag + ': ' + key + (k === 1 ? ' unchanged' : ' scales by k'), E[key], D[key] * k, { abs: key === 'oh' ? Math.max(D.R * k, 1e-300) : Math.max(Math.abs(E[key]), 1e-300), tol: T2 });
      add('invariance', tag + ': area ' + (k === 1 ? 'unchanged' : 'scales by k²'), E.area, D.area * k * k, { tol: T2 });
      for (const key of keep) { const idx = 'ABC'.indexOf(key); add('invariance', tag + ': angle ' + key + ' unchanged', E[key], D['ABC'[pi(idx)]], { abs: 1, tol: T2 }); }
      for (const key of vec) for (let i = 0; i < 3; i++) add('invariance', tag + ': ' + key + '[' + i + ']', E[key][i], D[key][pi(i)] * k, { abs: Math.max(Math.abs(E[key][i]), 1e-300), tol: T2 });
      for (const key of angVec) for (let i = 0; i < 3; i++) add('invariance', tag + ': ' + key + '[' + i + '] unchanged', E[key][i], D[key][pi(i)], { abs: 1, tol: T2 });
      for (const key of pts1) { const m = map(D[key]); add('invariance', tag + ': ' + key + ' x follows the corners', E[key].x, m.x, { abs: posAbs(k), tol: T2 }); add('invariance', tag + ': ' + key + ' y follows the corners', E[key].y, m.y, { abs: posAbs(k), tol: T2 }); }
      for (const key of ptsN) for (let i = 0; i < 3; i++) { const m = map(D[key][pi(i)]); add('invariance', tag + ': ' + key + '[' + i + '] follows the corners', hyp(E[key][i].x - m.x, E[key][i].y - m.y), 0, { abs: posAbs(k), tol: T2 }); }
      /* the trig table: sin and cos at each corner are properties of the angle alone */
      const t0 = trigData(D), t1 = trigData(E);
      for (let i = 0; i < 3; i++) if (t0[pi(i)].mode === 'general' && t1[i].mode === 'general') for (const fn of ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']) {
        const x = trigRatio(t1[i], fn), y = trigRatio(t0[pi(i)], fn);
        if (finite(x) && finite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6) add('invariance', tag + ': ' + fn + ' of corner ' + 'ABC'[i], x, y, { abs: Math.max(1, Math.abs(y)), tol: T2 });
      }
    };
    const run = (tag, th, k, tx, ty, mirror, perm) => {
      const f = similarity(th, k, tx, ty, mirror);
      let Pt = D.P.map(f); if (perm) Pt = perm.map(i => Pt[i]);
      let E; try { E = derivedAt(Pt); } catch (e) { truth('invariance', tag + ': the corners could be recomputed', false, String(e)); return; }
      compare(tag, E, k, f, perm);
    };
    run('moved and turned', 0.7, 1, 3.1, -2.2, false);
    run('mirrored', -2.1, 1, -5, 4, true);
    run('scaled ×1.7', 0.3, 1.7, 1.5, 0.5, false);
    run('shrunk ×0.37 and mirrored', -1.1, 0.37, -2, 7, true);
    run('corners relabelled B C A', 0, 1, 0, 0, false, [1, 2, 0]);
    run('corners relabelled A C B', 0.9, 2.5, 1, 1, false, [0, 2, 1]);
    return R_;
  }

  /* ---- the units ---- */
  function reviewUnits() {
    const R_ = { total: 0, failed: [] };
    const add = (group, label, expected, actual, tol) => { R_.total++; const err = Math.abs(expected - actual) / Math.max(Math.abs(expected), 1e-300); if (!(err <= (tol === undefined ? 1e-12 : tol))) R_.failed.push({ group, label, expected, actual, err }); };
    /* inches per unit, from the definitions (1 in = 25.4 mm exactly) */
    const inch = { in: 1, ft: 12, yd: 36, mi: 63360, mm: 1 / 25.4, cm: 1 / 2.54, m: 1 / 0.0254, km: 1 / 0.0000254 };
    for (const k of Object.keys(LEN)) if (inch[k] !== undefined) add('units', '1 ' + k + ' in inches', inch[k], LEN[k].f);
    add('units', '1 degree in radians', PI / 180, ANG.deg.f); add('units', '1 gradian in radians', PI / 200, ANG.grad.f); add('units', '1 radian', 1, ANG.rad.f);
    /* a printed fraction or multiple of π is the value it stands for, to the digits shown */
    let seed = 20261022; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const vals = [0.5, 0.25, 0.75, 1 / 3, 2 / 3, 0.2, 1.5, 7 / 3, -0.5, -1 / 3, 3, 0.125]; for (let i = 0; i < 80; i++) vals.push(rnd() * 20 - 10);
    for (const v of vals) {
      const f = fractionStr(v);
      if (f) { const m = /^(-?)(\d+)\/(\d+)$/.exec(String(f).replace(/\s/g, '').replace('−', '-')); if (m) add('fractions', 'fractionStr(' + v + ') = ' + f, v, (m[1] ? -1 : 1) * m[2] / m[3], Math.max(1e-9, 0.5 * Math.pow(10, -S.prec) / Math.max(Math.abs(v), 1e-9))); }
      const rad = v * 0.3, p = piStr(rad);
      if (p) { const m = /^(-?)(\d+)?π(?:\/(\d+))?$/.exec(String(p).replace(/\s/g, '').replace('−', '-')) || /^(-?)(\d+)\/(\d+)π$/.exec(String(p).replace(/\s/g, '')); if (m) { const mul = m[2] === undefined ? 1 : +m[2], den = m[3] === undefined ? 1 : +m[3]; add('fractions', 'piStr(' + rad + ') = ' + p, rad, (m[1] ? -1 : 1) * mul * PI / den, 1e-9); } }
    }
    return R_;
  }

  /* ---- the working in an open explanation panel ---- */
  const MAXC = 40;
  function numExpr(text) {
    /* "6.2566 in² − 5.0990 in²" -> { f(vals), digits[] } or null when the text is not plain arithmetic */
    let s = text.replace(/−/g, '-').replace(/\s*\(-?\d+\/\d+(?:\s*[a-z²]+)?\)/g, '').replace(/(\d)\s*(?:in²|cm²|mm²|ft²|km²|m²|yd²|mi²|in|cm|mm|ft|km|yd|mi|°|%)(?![a-z])/g, '$1').replace(/·|×/g, '*').replace(/÷/g, '/').replace(/\[/g, '(').replace(/\]/g, ')');
    s = s.replace(/\|([^|]*)\|/g, 'ABS($1)').replace(/√\(/g, 'SQRT(').replace(/√(\d[\d.]*)/g, 'SQRT($1)').replace(/(\d|\))²/g, '$1^2');
    const digits = [], vals = [];
    let t = s.replace(/(\d+\.?\d*(?:e[+-]?\d+)?|\.\d+)/gi, m => { const i = vals.length; vals.push(parseFloat(m)); digits.push(Math.min(4, S.prec)); return 'N[' + i + ']'; });   /* the working shows at most four decimals (trailing zeros dropped), so every number on screen carries that much rounding */
    t = t.replace(/\^2/g, '**2');
    if (/[A-Za-zπ]/.test(t.replace(/N\[\d+\]|SQRT|ABS/g, '')) || /[^N\[\]0-9+\-*\/()., SQRTABS]/.test(t) || !vals.length || vals.length > 24) return null;
    try { const f = new Function('N', 'SQRT', 'ABS', '"use strict";return (' + t + ')'); f(vals, Math.sqrt, Math.abs); return { f, vals, digits }; } catch (e) { return null; }
  }
  const rangeOf = (ex, rnd) => {
    const n = ex.vals.length, half = ex.digits.map(d => (d === Infinity ? 0 : 0.5 * Math.pow(10, -d)));
    const at = sgn => ex.f(ex.vals.map((v, i) => v + sgn(i) * half[i]), Math.sqrt, Math.abs);
    const outs = [ex.f(ex.vals, Math.sqrt, Math.abs), at(() => 1), at(() => -1), at(i => (i % 2 ? 1 : -1)), at(i => (i % 2 ? -1 : 1))];
    for (let k = 0; k < MAXC; k++) outs.push(at(() => (rnd() < 0.5 ? -1 : 1)));
    /* with so few digits on screen that the rounding alone moves the value by a fifth (a few decimals of a difference of two nearby
       numbers, a division by almost zero), the line cannot be judged: say nothing rather than guess */
    if (outs.some(v => !Number.isFinite(v)) || ex.vals.some((v, i) => half[i] > 0.02 * Math.abs(v) && ex.vals.length > 1)) return null;
    const lo = Math.min(...outs), hi = Math.max(...outs);
    if (hi - lo > 0.2 * Math.max(Math.abs(lo), Math.abs(hi))) return null;
    return [lo, hi];
  };
  function linear(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll('.frac').forEach(f => f.replaceWith(document.createTextNode(' ((' + f.querySelector('.num').textContent + ')/(' + f.querySelector('.den').textContent + ')) ')));
    c.querySelectorAll('button').forEach(x => x.remove());
    c.querySelectorAll('sub,sup').forEach(x => x.replaceWith(document.createTextNode(x.textContent)));
    return c.textContent.replace(/\s+/g, ' ').trim();
  }
  function reviewPanel(root) {
    const R_ = { total: 0, failed: [] }; root = root || document.getElementById('mBody'); if (!root) return R_;
    let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
    const mid = g => (g[0] + g[1]) / 2;
    const fail = (text, x, y) => R_.failed.push({ group: 'working', label: text.slice(0, 150), expected: mid(x), actual: mid(y), err: Math.abs(mid(x) - mid(y)) / Math.max(1e-300, Math.abs(mid(x))) });
    const meets = (x, y) => { const slack = 1e-12 * Math.max(1, Math.abs(x[0]), Math.abs(x[1]), Math.abs(y[0]), Math.abs(y[1])); return !(y[1] + slack < x[0] || x[1] + slack < y[0]); };
    const squared = g => { const lo = g[0] < 0 && g[1] > 0 ? 0 : Math.min(g[0] * g[0], g[1] * g[1]); return [lo, Math.max(g[0] * g[0], g[1] * g[1])]; };
    let last = null;   /* the previous line's label and the value it ended on: the working often goes on, line after line, with the same left-hand side */
    root.querySelectorAll('.eqn-line:not(.eqn-note)').forEach(el => {
      const text = linear(el); const segs = text.split(/\s=\s/).map(x => x.trim()).filter(Boolean);
      const ranges = segs.map(sg => { const ex = numExpr(sg.replace(/^[^=]*:\s*/, '')); return ex ? rangeOf(ex, rnd) : null; });
      const label = segs.length > 1 && !ranges[0] ? segs[0].replace(/\s+/g, '') : null;
      let prev = null;
      if (label && last && ranges[1]) {
        const lr = last.rg, r1 = ranges[1];
        if (label === last.label) { R_.total++; if (!meets(lr, r1)) fail(text, lr, r1); }
        else if (last.label === label + '²') { R_.total++; if (!meets(lr, squared(r1))) fail(last.text + '  →  ' + text, lr, squared(r1)); }
        else if (label === last.label + '²') { R_.total++; if (!meets(squared(lr), r1)) fail(last.text + '  →  ' + text, squared(lr), r1); }
      }
      ranges.forEach((rg, k) => {
        if (!rg) { prev = null; return; }
        if (prev) { R_.total++; if (!meets(prev, rg)) fail(text, prev, rg); }
        prev = rg;
      });
      last = label && prev ? { label, rg: prev, text } : null;
    });
    return R_;
  }

  window.__devMath = { review, reviewUnits, reviewPanel, derivedAt, numExpr, rangeOf };
})();

/* Calculation audit for Triangle Thing.
 *
 * Every time anything on screen changes (a drag, a typed value, a lock, a unit or decimals change, a transform), renderNow() calls
 * calcAudit(D). It re-derives every number in the left sidebar a SECOND way, from the three corner coordinates alone and by a different
 * route than derive() / updateStats() take, then compares:
 *
 *   model     the numbers behind the sidebar (sides, angles, area, radii, arcs, cevians, centers, trig) against the independent value
 *   identity  relations that must hold for every triangle (angles add to 180°, Euler's OI² = R(R − 2r), Apollonius, the Law of Sines /
 *             Cosines, perpendicular altitudes, equidistant circumcenter / incenter, H = 3G − 2O ...)
 *   display   the text actually printed in each sidebar row, parsed back into a number, against the independent value rounded the way the
 *             row rounds (so a row that shows the wrong digits, wrong unit scale or a stale value is caught even when the model is right)
 *
 * Results land in AUDIT (and the status line under the sidebar); the Dev mode tester treats any failed check as a problem.
 */
const AUDIT = { checks: [], total: 0, passed: 0, failed: [], maxErr: 0, degenerate: false, count: 0, ms: 0, at: 0, tested: { model: 0, identity: 0, display: 0 } };

function calcAudit(D) {
  const t0 = performance.now();
  const checks = [];
  const P = D.P, sc = Math.max(D.a, D.b, D.c, 1e-300);
  const minSide = Math.min(D.a, D.b, D.c);
  /* a position can't be known better than the floating-point spacing of the coordinates themselves, however small the triangle is */
  const pos = sc + 1e-6 * Math.max(...P.map(q => Math.max(Math.abs(q.x), Math.abs(q.y))));
  /* thinner than about one part in 1e9 and even the stable Heron formula runs out of digits: only the basics apply */
  /* ill-conditioned slivers lose digits in every formula, even correct ones: widen the tolerance with how thin the triangle is */
  const mag0 = Math.max(...P.map(q => Math.max(Math.abs(q.x), Math.abs(q.y))));
  /* about 1 / sin(thinnest angle), made worse when the triangle is small and far from the origin (its sides are differences of big numbers) */
  const cond = Math.min(1e15, Math.max(1, sc * sc / Math.max(D.area, 1e-300)) * (1 + mag0 / sc));
  const degenerate = !(D.area > 1e-9 * sc * sc) || !(minSide > 1e-9 * sc) || cond > 1e10 || mag0 > 1e7 * sc;   /* a triangle far smaller than its distance from the origin is mostly rounding noise */
  const TOL = Math.min(1e-2, 1e-9 * cond);
  const group = (g, kind) => (label, expected, actual, o) => {
    o = o || {};
    const tol = o.tol === undefined ? TOL : o.tol;
    const scale = o.scale === undefined ? Math.max(Math.abs(expected), Math.abs(actual)) : o.scale;
    let err;
    if (!Number.isFinite(expected) || !Number.isFinite(actual)) err = expected === actual ? 0 : Infinity;
    else err = Math.abs(expected - actual) / Math.max(scale, 1e-300);
    if (o.abs !== undefined) err = Math.abs(expected - actual) / o.abs;   /* absolute tolerance in the same units as the values */
    const pass = err <= tol;
    checks.push({ kind, group: g, label, expected, actual, err, tol, pass, note: o.note || '' });
  };
  const model = (g, label, e, a, o) => group(g, 'model')(label, e, a, o);
  const ident = (g, label, e, a, o) => group(g, 'identity')(label, e, a, o);

  const [pa, pb, pc] = P, V = [pa, pb, pc];
  const names = ['A', 'B', 'C'], low = ['a', 'b', 'c'];
  const side = (i) => Math.hypot(V[(i + 1) % 3].x - V[(i + 2) % 3].x, V[(i + 1) % 3].y - V[(i + 2) % 3].y);   /* hypot, so sides of 1e-302 don't underflow when squared */
  const a = side(0), b = side(1), c = side(2), s = (a + b + c) / 2;
  const sides = [a, b, c];

  /* ---- measurements ---- */
  for (let i = 0; i < 3; i++) model('Measurements', 'side ' + low[i], sides[i], D.sides[i]);
  if (!degenerate) {
    /* half-angle form tan(A/2) = sqrt((s−b)(s−c) / (s(s−a))): stable at 0° and 180°, unlike arccos of the Law of Cosines */
    const half = i => { const j = (i + 1) % 3, k = (i + 2) % 3; return 2 * Math.atan(Math.sqrt(Math.max(0, (s - sides[j]) * (s - sides[k]) / (s * (s - sides[i]))))); };
    const ang = [half(0), half(1), half(2)];
    for (let i = 0; i < 3; i++) model('Measurements', 'angle ' + names[i] + ' (half-angle formula)', ang[i], D.ang[i], { tol: Math.max(TOL, 1e-9), scale: Math.PI });
    ident('Measurements', 'A + B + C = 180°', Math.PI, D.A + D.B + D.C, { tol: 1e-9 * Math.max(1, cond), scale: Math.PI });
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3, k = (i + 2) % 3;
      const cosA = (sides[j] ** 2 + sides[k] ** 2 - sides[i] ** 2) / (2 * sides[j] * sides[k]);
      ident('Measurements', 'Law of Cosines at ' + names[i], cosA, Math.cos(D.ang[i]), { abs: 1, tol: 1e-9 * cond });
    }

    /* ---- geometry ---- */
    /* Kahan's stable Heron: sort a ≥ b ≥ c, area = ¼ √((a+(b+c))(c−(a−b))(c+(a−b))(a+(b−c))) */
    const [x, y, z] = [a, b, c].sort((m, n) => n - m);
    const heron = 0.25 * Math.sqrt(Math.max(0, (x + (y + z)) * (z - (x - y)) * (z + (x - y)) * (x + (y - z))));
    const shoe = Math.abs(pa.x * (pb.y - pc.y) + pb.x * (pc.y - pa.y) + pc.x * (pa.y - pb.y)) / 2;
    model('Geometry', 'area (stable Heron)', heron, D.area);
    ident('Geometry', 'area = ½·b·c·sin A', 0.5 * b * c * Math.sin(ang[0]), D.area);
    ident('Geometry', 'area (shoelace)', shoe, D.area);
    model('Geometry', 'perimeter', a + b + c, D.per);
    model('Geometry', 'semiperimeter', s, D.s);

    /* ---- circles ---- */
    const R = (a * b * c) / (4 * heron), r = heron / s;
    model('Circles', 'circumradius R = abc / 4K', R, D.R);
    ident('Circles', 'R = a / (2 sin A)', a / (2 * Math.sin(ang[0])), D.R);
    model('Circles', 'inradius r = K / s', r, D.r);
    ident('Circles', 'r = (s − a)·tan(A/2)', (s - a) * Math.tan(ang[0] / 2), D.r);
    for (let i = 0; i < 3; i++) ident('Circles', 'circumcenter to ' + names[i] + ' = R', R, Math.hypot(D.circum.x - V[i].x, D.circum.y - V[i].y), { tol: 1e-8 * cond });
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3, k = (i + 2) % 3, u = V[j], w = V[k];
      const dd = Math.abs((w.x - u.x) * (u.y - D.incenter.y) - (u.x - D.incenter.x) * (w.y - u.y)) / sides[i];
      ident('Circles', 'incenter to side ' + low[i] + ' = r', r, dd, { tol: 1e-8 * cond });
    }
    ident('Circles', 'Euler: OI² = R(R − 2r)', R * (R - 2 * r), (D.circum.x - D.incenter.x) ** 2 + (D.circum.y - D.incenter.y) ** 2, { abs: R * R, tol: 1e-8 * cond });
    ident('Circles', 'R ≥ 2r', 1, D.R >= 2 * D.r * (1 - 1e-9) ? 1 : 0, { tol: 0 });
    model('Circles', 'circumdiameter 2R', 2 * R, 2 * D.R);
    model('Circles', 'incircle diameter 2r', 2 * r, 2 * D.r);
    model('Circles', 'R / r', R / r, D.R / D.r);
    model('Circles', 'incircle area πr²', Math.PI * r * r, Math.PI * D.r * D.r);
    model('Circles', 'circumcircle area πR²', Math.PI * R * R, Math.PI * D.R * D.R);
    for (let i = 0; i < 3; i++) model('Circles', 'circumarc opposite ' + names[i] + ' = 2·' + names[i] + '·R', 2 * ang[i] * R, D.arcCirc[i]);
    ident('Circles', 'circumarcs add to 2πR', 2 * Math.PI * R, D.arcCirc[0] + D.arcCirc[1] + D.arcCirc[2]);
    for (let i = 0; i < 3; i++) model('Circles', 'incircle arc at ' + names[i] + ' = r(π − ' + names[i] + ')', r * (Math.PI - ang[i]), D.arcIn[i]);
    ident('Circles', 'incircle arcs add to 2πr', 2 * Math.PI * r, D.arcIn[0] + D.arcIn[1] + D.arcIn[2]);

    /* ---- cevians ---- */
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3, k = (i + 2) % 3;
      model('Cevians', 'altitude h' + low[i] + ' = 2K / ' + low[i], 2 * heron / sides[i], D.alt[i]);
      ident('Cevians', 'altitude h' + low[i] + ' = ' + low[j] + '·sin ' + names[k], sides[j] * Math.sin(ang[k]), D.alt[i]);
      ident('Cevians', 'altitude foot of ' + names[i] + ' is at distance h', D.alt[i], Math.hypot(V[i].x - D.altFoot[i].x, V[i].y - D.altFoot[i].y), { tol: 1e-8 * cond });
      const ex = V[k].x - V[j].x, ey = V[k].y - V[j].y;
      ident('Cevians', 'altitude ' + names[i] + ' ⟂ side ' + low[i], 0, ((D.altFoot[i].x - V[i].x) * ex + (D.altFoot[i].y - V[i].y) * ey) / (sides[i] * Math.max(D.alt[i], 1e-300)), { abs: 1, tol: 1e-8 * cond });
      model('Cevians', 'median m' + low[i] + ' (Apollonius)', 0.5 * Math.sqrt(2 * sides[j] ** 2 + 2 * sides[k] ** 2 - sides[i] ** 2), D.med[i]);
      ident('Cevians', 'median m' + low[i] + ' = |' + names[i] + ' → midpoint|', D.med[i], Math.hypot(V[i].x - (V[j].x + V[k].x) / 2, V[i].y - (V[j].y + V[k].y) / 2), { tol: 1e-8 * cond });
      model('Cevians', 'bisector t' + low[i] + ' = 2bc·cos(' + names[i] + '/2) / (b + c)', 2 * sides[j] * sides[k] * Math.cos(ang[i] / 2) / (sides[j] + sides[k]), D.bis[i]);
      ident('Cevians', 'bisector t' + low[i] + ' = |' + names[i] + ' → foot|', D.bis[i], Math.hypot(V[i].x - D.bisFoot[i].x, V[i].y - D.bisFoot[i].y), { tol: 1e-8 * cond });
    }
    ident('Cevians', 'Σ medians² = ¾ Σ sides²', 0.75 * (a * a + b * b + c * c), D.med[0] ** 2 + D.med[1] ** 2 + D.med[2] ** 2);

    /* ---- centers ---- */
    const G = { x: (pa.x + pb.x + pc.x) / 3, y: (pa.y + pb.y + pc.y) / 3 };
    model('Centers', 'centroid x', G.x, D.centroid.x, { abs: pos });
    model('Centers', 'centroid y', G.y, D.centroid.y, { abs: pos });
    const I = { x: (a * pa.x + b * pb.x + c * pc.x) / (a + b + c), y: (a * pa.y + b * pb.y + c * pc.y) / (a + b + c) };
    model('Centers', 'incenter x', I.x, D.incenter.x, { abs: pos });
    model('Centers', 'incenter y', I.y, D.incenter.y, { abs: pos });
    for (let i = 0; i < 3; i++) {
      const j = (i + 1) % 3, k = (i + 2) % 3;
      ident('Centers', 'orthocenter on altitude from ' + names[i], 0, ((D.ortho.x - V[i].x) * (V[j].x - V[k].x) + (D.ortho.y - V[i].y) * (V[j].y - V[k].y)) / (sc * pos), { abs: 1, tol: 1e-8 * cond });
    }
    ident('Centers', 'Euler line: H = 3G − 2O (x)', 3 * G.x - 2 * D.circum.x, D.ortho.x, { abs: pos, tol: 1e-8 * cond });
    ident('Centers', 'Euler line: H = 3G − 2O (y)', 3 * G.y - 2 * D.circum.y, D.ortho.y, { abs: pos, tol: 1e-8 * cond });
    for (let i = 0; i < 3; i++) ident('Centers', 'centroid at 2/3 of median from ' + names[i], V[i].x + (2 / 3) * (D.medFoot[i].x - V[i].x), D.centroid.x, { abs: pos });

    /* ---- trigonometry ---- */
    const td = trigData(D);
    for (let i = 0; i < 3; i++) {
      const ex = { sin: Math.sin(ang[i]), cos: Math.cos(ang[i]) };
      for (const fn of ['sin', 'cos', 'tan', 'csc', 'sec', 'cot']) {
        const got = trigRatio(td[i], fn);
        let want = fn === 'tan' ? Math.tan(ang[i]) : fn === 'csc' ? 1 / ex.sin : fn === 'sec' ? 1 / ex.cos : fn === 'cot' ? ex.cos / ex.sin : ex[fn];
        /* the app calls an angle right when it READS 90 at the current decimals, and then uses the exact right-triangle ratios: the ratios and
           the true sin / cos of the angle can differ by up to half a unit of the last printed place */
        const rightRule = td[i].mode !== 'general';
        if (rightRule && (!Number.isFinite(got) || Math.abs(want) > 1e3)) continue;
        if (!Number.isFinite(got) || Math.abs(want) > 1e8 || Math.abs(ex.cos) < 1e-9 && (fn === 'tan' || fn === 'sec')) {
          /* only really undefined where the function is: tan / sec at 90° */
          if (Math.abs(ex.cos) < 1e-7 && (fn === 'tan' || fn === 'sec') || !Number.isFinite(want)) continue;
          if (Math.abs(want) > 1e8) continue;
        }
        model('Trigonometry', fn + ' ' + names[i], want, got, { abs: Math.max(1, Math.abs(want)), tol: rightRule ? Math.PI / 180 * Math.pow(10, -S.prec) + 1e-8 : Math.min(1e-2, 1e-9 * cond) });
      }
      ident('Trigonometry', 'sin² + cos² = 1 at ' + names[i], 1, ex.sin ** 2 + ex.cos ** 2, { tol: 1e-12 });
      ident('Trigonometry', 'Law of Sines ' + low[i] + ' / sin ' + names[i] + ' = 2R', 2 * D.R, sides[i] / Math.sin(D.ang[i]), { tol: 1e-8 * cond });
    }

    /* ---- classification ---- */
    const maxA = Math.max(D.A, D.B, D.C), kind = isRightAngle(maxA) ? 'Right' : maxA > Math.PI / 2 ? 'Obtuse' : 'Acute';
    ident('Geometry', 'classification by angle (' + kind + ')', 1, D.kind === kind ? 1 : 0, { tol: 0 });
  } else {
    AUDIT.degenerate = true;
  }
  ident('Measurements', 'perimeter = a + b + c', a + b + c, D.per);

  /* ---- what the sidebar actually prints ---- */
  if (typeof refs === 'object' && refs && refs.a && !S.viewOnly) auditDisplay(D, group('Display', 'display'), degenerate, a, b, c, s);

  const failed = checks.filter(c => !c.pass);
  let maxErr = 0; for (const c of checks) if (c.kind !== 'display' && c.pass && c.err > maxErr && Number.isFinite(c.err)) maxErr = c.err;   /* display rows are rounded on purpose, so they don't count toward the worst error */
  const tested = { model: 0, identity: 0, display: 0 }; for (const c of checks) tested[c.kind]++;
  AUDIT.checks = checks; AUDIT.total = checks.length; AUDIT.passed = checks.length - failed.length; AUDIT.failed = failed; AUDIT.maxErr = maxErr;
  AUDIT.degenerate = degenerate; AUDIT.tested = tested; AUDIT.cond = cond; AUDIT.tol = TOL; AUDIT.count++; AUDIT.ms = performance.now() - t0; AUDIT.at = Date.now();
  return AUDIT;
}

/* parse the number a sidebar row prints (the part before the "(alternate unit)" note): "3.0000 in", "3/2 in", "1.2e+9 mm²", "36.8699°" */
function parseShown(text) {
  const head = String(text).split('(')[0];
  if (/π|—|∞|undefined/.test(head)) return null;
  const m = /^\s*(-?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?:\s*\/\s*(\d+))?/i.exec(head.replace(/\s/g, ' '));
  if (!m) return null;
  const v = parseFloat(m[1]) / (m[2] ? parseFloat(m[2]) : 1);
  return { v, frac: !!m[2], exp: /e/i.test(m[1]), decimals: (m[1].split('.')[1] || '').replace(/e.*/i, '').length };
}

/* a displayed value is right when it is the true value rounded the way the row rounds: within half a unit of the last printed place */
function auditDisplay(D, add, degenerate, a, b, c, s) {
  const d = S.prec, U = S.lenUnit, lf = LEN[U].f, af = ANG[S.angUnit].f;
  const text = k => (refs[k] ? refs[k].textContent : '');
  const row = (label, key, want, scale) => {
    const sh = parseShown(text(key));
    if (!sh) { if (!/π|undefined|—|∞/.test(text(key))) add(label, want, NaN, { tol: 0, note: 'row text "' + text(key).slice(0, 30) + '" could not be read' }); return; }
    let tol, abs;
    if (sh.frac) { abs = Math.max(1e-300, Math.abs(want)); tol = 1e-8; }
    else if (sh.exp) { abs = Math.max(1e-300, Math.abs(want)); tol = Math.pow(10, -Math.max(2, d - 1)) * 0.51; }
    else { abs = 1; tol = 0.5 * Math.pow(10, -d) * 1.001 + 1e-12 * Math.abs(want); }
    add(label + ' — shows "' + text(key).split('(')[0].trim() + '"', want, sh.v, { abs, tol });
  };
  row('Side a row', 'a', a / lf); row('Side b row', 'b', b / lf); row('Side c row', 'c', c / lf);
  row('Angle A row', 'A', D.A / af); row('Angle B row', 'B', D.B / af); row('Angle C row', 'C', D.C / af);
  row('Area row', 'area', D.area / (lf * lf)); row('Perimeter row', 'per', D.per / lf); row('Semiperimeter row', 'semi', D.s / lf);
  if (degenerate) return;
  row('Circumradius row', 'R', D.R / lf); row('Circumdiameter row', 'Rd', 2 * D.R / lf);
  row('Inradius row', 'r', D.r / lf); row('Incircle diameter row', 'rd', 2 * D.r / lf);
  row('R / r row', 'Rr', D.R / D.r);
  row('Incircle area row', 'inA', Math.PI * D.r * D.r / (lf * lf)); row('Circumcircle area row', 'cirA', Math.PI * D.R * D.R / (lf * lf));
  for (let i = 0; i < 3; i++) {
    row('Circumarc ' + 'ABC'[i] + ' row', 'arcC' + i, D.arcCirc[i] / lf);
    row('Incircle arc ' + 'ABC'[i] + ' row', 'arcI' + i, D.arcIn[i] / lf);
    row('Altitude ' + 'abc'[i] + ' row', 'h' + i, D.alt[i] / lf);
    row('Median ' + 'abc'[i] + ' row', 'm' + i, D.med[i] / lf);
    row('Bisector ' + 'abc'[i] + ' row', 't' + i, D.bis[i] / lf);
  }
  /* coordinates: "(x, y)" */
  const pt = (label, key, p) => {
    const m = /^\(\s*([^,]+),\s*([^)]+)\)/.exec(text(key)); if (!m) return;
    const x = parseShown(m[1]), y = parseShown(m[2]); if (!x || !y) return;
    const sc = Math.max(D.a, D.b, D.c), snap = v => (Math.abs(v) < sc * 1e-10 ? 0 : v);
    const opt = (sh, v) => sh.exp ? { abs: Math.max(Math.abs(v), 1e-300), tol: Math.pow(10, -Math.max(2, d - 1)) * 0.51 } : { abs: 1, tol: 0.5 * Math.pow(10, -d) * 1.001 + 1e-12 * Math.abs(v) };
    const px = snap(p.x) / lf, py = snap(p.y) / lf;
    add(label + ' x', px, x.v, opt(x, px)); add(label + ' y', py, y.v, opt(y, py));
  };
  pt('Vertex A', 'pA', D.P[0]); pt('Vertex B', 'pB', D.P[1]); pt('Vertex C', 'pC', D.P[2]);
  pt('Centroid', 'cen', D.centroid); pt('Incenter', 'inc', D.incenter); pt('Circumcenter', 'cir', D.circum); pt('Orthocenter', 'ort', D.ortho);
  /* trig table cells */
  const td = trigData(D);
  for (let i = 0; i < 3; i++) for (const fn in TRIG_RAW) {
    const el = refs['tg_' + fn + '_' + i]; if (!el) continue;
    const want = trigRatio(td[i], fn), t = el.textContent;
    if (!Number.isFinite(want) || /undefined|e/.test(t) || Math.abs(want) >= 1e7) continue;
    const sh = parseShown(t); if (!sh) continue;
    add('Trig table ' + fn + ' ' + 'ABC'[i], Math.abs(want) < 1e-12 ? 0 : want, sh.v, { abs: 1, tol: sh.frac ? 1e-8 : 0.5 * Math.pow(10, -d) * 1.001 + 1e-12 });
  }
  if (refs.class) add('Classification row (' + D.kind + ' · ' + D.shape + ')', 1, refs.class.textContent === D.kind + ' · ' + D.shape ? 1 : 0, { tol: 0 });
}

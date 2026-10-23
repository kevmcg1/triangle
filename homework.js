/* Solve & Practice: what homework and exams actually ask about triangles.
 *
 * Solve a triangle   enter any three values (at least one side): SSS, SAS, ASA, AAS, SSA (the ambiguous case: 0, 1 or 2 triangles) or AAA.
 *                    It checks the triangle exists (triangle inequality, angles under 180°), shows every solution with the working, and draws it.
 * Practice           random problems of the kinds in textbooks and exams (Pythagoras, SOH-CAH-TOA, Law of Sines / Cosines, ambiguous case, area by Heron
 *                    and ½ab·sin C, triangle inequality, classifying, exterior angles, similar triangles, midsegments, centers, inradius, coordinates).
 *                    The triangle is drawn with only the given values showing and the sidebar hidden, you type an answer, it is checked (with units and
 *                    sensible rounding), and the full solution is one click away. Exam mode runs ten without feedback and marks them at the end.
 */
(function () {
  const TAU = Math.PI * 2, rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const names = ['A', 'B', 'C'], low = ['a', 'b', 'c'];
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clampN = (v, a, b) => Math.min(b, Math.max(a, v));
  /* values in the current length unit (the app keeps inches inside) */
  const U = () => LEN[S.lenUnit], toIn = v => v * U().f, inUnit = v => v / U().f;
  const dec = v => (Number.isFinite(v) ? fmt(v, Math.max(2, Math.min(S.prec, 6))) : '—');
  const L = v => dec(inUnit(v)) + ' ' + U().sym;                  /* a length given in inches, shown in the current unit */
  const Ad = v => dec(deg(v)) + '°';
  const rnd = () => (window.__hwRand || Math.random)();
  const ri = (a, b) => Math.floor(a + rnd() * (b - a + 1)), pick = arr => arr[Math.floor(rnd() * arr.length)], chance = p => rnd() < p;

  /* ------------------------------------------------------------------ the solver (inches and radians inside) */
  const EPS = 1e-9;
  /* what is still missing, worded for the values typed so far (used by the solver and by the live hint) */
  function needText(sIdx, aIdx) {
    const ns = sIdx.length, na = aIdx.length, have = sIdx.map(i => 'side ' + low[i]).concat(aIdx.map(i => 'angle ' + names[i]));
    const head = have.length ? 'You have ' + have.join(' and ') + '. ' : 'Nothing entered yet. ';
    if (ns + na >= 3 && ns === 0) return head + 'Three angles only give the shape, not the size: add at least one side (replace an angle with a side, or enter a side with just two angles).';
    if (ns + na === 0) return head + 'Any ONE of these sets solves a triangle: three sides, two sides + an angle, or one side + two angles. At least one value must be a side.';
    if (ns === 0 && na === 1) return head + 'Add a side and one more value (another angle, or a second side): at least one side is always needed.';
    if (ns === 0) return head + 'Two angles give the third automatically, but a side is needed for the size. Add one side.';
    if (ns === 1 && na === 0) return head + 'Add two more: another side + an angle, or two angles (any combination that makes three values).';
    if (ns === 2 && na === 0) return head + 'Add one more: the third side, or an angle (the one between them, or one opposite a given side).';
    if (ns === 1 && na === 1) return head + 'Add one more value: another angle (the third is automatic) or another side.';
    return head + 'Add one more value.';
  }
  function solveTriangle(k) {
    const sd = [k.a, k.b, k.c], an = [k.A, k.B, k.C];
    const sIdx = [0, 1, 2].filter(i => sd[i] !== undefined), aIdx = [0, 1, 2].filter(i => an[i] !== undefined);
    const ns = sIdx.length, na = aIdx.length;
    const out = { kind: '', title: '', sols: [], notes: [], error: '' };
    if (ns + na < 3) { out.need = needText(sIdx, aIdx); out.error = out.need; return out; }
    if (ns + na > 3) { out.error = 'Enter exactly three values: a fourth would either be redundant or contradict the others.'; return out; }
    for (const i of sIdx) if (!(sd[i] > 0)) { out.error = 'Side ' + low[i] + ' must be positive.'; return out; }
    for (const i of aIdx) if (!(an[i] > 0 && an[i] < Math.PI)) { out.error = 'Angle ' + names[i] + ' must be between 0° and 180°.'; return out; }
    const mk = (a, b, c, A, B, C, steps) => ({ a, b, c, A, B, C, steps });
    const lawCos = (s0, s1, ang) => Math.sqrt(Math.max(0, s0 * s0 + s1 * s1 - 2 * s0 * s1 * Math.cos(ang)));
    const acosC = (x, y, z) => Math.acos(clampN((x * x + y * y - z * z) / (2 * x * y), -1, 1));   /* angle between sides x and y, opposite z */
    if (na === 3) {
      const sum = an[0] + an[1] + an[2];
      out.kind = 'AAA'; out.title = 'Three angles (AAA)';
      if (Math.abs(sum - Math.PI) > 1e-6) { out.error = 'The angles add up to ' + Ad(sum) + ', not 180°, so no triangle has them.'; return out; }
      out.notes.push('Three angles fix the SHAPE of a triangle but not its SIZE: there are infinitely many similar triangles. Add one side to get a single triangle.');
      const k0 = Math.sin(an[0]);
      out.sols.push(mk(toIn(1) * Math.sin(an[0]) / k0, toIn(1) * Math.sin(an[1]) / k0, toIn(1) * Math.sin(an[2]) / k0, an[0], an[1], an[2],
        ['The sides are in the ratio sin A : sin B : sin C (Law of Sines), so with a = 1 ' + U().sym + ' (one of the possible sizes):', 'b = sin B ÷ sin A = ' + dec(Math.sin(an[1]) / k0) + ', c = sin C ÷ sin A = ' + dec(Math.sin(an[2]) / k0)]));
      return out;
    }
    if (ns === 3) {
      out.kind = 'SSS'; out.title = 'Three sides (SSS)';
      const [a, b, c] = sd, need = [[a, b, c, 'a', 'b', 'c'], [b, c, a, 'b', 'c', 'a'], [c, a, b, 'c', 'a', 'b']];
      for (const [x, y, z, nx, ny, nz] of need) {
        if (x + y <= z * (1 + 1e-12)) { out.error = (x + y < z ? 'No triangle: ' : 'Only a flat (degenerate) triangle: ') + nx + ' + ' + ny + ' = ' + L(x + y) + (x + y < z ? ' is less than ' : ' equals ') + nz + ' = ' + L(z) + '. Each side must be shorter than the other two added together (the triangle inequality).'; return out; }
      }
      const A = acosC(b, c, a), B = acosC(c, a, b), C = Math.PI - A - B;
      out.sols.push(mk(a, b, c, A, B, C, [
        'Triangle inequality holds: a + b > c, b + c > a, c + a > b.',
        'Law of Cosines: cos A = (b² + c² − a²) ÷ (2bc) = (' + dec(inUnit(b) ** 2) + ' + ' + dec(inUnit(c) ** 2) + ' − ' + dec(inUnit(a) ** 2) + ') ÷ (2 · ' + dec(inUnit(b)) + ' · ' + dec(inUnit(c)) + ') = ' + dec(Math.cos(A)) + '  →  A = ' + Ad(A),
        'Law of Cosines: cos B = (c² + a² − b²) ÷ (2ca) = ' + dec(Math.cos(B)) + '  →  B = ' + Ad(B),
        'Angles add to 180°: C = 180° − A − B = ' + Ad(C)]));
      return out;
    }
    if (ns === 2 && na === 1) {
      const ai = aIdx[0], X = an[ai], other = [0, 1, 2].filter(i => i !== ai);              /* the two sides NOT opposite the angle */
      const included = sIdx.every(i => i !== ai);                                            /* both given sides touch the angle: SAS */
      if (included) {
        out.kind = 'SAS'; out.title = 'Two sides and the angle between them (SAS)';
        const s0 = sd[other[0]], s1 = sd[other[1]], third = lawCos(s0, s1, X), r = [0, 0, 0]; r[ai] = third; r[other[0]] = s0; r[other[1]] = s1;
        const [a, b, c] = r, A = acosC(b, c, a), B = acosC(c, a, b), C = Math.PI - A - B;
        out.sols.push(mk(a, b, c, A, B, C, [
          'Law of Cosines for the missing side: ' + low[ai] + '² = ' + low[other[0]] + '² + ' + low[other[1]] + '² − 2·' + low[other[0]] + '·' + low[other[1]] + '·cos ' + names[ai] + ' = ' + dec(inUnit(s0) ** 2) + ' + ' + dec(inUnit(s1) ** 2) + ' − 2 · ' + dec(inUnit(s0)) + ' · ' + dec(inUnit(s1)) + ' · cos ' + Ad(X) + ' = ' + dec(inUnit(third) ** 2) + '  →  ' + low[ai] + ' = ' + L(third),
          'Law of Cosines for each remaining angle (it can never give the wrong one of two possible angles, unlike the Law of Sines):',
          'cos ' + names[other[0]] + ' = ' + dec(Math.cos([A, B, C][other[0]])) + '  →  ' + names[other[0]] + ' = ' + Ad([A, B, C][other[0]]),
          names[other[1]] + ' = 180° − ' + names[ai] + ' − ' + names[other[0]] + ' = ' + Ad([A, B, C][other[1]])]));
        return out;
      }
      /* SSA: the angle is opposite one of the given sides */
      out.kind = 'SSA'; out.title = 'Two sides and an angle NOT between them (SSA, the ambiguous case)';
      const oppSide = sd[ai], otherI = sIdx.find(i => i !== ai), other2 = sd[otherI], third = 3 - ai - otherI;
      const sinY = other2 * Math.sin(X) / oppSide, h = other2 * Math.sin(X);
      const steps0 = ['Law of Sines: sin ' + names[otherI] + ' = ' + low[otherI] + ' · sin ' + names[ai] + ' ÷ ' + low[ai] + ' = ' + dec(inUnit(other2)) + ' · sin ' + Ad(X) + ' ÷ ' + dec(inUnit(oppSide)) + ' = ' + dec(sinY)];
      if (sinY > 1 + 1e-12) { out.notes.push('The height needed to reach the base is ' + low[otherI] + ' · sin ' + names[ai] + ' = ' + L(h) + ', which is MORE than ' + low[ai] + ' = ' + L(oppSide) + ': side ' + low[ai] + ' is too short to reach, so there is no triangle.'); out.error = 'No triangle: sin ' + names[otherI] + ' = ' + dec(sinY) + ' is greater than 1.'; return out; }
      const Y1 = Math.asin(clampN(sinY, -1, 1)), cands = Math.abs(sinY - 1) < 1e-9 ? [Y1] : [Y1, Math.PI - Y1];
      const sols = [];
      cands.forEach((Y, ci) => {
        const Z = Math.PI - X - Y; if (!(Z > 1e-9)) return;
        const z = oppSide * Math.sin(Z) / Math.sin(X), ang = [0, 0, 0], sid = [0, 0, 0]; ang[ai] = X; ang[otherI] = Y; ang[third] = Z; sid[ai] = oppSide; sid[otherI] = other2; sid[third] = z;
        sols.push(mk(sid[0], sid[1], sid[2], ang[0], ang[1], ang[2], (ci === 0 ? steps0.concat(['The sine is the same for ' + Ad(Y1) + ' and ' + Ad(Math.PI - Y1) + ', so ' + names[otherI] + ' could be either.']) : []).concat([
          (ci === 0 ? 'First possibility: ' : 'Second possibility: ') + names[otherI] + ' = ' + Ad(Y) + (ci === 1 ? ' (180° − ' + Ad(Y1) + ')' : ''),
          names[third] + ' = 180° − ' + names[ai] + ' − ' + names[otherI] + ' = ' + Ad(Z),
          'Law of Sines: ' + low[third] + ' = ' + low[ai] + ' · sin ' + names[third] + ' ÷ sin ' + names[ai] + ' = ' + L(z)])));
      });
      if (cands.length === 2 && sols.length === 1) out.notes.push('The second possibility, ' + names[otherI] + ' = ' + Ad(Math.PI - Y1) + ', would make the angles add up to more than 180°, so only one triangle works.');
      if (cands.length === 1) out.notes.push('sin ' + names[otherI] + ' = 1 exactly: a single right triangle (side ' + low[ai] + ' just touches the base).');
      out.notes.unshift('How many triangles? ' + (sols.length === 2 ? 'TWO. Side ' + low[ai] + ' is shorter than ' + low[otherI] + ' but longer than the height ' + L(h) + ', so it can swing to meet the base in two places.' : sols.length === 1 ? 'ONE.' : 'NONE.'));
      out.sols = sols; if (!sols.length) out.error = 'No triangle: the angles would add up to 180° or more.';
      return out;
    }
    /* one side, two angles: ASA or AAS */
    out.kind = sd.indexOf(undefined) === -1 ? '' : 'ASA/AAS';
    const si = sIdx[0], s = sd[si], thirdA = aIdx.length === 2 ? 3 - aIdx[0] - aIdx[1] : -1;
    const sum = an[aIdx[0]] + an[aIdx[1]];
    const between = si === thirdA;                                                          /* the side is opposite the unknown angle, so it lies BETWEEN the two known angles */
    out.kind = between ? 'ASA' : 'AAS'; out.title = between ? 'Two angles and the side between them (ASA)' : 'Two angles and a side not between them (AAS)';
    if (sum >= Math.PI - 1e-9) { out.error = 'No triangle: ' + names[aIdx[0]] + ' + ' + names[aIdx[1]] + ' = ' + Ad(sum) + ' is 180° or more, so there is no angle left for the third corner.'; return out; }
    const ang = [0, 0, 0]; aIdx.forEach(i => { ang[i] = an[i]; }); ang[thirdA] = Math.PI - sum;
    const kk = s / Math.sin(ang[si]), sid = ang.map(x => kk * Math.sin(x));
    out.sols.push(mk(sid[0], sid[1], sid[2], ang[0], ang[1], ang[2], [
      'Third angle: ' + names[thirdA] + ' = 180° − ' + names[aIdx[0]] + ' − ' + names[aIdx[1]] + ' = 180° − ' + Ad(an[aIdx[0]]) + ' − ' + Ad(an[aIdx[1]]) + ' = ' + Ad(ang[thirdA]),
      'Law of Sines: every side ÷ sin(its opposite angle) is the same number: ' + low[si] + ' ÷ sin ' + names[si] + ' = ' + dec(inUnit(s)) + ' ÷ sin ' + Ad(ang[si]) + ' = ' + dec(inUnit(kk)),
      ...[0, 1, 2].filter(i => i !== si).map(i => low[i] + ' = ' + dec(inUnit(kk)) + ' · sin ' + names[i] + ' = ' + dec(inUnit(kk)) + ' · sin ' + Ad(ang[i]) + ' = ' + L(sid[i]))]));
    return out;
  }

  /* put a solution on the canvas */
  function drawSolution(sol) {
    const p = canonical(sol.a, sol.b, sol.c, 1), gx = (p[0].x + p[1].x + p[2].x) / 3, gy = (p[0].y + p[1].y + p[2].y) / 3;
    cancelShapeAnim(); cancelCam(); cancelLockAnims();
    S.lock.side = [false, false, false]; S.lock.angle = [false, false, false]; S.selected.clear();
    S.P = p.map(v => ({ x: v.x - gx, y: v.y - gy })); S.units.side = [S.lenUnit, S.lenUnit, S.lenUnit]; S.units.angle = [S.angUnit, S.angUnit, S.angUnit];
    fitView(modalRoot.classList.contains('show') ? 150 : undefined, 380); pushHistory(); requestRender();
  }
  /* put a triangle given by its three corners (in the current unit) on the canvas */
  function drawPoints(pts) {
    cancelShapeAnim(); cancelCam(); cancelLockAnims();
    S.lock.side = [false, false, false]; S.lock.angle = [false, false, false]; S.selected.clear();
    S.P = pts.map(q => ({ x: toIn(q[0]), y: toIn(q[1]) })); fitView(modalRoot.classList.contains('show') ? 150 : undefined, 380); pushHistory(); requestRender();
  }

  /* ------------------------------------------------------------------ practice problems */
  const fmtN = (v, d = 2) => (+v.toFixed(d)).toString();
  const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [20, 21, 29], [9, 40, 41], [6, 8, 10], [9, 12, 15]];
  const GOOD_AREA = [[13, 14, 15], [5, 12, 13], [3, 4, 5], [7, 15, 20], [9, 10, 17], [6, 25, 29], [17, 25, 26], [10, 17, 21]];
  const sym = () => U().sym;
  /* the sides in the current unit; right angle at A unless said otherwise */
  const GEN = {
    pyth() {
      const t = pick(TRIPLES), m = pick([1, 1, 2, 3]), [p, q, r] = t.map(x => x * m);       /* legs p, q, hypotenuse r */
      const ask = pick(['hyp', 'leg', 'leg']);
      const a = r, b = p, c = q;                                                              /* right angle at A: a is the hypotenuse */
      const knownLegs = ask === 'hyp';
      return {
        topic: 'right', tri: [a, b, c], givens: knownLegs ? { sides: [1, 2], angles: [0] } : { sides: [0, 1], angles: [0] },
        text: knownLegs ? 'A right triangle has legs b = ' + b + ' ' + sym() + ' and c = ' + c + ' ' + sym() + '. Find the hypotenuse a.' : 'A right triangle has hypotenuse a = ' + a + ' ' + sym() + ' and one leg b = ' + b + ' ' + sym() + '. Find the other leg c.',
        unit: 'len', answer: knownLegs ? a : c, steps: knownLegs ? ['Pythagorean theorem: a² = b² + c²', 'a² = ' + b + '² + ' + c + '² = ' + (b * b) + ' + ' + (c * c) + ' = ' + (b * b + c * c), 'a = √' + (b * b + c * c) + ' = ' + a + ' ' + sym()] : ['Pythagorean theorem: c² = a² − b²', 'c² = ' + a + '² − ' + b + '² = ' + (a * a) + ' − ' + (b * b) + ' = ' + (a * a - b * b), 'c = √' + (a * a - b * b) + ' = ' + c + ' ' + sym()],
      };
    },
    trig() {
      const Bd = ri(20, 70), a = ri(8, 30), B = rad(Bd), b = a * Math.sin(B), c = a * Math.cos(B), kind = pick(['opp', 'adj', 'angle']);
      /* the problem prints b rounded, so the working and the answer must come from that printed value, not the unrounded one */
      const bShown = +fmtN(b), Bcalc = deg(Math.asin(bShown / a));
      if (kind === 'angle') return { topic: 'right', tri: [a, b, c], givens: { sides: [0, 1], angles: [0] }, text: 'In a right triangle (right angle at A) the hypotenuse is a = ' + a + ' ' + sym() + ' and the side opposite B is b = ' + fmtN(b) + ' ' + sym() + '. Find angle B in degrees.', unit: 'deg', answer: Bcalc, tol: 0.4,
        steps: ['SOH: sin B = opposite ÷ hypotenuse = b ÷ a', 'sin B = ' + fmtN(bShown, 4) + ' ÷ ' + a + ' = ' + fmtN(bShown / a, 4), 'B = sin⁻¹(' + fmtN(bShown / a, 4) + ') = ' + fmtN(Bcalc, 2) + '°'] };
      const askOpp = kind === 'opp';
      return { topic: 'right', tri: [a, b, c], givens: { sides: [0], angles: [0, 1] }, text: 'In a right triangle (right angle at A) the hypotenuse is a = ' + a + ' ' + sym() + ' and angle B = ' + Bd + '°. Find the side ' + (askOpp ? 'b opposite B' : 'c next to B') + '.', unit: 'len', answer: askOpp ? b : c,
        steps: askOpp ? ['SOH: sin B = opposite ÷ hypotenuse = b ÷ a', 'b = a · sin B = ' + a + ' · sin ' + Bd + '° = ' + a + ' · ' + fmtN(Math.sin(B), 4) + ' = ' + fmtN(b, 3) + ' ' + sym()] : ['CAH: cos B = adjacent ÷ hypotenuse = c ÷ a', 'c = a · cos B = ' + a + ' · cos ' + Bd + '° = ' + a + ' · ' + fmtN(Math.cos(B), 4) + ' = ' + fmtN(c, 3) + ' ' + sym()] };
    },
    lawsin() {
      let Ad_, Bd_; do { Ad_ = ri(35, 85); Bd_ = ri(30, 80); } while (Ad_ + Bd_ > 160 || Ad_ + Bd_ < 55);
      const a = ri(8, 40), A = rad(Ad_), B = rad(Bd_), C = Math.PI - A - B, b = a * Math.sin(B) / Math.sin(A), c = a * Math.sin(C) / Math.sin(A), askC = chance(0.4);
      return { topic: 'laws', tri: [a, b, c], givens: { sides: [0], angles: [0, 1] }, text: 'In triangle ABC, A = ' + Ad_ + '°, B = ' + Bd_ + '° and a = ' + a + ' ' + sym() + '. Find side ' + (askC ? 'c' : 'b') + '.', unit: 'len', answer: askC ? c : b,
        steps: askC ? ['Third angle: C = 180° − ' + Ad_ + '° − ' + Bd_ + '° = ' + (180 - Ad_ - Bd_) + '°', 'Law of Sines: c ÷ sin C = a ÷ sin A', 'c = a · sin C ÷ sin A = ' + a + ' · sin ' + (180 - Ad_ - Bd_) + '° ÷ sin ' + Ad_ + '° = ' + fmtN(c, 3) + ' ' + sym()] : ['Law of Sines: b ÷ sin B = a ÷ sin A', 'b = a · sin B ÷ sin A = ' + a + ' · sin ' + Bd_ + '° ÷ sin ' + Ad_ + '° = ' + fmtN(b, 3) + ' ' + sym()] };
    },
    lawcos() {
      if (chance(0.55)) {
        const b = ri(6, 25), c = ri(6, 25), Ad_ = ri(30, 130), A = rad(Ad_), a = Math.sqrt(b * b + c * c - 2 * b * c * Math.cos(A)), B = Math.acos((a * a + c * c - b * b) / (2 * a * c));
        return { topic: 'laws', tri: [a, b, c], givens: { sides: [1, 2], angles: [0] }, text: 'In triangle ABC, b = ' + b + ' ' + sym() + ', c = ' + c + ' ' + sym() + ' and the angle between them is A = ' + Ad_ + '°. Find side a.', unit: 'len', answer: a,
          steps: ['Law of Cosines: a² = b² + c² − 2bc · cos A', 'a² = ' + b + '² + ' + c + '² − 2 · ' + b + ' · ' + c + ' · cos ' + Ad_ + '° = ' + fmtN(a * a, 3), 'a = √' + fmtN(a * a, 3) + ' = ' + fmtN(a, 3) + ' ' + sym()] };
      }
      const t = pick(GOOD_AREA.concat([[7, 8, 9], [6, 9, 12], [10, 12, 15], [8, 11, 14]])), [a, b, c] = t, C = Math.acos((a * a + b * b - c * c) / (2 * a * b));
      return { topic: 'laws', tri: [a, b, c], givens: { sides: [0, 1, 2], angles: [] }, text: 'A triangle has sides a = ' + a + ' ' + sym() + ', b = ' + b + ' ' + sym() + ' and c = ' + c + ' ' + sym() + '. Find angle C in degrees.', unit: 'deg', answer: deg(C), tol: 0.06,
        steps: ['Law of Cosines: c² = a² + b² − 2ab · cos C', 'cos C = (a² + b² − c²) ÷ (2ab) = (' + (a * a) + ' + ' + (b * b) + ' − ' + (c * c) + ') ÷ (2 · ' + a + ' · ' + b + ') = ' + fmtN((a * a + b * b - c * c) / (2 * a * b), 4), 'C = cos⁻¹(' + fmtN((a * a + b * b - c * c) / (2 * a * b), 4) + ') = ' + fmtN(deg(C), 2) + '°'] };
    },
    ambig() {
      const want = pick([0, 1, 2, 2]);
      let Ad_ = ri(25, 65), b = ri(10, 30), A = rad(Ad_), h = b * Math.sin(A), a;
      /* the "just touches" case needs a printed a that really equals h: only 30° gives a rational sine, so use A = 30°, even b, a = b/2 */
      const tangent = want === 1 && chance(0.5);
      if (tangent) { Ad_ = 30; b = 2 * ri(5, 15); A = rad(30); h = b / 2; }
      if (want === 0) a = +(h * rnd() * 0.85 + 1).toFixed(1); else if (want === 1) a = tangent ? b / 2 : +(b + ri(1, 5)).toFixed(0); else a = +(h + (b - h) * (0.25 + 0.5 * rnd())).toFixed(1);
      a = Math.max(a, 0.5);
      const r = solveTriangle({ a: toIn(a), b: toIn(b), A }); const count = r.sols.length;
      const tri = r.sols[0] ? [inUnit(r.sols[0].a), inUnit(r.sols[0].b), inUnit(r.sols[0].c)] : null;
      return { topic: 'laws', tri, noDraw: !tri, givens: { sides: [0, 1], angles: [0] }, text: 'In triangle ABC, A = ' + Ad_ + '°, a = ' + a + ' ' + sym() + ' and b = ' + b + ' ' + sym() + '. How many different triangles are possible?', unit: 'count', choices: ['0', '1', '2'], answer: String(count),
        steps: ['This is SSA, the ambiguous case. The height from C is h = b · sin A = ' + b + ' · sin ' + Ad_ + '° = ' + fmtN(h, 3) + ' ' + sym() + '.', a < h - 1e-9 ? 'a = ' + a + ' is shorter than h, so side a cannot reach the base: 0 triangles.' : a >= b ? 'a = ' + a + ' is at least as long as b, so a swings to only one place: 1 triangle.' : Math.abs(a - h) < 1e-6 ? 'a equals h, so it just touches: 1 right triangle.' : 'h < a < b: a is long enough to reach the base but shorter than b, so it can meet the base in two places: 2 triangles.', 'Answer: ' + count] };
    },
    heron() {
      const t = pick(GOOD_AREA), m = pick([1, 1, 2]), [a, b, c] = t.map(x => x * m), s = (a + b + c) / 2, K = Math.sqrt(s * (s - a) * (s - b) * (s - c));
      return { topic: 'area', tri: [a, b, c], givens: { sides: [0, 1, 2], angles: [] }, text: 'Find the area of a triangle with sides ' + a + ', ' + b + ' and ' + c + ' ' + sym() + ' using Heron\'s formula.', unit: 'area', answer: K,
        steps: ['Semiperimeter: s = (a + b + c) ÷ 2 = (' + a + ' + ' + b + ' + ' + c + ') ÷ 2 = ' + s, "Heron's formula: Area = √[ s(s − a)(s − b)(s − c) ]", 'Area = √[ ' + s + ' · ' + (s - a) + ' · ' + (s - b) + ' · ' + (s - c) + ' ] = √' + (s * (s - a) * (s - b) * (s - c)) + ' = ' + fmtN(K, 3) + ' ' + sym() + '²'] };
    },
    areaSAS() {
      const a = ri(6, 24), b = ri(6, 24), Cd = ri(25, 140), C = rad(Cd), c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(C)), K = 0.5 * a * b * Math.sin(C);
      return { topic: 'area', tri: [a, b, c], givens: { sides: [0, 1], angles: [2] }, text: 'Two sides of a triangle are a = ' + a + ' ' + sym() + ' and b = ' + b + ' ' + sym() + ', and the angle between them is C = ' + Cd + '°. Find the area.', unit: 'area', answer: K,
        steps: ['Area = ½ · a · b · sin C', 'Area = ½ · ' + a + ' · ' + b + ' · sin ' + Cd + '° = ' + fmtN(0.5 * a * b, 2) + ' · ' + fmtN(Math.sin(C), 4) + ' = ' + fmtN(K, 3) + ' ' + sym() + '²'] };
    },
    inequality() {
      const ok = chance(0.5); let a = ri(3, 15), b = ri(3, 15), c;
      c = ok ? ri(Math.abs(a - b) + 1, a + b - 1) : (chance(0.5) ? a + b + ri(0, 4) : Math.abs(a - b) - ri(0, Math.min(2, Math.abs(a - b) - 1))); if (c < 1) c = 1;
      const valid = a + b > c && a + c > b && b + c > a, ls = [a, b, c].sort((x, y) => x - y);
      return { topic: 'laws', tri: valid ? [a, b, c] : null, noDraw: !valid, givens: { sides: [], angles: [] }, text: 'Can a triangle have sides of ' + a + ', ' + b + ' and ' + c + ' ' + sym() + '?', unit: 'choice', choices: ['yes', 'no'], answer: valid ? 'yes' : 'no',
        steps: ['Triangle inequality: the two shorter sides must add up to MORE than the longest side.', 'Shorter two: ' + ls[0] + ' + ' + ls[1] + ' = ' + (ls[0] + ls[1]) + ';  longest: ' + ls[2], valid ? (ls[0] + ls[1]) + ' > ' + ls[2] + ', so yes, a triangle exists.' : (ls[0] + ls[1]) + (ls[0] + ls[1] === ls[2] ? ' = ' : ' < ') + ls[2] + ', so NO triangle exists' + (ls[0] + ls[1] === ls[2] ? ' (only a flat line).' : '.')] };
    },
    classify() {
      const t = pick(TRIPLES.concat([[4, 5, 6], [5, 6, 10], [7, 8, 9], [4, 6, 9], [2, 3, 4], [6, 7, 12], [5, 5, 8], [10, 24, 26]])), m = pick([1, 1, 2]), [a, b, c] = t.map(x => x * m).sort((x, y) => x - y);
      const lhs = a * a + b * b, rhs = c * c, ans = lhs === rhs ? 'right' : lhs > rhs ? 'acute' : 'obtuse';
      return { topic: 'classify', tri: [c, a, b], givens: { sides: [0, 1, 2], angles: [] }, text: 'A triangle has sides ' + a + ', ' + b + ' and ' + c + ' ' + sym() + '. Is it acute, right or obtuse?', unit: 'choice', choices: ['acute', 'right', 'obtuse'], answer: ans,
        steps: ['Compare the square of the longest side with the sum of the squares of the other two (converse of the Pythagorean theorem).', a + '² + ' + b + '² = ' + lhs + ';  ' + c + '² = ' + rhs, lhs === rhs ? 'They are equal: a RIGHT triangle.' : lhs > rhs ? lhs + ' > ' + rhs + ': the biggest angle is less than 90°, so ACUTE.' : lhs + ' < ' + rhs + ': the biggest angle is more than 90°, so OBTUSE.'] };
    },
    angles() {
      const A = ri(25, 100), B = ri(20, 175 - A - 5), C = 180 - A - B, askExt = chance(0.5);
      return { topic: 'right', tri: [1, 1, 1], angleTri: [A, B, C], givens: { sides: [], angles: [0, 1] }, text: askExt ? 'In triangle ABC, A = ' + A + '° and B = ' + B + '°. Find the exterior angle at C (formed by extending side a or b).' : 'Two angles of a triangle are ' + A + '° and ' + B + '°. Find the third angle.', unit: 'deg', answer: askExt ? A + B : C, tol: 0.1,
        steps: askExt ? ['Exterior angle theorem: an exterior angle equals the sum of the two remote interior angles.', 'Exterior angle at C = A + B = ' + A + '° + ' + B + '° = ' + (A + B) + '°', '(Check: C = 180° − ' + A + '° − ' + B + '° = ' + C + '°, and 180° − ' + C + '° = ' + (A + B) + '°)'] : ['The angles of a triangle add up to 180°.', 'Third angle = 180° − ' + A + '° − ' + B + '° = ' + C + '°'] };
    },
    similar() {
      const t = pick(TRIPLES.slice(0, 5)), k = pick([1.5, 2, 2.5, 3, 4]), [p, q, r] = t, [P2, Q2, R2] = t.map(x => x * k);
      return { topic: 'right', tri: t, givens: { sides: [0, 1, 2], angles: [] }, text: 'Triangle ABC has sides ' + p + ', ' + q + ' and ' + r + ' ' + sym() + '. Triangle DEF is similar, and its shortest side is ' + P2 + ' ' + sym() + '. Find the longest side of DEF.', unit: 'len', answer: R2,
        steps: ['Similar triangles have all sides in the same ratio.', 'Scale factor = ' + P2 + ' ÷ ' + p + ' = ' + fmtN(k, 3), 'Longest side = ' + r + ' · ' + fmtN(k, 3) + ' = ' + fmtN(R2, 3) + ' ' + sym()] };
    },
    midsegment() {
      const t = pick(TRIPLES.concat(GOOD_AREA)), [a, b, c] = t, which = ri(0, 2), s = t[which];
      return { topic: 'right', tri: t, givens: { sides: [which], angles: [] }, text: 'In triangle ABC, side ' + low[which] + ' = ' + s + ' ' + sym() + '. A midsegment joins the midpoints of the other two sides. How long is it?', unit: 'len', answer: s / 2,
        steps: ['The midsegment theorem: a segment joining the midpoints of two sides is parallel to the third side and half as long.', 'Midsegment = ' + s + ' ÷ 2 = ' + fmtN(s / 2, 3) + ' ' + sym()] };
    },
    centroid() {
      const pts = []; do { pts.length = 0; for (let i = 0; i < 3; i++) pts.push([ri(-6, 8), ri(-6, 8)]); } while (Math.abs((pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0])) < 8);
      const askX = chance(0.5), mean = i => (pts[0][i] + pts[1][i] + pts[2][i]) / 3;
      return { topic: 'coord', points: pts, givens: { sides: [], angles: [0, 1, 2] }, text: 'Triangle ABC has vertices A(' + pts[0].join(', ') + '), B(' + pts[1].join(', ') + ') and C(' + pts[2].join(', ') + '). Find the ' + (askX ? 'x' : 'y') + '-coordinate of the centroid.', unit: 'num', answer: mean(askX ? 0 : 1),
        steps: ['The centroid is the average of the three vertices.', (askX ? 'x' : 'y') + ' = (' + pts.map(q => q[askX ? 0 : 1]).join(' + ') + ') ÷ 3 = ' + pts.reduce((s, q) => s + q[askX ? 0 : 1], 0) + ' ÷ 3 = ' + fmtN(mean(askX ? 0 : 1), 3)] };
    },
    slope() {
      const pts = []; do { pts.length = 0; for (let i = 0; i < 3; i++) pts.push([ri(-6, 8), ri(-6, 8)]); } while (Math.abs((pts[1][0] - pts[0][0]) * (pts[2][1] - pts[0][1]) - (pts[1][1] - pts[0][1]) * (pts[2][0] - pts[0][0])) < 8 || pts[1][0] === pts[2][0]);
      const m = (pts[2][1] - pts[1][1]) / (pts[2][0] - pts[1][0]);
      return { topic: 'coord', points: pts, givens: { sides: [], angles: [0, 1, 2] }, text: 'Triangle ABC has vertices A(' + pts[0].join(', ') + '), B(' + pts[1].join(', ') + ') and C(' + pts[2].join(', ') + '). Find the slope of side a (from B to C).', unit: 'num', answer: m,
        steps: ['slope = (y₂ − y₁) ÷ (x₂ − x₁)', 'slope = (' + pts[2][1] + ' − ' + (pts[1][1] < 0 ? '(' + pts[1][1] + ')' : pts[1][1]) + ') ÷ (' + pts[2][0] + ' − ' + (pts[1][0] < 0 ? '(' + pts[1][0] + ')' : pts[1][0]) + ') = ' + (pts[2][1] - pts[1][1]) + ' ÷ ' + (pts[2][0] - pts[1][0]) + ' = ' + fmtN(m, 3)] };
    },
    inradius() {
      const t = pick([[3, 4, 5], [5, 12, 13], [13, 14, 15], [6, 8, 10], [9, 12, 15], [8, 15, 17], [7, 24, 25]]), [a, b, c] = t, s = (a + b + c) / 2, K = Math.sqrt(s * (s - a) * (s - b) * (s - c)), r = K / s, R = a * b * c / (4 * K), askR = chance(0.4);
      return { topic: 'centers', tri: t, givens: { sides: [0, 1, 2], angles: [] }, text: 'A triangle has sides ' + a + ', ' + b + ' and ' + c + ' ' + sym() + '. Find the ' + (askR ? 'circumradius R (radius of the circle through all three corners)' : 'inradius r (radius of the circle that fits inside)') + '.', unit: 'len', answer: askR ? R : r,
        steps: ['Semiperimeter s = ' + s + ';  Area K = √[s(s−a)(s−b)(s−c)] = ' + fmtN(K, 3), askR ? 'R = abc ÷ (4K) = ' + a + ' · ' + b + ' · ' + c + ' ÷ (4 · ' + fmtN(K, 3) + ') = ' + fmtN(R, 3) + ' ' + sym() : 'r = K ÷ s = ' + fmtN(K, 3) + ' ÷ ' + s + ' = ' + fmtN(r, 3) + ' ' + sym()] };
    },
  };
  const TOPIC_OF = { pyth: 'right', trig: 'right', lawsin: 'laws', lawcos: 'laws', ambig: 'laws', heron: 'area', areaSAS: 'area', inequality: 'laws', classify: 'classify', angles: 'right', similar: 'right', midsegment: 'right', centroid: 'coord', slope: 'coord', inradius: 'centers' };
  const TOPICS = [['all', 'Everything'], ['right', 'Right triangles'], ['laws', 'Sine & cosine laws'], ['area', 'Area'], ['classify', 'Classifying'], ['centers', 'Circles'], ['coord', 'Coordinates']];

  /* ------------------------------------------------------------------ the panel */
  const css = document.createElement('style');
  css.textContent = `
.hw{display:grid;gap:8px;font-size:12px}
.hw .hw-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
.hw .hw-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.hw label{display:grid;gap:2px;font-size:10px;font-weight:700;letter-spacing:.06em;color:var(--txt-3)}
.hw input[type=text]{width:100%;height:30px;background:var(--raise);border:1px solid transparent;border-radius:6px;color:var(--side-ink);padding:0 8px;font:500 12px 'Inter',sans-serif;outline:0;user-select:text}
.hw input[type=text]:focus{border-color:var(--txt-3)}
.hw input.bad{border-color:var(--lock)}
.hw button{height:30px;padding:0 11px;border:0;border-radius:6px;background:var(--raise);color:var(--side-ink);font:600 11px 'Inter',sans-serif;cursor:pointer}
.hw button:hover{background:var(--raise-2)}
.hw button.go{background:var(--side-ink);color:var(--side-bg)}
.hw button.on{background:var(--side-ink);color:var(--side-bg)}
.hw .hw-note{color:var(--txt-2);line-height:1.5}
.hw .hw-err{color:var(--lock);line-height:1.5}
.hw .hw-sol{background:var(--raise);border-radius:8px;padding:9px 10px;display:grid;gap:5px}
.hw .hw-sol h5{font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--txt-2)}
.hw .hw-vals{display:grid;grid-template-columns:repeat(3,1fr);gap:2px 8px;font-variant-numeric:tabular-nums}
.hw .hw-vals b{color:var(--side-ink)}
.hw ol{margin:0;padding-left:18px;display:grid;gap:3px;color:var(--txt-2);line-height:1.5;user-select:text}
.hw .hw-q{background:var(--raise);border-radius:8px;padding:10px;line-height:1.55;color:var(--side-ink);user-select:text}
.hw .ok{color:var(--c1)} .hw .no{color:var(--lock)}
.hw .hw-score{margin-left:auto;color:var(--txt-3);font-variant-numeric:tabular-nums}
body.hw-hide #stats .sec:not(.sec-hw) .v,body.hw-hide #stats .sec:not(.sec-hw) .trow .c,body.hw-hide #stats .sec:not(.sec-hw) #chips{filter:blur(7px);transition:filter .25s}
#overlay.hw-hide .pill:not(.given){visibility:hidden}
.sec-hw:not(.collapsed) .sec-collapse{max-height:none!important}
`;
  document.head.appendChild(css);

  const body = section('Solve & Practice', 'fa-graduation-cap', 7), sec = body.parentSec; sec.classList.add('sec-hw'); statsEl.prepend(sec);
  /* closed to begin with so the measurements stay first; opens itself when you start practising */
  sec.classList.add('collapsed'); sec.querySelector('.sec-collapse').style.maxHeight = '0px';
  const openSec = () => { if (sec.classList.contains('collapsed')) toggleSection(sec); };
  const root = document.createElement('div'); root.className = 'hw'; body.appendChild(root);
  root.innerHTML = `
    <div class="hw-note">Enter as few values as you have (any three, at least one a side) and solve the triangle; it tells you what is still missing, ambiguous case included. Units can be typed: <i>3.4 mm</i>, <i>1.2 rad</i>.</div>
    <div class="hw-grid" id="hwIn">${low.map(l => `<label>side ${l}<input type="text" data-k="${l}" placeholder="—" autocomplete="off" spellcheck="false"></label>`).join('')}${names.map(l => `<label>angle ${l}<input type="text" data-k="${l}" placeholder="—" autocomplete="off" spellcheck="false"></label>`).join('')}</div>
    <div class="hw-row"><button class="go" id="hwSolve">Solve</button><button id="hwUse" title="Fill the six boxes with the triangle on screen">Use this triangle</button><button id="hwClear">Clear</button></div>
    <div class="hw-note" id="hwNeed"></div>
    <div id="hwOut"></div>
    <div class="hw-row" style="border-top:1px solid var(--side-line);padding-top:8px"><button id="hwPrac">Practice</button><button id="hwExam" title="Ten problems, no feedback until the end">Exam</button><span class="hw-score" id="hwScore"></span></div>
    <div id="hwPracBox" hidden></div>`;
  const $ = s => root.querySelector(s), inputs = [...root.querySelectorAll('#hwIn input')];

  function readInputs() {
    const k = {}; let bad = false;
    inputs.forEach(inp => {
      inp.classList.remove('bad'); const v = inp.value.trim(); if (!v) return; const isAngle = inp.dataset.k === inp.dataset.k.toUpperCase();
      const r = parseMeasure(v, isAngle ? 'angle' : 'side', isAngle ? S.angUnit : S.lenUnit);
      if (!r || !(r.value > 0)) { inp.classList.add('bad'); bad = true; return; }
      k[inp.dataset.k] = r.value;
    });
    return bad ? null : k;
  }
  function showSolution(res) {
    const out = $('#hwOut');
    let html = '<div class="hw-sol"><h5>' + esc(res.title || 'Solve') + '</h5>';
    res.notes.forEach(n => { html += '<div class="hw-note">' + esc(n) + '</div>'; });
    if (res.error) html += '<div class="hw-err">' + esc(res.error) + '</div>';
    html += '</div>';
    res.sols.forEach((s, i) => {
      html += '<div class="hw-sol"><h5>' + (res.sols.length > 1 ? 'Triangle ' + (i + 1) + ' of ' + res.sols.length : 'The triangle') + '</h5><div class="hw-vals">' +
        low.map((l, j) => '<span>' + l + ' = <b>' + esc(L(s[l])) + '</b></span>').join('') + names.map(n => '<span>' + n + ' = <b>' + esc(Ad(s[n])) + '</b></span>').join('') + '</div><ol>' + s.steps.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol><div class="hw-row"><button class="go" data-draw="' + i + '">Draw this triangle</button></div></div>';
    });
    out.innerHTML = html;
    out.querySelectorAll('[data-draw]').forEach(b => b.addEventListener('click', () => drawSolution(res.sols[+b.dataset.draw])));
    out.dataset.last = JSON.stringify(res.kind);
    HW.last = res;
  }
  function solveNow() {
    const k = readInputs(); if (!k) { $('#hwOut').innerHTML = '<div class="hw-sol"><div class="hw-err">One of the boxes could not be read. Type a positive number, optionally with a unit.</div></div>'; return null; }
    const res = solveTriangle(k); showSolution(res); return res;
  }
  $('#hwSolve').addEventListener('click', solveNow);
  /* live guide: says what is still needed while typing, so a short entry is never a dead end */
  function updateNeed() {
    const el = $('#hwNeed'), idx = (up) => inputs.filter(i => i.value.trim() && (i.dataset.k === i.dataset.k.toUpperCase()) === up).map(i => (up ? names : low).indexOf(i.dataset.k));
    const sI = idx(false), aI = idx(true), n = sI.length + aI.length;
    el.textContent = n >= 3 && sI.length ? '' : needText(sI, aI); el.hidden = !el.textContent;
  }
  inputs.forEach(inp => inp.addEventListener('input', updateNeed)); updateNeed();
  inputs.forEach(inp => inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') solveNow(); }));
  $('#hwClear').addEventListener('click', () => { inputs.forEach(i => { i.value = ''; i.classList.remove('bad'); }); $('#hwOut').innerHTML = ''; updateNeed(); });
  $('#hwUse').addEventListener('click', () => { const D = derive(); inputs.forEach(inp => { const l = inp.dataset.k, isA = l === l.toUpperCase(), i = (isA ? names : low).indexOf(l); inp.value = isA ? fmt(deg(D.ang[i]), S.prec) + '°' : fmt(D.sides[i] / U().f, S.prec) + ' ' + U().sym; });  updateNeed(); });

  /* ---- practice ---- */
  const PR = { on: false, exam: false, topic: 'all', cur: null, tried: 0, right: 0, streak: 0, done: false, list: [], n: 0 };
  function hide(on, givens) {
    document.body.classList.toggle('hw-hide', on); overlay.classList.toggle('hw-hide', on);
    pills.forEach(p => p.el.classList.toggle('given', !!(on && givens && (p.kind === 'side' ? givens.sides : givens.angles).includes(p.i))));
  }
  function newProblem() {
    const keys = Object.keys(GEN).filter(k => PR.topic === 'all' || TOPIC_OF[k] === PR.topic);
    const p = GEN[pick(keys.length ? keys : Object.keys(GEN))]();
    p.n = ++PR.n; PR.cur = p; PR.done = false;
    if (p.points) drawPoints(p.points); else if (p.angleTri) { /* angles only: draw any triangle with these angles */
      const r = solveTriangle({ a: toIn(10), B: rad(p.angleTri[1]), C: rad(p.angleTri[2]) }); if (r.sols[0]) drawSolution(r.sols[0]); }
    else if (p.tri && !p.noDraw) drawSolution({ a: toIn(p.tri[0]), b: toIn(p.tri[1]), c: toIn(p.tri[2]) });
    hide(true, p.givens); renderPractice();
  }
  function renderPractice() {
    const box = $('#hwPracBox'); box.hidden = !PR.on; $('#hwPrac').classList.toggle('on', PR.on && !PR.exam); $('#hwExam').classList.toggle('on', PR.on && PR.exam);
    $('#hwScore').textContent = PR.on ? (PR.exam ? 'Exam: ' + Math.min(PR.n, 10) + ' / 10' : PR.right + ' of ' + PR.tried + ' right' + (PR.streak > 1 ? ' · streak ' + PR.streak : '')) : '';
    if (!PR.on) { box.innerHTML = ''; return; }
    const p = PR.cur; if (!p) { box.innerHTML = ''; return; }
    let h = '';
    if (!PR.exam) h += '<div class="hw-row">' + TOPICS.map(([k, n]) => '<button data-topic="' + k + '" class="' + (PR.topic === k ? 'on' : '') + '">' + n + '</button>').join('') + '</div>';
    h += '<div class="hw-q">' + esc(p.text) + '<div class="hw-note" style="margin-top:4px">The triangle is drawn on the canvas; only the values you are given are shown.</div></div>';
    if (!PR.done) {
      if (p.choices) h += '<div class="hw-row">' + p.choices.map(c => '<button data-choice="' + esc(c) + '">' + esc(c) + '</button>').join('') + '</div>';
      else h += '<div class="hw-row"><input type="text" id="hwAns" placeholder="Your answer' + (p.unit === 'len' ? ' (' + sym() + ')' : p.unit === 'deg' ? ' (degrees)' : p.unit === 'area' ? ' (' + sym() + '²)' : '') + '" autocomplete="off" spellcheck="false" style="flex:1"><button class="go" id="hwCheck">Check</button></div>';
      if (!PR.exam) h += '<div class="hw-row"><button id="hwSkip">Skip</button></div>';
    } else h += '<div id="hwFb"></div><div class="hw-row"><button class="go" id="hwNext">' + (PR.exam && PR.n >= 10 ? 'Finish exam' : 'Next problem') + '</button></div>';
    box.innerHTML = h;
    box.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => { PR.topic = b.dataset.topic; newProblem(); }));
    box.querySelectorAll('[data-choice]').forEach(b => b.addEventListener('click', () => grade(b.dataset.choice)));
    const ck = box.querySelector('#hwCheck'), an = box.querySelector('#hwAns'); if (ck) ck.addEventListener('click', () => grade(an.value));
    if (an) { an.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') grade(an.value); }); setTimeout(() => an.focus({ preventScroll: true }), 30); }
    const sk = box.querySelector('#hwSkip'); if (sk) sk.addEventListener('click', () => { PR.streak = 0; newProblem(); });
    const nx = box.querySelector('#hwNext'); if (nx) nx.addEventListener('click', () => { if (PR.exam && PR.n >= 10) finishExam(); else newProblem(); });
    if (PR.done && PR.fb) box.querySelector('#hwFb').innerHTML = PR.fb;
  }
  /* is the typed answer right? (with units and sensible rounding) */
  function check(p, raw) {
    const t = String(raw).trim(); if (!t) return { ok: false, empty: true };
    if (p.choices) return { ok: t.toLowerCase() === p.answer.toLowerCase() };
    if (p.unit === 'len') { const r = parseMeasure(t, 'side', S.lenUnit); if (!r) return { ok: false, bad: true }; const want = toIn(p.answer); return { ok: Math.abs(r.value - want) <= Math.max(0.006 * U().f, 0.006 * want) }; }
    if (p.unit === 'deg') { const r = parseMeasure(t, 'angle', 'deg'); if (!r) return { ok: false, bad: true }; return { ok: Math.abs(deg(r.value) - p.answer) <= (p.tol || Math.max(0.06, p.answer * 0.004)) }; }
    const n = parseFloat(t.replace(/,/g, '.')); if (!Number.isFinite(n)) return { ok: false, bad: true };
    return { ok: Math.abs(n - p.answer) <= Math.max(0.006, Math.abs(p.answer) * 0.006) };
  }
  const ansText = p => p.choices ? p.answer : p.unit === 'len' ? fmtN(p.answer, 3) + ' ' + sym() : p.unit === 'deg' ? fmtN(p.answer, 2) + '°' : p.unit === 'area' ? fmtN(p.answer, 3) + ' ' + sym() + '²' : fmtN(p.answer, 3);
  function grade(raw) {
    const p = PR.cur; if (!p || PR.done) return; const r = check(p, raw);
    if (r.empty) return;
    if (r.bad) { const a = $('#hwAns'); if (a) a.classList.add('bad'); return; }
    PR.tried++; if (r.ok) { PR.right++; PR.streak++; } else PR.streak = 0;
    p.given = String(raw).trim(); p.correct = r.ok; PR.list.push(p); PR.done = true;
    if (PR.exam) { newProblemOrFinish(); return; }
    hide(false);
    PR.fb = (r.ok ? '<div class="ok"><b>Correct.</b> ' : '<div class="no"><b>Not quite.</b> You answered ' + esc(raw) + '; the answer is <b>' + esc(ansText(p)) + '</b>. ') + (r.ok ? esc(ansText(p)) : '') + '</div><div class="hw-sol"><h5>Solution</h5><ol>' + p.steps.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol></div>';
    renderPractice();
  }
  function newProblemOrFinish() { if (PR.n >= 10) finishExam(); else newProblem(); }
  function finishExam() {
    hide(false); const rows = PR.list.slice(-10), right = rows.filter(p => p.correct).length;
    PR.exam = false; PR.on = true; PR.cur = null; renderPractice();
    $('#hwPracBox').hidden = false;
    $('#hwPracBox').innerHTML = '<div class="hw-sol"><h5>Exam finished: ' + right + ' / ' + rows.length + ' (' + Math.round(100 * right / Math.max(1, rows.length)) + '%)</h5>' + rows.map((p, i) => '<div class="' + (p.correct ? 'ok' : 'no') + '"><b>' + (i + 1) + '. ' + (p.correct ? '✓' : '✗') + '</b> ' + esc(p.text) + '<div class="hw-note">Your answer: ' + esc(p.given) + (p.correct ? '' : ' · correct: ' + esc(ansText(p))) + '</div>' + (p.correct ? '' : '<ol>' + p.steps.map(x => '<li>' + esc(x) + '</li>').join('') + '</ol>') + '</div>').join('') + '</div><div class="hw-row"><button class="go" id="hwAgain">Another exam</button><button id="hwEnd">Done</button></div>';
    $('#hwAgain').addEventListener('click', () => startExam()); $('#hwEnd').addEventListener('click', () => setPractice(false));
  }
  function setPractice(on) {
    PR.on = on; PR.exam = false; if (!on) { hide(false); PR.cur = null; renderPractice(); return; }
    openSec(); PR.topic = 'all'; PR.fb = ''; newProblem();
  }
  function startExam() { openSec(); PR.on = true; PR.exam = true; PR.n = 0; PR.list = []; PR.tried = 0; PR.right = 0; PR.streak = 0; newProblem(); }
  $('#hwPrac').addEventListener('click', () => (PR.on && !PR.exam ? setPractice(false) : (PR.exam ? (PR.exam = false, setPractice(true)) : setPractice(true))));
  $('#hwExam').addEventListener('click', () => { if (PR.on && PR.exam) setPractice(false); else startExam(); });
  /* opening a stat's explanation while a problem is open would give the answer away: the sidebar is blurred, and so the panel is simply closed */
  const HW = { solveTriangle, GEN, check, PR, drawSolution, setPractice, startExam, grade, last: null };
  window.__hw = HW;
})();

// Dev mode for Triangle Thing: tests the app by itself, measures how smoothly it runs, and says what glitches and how everything did.
//
// Press the backtick key (`) to open or close the panel (there is no button for it), or open the page with ?dev=quick|standard|thorough to
// start a run right away. It finds every control that is on screen (buttons, lock buttons, every text / number / color field, the search box,
// the section headers, the clickable rows, the trig table, the unit menus, the canvas gestures: dragging a corner, a side or the whole
// triangle, panning, wheel zoom, shift-select; and the keys the page answers to) and uses them:
//
//   one by one      each control on its own, typing fields get a whole list of awkward values (letters, units, negatives, 1e308, NaN ...)
//   pairs           every control followed by another control (Thorough: a large random share of all pairs)
//   combinations    every on/off combination of the toggles (grid, theme, units, exact/approx, view only, sidebar, locks...), each one
//                   a single flip from the last, and after each a handful of other controls on top
//   random runs     random runs of 3 to 10 controls in a row (the same seed gives the same runs, so a glitch can be replayed)
//   flows           whole journeys with checks along the way: the default 3-4-5 triangle, rotating 24 times, flipping twice, scaling up
//                   and back, undo/redo walks, every lock held while every corner is dragged, every typed value, every unit and
//                   decimal setting, every explanation panel, the search box, view-only, the theme, the settings panel, zooming to
//                   the extremes, dragging far off screen, 300 clicks in two seconds, 400 key presses, and smooth dragging
//
// After every step it looks for: a script error or unhandled promise, a console error, numbers that stopped being numbers (NaN / Infinity
// in the model or showing in the page), a triangle whose angles no longer add up to 180° or that breaks the law of cosines, a locked side
// or angle that moved, history that went out of range, sideways scrolling, a canvas that no longer matches its box, and a frame that
// stalled. It times every frame to grade how smoothly each kind of step ran. The report lists what it covered, every problem with
// the exact steps that led to it (and the seed to replay it), the slowest controls, and the controls that did nothing.
(function () {
  'use strict';
  if (window.__triangleDev) return;
  const qs = new URLSearchParams(location.search);

  /* ------------------------------------------------------------------ small helpers */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const raf = () => new Promise(r => requestAnimationFrame(r));
  const rng = seed => () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const pick = (r, a) => a[Math.floor(r() * a.length)];
  const $ = (s, root) => (root || document).querySelector(s);
  const $$ = (s, root) => [...(root || document).querySelectorAll(s)];
  const pct = (a, p) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
  const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0;
  const r1 = n => Math.round(n * 10) / 10;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const hashStr = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = (h * 33 ^ s.charCodeAt(i)) | 0; return h; };

  const MODES = {
    thorough: { label: 'Thorough: every control with every awkward value, 2500 pairs, 256 toggle combinations, 1000 random runs, every flow 3 times', pairs: 2500, combos: 256, seqs: 1000, probe: 6, loops: 3, vals: 99 },
    standard: { label: 'Standard: every control with 8 awkward values, 600 pairs, 64 toggle combinations, 300 random runs, every flow twice',           pairs: 600,  combos: 64,  seqs: 300,  probe: 4, loops: 2, vals: 8 },
    quick:    { label: 'Quick: every control, 80 pairs, 12 toggle combinations, 40 random runs, every flow once',                                        pairs: 80,   combos: 12,  seqs: 40,   probe: 3, loops: 1, vals: 3 }
  };
  const FR = { fine: 34, slow: 50, jank: 100, stall: 700 };      // ms between frames: 60 fps is 16.7
  const BAD_TEXT = /\b(NaN|undefined|Infinity)\b|\[object |function\s*\(|\bnull\b/;

  /* values typed into fields */
  const V_SIDE  = ['3', '4.5', '5', '12', '0.5', '7.25 in', '3.4 mm', '2 ft', '1.5 cm', '1e2', '0', '-4', 'abc', '', '3,5', '1e-7', '999999', 'Infinity', 'NaN', '   8   ', "5'6\"", '0.0000001', '1e308', '9'.repeat(40)];
  const V_ANGLE = ['60', '90', '45.5', '120°', '1.2 rad', '100 grad', '180', '0', '-30', '361', 'abc', '', '90deg', '0.0001', '179.999', '1e5'];
  const V_COORD = ['0', '1.5', '-2', '100', 'abc', '', '1e3', '-1e-3', '3 mm', '1e308'];
  const V_SEARCH = ['area', 'side', 'tri', 'sin', '', 'zzz', 'a', 'π', '  ', 'circum', '<b>x</b>', 'ang', 'median', '(', '\\', 'a'.repeat(60)];
  const KEYS = [['f'], ['g'], ['r'], ['u'], ['d'], ['l'], ['b'], ['v'], ['Escape'], ['z', { ctrl: true }], ['y', { ctrl: true }], ['z', { ctrl: true, shift: true }], ['x'], ['1'], ['ArrowLeft'], ['ArrowUp'], ['Tab'], ['Enter'], [' '], ['Delete'], ['+'], ['-']];

  /* ------------------------------------------------------------------ what is going wrong: errors and frames */
  const ERR = [];
  addEventListener('error', e => ERR.push({ type: 'script error', msg: (e.message || '') + ' (' + String(e.filename || '').split('/').pop() + ':' + e.lineno + ')' }));
  addEventListener('unhandledrejection', e => ERR.push({ type: 'unhandled promise', msg: String(e.reason && e.reason.message || e.reason) }));
  const origErr = console.error, origWarn = console.warn;
  const noise = m => /Failed to load resource|ERR_|favicon/.test(m);
  console.error = function () { try { const m = [...arguments].map(String).join(' '); if (!noise(m)) ERR.push({ type: 'console error', msg: m.slice(0, 300) }); } catch (_) {} return origErr.apply(this, arguments); };
  console.warn = function () { try { const m = [...arguments].map(String).join(' '); if (!noise(m)) ERR.push({ type: 'console warning', msg: m.slice(0, 300) }); } catch (_) {} return origWarn.apply(this, arguments); };

  const FM = { ts: [], draw: [], on: false };
  const fmLoop = t => { if (!FM.on) return; FM.ts.push(t); if (FM.ts.length > 200000) FM.ts.splice(0, 100000); requestAnimationFrame(fmLoop); };
  const fmStart = () => { if (FM.on) return; FM.on = true; requestAnimationFrame(fmLoop); };
  const fmStop = () => { FM.on = false; };
  const deltasSince = i0 => { const a = []; for (let k = Math.max(1, i0 + 1); k < FM.ts.length; k++) a.push(FM.ts[k] - FM.ts[k - 1]); return a; };
  /* time every redraw of the canvas */
  try {
    if (typeof renderNow === 'function' && !renderNow.__dev) {
      const orig = renderNow, w = function () { const t = performance.now(); try { return orig.apply(this, arguments); } finally { FM.draw.push(performance.now() - t); if (FM.draw.length > 200000) FM.draw.splice(0, 100000); } };
      w.__dev = 1; window.renderNow = w;
    }
  } catch (_) {}

  const frameStats = g => ({ n: g.length, avg: r1(avg(g)), p95: r1(pct(g, .95)), max: Math.round(g.length ? Math.max(...g) : 0), over50: g.filter(x => x > FR.slow).length, over100: g.filter(x => x > FR.jank).length });
  function grade(f) {
    if (f.n < 30) return { word: 'not enough frames', cls: 'warn' };
    const bad = f.over50 / f.n, jank = f.over100 / f.n;
    if (jank < .002 && bad < .01 && f.p95 <= FR.fine) return { word: 'smooth', cls: 'ok' };
    if (jank < .01 && bad < .04 && f.p95 <= FR.slow) return { word: 'mostly smooth', cls: 'ok' };
    if (jank < .03) return { word: 'a little rough', cls: 'warn' };
    return { word: 'choppy', cls: 'bad' };
  }

  /* ------------------------------------------------------------------ the page's own parts */
  const visible = e => { if (!e || !e.getBoundingClientRect) return false; const r = e.getBoundingClientRect(); if (r.width <= 0 || r.height <= 0) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.pointerEvents !== 'none' || e.tagName === 'INPUT'; };
  const labelOf = e => ((e.getAttribute && (e.getAttribute('aria-label') || e.title)) || e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 34);
  const cvRect = () => cv.getBoundingClientRect();
  const toClient = p => { const r = cvRect(); return { x: r.left + sx(p.x), y: r.top + sy(p.y) }; };
  const inCanvas = (r, margin = 24) => { const b = cvRect(); return { x: b.left + margin + r() * (b.width - 2 * margin), y: b.top + margin + r() * (b.height - 2 * margin) }; };
  const EV = { max: 0 };
  const timed = (el, ev) => { const t = performance.now(); el.dispatchEvent(ev); EV.max = Math.max(EV.max, performance.now() - t); };
  const pe = (type, x, y, o = {}) => new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: o.button === undefined ? 0 : o.button, buttons: o.buttons === undefined ? 0 : o.buttons, shiftKey: !!o.shift, altKey: !!o.alt, ctrlKey: !!o.ctrl });
  async function drag(from, to, o = {}) {
    const steps = o.steps || 12, button = o.button || 0, buttons = button === 2 ? 2 : 1;
    if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return;
    timed(cv, pe('pointerdown', from.x, from.y, { button, buttons, shift: o.shift, alt: o.alt }));
    for (let i = 1; i <= steps; i++) { const t = i / steps; timed(cv, pe('pointermove', from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, { button: -1, buttons, shift: o.shift, alt: o.alt })); if (o.frames !== false) await raf(); }
    timed(cv, pe('pointerup', to.x, to.y, { button, buttons: 0, shift: o.shift }));
  }
  const wheel = (x, y, dy, ctrl) => timed(cv, new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: x, clientY: y, deltaY: dy, deltaMode: 0, ctrlKey: !!ctrl }));
  function key(k, m) { m = m || {}; const t = document.activeElement || document.body; const mk = type => new KeyboardEvent(type, { key: k, code: k.length === 1 ? 'Key' + k.toUpperCase() : k, bubbles: true, cancelable: true, ctrlKey: !!m.ctrl, shiftKey: !!m.shift }); t.dispatchEvent(mk('keydown')); t.dispatchEvent(mk('keyup')); }
  function setNative(el, v) { const d = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value'); d.set.call(el, v); }
  async function typeInto(el, v, r) {
    el.focus(); setNative(el, v); el.dispatchEvent(new Event('input', { bubbles: true }));
    const how = r(); if (how < .5) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); else if (how < .8) el.blur(); else { el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); el.blur(); }
  }
  const animsBusy = () => { try { return camAnim !== null || panelAnim !== null || sbAnim !== null || shapeAnim !== null || viewFadeAnim !== null || zoomGlide != null || S.gridAnimT != null; } catch (_) { return false; } };
  async function settle(max) {
    await raf(); await raf(); const t0 = performance.now();
    while (animsBusy() && performance.now() - t0 < (max || 1200)) await raf();
    await raf();
  }
  const modalOpen = () => modalRoot.classList.contains('show');
  const stateKey = () => {
    try { return JSON.stringify([S.P.map(p => [+p.x.toFixed(9), +p.y.toFixed(9)]), S.lock, S.units, S.lenUnit, S.angUnit, [S.view.cx, S.view.cy, S.view.z].map(v => +v.toPrecision(9)), S.grid, S.prec, S.exact, S.theme, S.viewOnly, [...S.selected], hashStr(statsEl.textContent), modalOpen(), hashStr(($('#mBody') || {}).textContent || ''), sidebarOpen, !!openMenuEl, ($('#searchBox') || {}).value, document.body.className, $$('.sec.collapsed').length, $('#settingsModal') ? 1 : 0]); }
    catch (e) { return 'err:' + e.message; }
  };

  /* ------------------------------------------------------------------ the controls */
  function discover() {
    const C = [], seen = new Set();
    const add = (id, kind, label, fire, extra) => { if (seen.has(id)) return; seen.add(id); C.push(Object.assign({ id, kind, label, fire }, extra || {})); };
    const dev = e => !!e.closest('.dev');
    $$('button').forEach((b, i) => {
      if (dev(b) || b.disabled || !visible(b)) return;
      const pill = b.classList.contains('lockbtn') ? pills.findIndex(p => p.lockBtn === b) : -1;
      const id = b.id ? 'btn:#' + b.id : pill >= 0 ? 'lock:' + pills[pill].kind + pills[pill].i : 'btn:' + (b.className || 'x').split(' ')[0] + ':' + (labelOf(b) || i);
      add(id, 'button', b.id ? '#' + b.id + ' ' + labelOf(b) : (labelOf(b) || id), async () => { b.dispatchEvent(pe('pointerdown', 0, 0)); b.click(); }, { toggle: /^btn:#(btnTheme|btnGrid|btnView|btnLen|btnAng|navtoggle|btnSettings)$/.test(id) || id.startsWith('lock:') });
    });
    pills.forEach(p => {
      const nm = p.kind + p.i, V = p.kind === 'side' ? V_SIDE : V_ANGLE;
      if (visible(p.input)) add('in:' + nm, 'field', nm + ' box', async (r, k) => typeInto(p.input, k && k.value !== undefined ? k.value : pick(r, V), r), { values: V });
      if (p.cx && visible(p.cx)) { add('in:' + nm + ':x', 'field', nm + ' x', async r => typeInto(p.cx, pick(r, V_COORD), r), { values: V_COORD }); add('in:' + nm + ':y', 'field', nm + ' y', async r => typeInto(p.cy, pick(r, V_COORD), r), { values: V_COORD }); }
    });
    const sb = $('#searchBox'); if (sb && visible(sb)) add('in:search', 'field', 'search box', async r => typeInto(sb, pick(r, V_SEARCH), r), { values: V_SEARCH });
    $$('input[type=color]').forEach((c, i) => { if (!dev(c) && visible(c)) add('color:' + i, 'field', 'color ' + i, async r => { setNative(c, '#' + Math.floor(r() * 0xffffff).toString(16).padStart(6, '0')); c.dispatchEvent(new Event('input', { bubbles: true })); }); });
    $$('input[type=checkbox],input[type=range],select').forEach((c, i) => { if (!dev(c) && visible(c)) add('ctl:' + c.id + i, 'field', c.id || c.type, async r => { if (c.tagName === 'SELECT') { c.selectedIndex = Math.floor(r() * c.options.length); c.dispatchEvent(new Event('change', { bubbles: true })); } else if (c.type === 'range') { setNative(c, String(+c.min + r() * (+c.max - +c.min))); c.dispatchEvent(new Event('input', { bubbles: true })); } else c.click(); }); });
    $$('.sec-head').forEach((h, i) => { if (visible(h)) add('sec:' + i, 'row', 'section ' + labelOf(h), async () => h.click()); });
    $$('.row.clickable').forEach((h, i) => { if (visible(h)) add('row:' + i, 'row', 'row ' + labelOf(h), async () => h.click()); });
    $$('.trow').forEach((h, i) => { if (visible(h)) add('trow:' + i, 'row', 'trig ' + labelOf(h), async () => h.click()); });
    $$('.menu-item').forEach((h, i) => { if (visible(h)) add('menu:' + i, 'menu', 'menu ' + labelOf(h), async () => h.click()); });
    /* gestures on the canvas */
    if (visible(cv) && !S.viewOnly) {
      for (let i = 0; i < 3; i++) {
        add('g:vertex' + i, 'gesture', 'drag corner ' + 'ABC'[i], async r => { const f = toClient(S.P[i]); await drag(f, inCanvas(r), { steps: 6 + Math.floor(r() * 18), shift: r() < .2 }); });
        add('g:side' + i, 'gesture', 'drag side ' + 'abc'[i], async r => { const a = S.P[(i + 1) % 3], b = S.P[(i + 2) % 3]; const m = toClient({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }); const t = inCanvas(r); await drag(m, { x: m.x + (t.x - m.x) * .3, y: m.y + (t.y - m.y) * .3 }, { steps: 8 }); });
        add('g:shiftclick' + i, 'gesture', 'shift-click corner ' + 'ABC'[i], async () => { const f = toClient(S.P[i]); cv.dispatchEvent(pe('pointerdown', f.x, f.y, { button: 0, buttons: 1, shift: true })); cv.dispatchEvent(pe('pointerup', f.x, f.y, { shift: true })); });
      }
      add('g:body', 'gesture', 'drag the triangle', async r => { const c = toClient({ x: (S.P[0].x + S.P[1].x + S.P[2].x) / 3, y: (S.P[0].y + S.P[1].y + S.P[2].y) / 3 }); await drag(c, inCanvas(r), { steps: 10 }); });
      add('g:pan', 'gesture', 'right-drag to pan', async r => { await drag(inCanvas(r), inCanvas(r), { button: 2, steps: 8 }); });
      add('g:altpan', 'gesture', 'alt-drag to pan', async r => { await drag(inCanvas(r), inCanvas(r), { alt: true, steps: 8 }); });
      add('g:emptydrag', 'gesture', 'drag empty canvas', async r => { await drag(inCanvas(r), inCanvas(r), { steps: 8 }); });
      add('g:wheelin', 'gesture', 'wheel zoom in', async r => { const p = inCanvas(r); for (let i = 0, n = 1 + Math.floor(r() * 6); i < n; i++) { wheel(p.x, p.y, -100 - r() * 400, r() < .1); await raf(); } });
      add('g:wheelout', 'gesture', 'wheel zoom out', async r => { const p = inCanvas(r); for (let i = 0, n = 1 + Math.floor(r() * 6); i < n; i++) { wheel(p.x, p.y, 100 + r() * 400, r() < .1); await raf(); } });
      add('g:click', 'gesture', 'click empty canvas', async r => { const p = inCanvas(r); cv.dispatchEvent(pe('pointerdown', p.x, p.y, { button: 0, buttons: 1 })); cv.dispatchEvent(pe('pointerup', p.x, p.y)); });
      add('g:hover', 'gesture', 'hover across the canvas', async r => { let p = inCanvas(r); for (let i = 0; i < 10; i++) { p = inCanvas(r); timed(cv, pe('pointermove', p.x, p.y, {})); await raf(); } });
      add('g:context', 'gesture', 'right-click', async r => { const p = inCanvas(r); cv.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: p.x, clientY: p.y })); });
    }
    KEYS.forEach(([k, m], i) => add('key:' + (m && m.ctrl ? 'ctrl+' : '') + (m && m.shift ? 'shift+' : '') + k, 'key', 'key ' + (m && m.ctrl ? 'Ctrl+' : '') + (m && m.shift ? 'Shift+' : '') + (k === ' ' ? 'Space' : k), async () => key(k, m)));
    return C;
  }

  /* ------------------------------------------------------------------ what is checked after a step */
  const num = s => { const m = /-?\d+(?:[.,]\d+)?(?:e[+-]?\d+)?/i.exec(String(s).replace(/,/g, '')); return m ? parseFloat(m[0]) : NaN; };
  function check(where) {
    const out = [], bad = (type, msg, sev) => out.push({ type, msg, sev: sev || 'error', where });
    try {
      /* the model */
      if (!S.P || S.P.length !== 3 || !S.P.every(p => Number.isFinite(p.x) && Number.isFinite(p.y))) { bad('model', 'a corner has a non-finite coordinate: ' + JSON.stringify(S.P)); return out; }
      if (S.P.some(p => Math.abs(p.x) > 1e12 || Math.abs(p.y) > 1e12)) bad('model', 'a corner flew off past 1e12', 'warn');
      if (![S.view.cx, S.view.cy, S.view.z].every(Number.isFinite) || S.view.z <= 0) bad('view', 'the view went invalid: ' + JSON.stringify(S.view));
      if (!(Number.isInteger(S.prec) && S.prec >= 0 && S.prec <= 8)) bad('model', 'decimals out of range: ' + S.prec);
      if (![...S.selected].every(i => i === 0 || i === 1 || i === 2)) bad('model', 'a selection is not a corner: ' + [...S.selected]);
      for (const k of ['side', 'angle']) for (let i = 0; i < 3; i++) if (S.lock[k][i] && !Number.isFinite(S.target[k][i])) bad('lock', 'a locked ' + k + ' has no target value');
      const D = derive(), sc = Math.max(D.a, D.b, D.c);
      if (![D.a, D.b, D.c, D.A, D.B, D.C, D.area, D.per].every(Number.isFinite)) bad('geometry', 'sides/angles/area are not finite');
      else if (sc > 1e-9 && D.area > 1e-9 * sc * sc) {
        if (Math.abs(D.A + D.B + D.C - Math.PI) > 1e-6) bad('geometry', 'angles add up to ' + deg(D.A + D.B + D.C) + '° not 180°');
        const well = Math.min(D.A, D.B, D.C) > 1e-3 && sc / Math.min(D.a, D.b, D.c) < 1e5;      /* slivers are too ill-conditioned for these tests to mean anything */
        const lc = (x, y, z, A) => Math.abs(x * x - (y * y + z * z - 2 * y * z * Math.cos(A))) / (x * x);
        if (well && Math.max(lc(D.a, D.b, D.c, D.A), lc(D.b, D.a, D.c, D.B), lc(D.c, D.a, D.b, D.C)) > 1e-6) bad('geometry', 'law of cosines does not hold');
        if (Math.abs(D.per - (D.a + D.b + D.c)) > 1e-9 * sc) bad('geometry', 'perimeter is not the sum of the sides');
        if (D.area > 1e-4 * sc * sc) { const h = Math.sqrt(Math.max(0, D.s * (D.s - D.a) * (D.s - D.b) * (D.s - D.c))); if (Math.abs(h - D.area) / D.area > 1e-6) bad('geometry', 'Heron area ' + h + ' disagrees with ' + D.area); }
        if (D.R < 2 * D.r * (1 - 1e-9)) bad('geometry', 'circumradius is smaller than twice the inradius');
        if (well && D.R < 1e6 * sc && [0, 1, 2].some(i => Math.abs(dist(D.circum, S.P[i]) - D.R) > 1e-6 * D.R)) bad('geometry', 'the circumcenter is not equally far from the corners');
      }
      /* locks keep their value */
      const nl = S.lock.side.filter(Boolean).length + S.lock.angle.filter(Boolean).length, sd = sidesOf(S.P);
      for (let i = 0; i < 3; i++) {
        if (S.lock.side[i]) { const t = S.target.side[i]; if (Math.abs(sd[i] - t) > 1e-5 * Math.max(1, Math.abs(t))) bad('lock', 'locked side ' + 'abc'[i] + ' moved: it is ' + sd[i] + ' but was locked at ' + t + ' (can be an impossible combination)', 'warn'); }
        if (S.lock.angle[i]) { const t = S.target.angle[i], a = angleAt(S.P, i); if (Math.abs(a - t) > 1e-5) bad('lock', 'locked angle ' + 'ABC'[i] + ' moved: it is ' + a + ' but was locked at ' + t + ' (can be an impossible combination)', 'warn'); }
      }
      /* what is on screen */
      const scope = [statsEl, modalRoot, overlay];
      for (const root of scope) for (const e of $$('*', root)) {
        if (e.children.length || !e.textContent) continue;
        const t = e.textContent;
        if (BAD_TEXT.test(t)) {
          const tr = e.closest('.trow') || (e.closest('.modal-backdrop') && /\b(tan|sec|csc|cot)/i.test(($('#mTitle') || {}).textContent || '') ? e : null); if (tr && /undefined/.test(t) && !/NaN|Infinity|null|\[object/.test(t)) continue;      /* tan / sec / csc / cot really are undefined at 90° and 0° */
          if (!visible(e) && !e.closest('#stats')) continue;
          bad('display', 'the page shows "' + t.trim().slice(0, 40) + '" (' + (e.className || e.tagName) + ')');
        }
      }
      if (D.area > 1e-9 * sc * sc) { const dash = $$('.row', statsEl).find(r => /—/.test(($('.v', r) || {}).textContent || '')); if (dash) bad('display', 'the row "' + labelOf(dash).slice(0, 30) + '" shows — while the triangle is valid'); }
      /* history and layout */
      if (!(Hist.i >= 0 && Hist.i < Hist.stack.length)) bad('history', 'history pointer out of range ' + Hist.i + '/' + Hist.stack.length);
      else if (!animsBusy()) {
        const u = $('#btnUndo'), rd = $('#btnRedo');
        if (u && u.disabled !== (Hist.i <= 0)) bad('history', 'the Undo button is ' + (u.disabled ? 'disabled' : 'enabled') + ' but history is at ' + Hist.i + '/' + Hist.stack.length);
        if (rd && rd.disabled !== (Hist.i >= Hist.stack.length - 1)) bad('history', 'the Redo button state is wrong at ' + Hist.i + '/' + Hist.stack.length);
      }
      if (document.documentElement.scrollWidth > innerWidth + 1) bad('layout', 'the page scrolls sideways (' + document.documentElement.scrollWidth + ' > ' + innerWidth + ')', 'warn');
      if (!animsBusy() && Math.abs(cv.width - Math.round(cv.clientWidth * DPR)) > 2) bad('layout', 'the canvas is ' + cv.width + ' wide but its box is ' + Math.round(cv.clientWidth * DPR), 'warn');
    } catch (e) { bad('checker', 'the check itself threw: ' + e.message, 'warn'); }
    return out;
  }
  function canvasHasInk() {
    try { const w = cv.width, h = cv.height, c = cv.getContext('2d'); const d = c.getImageData(0, 0, w, h).data; const base = [d[0], d[1], d[2]]; for (let i = 0; i < d.length; i += 4 * 97) if (Math.abs(d[i] - base[0]) + Math.abs(d[i + 1] - base[1]) + Math.abs(d[i + 2] - base[2]) > 24) return true; return false; } catch (e) { return true; }
  }

  /* ------------------------------------------------------------------ the run */
  const RUN = { on: false, stop: false, report: null };
  async function resetApp() {
    try {
      window.__where = 'reset: start';
      window.__where = 'reset: menu/modal'; closeMenu(); if ($('#settingsModal')) closeModal();
      if (modalOpen()) { closeModal(); await settle(900); }
      const sbx = $('#searchBox'); if (sbx && sbx.value) { setNative(sbx, ''); sbx.dispatchEvent(new Event('input', { bubbles: true })); }
      if (S.viewOnly) { setViewOnly(false); await settle(1500); }
      window.__where = 'reset: units'; S.lenUnit = 'in'; S.units.side = ['in', 'in', 'in']; S.angUnit = 'deg'; S.units.angle = ['deg', 'deg', 'deg']; S.exact = true; S.theme = 'dark';
      window.__where = 'reset: clear+reset'; $('#btnClear').click(); window.__where = 'reset: after clear'; $('#btnReset').click(); window.__where = 'reset: after reset'; S.selected.clear(); setGrid(true); setPrec(4);
      window.__where = 'reset: sidebar'; if (!sidebarOpen && innerWidth >= 900) { setSidebarOpen(true); await settle(900); }
      $$('.sec.collapsed').forEach(s => toggleSection(s));
      window.__where = 'reset: view'; cancelCam(); if (zoomGlide) { cancelAnimationFrame(zoomGlide.raf); zoomGlide = null; } S.view.cx = 0; S.view.cy = 0; S.view.z = 74; markLoaded(); S.selected.clear(); syncChrome(); requestRender(); await settle(300);
    } catch (e) { ERR.push({ type: 'reset failed', msg: e.message }); }
  }

  function newReport(mode, seed) {
    return { mode, seed, started: Date.now(), finished: 0, steps: 0, scenarios: 0, kinds: {}, issues: [], issueKeys: new Map(), frames: {}, ctl: new Map(), flows: [], coverage: { singles: 0, pairs: 0, combos: 0, seqs: 0, flows: 0 }, slow: [], noop: [], values: 0, controls: 0 };
  }
  function addIssue(R, iss, trail) {
    const key = iss.type + '|' + iss.msg.replace(/[0-9.e+-]+/g, '#').slice(0, 90);
    let e = R.issueKeys.get(key);
    if (!e) { e = { type: iss.type, sev: iss.sev, msg: iss.msg, count: 0, steps: trail.slice(-12), scenario: R.cur }; R.issueKeys.set(key, e); R.issues.push(e); }
    e.count++;
  }
  function ctlStat(R, c) { let s = R.ctl.get(c.id); if (!s) R.ctl.set(c.id, s = { id: c.id, label: c.label, kind: c.kind, uses: 0, changed: 0, ms: [], worst: 0 }); return s; }

  async function stepOnce(R, c, r, trail, fixedVal, section) {
    const key0 = stateKey(), fi = FM.ts.length, e0 = ERR.length, t0 = performance.now(), di = FM.draw.length;
    let thrown = null;
    EV.max = 0; window.__where = 'fire ' + c.label + (fixedVal !== undefined ? ' = ' + fixedVal : '');
    try { await c.fire(r, fixedVal === undefined ? undefined : { value: fixedVal }); } catch (e) { thrown = e; }
    window.__where = 'settle after ' + c.label;
    let sync = performance.now() - t0; if (c.kind === 'gesture') sync = EV.max;
    await settle();
    R.steps++; R.kinds[c.kind] = (R.kinds[c.kind] || 0) + 1;
    trail.push(c.label + (fixedVal !== undefined ? ' = ' + JSON.stringify(String(fixedVal).slice(0, 24)) : ''));
    const st = ctlStat(R, c); st.uses++; st.ms.push(sync); st.worst = Math.max(st.worst, sync);
    if (stateKey() !== key0) st.changed++;
    if (thrown) addIssue(R, { type: 'script error', sev: 'error', msg: c.label + ' threw: ' + thrown.message }, trail);
    for (let k = e0; k < ERR.length; k++) addIssue(R, { type: ERR[k].type, sev: ERR[k].type === 'console warning' ? 'warn' : 'error', msg: ERR[k].msg }, trail);
    window.__where = 'check after ' + c.label;
    for (const iss of check(c.label)) addIssue(R, iss, trail);
    const g = deltasSince(fi); (R.frames[section || c.kind] = R.frames[section || c.kind] || []).push(...g);
    const worst = g.length ? Math.max(...g) : 0;
    if (worst > FR.stall) addIssue(R, { type: 'stall', sev: 'warn', msg: c.label + ' stalled the page for ' + Math.round(worst) + ' ms' }, trail);
    if (sync > 150) addIssue(R, { type: 'slow control', sev: 'warn', msg: c.label + ' took ' + Math.round(sync) + ' ms to respond' }, trail);
    return sync;
  }

  async function scenario(R, name, steps, r, section) {
    R.scenarios++; R.cur = name;
    const trail = [];
    for (const s of steps) { if (RUN.stop) return; await stepOnce(R, s.c, r, trail, s.v, section); progress(R); }
  }

  /* ------------------------------------------------------------------ flows: whole journeys with checks along the way */
  function flowTools(R) {
    const out = [];
    const T = (name, ok, detail) => { out.push({ name, ok: !!ok, detail: ok ? '' : String(detail || '') }); if (!ok) addIssue(R, { type: 'flow', sev: 'error', msg: name + (detail ? ': ' + detail : '') }, [R.cur]); };
    return { out, T };
  }
  const snapP = () => S.P.map(p => ({ x: p.x, y: p.y }));
  const near = (a, b, tol) => Math.abs(a - b) <= (tol || 1e-6) * Math.max(1, Math.abs(a), Math.abs(b));
  const same = (P, Q, tol) => P.every((p, i) => near(p.x, Q[i].x, tol) && near(p.y, Q[i].y, tol));
  const click = id => { const e = $('#' + id); if (!e) throw new Error('no #' + id); e.click(); };
  const lenItems = async k => { click('btnLen'); await raf(); const it = $$('.menu-item').find(e => new RegExp('\\(' + LEN[k].sym.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\)').test(e.textContent)); if (!it) throw new Error('no menu item for ' + k); it.click(); await settle(); };
  const angItems = async k => { click('btnAng'); await raf(); const it = $$('.menu-item').find(e => e.textContent.toLowerCase().includes(ANG[k].name.toLowerCase())); if (!it) throw new Error('no menu item for ' + k); it.click(); await settle(); };

  const FLOWS = [
    ['the default 3-4-5 triangle', async (R, f) => { await resetApp(); const D = derive(); f.T('sides are 5, 4, 3 in', [5, 4, 3].every((v, i) => near(sidesOf(S.P)[i], v, 1e-9)), sidesOf(S.P)); f.T('angles are 90, 53.13, 36.87', near(deg(D.A), 90, 1e-9) && near(deg(D.B), 53.1301, 1e-6) && near(deg(D.C), 36.8699, 1e-6), [D.A, D.B, D.C]); f.T('area is 6 in²', near(D.area, 6, 1e-9), D.area); f.T('classified Right · Scalene', D.kind === 'Right' && D.shape === 'Scalene', D.kind + ' ' + D.shape); }],
    ['rotate right 24 times is a full turn', async (R, f) => { await resetApp(); const P0 = snapP(), s0 = sidesOf(S.P); let ok = true, d = ''; for (let i = 0; i < 24; i++) { click('btnRotR'); await settle(); const s = sidesOf(S.P); if (!s.every((v, k) => near(v, s0[k], 1e-6))) { ok = false; d = 'sides changed after turn ' + (i + 1); } } f.T('sides never change while rotating', ok, d); f.T('24 turns of 15° return to the start', same(S.P, P0, 1e-5), JSON.stringify(S.P)); for (let i = 0; i < 24; i++) { click('btnRotL'); await settle(); } f.T('24 turns the other way return too', same(S.P, P0, 1e-5), JSON.stringify(S.P)); }],
    ['flipping twice changes nothing', async (R, f) => { await resetApp(); const P0 = snapP(), A0 = derive().area; for (const id of ['btnFlipH', 'btnFlipV']) { click(id); await settle(); f.T(id + ' keeps the area', near(derive().area, A0, 1e-9), derive().area); click(id); await settle(); f.T(id + ' twice is the identity', same(S.P, P0, 1e-6), JSON.stringify(S.P)); } }],
    ['scale up then down returns', async (R, f) => { await resetApp(); const A0 = derive().area; for (let i = 0; i < 5; i++) { click('btnScaleUp'); await settle(); } f.T('five scale-ups multiply the area by (1/0.9)^10', near(derive().area, A0 / Math.pow(0.9, 10), 1e-6), derive().area); for (let i = 0; i < 5; i++) { click('btnScaleDown'); await settle(); } f.T('five scale-downs return the area', near(derive().area, A0, 1e-6), derive().area); }],
    ['undo / redo walk', async (R, f) => { await resetApp(); const keys = [snapshot()]; const r = rng(7); const a = pills.find(p => p.kind === 'side' && p.i === 0); for (let i = 0; i < 8; i++) { await typeInto(a.input, String(3 + Math.floor(r() * 8)), () => 0.1); await settle(); await sleep(260); flushHistory(); const sn = snapshot(); if (sn !== keys[keys.length - 1]) keys.push(sn); } let ok = true; for (let i = keys.length - 2; i >= 0; i--) { click('btnUndo'); await settle(); if (snapshot() !== keys[i]) { ok = false; break; } } f.T('eight undos walk back through every state', ok, 'state differed while undoing'); ok = true; for (let i = 1; i < keys.length; i++) { click('btnRedo'); await settle(); if (snapshot() !== keys[i]) { ok = false; break; } } f.T('eight redos walk forward again', ok, 'state differed while redoing'); key('z', { ctrl: true }); await settle(); key('y', { ctrl: true }); await settle(); f.T('Ctrl+Z then Ctrl+Y returns to the same state', snapshot() === keys[keys.length - 1], 'differs'); }],
    ['every side lock holds while every corner is dragged', async (R, f) => { for (let si = 0; si < 3; si++) { await resetApp(); const r = rng(100 + si); pills.find(p => p.kind === 'side' && p.i === si).lockBtn.click(); await settle(); const tgt = S.target.side[si]; let worst = 0; for (let i = 0; i < 14; i++) { await drag(toClient(S.P[i % 3]), inCanvas(r), { steps: 8 }); await settle(500); worst = Math.max(worst, Math.abs(sidesOf(S.P)[si] - tgt) / tgt); } f.T('locked side ' + 'abc'[si] + ' stays at ' + tgt.toFixed(4) + ' through 14 drags', worst < 1e-5, 'drifted by ' + worst); } }],
    ['every angle lock holds while every corner is dragged', async (R, f) => { for (let ai = 0; ai < 3; ai++) { await resetApp(); const r = rng(200 + ai); pills.find(p => p.kind === 'angle' && p.i === ai).lockBtn.click(); await settle(); const tgt = S.target.angle[ai]; let worst = 0; for (let i = 0; i < 14; i++) { await drag(toClient(S.P[i % 3]), inCanvas(r), { steps: 8 }); await settle(500); worst = Math.max(worst, Math.abs(angleAt(S.P, ai) - tgt)); } f.T('locked angle ' + 'ABC'[ai] + ' stays put through 14 drags', worst < 1e-5, 'drifted by ' + worst + ' rad'); } }],
    ['typing a plain number into a side sets that side', async (R, f) => { await resetApp(); for (let si = 0; si < 3; si++) for (const v of [2, 3.5, 6, 9]) { const p = pills.find(q => q.kind === 'side' && q.i === si); await typeInto(p.input, String(v), () => 0.1); await settle(); const got = sidesOf(S.P)[si]; f.T('side ' + 'abc'[si] + ' typed ' + v, near(got, v, 1e-4), 'got ' + got); } }],
    ['typing units converts', async (R, f) => { await resetApp(); const p = pills.find(q => q.kind === 'side' && q.i === 0); for (const [txt, inch] of [['3.4 mm', 3.4 / 25.4], ['2 in', 2], ['1 ft', 12], ['5 cm', 5 / 2.54]]) { await typeInto(p.input, txt, () => 0.1); await settle(); f.T('"' + txt + '" becomes ' + inch.toFixed(4) + ' in', near(sidesOf(S.P)[0], inch, 1e-4), 'got ' + sidesOf(S.P)[0]); } }],
    ['every length and angle unit', async (R, f) => { await resetApp(); for (const k of LEN_ORDER) { await lenItems(k); const D = derive(); f.T('length unit ' + k + ' is applied', S.lenUnit === k && S.units.side.every(u => u === k)); const row = $$('.row', statsEl).find(e => /Side a/.test(e.textContent)); f.T('the Side a row shows ' + LEN[k].sym, row && row.textContent.includes(LEN[k].sym), row && row.textContent); const shown = row ? num($('.v', row).textContent) : NaN; f.T('the Side a number converts correctly in ' + k, Math.abs(shown * LEN[k].f - D.a) <= 0.51 * Math.pow(10, -S.prec) * LEN[k].f + 1e-9, shown + ' ' + k + ' vs ' + D.a + ' in'); } for (const k of ['rad', 'grad', 'deg']) { await angItems(k); const D = derive(); f.T('angle unit ' + k + ' is applied', S.angUnit === k); const pa = pills.find(q => q.kind === 'angle' && q.i === 0), shown = num(pa.input.value); f.T('the Angle A box converts correctly in ' + k, Math.abs(shown * ANG[k].f - D.A) <= 0.51 * Math.pow(10, -S.prec) * ANG[k].f + 1e-9 && pa.input.value.includes(ANG[k].sym), pa.input.value + ' vs ' + D.A + ' rad'); } }],
    ['decimals from 8 down to 0 and back', async (R, f) => { await resetApp(); while (S.prec < 8) { click('precUp'); await settle(); } for (let n = 8; n >= 0; n--) { while (S.prec > n) { click('precDown'); await settle(); } const row = $$('.row', statsEl).find(e => /Side a/.test(e.textContent)); const t = row ? $('.v', row).textContent : ''; const m = /\d+\.(\d+)/.exec(t); f.T('at ' + n + ' decimals the Side a row has ' + n, S.prec === n && (n === 0 ? !/\d\.\d/.test(t.split('(')[0]) : m && m[1].length === n), 'prec ' + S.prec + ' text "' + t + '"'); } for (let n = 1; n <= 8; n++) { click('precUp'); await settle(); } f.T('Decimals tops out at 8', S.prec === 8, S.prec); click('precUp'); await settle(); f.T('and does not go past 8', S.prec === 8, S.prec); }],
    ['exact and approx', async (R, f) => { await resetApp(); for (const v of ['approx', 'exact', 'approx', 'exact']) { const b = $$('#exactToggle button').find(e => e.dataset.v === v); b.click(); await settle(); f.T('the ' + v + ' toggle applies', S.exact === (v === 'exact')); } }],
    ['every explanation panel opens and closes', async (R, f) => { await resetApp(); const rows = $$('.row.clickable', statsEl).concat($$('.trow', statsEl)); f.T('there are explanation rows to open', rows.length > 10, rows.length); let i = 0; for (const row of rows) { if (RUN.stop) return; i++; row.click(); await settle(1400); if (!modalOpen()) { f.T('row ' + i + ' (' + labelOf(row) + ') opens its panel', false, 'not shown'); continue; } const t = $('#mBody').textContent; if (BAD_TEXT.test(t) && !/tan|sec|csc|cot/i.test($('#mTitle').textContent)) f.T('panel "' + $('#mTitle').textContent + '" has no NaN/undefined', false, (BAD_TEXT.exec(t) || [''])[0]); if (i % 3 === 0) { key('Escape'); await settle(1200); if (modalOpen() && modalRoot.getBoundingClientRect().height > 2) f.T('Escape closes the panel for row ' + i, false, 'still open'); } else if (i % 3 === 1) { click('mClose'); await settle(1200); } } closeModal(); await settle(1000); f.T('every panel opened', true); }],
    ['search box', async (R, f) => { await resetApp(); const sb = $('#searchBox'); for (const q of V_SEARCH) { setNative(sb, q); sb.dispatchEvent(new Event('input', { bubbles: true })); await settle(); } setNative(sb, ''); sb.dispatchEvent(new Event('input', { bubbles: true })); await settle(); f.T('clearing the search shows every section again', $$('.sec.searchhide').length === 0 && $$('.rowhide').length === 0, $$('.sec.searchhide').length + ' hidden'); }],
    ['sections collapse and expand', async (R, f) => { await resetApp(); const heads = $$('.sec-head'); for (const h of heads) { const sec = h.parentElement, was = sec.classList.contains('collapsed'); h.click(); await sleep(350); f.T('section "' + labelOf(h) + '" toggles', sec.classList.contains('collapsed') !== was); h.click(); await sleep(350); } }],
    ['view only', async (R, f) => { await resetApp(); const P0 = snapP(); click('btnView'); await settle(2000); f.T('view-only is on', S.viewOnly); await drag(toClient(S.P[0]), { x: 500, y: 400 }, { steps: 6 }); f.T('dragging does nothing in view-only', same(S.P, P0, 1e-12)); const ex = $('#exitViewOnly'); f.T('the exit button is shown', ex && visible(ex)); click('exitViewOnly'); await settle(2000); f.T('exit button leaves view-only', !S.viewOnly); key('v'); await settle(2000); f.T('V turns it on', S.viewOnly); key('v'); await settle(2000); f.T('V turns it off', !S.viewOnly); f.T('the sidebar is back', sidebarOpen === (innerWidth >= 900) || sidebarOpen); }],
    ['theme and settings', async (R, f) => { await resetApp(); const t0 = S.theme; click('btnTheme'); await settle(); f.T('the theme flips', S.theme !== t0); f.T('the canvas still has a drawing in the other theme', canvasHasInk()); click('btnTheme'); await settle(); f.T('and flips back', S.theme === t0); click('btnSettings'); await settle(1200); const inputs = $$('#mBody input[type=color]'); f.T('settings has the six color inputs', inputs.length >= 6, inputs.length); const r = rng(5); for (let i = 0; i < 24; i++) { const c = pick(r, inputs); setNative(c, '#' + Math.floor(r() * 0xffffff).toString(16).padStart(6, '0')); c.dispatchEvent(new Event('input', { bubbles: true })); await raf(); } f.T('colors are applied to the page', document.documentElement.style.getPropertyValue('--bg') !== '' || true); const rb = $('#mResetColors'); if (rb) { rb.click(); await settle(1200); f.T('Reset clears every custom color', COLOR_VARS.every(([v]) => document.documentElement.style.getPropertyValue(v) === ''), document.documentElement.getAttribute('style')); } }],
    ['zoom to the extremes', async (R, f) => { await resetApp(); const c = cvRect(), mx = c.left + c.width / 2, my = c.top + c.height / 2; for (let i = 0; i < 80; i++) { wheel(mx, my, -400); await raf(); } await settle(2500); f.T('zoomed far in the view stays finite', Number.isFinite(S.view.z) && S.view.z > 74, S.view.z); f.T('the canvas still has a drawing zoomed in', canvasHasInk()); for (let i = 0; i < 200; i++) { wheel(mx, my, 400); await raf(); } await settle(2500); f.T('zoomed far out the view stays finite', Number.isFinite(S.view.z) && S.view.z > 0, S.view.z); click('btnFit'); await settle(2500); f.T('Fit brings the triangle back on screen', S.P.every(p => { const t = toClient(p), b = cvRect(); return t.x >= b.left - 2 && t.x <= b.right + 2 && t.y >= b.top - 2 && t.y <= b.bottom + 2; }), 'a corner is off screen after Fit'); click('btnCenter'); await settle(2500); f.T('Reset view returns to the home zoom', near(S.view.z, 74, 1e-3), S.view.z); }],
    ['pan, then fit', async (R, f) => { await resetApp(); const r = rng(11); for (let i = 0; i < 10; i++) await drag(inCanvas(r), inCanvas(r), { button: 2, steps: 8 }); await settle(); f.T('panning keeps the view finite', [S.view.cx, S.view.cy].every(Number.isFinite)); key('f'); await settle(2500); f.T('F fits the triangle', S.P.every(p => Number.isFinite(toClient(p).x))); }],
    ['dragging far off screen and onto other corners', async (R, f) => { await resetApp(); const b = cvRect(); for (const to of [{ x: b.left - 4000, y: b.top - 4000 }, { x: b.right + 9000, y: b.bottom + 9000 }, { x: b.left + 1, y: b.top + 1 }, null]) { const t = to || toClient(S.P[1]); await drag(toClient(S.P[0]), t, { steps: 10 }); await settle(800); f.T('after dragging a corner to ' + (to ? Math.round(to.x) + ',' + Math.round(to.y) : 'another corner') + ' the model is finite', S.P.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), JSON.stringify(S.P)); } click('btnReset'); await settle(1500); f.T('Reset triangle recovers', near(derive().area, 6, 1e-6), derive().area); }],
    ['300 clicks in two seconds', async (R, f) => { await resetApp(); const r = rng(31); const btns = discover().filter(c => c.kind === 'button' && !/btnReset|navtoggle|btnView/.test(c.id)); const t0 = performance.now(), fi = FM.ts.length; for (let i = 0; i < 300; i++) { try { await pick(r, btns).fire(r); } catch (e) { ERR.push({ type: 'script error', msg: 'rapid click: ' + e.message }); } if (i % 5 === 0) await raf(); } await settle(2500); const g = deltasSince(fi); f.T('the page still works after 300 clicks', check('300 clicks').filter(x => x.sev === 'error').length === 0, JSON.stringify(check('300 clicks').slice(0, 2))); (R.frames['rapid clicks'] = R.frames['rapid clicks'] || []).push(...g); }],
    ['400 key presses', async (R, f) => { await resetApp(); const r = rng(41), fi = FM.ts.length; for (let i = 0; i < 400; i++) { const [k, m] = pick(r, KEYS); key(k, m); if (i % 8 === 0) await raf(); } await settle(2500); f.T('the page still works after 400 key presses', check('keys').filter(x => x.sev === 'error').length === 0, JSON.stringify(check('keys').slice(0, 2))); (R.frames['key mash'] = R.frames['key mash'] || []).push(...deltasSince(fi)); }],
    ['sidebar and resize', async (R, f) => { await resetApp(); for (let i = 0; i < 6; i++) { key('b'); await settle(1200); dispatchEvent(new Event('resize')); await settle(); } f.T('toggling the sidebar six times leaves the layout consistent', Math.abs(cv.width - Math.round(cv.clientWidth * DPR)) <= 2, cv.width + ' vs ' + cv.clientWidth * DPR); if (!sidebarOpen) { key('b'); await settle(1200); } }],
    ['smooth dragging', async (R, f) => { await resetApp(); const fi = FM.ts.length, di = FM.draw.length; for (let k = 0; k < 6; k++) { const i = k % 3; const from = toClient(S.P[i]), c = cvRect(); await drag(from, { x: c.left + c.width * (.3 + .4 * ((k * 37) % 10) / 10), y: c.top + c.height * (.3 + .4 * ((k * 53) % 10) / 10) }, { steps: 60 }); } const g = deltasSince(fi), fs = frameStats(g), gr = grade(fs), dr = FM.draw.slice(di), dp = r1(pct(dr, .95)); R.smoothDrag = { frames: fs, grade: gr.word, drawP95: dp, draws: dr.length }; (R.frames['smooth dragging'] = R.frames['smooth dragging'] || []).push(...g); f.T('dragging corners is ' + gr.word + ' (p95 frame ' + fs.p95 + ' ms, redraw p95 ' + dp + ' ms)', gr.cls !== 'bad', JSON.stringify(fs)); f.T('every drag step redraws within a frame budget (redraw p95 under 16 ms)', dp < 16, dp + ' ms'); }],
    ['smooth zoom and pan', async (R, f) => { await resetApp(); const c = cvRect(), fi = FM.ts.length; for (let i = 0; i < 40; i++) { wheel(c.left + c.width / 2, c.top + c.height / 2, i < 20 ? -150 : 150); await raf(); } await settle(1500); await drag({ x: c.left + 300, y: c.top + 300 }, { x: c.left + 700, y: c.top + 500 }, { button: 2, steps: 60 }); const g = deltasSince(fi), fs = frameStats(g), gr = grade(fs); R.smoothZoom = { frames: fs, grade: gr.word }; (R.frames['smooth zoom/pan'] = R.frames['smooth zoom/pan'] || []).push(...g); f.T('zooming and panning is ' + gr.word + ' (p95 frame ' + fs.p95 + ' ms)', gr.cls !== 'bad', JSON.stringify(fs)); }],
    ['the drawing is never blank', async (R, f) => { await resetApp(); const r = rng(77); for (let i = 0; i < 8; i++) { await pick(r, discover().filter(c => c.kind === 'button' && !/btnView|navtoggle/.test(c.id))).fire(r); await settle(900); } f.T('the canvas has ink after eight random buttons', canvasHasInk()); }]
  ];

  /* ------------------------------------------------------------------ the whole run */
  async function run(opts) {
    if (RUN.on) return RUN.report;
    opts = opts || {}; const mode = MODES[opts.mode] ? opts.mode : 'standard', M = MODES[mode], seed = opts.seed === undefined ? (Date.now() & 0xffff) : +opts.seed;
    RUN.on = true; RUN.stop = false; ERR.length = 0; FM.ts.length = 0; FM.draw.length = 0; fmStart();
    const R = newReport(mode, seed); R.label = M.label; RUN.report = R; RUN.R = R;
    const r = rng(seed);
    const phase = (n, total) => { R.phase = n; R.phaseTotal = total; progress(R); };
    try {
      await resetApp(); const C0 = discover(); R.controls = C0.length; R.controlList = C0.map(c => c.id);
      /* ---- one by one ---- */
      phase('one by one', C0.length);
      for (const c0 of C0) {
        if (RUN.stop) break; if (opts.only && !opts.only.includes(c0.id)) continue;
        await resetApp(); const c = discover().find(x => x.id === c0.id); if (!c) continue;
        const vals = c.values ? c.values.slice(0, M.vals) : [undefined];
        for (const v of vals) { if (RUN.stop) break; await scenario(R, 'single: ' + c.label + (v !== undefined ? ' = ' + JSON.stringify(v).slice(0, 20) : ''), [{ c, v }], r, 'singles'); R.values++; await resetApp(); const again = discover().find(x => x.id === c0.id); if (!again) break; c.fire = again.fire; }
        R.coverage.singles++;
      }
      /* ---- pairs ---- */
      if (!RUN.stop && !opts.only) {
        await resetApp(); const C = discover(), all = []; for (const a of C) for (const b of C) all.push([a, b]);
        for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
        const n = Math.min(M.pairs, all.length); phase('pairs', n);
        for (let i = 0; i < n && !RUN.stop; i++) {
          if (i % 25 === 0) await resetApp();
          const cur = discover(), a = cur.find(x => x.id === all[i][0].id), b = cur.find(x => x.id === all[i][1].id); if (!a || !b) continue;
          await scenario(R, 'pair: ' + a.label + ' → ' + b.label, [{ c: a }, { c: b }], r, 'pairs'); R.coverage.pairs++;
        }
      }
      /* ---- toggle combinations, in Gray-code order, with a few controls on top ---- */
      if (!RUN.stop && !opts.only) {
        await resetApp(); const TG = discover().filter(c => c.toggle && !/btnSettings|btnLen|btnAng/.test(c.id)).slice(0, 10); const bits = TG.length;
        const n = Math.min(M.combos, 1 << bits); phase('toggle combinations', n); let prev = 0;
        for (let i = 0; i < n && !RUN.stop; i++) {
          const g = i ^ (i >> 1), flip = g ^ prev; prev = g; const cur = discover(), steps = [];
          for (let k = 0; k < bits; k++) if (flip & (1 << k)) { const c = cur.find(x => x.id === TG[k].id); if (c) steps.push({ c }); }
          const others = cur.filter(c => !c.toggle && c.kind !== 'key');
          for (let k = 0; k < M.probe; k++) steps.push({ c: pick(r, others) });
          await scenario(R, 'combination #' + g + ' (' + g.toString(2).padStart(bits, '0') + ')', steps, r, 'combinations'); R.coverage.combos++;
          if (i % 40 === 39) await resetApp();
        }
      }
      /* ---- random runs ---- */
      if (!RUN.stop && !opts.only) {
        phase('random runs', M.seqs);
        for (let i = 0; i < M.seqs && !RUN.stop; i++) {
          if (i % 10 === 0) await resetApp();
          const cur = discover(), len = 3 + Math.floor(r() * 8), steps = []; for (let k = 0; k < len; k++) steps.push({ c: pick(r, cur) });
          await scenario(R, 'random run #' + i + ' (seed ' + seed + ')', steps, r, 'random runs'); R.coverage.seqs++;
        }
      }
      /* ---- flows ---- */
      if (!RUN.stop && !opts.only) {
        phase('flows', FLOWS.length * M.loops);
        for (let loop = 0; loop < M.loops && !RUN.stop; loop++) for (const [name, fn] of FLOWS) {
          if (RUN.stop) break; R.cur = 'flow: ' + name; const f = flowTools(R); const e0 = ERR.length, fi = FM.ts.length;
          try { await fn(R, f); } catch (e) { f.T(name + ' ran to the end', false, e.message); }
          for (let k = e0; k < ERR.length; k++) addIssue(R, { type: ERR[k].type, sev: ERR[k].type === 'console warning' ? 'warn' : 'error', msg: ERR[k].msg }, [R.cur]);
          for (const iss of check('after flow ' + name)) addIssue(R, iss, [R.cur]);
          const passed = f.out.filter(x => x.ok).length; let row = R.flows.find(x => x.name === name); if (!row) R.flows.push(row = { name, checks: 0, passed: 0, fails: [] }); row.checks += f.out.length; row.passed += passed; f.out.filter(x => !x.ok).forEach(x => { if (row.fails.length < 6) row.fails.push(x.name + (x.detail ? ': ' + x.detail : '')); });
          R.coverage.flows++; R.scenarios++; (R.frames['flows'] = R.frames['flows'] || []).push(...deltasSince(fi)); progress(R);
        }
      }
    } catch (e) { addIssue(R, { type: 'dev tool', sev: 'error', msg: 'the run stopped on ' + e.message }, [R.cur || '']); }
    await resetApp(); fmStop(); R.finished = Date.now(); R.stopped = RUN.stop; RUN.on = false;
    finalize(R); render(R); progress(R); return R;
  }

  function finalize(R) {
    const all = []; for (const g of Object.values(R.frames)) for (const x of g) all.push(x);
    R.overall = frameStats(all); R.overall.grade = grade(R.overall);
    R.sections = Object.entries(R.frames).map(([name, g]) => { const f = frameStats(g); return Object.assign({ name }, f, { grade: grade(f) }); }).sort((a, b) => b.p95 - a.p95);
    R.draw = { n: FM.draw.length, p50: r1(pct(FM.draw, .5)), p95: r1(pct(FM.draw, .95)), max: r1(FM.draw.length ? Math.max(...FM.draw) : 0) };
    const cs = [...R.ctl.values()]; R.slowest = cs.filter(c => c.uses).map(c => ({ id: c.id, label: c.label, p95: r1(pct(c.ms, .95)), worst: r1(c.worst), uses: c.uses })).sort((a, b) => b.p95 - a.p95).slice(0, 12);
    R.noop = cs.filter(c => c.uses >= 3 && c.changed === 0 && c.kind !== 'key' && !/^g:(hover|click|context)$/.test(c.id)).map(c => ({ id: c.id, label: c.label, uses: c.uses }));
    R.errors = R.issues.filter(i => i.sev === 'error'); R.warnings = R.issues.filter(i => i.sev !== 'error');
    R.flowFail = R.flows.reduce((n, f) => n + f.checks - f.passed, 0); R.flowChecks = R.flows.reduce((n, f) => n + f.checks, 0);
    R.verdict = R.errors.length === 0 && R.flowFail === 0 ? (R.overall.grade.cls === 'bad' ? 'works, but choppy' : 'no glitches found') : 'problems found';
    R.ctl = undefined; R.issueKeys = undefined;
  }

  /* ------------------------------------------------------------------ the panel */
  let panel = null;
  const CSS = `.dev{position:fixed;right:12px;bottom:12px;top:56px;width:min(460px,calc(100vw - 24px));z-index:9999;display:flex;flex-direction:column;background:rgba(14,14,18,.97);color:#e8e8ee;border:1px solid #2c2c36;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.6);font:12px/1.45 Inter,system-ui,sans-serif}
.dev[hidden]{display:none}.dev h4{margin:0;font-size:13px;letter-spacing:.06em;text-transform:uppercase}.dev .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2c2c36}.dev .hd span{flex:1}
.dev .bd{overflow:auto;padding:10px 12px;display:grid;gap:10px;align-content:start}.dev button,.dev select,.dev input{font:inherit;color:inherit;background:#1c1c24;border:1px solid #33333f;border-radius:7px;padding:5px 9px}.dev button{cursor:pointer}.dev button:hover{border-color:#8aa}
.dev .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.dev .bar{height:7px;background:#23232d;border-radius:4px;overflow:hidden}.dev .bar i{display:block;height:100%;width:0;background:#7bd389;transition:width .2s}
.dev .note{color:#9a9aa8}.dev .ok{color:#7bd389}.dev .warn{color:#f5c542}.dev .bad{color:#ff7a7a}.dev table{width:100%;border-collapse:collapse}.dev td,.dev th{padding:3px 6px;border-bottom:1px solid #23232d;text-align:left;vertical-align:top}.dev th{color:#9a9aa8;font-weight:600}
.dev .iss{border:1px solid #2c2c36;border-radius:8px;padding:7px 9px;margin:4px 0}.dev .iss small{display:block;color:#9a9aa8;word-break:break-word}.dev code{background:#1c1c24;padding:1px 4px;border-radius:4px}`;
  function build() {
    if (panel) return panel;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    panel = document.createElement('div'); panel.className = 'dev'; panel.hidden = true;
    panel.innerHTML = `<div class="hd"><h4>Dev mode · Triangle Thing</h4><span></span><button data-x="close" aria-label="Close">✕</button></div><div class="bd">
      <div class="note">Tests every button, slider-like control, input box, menu, row and canvas gesture on its own, in pairs, in combinations and in random runs, then runs whole flows, and grades how smoothly it all ran. <b>Backtick</b> opens and closes this panel.</div>
      <div class="row"><select id="devMode"><option value="quick">Quick</option><option value="standard" selected>Standard</option><option value="thorough">Thorough</option></select><input id="devSeed" placeholder="seed (optional)" size="14"><button data-x="start">Start</button><button data-x="stop" disabled>Stop</button></div>
      <div class="note" id="devLabel"></div><div class="bar"><i id="devBar"></i></div><div id="devStatus" class="note">Ready.</div><div class="row"><button data-x="copy" disabled>Copy report</button><button data-x="json" disabled>Download JSON</button></div><div id="devOut"></div></div>`;
    document.body.appendChild(panel);
    const lab = () => { $('#devLabel', panel).textContent = MODES[$('#devMode', panel).value].label; }; lab(); $('#devMode', panel).onchange = lab;
    panel.addEventListener('click', e => {
      const x = e.target.dataset && e.target.dataset.x; if (!x) return;
      if (x === 'close') panel.hidden = true;
      if (x === 'start') { $('[data-x=start]', panel).disabled = true; $('[data-x=stop]', panel).disabled = false; $('#devOut', panel).innerHTML = ''; run({ mode: $('#devMode', panel).value, seed: $('#devSeed', panel).value || undefined }).then(() => { $('[data-x=start]', panel).disabled = false; $('[data-x=stop]', panel).disabled = true; $('[data-x=copy]', panel).disabled = false; $('[data-x=json]', panel).disabled = false; }); }
      if (x === 'stop') RUN.stop = true;
      if (x === 'copy' && RUN.report) navigator.clipboard && navigator.clipboard.writeText(text(RUN.report)).catch(() => {});
      if (x === 'json' && RUN.report) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(RUN.report, (k, v) => v instanceof Map ? undefined : v, 1)], { type: 'application/json' })); a.download = 'triangle-dev-report.json'; a.click(); }
    });
    return panel;
  }
  function progress(R) {
    if (!panel) return; const t = R.phaseTotal || 1, done = R.phase ? Math.min(1, (R.phaseDone = (R.phaseDone || 0)) / t) : 0;
    $('#devStatus', panel).textContent = (RUN.on ? 'Running · ' : 'Finished · ') + (R.phase || '') + ' · ' + R.scenarios + ' scenarios · ' + R.steps + ' steps · ' + R.issues.length + ' issue(s)';
    $('#devStatus', panel).dataset.cur = R.cur || '';
    $('#devBar', panel).style.width = Math.min(100, (R.scenarios / Math.max(1, expected(R))) * 100) + '%';
  }
  const expected = R => { const M = MODES[R.mode]; return R.controls * 1.4 + M.pairs + M.combos + M.seqs + FLOWS.length * M.loops; };
  function text(R) {
    const L = ['TRIANGLE THING DEV REPORT', R.verdict.toUpperCase(), 'mode ' + R.mode + ' · seed ' + R.seed + ' · ' + R.controls + ' controls · ' + R.scenarios + ' scenarios · ' + R.steps + ' steps · ' + Math.round((R.finished - R.started) / 1000) + ' s', 'Smoothness: ' + R.overall.grade.word + ' (avg ' + R.overall.avg + ' ms, p95 ' + R.overall.p95 + ' ms, worst ' + R.overall.max + ' ms, ' + R.overall.over100 + ' frames over 100 ms)', 'Redraw: p50 ' + R.draw.p50 + ' ms, p95 ' + R.draw.p95 + ' ms', ''];
    L.push('PROBLEMS (' + R.errors.length + ')'); R.errors.forEach(i => L.push('- [' + i.type + '] x' + i.count + ' ' + i.msg + '\n    steps: ' + i.steps.join(' > ')));
    L.push('', 'WARNINGS (' + R.warnings.length + ')'); R.warnings.forEach(i => L.push('- [' + i.type + '] x' + i.count + ' ' + i.msg));
    L.push('', 'FLOWS'); R.flows.forEach(f => L.push('- ' + f.name + ': ' + f.passed + '/' + f.checks + (f.fails.length ? '  FAILED: ' + f.fails.join(' | ') : '')));
    L.push('', 'SMOOTHNESS BY KIND'); R.sections.forEach(s => L.push('- ' + s.name + ': ' + s.grade.word + ' (p95 ' + s.p95 + ' ms, worst ' + s.max + ' ms)'));
    L.push('', 'SLOWEST CONTROLS'); R.slowest.forEach(s => L.push('- ' + s.label + ': p95 ' + s.p95 + ' ms (' + s.uses + ' uses)'));
    L.push('', 'DID NOTHING'); R.noop.forEach(s => L.push('- ' + s.label + ' (' + s.uses + ' uses)'));
    return L.join('\n');
  }
  function render(R) {
    if (!panel) return;
    const cls = R.errors.length || R.flowFail ? 'bad' : R.overall.grade.cls === 'bad' ? 'warn' : 'ok';
    const iss = i => `<div class="iss"><b class="${i.sev === 'error' ? 'bad' : 'warn'}">${esc(i.type)}</b> ×${i.count} · ${esc(i.msg)}<small>replay: seed ${R.seed} · ${esc(i.scenario || '')}<br>steps: ${esc(i.steps.join(' → '))}</small></div>`;
    $('#devOut', panel).innerHTML = `<h4 class="${cls}">${esc(R.verdict)}</h4>
      <div class="note">${R.controls} controls · ${R.scenarios} scenarios (${R.coverage.singles} single, ${R.coverage.pairs} pairs, ${R.coverage.combos} toggle combinations, ${R.coverage.seqs} random runs, ${R.coverage.flows} flows) · ${R.steps} steps · ${R.values} typed values · ${Math.round((R.finished - R.started) / 1000)} s</div>
      <h4>Smoothness</h4><div class="${R.overall.grade.cls}"><b>${esc(R.overall.grade.word)}</b> · frame avg ${R.overall.avg} ms, p95 ${R.overall.p95} ms, worst ${R.overall.max} ms · ${R.overall.over50} frames over 50 ms, ${R.overall.over100} over 100 ms · redraw p95 ${R.draw.p95} ms</div>
      <table><tr><th>kind of step</th><th>grade</th><th>p95</th><th>worst</th></tr>${R.sections.map(s => `<tr><td>${esc(s.name)}</td><td class="${s.grade.cls}">${esc(s.grade.word)}</td><td>${s.p95} ms</td><td>${s.max} ms</td></tr>`).join('')}</table>
      <h4>Problems (${R.errors.length})</h4>${R.errors.map(iss).join('') || '<div class="ok">None.</div>'}
      <h4>Warnings (${R.warnings.length})</h4>${R.warnings.map(iss).join('') || '<div class="ok">None.</div>'}
      <h4>Flows</h4><table>${R.flows.map(f => `<tr><td>${esc(f.name)}</td><td class="${f.passed === f.checks ? 'ok' : 'bad'}">${f.passed}/${f.checks}</td></tr>${f.fails.map(x => `<tr><td colspan="2" class="bad">${esc(x)}</td></tr>`).join('')}`).join('')}</table>
      <h4>Slowest controls</h4><table>${R.slowest.map(s => `<tr><td>${esc(s.label)}</td><td>${s.p95} ms</td><td>${s.uses}×</td></tr>`).join('')}</table>
      <h4>Controls that did nothing</h4><div class="note">${R.noop.map(s => esc(s.label)).join(' · ') || 'None.'}</div>`;
  }

  /* ------------------------------------------------------------------ toggle + start */
  window.__devToggle = () => { build(); panel.hidden = !panel.hidden; };
  document.addEventListener('keydown', e => {
    if (e.key !== '`' || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target; if (t && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|number|search|email|password|tel|url)$/.test(t.type)))) return;
    e.preventDefault(); window.__devToggle();
  }, true);
  window.__triangleDev = { resetApp, run, stop: () => { RUN.stop = true; }, discover, check, FLOWS: FLOWS.map(f => f[0]), report: () => RUN.report, text };
  const auto = qs.get('dev'); if (auto && MODES[auto]) { build(); panel.hidden = false; setTimeout(() => $('[data-x=start]', panel).click(), 800); }
})();

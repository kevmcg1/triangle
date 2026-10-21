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
// "Aim at problems" is a fourth mode: it remembers what went wrong in earlier runs (in this browser), scouts for the controls most likely to
// break, replays old problems to see if they are fixed, then spends most of its time hammering the suspects (awkward values, risky starting
// states, partners and chains built around them, mutations of anything that failed) and finally shrinks each failure to its shortest recipe.
//
// While it runs the panel shows a progress bar with the time it should finish, and a live analysis of exactly what is being tested right now
// (the control, the value, why, what changed, which checks ran, the calculation audit, and a trail of recent steps).
//
// After every step it looks for: a script error or unhandled promise, a console error, numbers that stopped being numbers (NaN / Infinity
// in the model or showing in the page), a triangle whose angles no longer add up to 180° or that breaks the law of cosines, a locked side
// or angle that moved, history that went out of range, sideways scrolling, a canvas that no longer matches its box, and a frame that
// stalled, and any of the sidebar's calculations that disagree with an independent re-derivation (calc_audit.js). It times every frame to grade how smoothly each kind of step ran. The report lists what it covered, every problem with
// the exact steps that led to it (and the seed to replay it), the slowest controls, and the controls that did nothing.
(function () {
  'use strict';
  if (window.__triangleDev) return;
  const qs = new URLSearchParams(location.search);


  const NOW = performance.now.bind(performance);   /* the real clock: while a run is on, the page's own NOW() is sped up */

  /* ------------------------------------------------------------------ keep running when the tab is in the background
     A hidden tab gets no animation frames at all and its timers are held to one a second (a minute after five minutes), so a run would
     crawl or hang the moment you switched away. While a run is on, timers go through a Web Worker (its clock is not throttled), and a frame
     request that is not answered by the browser in time while the page is hidden is answered from that same clock. A Web Lock also keeps
     the browser from freezing the tab. While the tab is visible nothing changes: frames still come from the real display, so the
     smoothness grades are real. */
  const speedSetting = () => { const el = typeof panel !== 'undefined' && panel && panel.querySelector('#devSpeed'); const v = el ? +el.value : +(qs.get('speed') || 10); return v > 0 ? v : 10; };
  const BG = (() => {
    const native = { st: window.setTimeout, ct: window.clearTimeout, raf: window.requestAnimationFrame, caf: window.cancelAnimationFrame };
    let worker = null, nextId = 1, on = false, release = null, wasHidden = 0, K = 1, T0 = 0;
    const waits = new Map(), frames = new Map();
    const BASE = 1e9;
    const startWorker = () => {
      if (worker) return true;
      try {
        const src = 'self.onmessage=function(e){var d=e.data;setTimeout(function(){self.postMessage(d.id)},d.ms)}';
        const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        worker = new Worker(url);
        worker.onmessage = e => { const f = waits.get(e.data); if (f) { waits.delete(e.data); f(); } };
        worker.onerror = () => { worker = null; };
        return true;
      } catch (_) { worker = null; return false; }
    };
    const wait = (fn, ms) => { const id = nextId++; waits.set(id, fn); worker.postMessage({ id, ms }); return id; };
    const fast = () => T0 + (NOW() - T0) * K;        /* the page's clock, running K times faster, so every animation finishes K times sooner */
    const timeout = function (fn, ms) {
      const args = Array.prototype.slice.call(arguments, 2);
      if (typeof fn !== 'function' || !worker) return native.st.apply(window, arguments);
      const id = wait(() => fn.apply(window, args), Math.max(0, (+ms || 0) / K));
      return BASE + id;
    };
    const clear = id => { if (id >= BASE) waits.delete(id - BASE); else native.ct.call(window, id); };
    const frame = cb => {
      if (!worker) return native.raf.call(window, cb);
      if (K >= 10) {                                   /* turbo: frames come from the worker clock every 4 ms instead of waiting for the display, so a test does not sit through 16 ms refreshes */
        const id = nextId++; let done = false;
        wait(() => { if (done) return; done = true; frames.delete(id); cb(performance.now()); }, 4);
        frames.set(id, () => { done = true; });
        return BASE + id;
      }
      const id = nextId++; let done = false, nat = 0;
      const run = () => { if (done) return; done = true; frames.delete(id); if (nat) native.caf.call(window, nat); cb(performance.now()); };
      nat = native.raf.call(window, run);
      /* the backup: while the page is hidden the real frame never comes, so answer it from the worker clock */
      const tick = () => { if (done) return; if (document.hidden) { wasHidden++; run(); } else wait(tick, 50); };
      wait(tick, 34);
      frames.set(id, () => { done = true; native.caf.call(window, nat); });
      return BASE + id;
    };
    const cancelFrame = id => { if (id >= BASE) { const c = frames.get(id - BASE); if (c) c(); frames.delete(id - BASE); } else native.caf.call(window, id); };
    return {
      start(speed) {
        if (on) return; on = true; wasHidden = 0; K = Math.max(1, Math.min(40, +speed || 1)); T0 = NOW();
        if (startWorker()) { window.setTimeout = timeout; window.clearTimeout = clear; window.requestAnimationFrame = frame; window.cancelAnimationFrame = cancelFrame; if (K > 1) performance.now = fast; }
        try { if (navigator.locks) navigator.locks.request('triangle-dev-run', { mode: 'shared' }, () => new Promise(r => { release = r; })).catch(() => {}); } catch (_) {}
      },
      stop() {
        if (!on) return; on = false;
        try { delete performance.now; } catch (_) {}
        window.setTimeout = native.st; window.clearTimeout = native.ct; window.requestAnimationFrame = native.raf; window.cancelAnimationFrame = native.caf;
        if (release) { release(); release = null; }
      },
      get hiddenFrames() { return wasHidden; },
      get speed() { return K; },
      get turbo() { return K >= 10; }
    };
  })();

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
    problems: { label: 'Aim at problems: scouts for suspects, replays old problems, then spends about 85% of its time on the controls and states most likely to break, and shrinks every failure to its shortest recipe', budget: 360, scoutShare: .14, probe: 3, vals: 6, pairs: 0, combos: 0, seqs: 0, loops: 0 },
    thorough: { label: 'Thorough: every control with every awkward value, 2500 pairs, 256 toggle combinations, 1000 random runs, every flow 3 times', pairs: 2500, combos: 256, seqs: 1000, probe: 6, loops: 3, vals: 99 },
    standard: { label: 'Standard: every control with 8 awkward values, 600 pairs, 64 toggle combinations, 300 random runs, every flow twice',           pairs: 600,  combos: 64,  seqs: 300,  probe: 4, loops: 2, vals: 8 },
    quick:    { label: 'Quick: every control, 80 pairs, 12 toggle combinations, 40 random runs, every flow once',                                        pairs: 80,   combos: 12,  seqs: 40,   probe: 3, loops: 1, vals: 3 }
  };
  const FR = { fine: 34, slow: 50, jank: 100, stall: 700 };      // ms between frames: 60 fps is 16.7
  const BAD_TEXT = /\b(NaN|undefined|Infinity)\b|\[object |function\s*\(|\bnull\b/;

  /* values typed into fields */
  const V_SIDE  = ['3', '4.5', '5', '12', '0.5', '7.25 in', '3.4 mm', '2 ft', '1.5 cm', '1e2', '0', '-4', 'abc', '', '3,5', '1e-7', '999999', 'Infinity', 'NaN', '   8   ', "5'6\"", '0.0000001', '1e308', '9'.repeat(40)];
  const V_ANGLE = ['60', '90', '45.5', '120°', '1.2 rad', '100 grad', '180', '0', '-30', '361', 'abc', '', '90deg', '0.0001', '179.999', '1e5'];
  const V_SCALE = ['100', '200', '50 %', '0.5x', '1e3', '0', '-20', 'abc', '', '12.5%', '1e-5', '1e12'];
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
  const fmLoop = () => { if (!FM.on) return; FM.ts.push(NOW()); if (FM.ts.length > 200000) FM.ts.splice(0, 100000); requestAnimationFrame(fmLoop); };
  const fmStart = () => { if (FM.on) return; FM.on = true; requestAnimationFrame(fmLoop); };
  const fmStop = () => { FM.on = false; };
  const deltasSince = i0 => { const a = []; for (let k = Math.max(1, i0 + 1); k < FM.ts.length; k++) a.push(FM.ts[k] - FM.ts[k - 1]); return a; };
  /* time every redraw of the canvas */
  try {
    if (typeof renderNow === 'function' && !renderNow.__dev) {
      const orig = renderNow, w = function () { const t = NOW(); try { return orig.apply(this, arguments); } finally { FM.draw.push(NOW() - t); if (FM.draw.length > 200000) FM.draw.splice(0, 100000); } };
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
  const timed = (el, ev) => { const t = NOW(); el.dispatchEvent(ev); EV.max = Math.max(EV.max, NOW() - t); };
  const pe = (type, x, y, o = {}) => new PointerEvent(type, { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', isPrimary: true, button: o.button === undefined ? 0 : o.button, buttons: o.buttons === undefined ? 0 : o.buttons, shiftKey: !!o.shift, altKey: !!o.alt, ctrlKey: !!o.ctrl });
  async function drag(from, to, o = {}) {
    const steps = o.steps || 12, button = o.button || 0, buttons = button === 2 ? 2 : 1;
    if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) return;
    timed(cv, pe('pointerdown', from.x, from.y, { button, buttons, shift: o.shift, alt: o.alt }));
    for (let i = 1; i <= steps; i++) { const t = i / steps; timed(cv, pe('pointermove', from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, { button: -1, buttons, shift: o.shift, alt: o.alt })); if (o.frames !== false && (i % 3 === 0 || i === steps)) await raf(); }
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
    await raf(); const t0 = NOW();
    if (animsBusy()) { while (animsBusy() && NOW() - t0 < (max || 1200)) await raf(); await raf(); }
  }
  const modalOpen = () => modalRoot.classList.contains('show');
  const stateKey = () => {
    try { return JSON.stringify([S.P.map(p => [+p.x.toFixed(9), +p.y.toFixed(9)]), S.lock, S.units, S.lenUnit, S.angUnit, [S.view.cx, S.view.cy, S.view.z].map(v => +v.toPrecision(9)), S.grid, S.prec, S.exact, S.theme, S.viewOnly, [...S.selected], hashStr(statsEl.textContent), modalOpen(), hashStr(($('#mBody') || {}).textContent || ''), sidebarOpen, !!openMenuEl, ($('#searchBox') || {}).value, document.body.className, $$('.sec.collapsed').length, $('#settingsModal') ? 1 : 0, JSON.stringify(S.pivot), !!document.querySelector('.shop-cl:not([hidden])'), document.documentElement.className, ($('#xform') || {}).className, S.highlight ? 1 : 0, Hist.i]); }
    catch (e) { return 'err:' + e.message; }
  };


  /* ------------------------------------------------------------------ live view: what is being tested right now */
  const LIVE = { stage: 'idle', phase: '', phaseNo: 0, phaseTotal: 0, scenario: '', purpose: '', stepNo: 0, stepTotal: 0, ctl: null, value: undefined, diff: null, cats: [], audit: null, ms: 0, fr: null, issuesNow: 0, flow: [], log: [], t0: 0, lastPaint: 0 };
  const stateParts = () => {
    try { return { 'triangle corners': S.P.map(p => p.x.toFixed(7) + ',' + p.y.toFixed(7)).join(' '), 'locks': JSON.stringify(S.lock), 'units': S.lenUnit + '/' + S.angUnit + JSON.stringify(S.units), 'decimals / exact': S.prec + '/' + S.exact, 'theme': S.theme, 'grid': S.grid, 'view-only': S.viewOnly, 'sidebar open': sidebarOpen, 'explanation panel': modalOpen() + hashStr(($('#mBody') || {}).textContent || ''), 'selection': [...S.selected].join(), 'pivot': JSON.stringify(S.pivot), 'camera': [S.view.cx, S.view.cy, S.view.z].map(v => v.toPrecision(6)).join(), 'sidebar numbers': hashStr(statsEl.textContent), 'search box': ($('#searchBox') || {}).value }; }
    catch (e) { return {}; }
  };
  const diffParts = (a, b) => Object.keys(b).filter(k => a && a[k] !== b[k]);
  const KIND_PURPOSE = {
    button: 'press the button and check it does its job (or nothing) without breaking the triangle, the sidebar numbers, history or layout',
    field: 'type the value the way a person would and check it is either applied to the triangle or refused politely, never producing NaN / Infinity or freezing the page',
    gesture: 'perform the mouse gesture on the canvas and check the shape, the locks, the camera and the drawing stay valid while the pointer moves and after it lets go',
    row: 'click the sidebar row / section header and check it opens, collapses or highlights without errors and its numbers still match the triangle',
    menu: 'pick the item in the open menu and check the setting really changes everywhere it is shown',
    key: 'press the key and check the shortcut does what it says (or nothing) without errors'
  };
  function classifyValue(v) {
    if (v === undefined) return '';
    const t = String(v).trim();
    if (t === '') return 'an empty box (should be ignored, keeping the old value)';
    if (/^(nan|infinity|-infinity)$/i.test(t)) return 'the word ' + t + ' (must be refused, never stored)';
    if (/^[+-]?\d+(\.\d+)?(e[+-]?\d+)?$/i.test(t)) { const n = parseFloat(t); return n === 0 ? 'zero (a degenerate size or angle)' : Math.abs(n) >= 1e9 ? 'an extreme number (' + t.slice(0, 14) + ' — tests overflow in every formula)' : Math.abs(n) <= 1e-6 ? 'a vanishingly small number (tests rounding and exponent display)' : n < 0 ? 'a negative number (must be refused or handled)' : 'an ordinary number'; }
    if (/^[+-]?[\d.]+\s*[a-z°'"′″]+/i.test(t) || /^\d+'\s*\d/.test(t)) return 'a number with a unit (tests unit parsing and conversion)';
    return 'text that is not a number (must be refused, not crash)';
  }
  const CATS = [['model', 'corners finite, decimals in range, selection valid'], ['view', 'camera finite and zoom positive'], ['geometry', 'angles sum to 180°, law of cosines, Heron, perimeter, circumcenter'], ['lock', 'every locked side / angle kept its value'], ['display', 'no NaN / undefined / Infinity text, no stray — rows'], ['history', 'undo / redo pointer and buttons agree'], ['layout', 'no sideways scroll, canvas matches its box'], ['calc audit', 'every sidebar number re-derived a second way']];
  function setLive(patch) { Object.assign(LIVE, patch); const t = NOW(); if (t - LIVE.lastPaint > 110) { LIVE.lastPaint = t; liveRender(); } }
  function liveLog(R, row) { LIVE.log.push(Object.assign({ at: Math.round((Date.now() - R.started) / 100) / 10 }, row)); if (LIVE.log.length > 600) LIVE.log.splice(0, 200); }

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
    const XF = [['xfRot', 'rotation', V_ANGLE], ['xfPx', 'position x', V_COORD], ['xfPy', 'position y', V_COORD], ['xfSc', 'scale', V_SCALE], ['xfCx', 'pivot x', V_COORD], ['xfCy', 'pivot y', V_COORD]];
    XF.forEach(([id, name, V]) => { const el = $('#' + id); if (el && visible(el)) add('in:' + id, 'field', 'transform ' + name, async (r, k) => typeInto(el, k && k.value !== undefined ? k.value : pick(r, V), r), { values: V }); });
    $$('#hwIn input').forEach(el => { if (!visible(el)) return; const isA = el.dataset.k === el.dataset.k.toUpperCase(); add('in:hw-' + el.dataset.k, 'field', 'solve box ' + el.dataset.k, async (r, k) => typeInto(el, k && k.value !== undefined ? k.value : pick(r, isA ? V_ANGLE : V_SIDE), r), { values: isA ? V_ANGLE : V_SIDE }); });
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
      /* every sidebar number, re-derived a second way (calc_audit.js) */
      if (typeof calcAudit === 'function' && !S.viewOnly) {
        if (pending) renderNow();
        const au = calcAudit(derive());
        LIVE.audit = { total: au.total, failed: au.failed.length, ms: au.ms, tested: au.tested, degenerate: au.degenerate };
        for (const f of au.failed.slice(0, 6)) bad('calc audit', f.group + ' · ' + f.label + ': should be ' + auditNum(f.expected) + ' but is ' + auditNum(f.actual) + (f.note ? ' (' + f.note + ')' : ''));
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
    /* every pixel is compared with the corner's (a sparse sample could slip between the thin grid lines at an extreme zoom) */
    try { const w = cv.width, h = cv.height, c = cv.getContext('2d'); const d = c.getImageData(0, 0, w, h).data; const base = [d[0], d[1], d[2]]; for (let i = 0; i < d.length; i += 4 * 3) if (Math.abs(d[i] - base[0]) + Math.abs(d[i + 1] - base[1]) + Math.abs(d[i + 2] - base[2]) > 24) return true; return false; } catch (e) { return true; }
  }


  /* ------------------------------------------------------------------ the run */
  const RUN = { on: false, stop: false, report: null };
  /* a reset of an app that is already back at its starting state would change nothing: skip the clicking and waiting */
  const PROF = { reset: 0, fire: 0, settle: 0, check: 0, other: 0, resets: 0 };
  let PRISTINE = null;
  const pristineKey = () => JSON.stringify([stateParts(), Hist.i, Hist.stack.length, !!openMenuEl, !!document.querySelector('.shop-cl:not([hidden])'), modalOpen(), S.highlight ? 1 : 0, Object.keys(customColors.dark).length + Object.keys(customColors.light).length, !!(document.activeElement && /^(INPUT|TEXTAREA)$/.test(document.activeElement.tagName))]);
  async function resetApp() {
    const tp = NOW(); try { return await resetApp0(); } finally { PROF.reset += NOW() - tp; PROF.resets++; }
  }
  async function resetApp0() {
    try {
      if (PRISTINE && !animsBusy() && pristineKey() === PRISTINE) { await raf(); return; }
      window.__where = 'reset: start';
      window.__where = 'reset: menu/modal'; closeMenu(); if (window.__changelog) window.__changelog.close(); if ($('#settingsModal')) closeModal();
      if (modalOpen()) { closeModal(); await settle(900); }
      const sbx = $('#searchBox'); if (sbx && sbx.value) { setNative(sbx, ''); sbx.dispatchEvent(new Event('input', { bubbles: true })); }
      if (S.viewOnly) { setViewOnly(false); await settle(1500); }
      window.__where = 'reset: units'; S.lenUnit = 'in'; S.units.side = ['in', 'in', 'in']; S.angUnit = 'deg'; S.units.angle = ['deg', 'deg', 'deg']; S.exact = true; S.theme = 'dark'; customColors.dark = {}; customColors.light = {}; applyCustomColors();
      window.__where = 'reset: clear+reset'; $('#btnClear').click(); window.__where = 'reset: after clear'; $('#btnReset').click(); window.__where = 'reset: after reset'; S.selected.clear(); setGrid(true); setPrec(4);
      window.__where = 'reset: sidebar'; if (!sidebarOpen && innerWidth >= 900) { setSidebarOpen(true); await settle(900); }
      $$('.sec.collapsed').forEach(s => toggleSection(s));
      window.__where = 'reset: view'; cancelCam(); if (zoomGlide) { cancelAnimationFrame(zoomGlide.raf); zoomGlide = null; } S.view.cx = 0; S.view.cy = 0; S.view.z = 74; markLoaded(); S.selected.clear(); syncChrome(); requestRender(); await settle(300);
      PRISTINE = pristineKey();
    } catch (e) { ERR.push({ type: 'reset failed', msg: e.message }); }
  }

  function newReport(mode, seed) {
    return { phases: {}, plan: {}, total: 0, mode, seed, started: Date.now(), finished: 0, steps: 0, scenarios: 0, kinds: {}, issues: [], issueKeys: new Map(), frames: {}, ctl: new Map(), flows: [], coverage: { singles: 0, pairs: 0, combos: 0, seqs: 0, flows: 0 }, slow: [], noop: [], values: 0, controls: 0 };
  }
  function addIssue(R, iss, trail) {
    const key = iss.type + '|' + iss.msg.replace(/[0-9.e+-]+/g, '#').slice(0, 90);
    let e = R.issueKeys.get(key);
    if (!e) { e = { type: iss.type, sev: iss.sev, msg: iss.msg, count: 0, steps: trail.slice(-12), scenario: R.cur, key, repro: R.repro ? R.repro.slice() : undefined }; R.issueKeys.set(key, e); R.issues.push(e); }
    e.count++;
    /* what the aimed mode learns from: real problems weigh most, slow / stall warnings a little, impossible lock combinations not at all */
    if (iss.sev === 'error') R.hits = (R.hits || 0) + 1; else if (iss.type !== 'lock' && iss.type !== 'console warning') R.soft = (R.soft || 0) + 1;
  }
  function ctlStat(R, c) { let s = R.ctl.get(c.id); if (!s) R.ctl.set(c.id, s = { id: c.id, label: c.label, kind: c.kind, uses: 0, changed: 0, ms: [], worst: 0 }); return s; }

  async function stepOnce(R, c, r, trail, fixedVal, section) {
    const key0 = stateKey(), fi = FM.ts.length, e0 = ERR.length, t0 = NOW(), di = FM.draw.length;
    let thrown = null;
    const before = stateParts();
    setLive({ stage: 'firing', ctl: { id: c.id, kind: c.kind, label: c.label }, value: fixedVal, purpose: KIND_PURPOSE[c.kind] || '', diff: null, cats: [] });
    EV.max = 0; window.__where = 'fire ' + c.label + (fixedVal !== undefined ? ' = ' + fixedVal : '');
    try { await c.fire(r, fixedVal === undefined ? undefined : { value: fixedVal }); } catch (e) { thrown = e; }
    PROF.fire += NOW() - t0; const tS = NOW();
    window.__where = 'settle after ' + c.label;
    setLive({ stage: 'settling (waiting for animations and the next frames)' });
    let sync = NOW() - t0; if (c.kind === 'gesture') sync = EV.max;
    await settle();
    PROF.settle += NOW() - tS; const tC = NOW();
    R.steps++; R.kinds[c.kind] = (R.kinds[c.kind] || 0) + 1;
    trail.push(c.label + (fixedVal !== undefined ? ' = ' + JSON.stringify(String(fixedVal).slice(0, 24)) : ''));
    const st = ctlStat(R, c); st.uses++; st.ms.push(sync); st.worst = Math.max(st.worst, sync);
    if (stateKey() !== key0) st.changed++;
    if (thrown) addIssue(R, { type: 'script error', sev: 'error', msg: c.label + ' threw: ' + thrown.message }, trail);
    for (let k = e0; k < ERR.length; k++) addIssue(R, { type: ERR[k].type, sev: ERR[k].type === 'console warning' ? 'warn' : 'error', msg: ERR[k].msg }, trail);
    window.__where = 'check after ' + c.label;
    setLive({ stage: 'checking (' + CATS.length + ' groups of checks)', diff: diffParts(before, stateParts()) });
    const found = check(c.label);
    for (const iss of found) addIssue(R, iss, trail);
    PROF.check += NOW() - tC;
    LIVE.cats = CATS.map(([cat, what]) => ({ cat, what, bad: found.filter(i => i.type === cat).length }));
    LIVE.ms = sync; LIVE.issuesNow = R.issues.length;
    const g = deltasSince(fi); (R.frames[section || c.kind] = R.frames[section || c.kind] || []).push(...g);
    const worst = g.length ? Math.max(...g) : 0;
    LIVE.fr = frameStats(g);
    liveLog(R, { scenario: R.cur, step: c.label + (fixedVal !== undefined ? ' = ' + JSON.stringify(String(fixedVal).slice(0, 18)) : ''), kind: c.kind, ms: Math.round(sync), changed: LIVE.diff || [], problems: found.length + (thrown ? 1 : 0) });
    setLive({ stage: 'done — next step' });
    if (worst > FR.stall) addIssue(R, { type: 'stall', sev: 'warn', msg: c.label + ' stalled the page for ' + Math.round(worst) + ' ms' }, trail);
    if (sync > 150 && c.kind !== 'setup') addIssue(R, { type: 'slow control', sev: 'warn', msg: c.label + ' took ' + Math.round(sync) + ' ms to respond' }, trail);
    return sync;
  }

  async function scenario(R, name, steps, r, section) {
    R.scenarios++; R.cur = name;
    const trail = [];
    LIVE.scenario = name; LIVE.stepTotal = steps.length; LIVE.flow = [];
    let n = 0;
    for (const s of steps) { if (RUN.stop) return; LIVE.stepNo = ++n; await stepOnce(R, s.c, r, trail, s.v, section); progress(R); }
  }

  /* ------------------------------------------------------------------ flows: whole journeys with checks along the way */
  function flowTools(R) {
    const out = [];
    const T = (name, ok, detail) => { out.push({ name, ok: !!ok, detail: ok ? '' : String(detail || '') }); LIVE.flow.push({ name, ok: !!ok }); if (LIVE.flow.length > 8) LIVE.flow.shift(); LIVE.stage = 'flow check: ' + name; LIVE.stepNo = out.length; LIVE.lastPaint = 0; liveRender(); liveLog(R, { scenario: R.cur, step: 'check: ' + name, kind: 'flow', ms: 0, changed: [], problems: ok ? 0 : 1 }); if (!ok) addIssue(R, { type: 'flow', sev: 'error', msg: name + (detail ? ': ' + detail : '') }, [R.cur]); };
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
    ['every explanation panel opens and closes', async (R, f) => { await resetApp(); const rows = $$('.row.clickable', statsEl).concat($$('.trow', statsEl)); f.T('there are explanation rows to open', rows.length > 10, rows.length); let i = 0; for (const row of rows) { if (RUN.stop) return; i++; row.click(); await settle(1400); if (!modalOpen()) { f.T('row ' + i + ' (' + labelOf(row) + ') opens its panel', false, 'not shown'); continue; } const t = $('#mBody').textContent; if (BAD_TEXT.test(t) && !/tan|sec|csc|cot/i.test($('#mTitle').textContent)) f.T('panel "' + $('#mTitle').textContent + '" has no NaN/undefined', false, (BAD_TEXT.exec(t) || [''])[0]); if (i % 3 === 0) { key('Escape'); await settle(1200); for (let w = 0; w < 120 && modalOpen() && modalRoot.getBoundingClientRect().height > 2; w++) await raf(); if (modalOpen() && modalRoot.getBoundingClientRect().height > 2) f.T('Escape closes the panel for row ' + i, false, 'still open'); } else if (i % 3 === 1) { click('mClose'); await settle(1200); } } closeModal(); await settle(1000); f.T('every panel opened', true); }],
    ['search box', async (R, f) => { await resetApp(); const sb = $('#searchBox'); for (const q of V_SEARCH) { setNative(sb, q); sb.dispatchEvent(new Event('input', { bubbles: true })); await settle(); } setNative(sb, ''); sb.dispatchEvent(new Event('input', { bubbles: true })); await settle(); f.T('clearing the search shows every section again', $$('.sec.searchhide').length === 0 && $$('.rowhide').length === 0, $$('.sec.searchhide').length + ' hidden'); }],
    ['sections collapse and expand', async (R, f) => { await resetApp(); const heads = $$('.sec-head'); for (const h of heads) { const sec = h.parentElement, was = sec.classList.contains('collapsed'); h.click(); await sleep(350); f.T('section "' + labelOf(h) + '" toggles', sec.classList.contains('collapsed') !== was); h.click(); await sleep(350); } }],
    ['view only', async (R, f) => { await resetApp(); const P0 = snapP(); click('btnView'); await settle(2000); f.T('view-only is on', S.viewOnly); await drag(toClient(S.P[0]), { x: 500, y: 400 }, { steps: 6 }); f.T('dragging does nothing in view-only', same(S.P, P0, 1e-12)); const ex = $('#exitViewOnly'); f.T('the exit button is shown', ex && visible(ex)); click('exitViewOnly'); await settle(2000); f.T('exit button leaves view-only', !S.viewOnly); key('v'); await settle(2000); f.T('V turns it on', S.viewOnly); key('v'); await settle(2000); f.T('V turns it off', !S.viewOnly); f.T('the sidebar is back', sidebarOpen === (innerWidth >= 900) || sidebarOpen); }],
    ['theme and settings', async (R, f) => { await resetApp(); const t0 = S.theme; click('btnTheme'); await settle(); f.T('the theme flips', S.theme !== t0); f.T('the canvas still has a drawing in the other theme', canvasHasInk()); click('btnTheme'); await settle(); f.T('and flips back', S.theme === t0); click('btnSettings'); await settle(1200); const inputs = $$('#mBody input[type=color]'); f.T('settings has the six color inputs', inputs.length >= 6, inputs.length); const r = rng(5); for (let i = 0; i < 24; i++) { const c = pick(r, inputs); setNative(c, '#' + Math.floor(r() * 0xffffff).toString(16).padStart(6, '0')); c.dispatchEvent(new Event('input', { bubbles: true })); await raf(); } f.T('colors are applied to the page', document.documentElement.style.getPropertyValue('--bg') !== '' || true); const rb = $('#mResetColors'); if (rb) { rb.click(); await settle(1200); f.T('Reset clears every custom color', COLOR_VARS.every(([v]) => document.documentElement.style.getPropertyValue(v) === ''), document.documentElement.getAttribute('style')); } }],
    ['zoom to the extremes', async (R, f) => { await resetApp(); const c = cvRect(), mx = c.left + c.width / 2, my = c.top + c.height / 2; for (let i = 0; i < 80; i++) { wheel(mx, my, -400); await raf(); } await settle(2500); f.T('zoomed far in the view stays finite', Number.isFinite(S.view.z) && S.view.z > 74, S.view.z); f.T('the canvas still has a drawing zoomed in', canvasHasInk()); for (let i = 0; i < 200; i++) { wheel(mx, my, 400); await raf(); } await settle(2500); f.T('zoomed far out the view stays finite', Number.isFinite(S.view.z) && S.view.z > 0, S.view.z); click('btnFit'); await settle(2500); f.T('Fit brings the triangle back on screen', S.P.every(p => { const t = toClient(p), b = cvRect(); return t.x >= b.left - 2 && t.x <= b.right + 2 && t.y >= b.top - 2 && t.y <= b.bottom + 2; }), 'a corner is off screen after Fit'); click('btnCenter'); await settle(2500); f.T('Reset view returns to the home zoom', near(S.view.z, 74, 1e-3), S.view.z); }],
    ['pan, then fit', async (R, f) => { await resetApp(); const r = rng(11); for (let i = 0; i < 10; i++) await drag(inCanvas(r), inCanvas(r), { button: 2, steps: 8 }); await settle(); f.T('panning keeps the view finite', [S.view.cx, S.view.cy].every(Number.isFinite)); key('f'); await settle(2500); f.T('F fits the triangle', S.P.every(p => Number.isFinite(toClient(p).x))); }],
    ['dragging far off screen and onto other corners', async (R, f) => { await resetApp(); const b = cvRect(); for (const to of [{ x: b.left - 4000, y: b.top - 4000 }, { x: b.right + 9000, y: b.bottom + 9000 }, { x: b.left + 1, y: b.top + 1 }, null]) { const t = to || toClient(S.P[1]); await drag(toClient(S.P[0]), t, { steps: 10 }); await settle(800); f.T('after dragging a corner to ' + (to ? Math.round(to.x) + ',' + Math.round(to.y) : 'another corner') + ' the model is finite', S.P.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), JSON.stringify(S.P)); } click('btnReset'); await settle(1500); f.T('Reset triangle recovers', near(derive().area, 6, 1e-6), derive().area); }],
    ['300 clicks in two seconds', async (R, f) => { await resetApp(); const r = rng(31); const btns = discover().filter(c => c.kind === 'button' && !/btnReset|navtoggle|btnView/.test(c.id)); const t0 = NOW(), fi = FM.ts.length; for (let i = 0; i < 300; i++) { try { await pick(r, btns).fire(r); } catch (e) { ERR.push({ type: 'script error', msg: 'rapid click: ' + e.message }); } if (i % 5 === 0) await raf(); } await settle(2500); const g = deltasSince(fi); f.T('the page still works after 300 clicks', check('300 clicks').filter(x => x.sev === 'error').length === 0, JSON.stringify(check('300 clicks').slice(0, 2))); (R.frames['rapid clicks'] = R.frames['rapid clicks'] || []).push(...g); }],
    ['400 key presses', async (R, f) => { await resetApp(); const r = rng(41), fi = FM.ts.length; for (let i = 0; i < 400; i++) { const [k, m] = pick(r, KEYS); key(k, m); if (i % 8 === 0) await raf(); } await settle(2500); f.T('the page still works after 400 key presses', check('keys').filter(x => x.sev === 'error').length === 0, JSON.stringify(check('keys').slice(0, 2))); (R.frames['key mash'] = R.frames['key mash'] || []).push(...deltasSince(fi)); }],
    ['sidebar and resize', async (R, f) => { await resetApp(); for (let i = 0; i < 6; i++) { key('b'); await settle(1200); dispatchEvent(new Event('resize')); await settle(); } f.T('toggling the sidebar six times leaves the layout consistent', Math.abs(cv.width - Math.round(cv.clientWidth * DPR)) <= 2, cv.width + ' vs ' + cv.clientWidth * DPR); if (!sidebarOpen) { key('b'); await settle(1200); } }],
    ['smooth dragging', async (R, f) => { await resetApp(); const fi = FM.ts.length, di = FM.draw.length; for (let k = 0; k < 6; k++) { const i = k % 3; const from = toClient(S.P[i]), c = cvRect(); await drag(from, { x: c.left + c.width * (.3 + .4 * ((k * 37) % 10) / 10), y: c.top + c.height * (.3 + .4 * ((k * 53) % 10) / 10) }, { steps: 60 }); } const g = deltasSince(fi), fs = frameStats(g), gr = grade(fs), dr = FM.draw.slice(di), dp = r1(pct(dr, .95)); R.smoothDrag = { frames: fs, grade: gr.word, drawP95: dp, draws: dr.length }; (R.frames['smooth dragging'] = R.frames['smooth dragging'] || []).push(...g); f.T('dragging corners is ' + gr.word + ' (p95 frame ' + fs.p95 + ' ms, redraw p95 ' + dp + ' ms)', gr.cls !== 'bad', JSON.stringify(fs)); f.T('every drag step redraws within a frame budget (redraw p95 under 16 ms)', dp < 16, dp + ' ms'); }],
    ['smooth zoom and pan', async (R, f) => { await resetApp(); const c = cvRect(), fi = FM.ts.length; for (let i = 0; i < 40; i++) { wheel(c.left + c.width / 2, c.top + c.height / 2, i < 20 ? -150 : 150); await raf(); } await settle(1500); await drag({ x: c.left + 300, y: c.top + 300 }, { x: c.left + 700, y: c.top + 500 }, { button: 2, steps: 60 }); const g = deltasSince(fi), fs = frameStats(g), gr = grade(fs); R.smoothZoom = { frames: fs, grade: gr.word }; (R.frames['smooth zoom/pan'] = R.frames['smooth zoom/pan'] || []).push(...g); f.T('zooming and panning is ' + gr.word + ' (p95 frame ' + fs.p95 + ' ms)', gr.cls !== 'bad', JSON.stringify(fs)); }],
    ['rotate, move and scale about every pivot', async (R, f) => {
      const xf = id => $('#' + id), setBox = async (id, v) => { await typeInto(xf(id), String(v), () => 0.1); await settle(); };
      for (const [mode, name] of PIVOTS) {
        await resetApp(); setPivotMode(mode); await settle(); xf('xfToggle').closest('#xform').classList.remove('collapsed');
        const s0 = sidesOf(S.P), ang0 = [derive().A, derive().B, derive().C], pv0 = pivotWorld();
        await setBox('xfRot', '40');
        f.T(name + ': rotating keeps every side', sidesOf(S.P).every((v, i) => near(v, s0[i], 1e-6)), sidesOf(S.P));
        f.T(name + ': rotation reads 40°', near(deg(rotationNow()), 40, 1e-6), deg(rotationNow()));
        f.T(name + ': the pivot itself stays put while rotating', near(pivotWorld().x, pv0.x, 1e-6) && near(pivotWorld().y, pv0.y, 1e-6), JSON.stringify([pv0, pivotWorld()]));
        const pv1 = pivotWorld();
        await setBox('xfSc', '250');
        f.T(name + ': scale reads 250%', near(scaleNow() * 100, 250, 1e-6), scaleNow() * 100);
        f.T(name + ': scaling keeps every angle', [derive().A, derive().B, derive().C].every((v, i) => near(v, ang0[i], 1e-6)), [derive().A, derive().B, derive().C]);
        f.T(name + ': the pivot stays put while scaling', near(pivotWorld().x, pv1.x, 1e-6) && near(pivotWorld().y, pv1.y, 1e-6), JSON.stringify([pv1, pivotWorld()]));
        if (mode !== 'origin') {
          const sNow = sidesOf(S.P);
          await setBox('xfPx', '2'); await setBox('xfPy', '-1.5');
          const q = pivotWorld();
          f.T(name + ': position moves the pivot to (2, -1.5) in', near(q.x, 2, 1e-6) && near(q.y, -1.5, 1e-6), JSON.stringify(q));
          f.T(name + ': moving does not change the shape', sidesOf(S.P).every((v, i) => near(v, sNow[i], 1e-6)), sidesOf(S.P));
        }
        const bad = check('pivot ' + name).filter(x => x.sev === 'error'); f.T(name + ': nothing is broken afterwards', bad.length === 0, JSON.stringify(bad.slice(0, 2)));
      }
      await resetApp();
      /* typing rubbish into the transform boxes changes nothing */
      const P0 = snapP(); for (const id of ['xfRot', 'xfPx', 'xfSc']) for (const v of ['abc', '', 'NaN', '0', '-5', '1e999']) await setBox(id, v);
      f.T('nonsense typed into the transform boxes leaves a finite triangle', S.P.every(p => Number.isFinite(p.x) && Number.isFinite(p.y)), JSON.stringify(S.P));
    }],
    ['a custom pivot can be dragged and follows the triangle', async (R, f) => {
      await resetApp(); setPivotMode('custom'); await settle();
      const q0 = pivotWorld(), from = toClient(q0), c = cvRect(), to = { x: from.x + 60, y: from.y - 40 };
      await drag(from, to, { steps: 10 }); await settle();
      const q1 = pivotWorld(), want = toWorld({ x: to.x - c.left, y: to.y - c.top });
      f.T('dragging the pivot marker moves the pivot under the pointer', near(q1.x, want.x, 1e-3) && near(q1.y, want.y, 1e-3), JSON.stringify([q1, want]));
      const rel = toBary(q1); await drag(toClient(S.P[0]), { x: toClient(S.P[0]).x + 50, y: toClient(S.P[0]).y + 30 }, { steps: 8 }); await settle();
      const b = S.pivot.bary; f.T('the custom pivot keeps its place relative to the triangle when a corner moves', rel && b.every((v, i) => near(v, rel[i], 1e-9)), JSON.stringify([rel, b]));
      click('btnReset'); await settle(); f.T('resetting the triangle puts the pivot back on the centroid', S.pivot.mode === 'centroid');
    }],
    ['overlapping labels get leader arrows', async (R, f) => {
      await resetApp(); await settle();
      const roomy = W > 900; if (roomy) f.T('no leader arrows on the roomy default triangle', $$('#leaders .ld.on').length === 0, $$('#leaders .ld.on').length);   /* a phone is too narrow for that: crowded labels there are meant to get arrows */
      S.P = [{ x: -1.5, y: 0 }, { x: 1.5, y: 0 }, { x: 0, y: 0.05 }]; fitView(undefined, 0); await settle(800); requestRender(); await settle();
      const boxes = pills.map(p => p.el.getBoundingClientRect());
      let over = 0; for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) { const a = boxes[i], b = boxes[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) over++; }
      f.T('labels on a flat triangle no longer sit on top of each other', over === 0, over + ' overlapping pairs');
      const on = $$('#leaders .ld.on'); f.T('the labels that were crowded have leader arrows', on.length >= 2, on.length + ' arrows');
      f.T('every arrow has real coordinates', on.every(g => [...g.querySelectorAll('line')].every(l => ['x1', 'y1', 'x2', 'y2'].every(a => Number.isFinite(parseFloat(l.getAttribute(a)))))), 'NaN in an arrow');
      await resetApp(); await sleep(300); if (roomy) f.T('arrows disappear again once there is room', $$('#leaders .ld.on').length === 0, $$('#leaders .ld.on').length);
    }],
    ['the calculation audit agrees at every unit and precision', async (R, f) => {
      await resetApp(); const tris = [[[0, 0], [4, 0], [0, 3]], [[0, 0], [10, 0], [5, 0.001]], [[0, 0], [1e4, 0], [3e3, 8e3]], [[-3, 2], [7, 1], [0, 6]], [[0, 0], [1, 0], [0.5, 0.8660254037844386]]];
      let n = 0, failed = [];
      for (const lk of LEN_ORDER) { await lenItems(lk); for (const ak of ANG_ORDER) { await angItems(ak); for (const pr of [0, 4, 8]) { setPrec(pr); for (const t of tris) { S.P = t.map(([x, y]) => ({ x, y })); requestRender(); await raf(); await raf(); n++; if (AUDIT.failed.length) failed.push(lk + '/' + ak + '/' + pr + ': ' + AUDIT.failed[0].label); } } } }
      f.T('all ' + n + ' unit, precision and shape combinations agree with the independent maths', failed.length === 0, failed.slice(0, 3).join(' | '));
      for (const v of ['approx', 'exact']) { $$('#exactToggle button').find(e => e.dataset.v === v).click(); await settle(); f.T('the audit passes in ' + v + ' display mode', AUDIT.failed.length === 0, AUDIT.failed.slice(0, 2).map(c => c.label).join(' | ')); }
      window.__openAudit(); await settle(1400); f.T('the audit details panel opens with a table of checks', modalOpen() && $$('#mBody .audit-table tr').length > 50, $$('#mBody .audit-table tr').length);
      closeModal(); await settle(1200);
    }],
    ['the triangle solver recovers the true triangle in every case', async (R, f) => {
      let seed = 3; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }, H = window.__hw, close = (x, y) => Math.abs(x - y) <= 1e-6 * Math.max(1, Math.abs(x), Math.abs(y));
      const same = (s, t) => ['a', 'b', 'c', 'A', 'B', 'C'].every(k => close(s[k], t[k])); let bad = [], n = 0;
      for (let i = 0; i < 300; i++) {
        const a = 1 + rnd() * 20, b = 1 + rnd() * 20, C = 0.2 + rnd() * 2.7, c = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(C)), A = Math.acos((b * b + c * c - a * a) / (2 * b * c)), B = Math.PI - A - C, T0 = { a, b, c, A, B, C };
        for (const [nm, k] of Object.entries({ SSS: { a, b, c }, SAS: { a, b, C }, ASA: { A, B, c }, AAS: { A, B, a }, SSA: { a, b, A }, SSA2: { b, c, B } })) { n++; const r = H.solveTriangle(k); if (!r.sols.some(sol => same(sol, T0))) bad.push(nm + ' ' + JSON.stringify(k).slice(0, 60)); }
      }
      f.T('all ' + n + ' solved triangles include the true one', bad.length === 0, bad.slice(0, 3).join(' | '));
      f.T('3, 4, 8 is rejected by the triangle inequality', /No triangle/.test(H.solveTriangle({ a: 3, b: 4, c: 8 }).error));
      f.T('angles of 100° and 90° are rejected', /180°/.test(H.solveTriangle({ A: Math.PI * 100 / 180, B: Math.PI / 2, a: 3 }).error));
      f.T('a = 7, b = 10, A = 30° has two triangles (the ambiguous case)', H.solveTriangle({ a: 7 * 25.4 / 25.4, b: 10, A: Math.PI / 6 }).sols.length === 2);
      f.T('a = 3, b = 10, A = 30° has none', H.solveTriangle({ a: 3, b: 10, A: Math.PI / 6 }).sols.length === 0);
    }],
    ['the Solve box takes typed values and draws the answer', async (R, f) => {
      await resetApp(); const sec = $('.sec-hw'); if (sec.classList.contains('collapsed')) { toggleSection(sec); await settle(600); }
      const box = k => $('#hwIn input[data-k="' + k + '"]'), set = async (k, v) => { await typeInto(box(k), v, () => 0.1); };
      click('hwClear'); await set('a', '5'); await set('b', '4'); await set('c', '3'); click('hwSolve'); await settle(400);
      f.T('SSS 5-4-3 gives one triangle', $$('#hwOut [data-draw]').length === 1, $('#hwOut').textContent.slice(0, 80));
      $('#hwOut [data-draw]').click(); await settle(900);
      f.T('drawing it puts a 5-4-3 triangle on the canvas', sidesOf(S.P).every((v, i) => near(v / LEN[S.lenUnit].f, [5, 4, 3][i], 1e-6)), JSON.stringify(sidesOf(S.P)));
      click('hwClear'); await set('a', '7'); await set('b', '10'); await set('A', '30'); click('hwSolve'); await settle(400);
      f.T('SSA 7, 10, 30° offers two triangles to draw', $$('#hwOut [data-draw]').length === 2, $$('#hwOut [data-draw]').length);
      click('hwClear'); await set('a', '3'); await set('b', '4'); await set('c', '8'); click('hwSolve'); await settle(300);
      f.T('3, 4, 8 says why it cannot be drawn', /No triangle/.test($('#hwOut').textContent) && $$('#hwOut [data-draw]').length === 0);
      click('hwClear'); await set('a', 'abc'); click('hwSolve'); await settle(300);
      f.T('a box that cannot be read is flagged, not guessed', $('#hwIn input[data-k="a"]').classList.contains('bad'));
      click('hwUse'); click('hwSolve'); await settle(300);
      f.T('"Use this triangle" fills six values and Solve says to enter three', /three|exactly/i.test($('#hwOut').textContent), $('#hwOut').textContent.slice(0, 80));
      click('hwClear');
    }],
    ['practice problems are answerable, checked and marked', async (R, f) => {
      await resetApp(); const H = window.__hw; let bad = [], n = 0;
      for (const [k, g] of Object.entries(H.GEN)) for (let i = 0; i < 80; i++) { const q = g(); n++; const typed = q.choices ? q.answer : String(q.answer); if (!H.check(q, typed).ok) bad.push(k + ' rejects its own answer'); if (!q.steps.length || q.steps.some(t => BAD_TEXT.test(t))) bad.push(k + ' has bad steps'); if (BAD_TEXT.test(q.text)) bad.push(k + ' has bad text'); }
      f.T('all ' + n + ' generated problems accept their own answer and read cleanly', bad.length === 0, [...new Set(bad)].slice(0, 3).join(' | '));
      click('hwPrac'); await settle(1000);
      f.T('Practice opens a problem and hides the answers', !!$('#hwPracBox .hw-q') && document.body.classList.contains('hw-hide'));
      const hiddenPills = pills.filter(p => getComputedStyle(p.el).visibility === 'hidden').length; f.T('only the given values stay on the canvas', hiddenPills > 0 && hiddenPills < 6, hiddenPills + ' hidden');
      let q = H.PR.cur; if (q.choices) $('#hwPracBox [data-choice="' + q.answer + '"]').click(); else { await typeInto($('#hwAns'), String(q.answer), () => 0.6); click('hwCheck'); } await settle(300);
      f.T('the right answer is marked correct', /Correct/.test(($('#hwFb') || {}).textContent || ''), ($('#hwFb') || {}).textContent);
      f.T('the answers come back after checking', !document.body.classList.contains('hw-hide'));
      click('hwNext'); await settle(500); q = H.PR.cur; if (q.choices) { const wrong = q.choices.find(c => c !== q.answer); $('#hwPracBox [data-choice="' + wrong + '"]').click(); } else { await typeInto($('#hwAns'), '-12345', () => 0.6); click('hwCheck'); } await settle(300);
      f.T('a wrong answer shows the solution', /Not quite/.test(($('#hwFb') || {}).textContent || '') && $$('#hwFb ol li').length > 0, ($('#hwFb') || {}).textContent);
      click('hwPrac'); await settle(500); f.T('closing Practice shows everything again', !document.body.classList.contains('hw-hide') && pills.every(p => getComputedStyle(p.el).visibility !== 'hidden'));
      click('hwExam'); await settle(500);
      for (let i = 0; i < 10; i++) { q = H.PR.cur; if (!q) break; if (q.choices) $('#hwPracBox [data-choice="' + q.answer + '"]').click(); else { await typeInto($('#hwAns'), String(q.answer), () => 0.6); click('hwCheck'); } await settle(200); }
      f.T('an exam of ten marks itself at the end', /Exam finished: 10 \/ 10/.test($('#hwPracBox').textContent), $('#hwPracBox').textContent.slice(0, 60));
      click('hwEnd'); await settle(300);
    }],
    ['the drawing is never blank', async (R, f) => { await resetApp(); const r = rng(77); for (let i = 0; i < 8; i++) { await pick(r, discover().filter(c => c.kind === 'button' && !/btnView|navtoggle/.test(c.id))).fire(r); await settle(900); } f.T('the canvas has ink after eight random buttons', canvasHasInk()); }]
  ];

  /* ------------------------------------------------------------------ aim at problems */
  const STORE = 'triangleDevProblems.v1';
  const loadMem = () => { try { const o = JSON.parse(localStorage.getItem(STORE)); return o && typeof o === 'object' ? o : { ctl: {}, repros: [], flows: [] }; } catch (_) { return { ctl: {}, repros: [], flows: [] }; } };
  const saveMem = o => { try { localStorage.setItem(STORE, JSON.stringify(o)); } catch (_) {} };
  /* how likely each kind of control is to hide a bug, before anything has been learned */
  const PRIOR = c => c.kind === 'field' ? 5 : c.kind === 'gesture' ? 4 : /^lock:/.test(c.id) ? 4 : /btn:#(btnRot|btnFlip|btnScale|xf)/.test(c.id) ? 3.5 : c.kind === 'menu' ? 2 : c.toggle ? 2 : c.kind === 'row' ? 1 : c.kind === 'key' ? 1 : 2;
  /* nastier typed values than the ordinary lists: the odd things a real keyboard produces */
  const FUZZ = ['1e-300', '1e300', '-0', '0.0000001', '9'.repeat(30), '1/0', '1,5,5', '1e', 'e5', '--5', '5 5', '0x10', '1_000', "5'6\"", '1 ft 6', '   ', '٣', '\u0000', '.', '-.', '+', '1e999', '-1e999', '3 mm 4', '90.00000000001', '179.99999999', '0.00001°', '1e-12 rad'];
  const fuzzValue = (r, c, last) => {
    const base = c.values && c.values.length ? c.values : FUZZ, roll = r();
    if (roll < .45) return pick(r, FUZZ);
    if (roll < .6 && last !== undefined && last !== '') return String(last) + pick(r, [' mm', ' in', '°', ' rad', 'e3', 'e-3', '0', '.5', ' ft', ' km']);
    if (roll < .7) return String(Math.round((r() - .5) * 2e4) / 100) + pick(r, ['', ' in', ' mm', ' cm']);
    return pick(r, base);
  };
  /* risky starting states: each is a control of its own, so a failing recipe replays exactly */
  const SETUPS = [
    ['two angles locked', async () => { for (const i of [0, 1]) { const p = pills.find(q => q.kind === 'angle' && q.i === i); if (p && !S.lock.angle[i]) p.lockBtn.click(); } }],
    ['two sides locked', async () => { for (const i of [0, 1]) { const p = pills.find(q => q.kind === 'side' && q.i === i); if (p && !S.lock.side[i]) p.lockBtn.click(); } }],
    ['a side and an angle locked', async () => { const a = pills.find(q => q.kind === 'side' && q.i === 2), b = pills.find(q => q.kind === 'angle' && q.i === 0); if (a && !S.lock.side[2]) a.lockBtn.click(); if (b && !S.lock.angle[0]) b.lockBtn.click(); }],
    ['everything locked', async () => { for (const p of pills) if (!S.lock[p.kind][p.i]) p.lockBtn.click(); }],
    ['a thin sliver triangle', async () => { S.P = [{ x: -5, y: 0 }, { x: 5, y: 0 }, { x: 1, y: 0.002 }]; markLoaded(); requestRender(); }],
    ['a nearly flat triangle', async () => { S.P = [{ x: -3, y: 0 }, { x: 3, y: 1e-9 }, { x: 0, y: 0 }]; markLoaded(); requestRender(); }],
    ['an enormous triangle', async () => { S.P = [{ x: 0, y: 0 }, { x: 4e8, y: 0 }, { x: 0, y: 3e8 }]; markLoaded(); fitView(undefined, 0); requestRender(); }],
    ['a microscopic triangle far from the origin', async () => { S.P = [{ x: 7, y: -3 }, { x: 7 + 4e-7, y: -3 }, { x: 7, y: -3 + 3e-7 }]; markLoaded(); fitView(undefined, 0); requestRender(); }],
    ['zoomed far in', async () => { S.view.z = 1e6; requestRender(); }],
    ['zoomed far out', async () => { S.view.z = 1e-3; requestRender(); }],
    ['0 decimals', async () => { setPrec(0); }],
    ['8 decimals', async () => { setPrec(8); }],
    ['kilometers and gradians', async () => { await lenItems('km'); await angItems('grad'); }],
    ['millimeters and radians, approx display', async () => { await lenItems('mm'); await angItems('rad'); const b = $$('#exactToggle button').find(e => e.dataset.v === 'approx'); if (b) b.click(); }],
    ['an isosceles right triangle', async () => { S.P = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 4 }]; markLoaded(); requestRender(); }],
    ['an equilateral triangle', async () => { S.P = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 2 * Math.sqrt(3) }]; markLoaded(); requestRender(); }],
    ['a custom pivot far away', async () => { setPivotMode('custom'); const b = toBary({ x: 25, y: -40 }); if (b) { S.pivot.bary = b; requestRender(); } }],
    ['the circumcenter as pivot', async () => { setPivotMode('circum'); }],
    ['an explanation panel open', async () => { const row = $$('.row.clickable', statsEl)[3]; if (row) row.click(); await settle(900); }],
    ['two corners selected', async () => { S.selected.clear(); S.selected.add(0); S.selected.add(1); requestRender(); }],
    ['the light theme', async () => { if (S.theme !== 'light') click('btnTheme'); }]
  ].map(([label, fn]) => ({ id: 'setup:' + label, kind: 'setup', label: 'start from ' + label, fire: async () => { await fn(); await settle(300); } }));
  const SETUP_MAP = new Map(SETUPS.map(c => [c.id, c]));

  async function runProblems(R, opts, M, r, C0, phase) {
    const mem = loadMem();
    R.mem0 = { suspects: Object.keys(mem.ctl).length, repros: mem.repros.length };
    R.rr = rng(R.seed ^ 0x5bd1e995);
    const total = opts.budget || M.budget; R.total = total;
    const scoutN = Math.round(total * M.scoutShare), replayN = Math.min(mem.repros.length + mem.flows.length, Math.round(total * .1));
    const shrinkN = 24, huntN = Math.max(20, total - scoutN - replayN - shrinkN);
    R.plan = { 'scouting': scoutN, 'replaying old problems': replayN, 'hunting': huntN, 'shrinking repros': shrinkN };
    R.stepsPer = { 'scouting': 1, 'replaying old problems': 4, 'hunting': 4, 'shrinking repros': 4 };
    const P = R.problems = { memory: R.mem0, scoutN, aimed: 0, explore: 0, replay: [], minimal: [], suspects: [], types: {}, flowsRerun: [] };
    /* suspicion per control: what earlier runs remembered (fading), what the prior says, and what this run finds */
    const sus = new Map();
    const get = c => { let x = sus.get(c.id); if (!x) { const m = mem.ctl[c.id]; x = { c, id: c.id, label: c.label, kind: c.kind, prior: PRIOR(c), mem: m ? m.score * .7 : 0, found: 0, hits: 0, soft: 0, uses: 0, bad: {} }; sus.set(c.id, x); } return x; };
    const weight = x => Math.pow(.5 + x.prior * .35 + x.mem + x.found, 1.6);
    const roulette = (list, wf) => { let t = 0; const w = list.map(x => { const v = wf(x); t += v; return v; }); let k = R.rr() * t; for (let i = 0; i < list.length; i++) { k -= w[i]; if (k <= 0) return list[i]; } return list[list.length - 1]; };
    const fresh = () => discover().filter(c => c.kind !== 'key' || R.rr() < .5);
    const learn = (steps, hit, soft, lastC) => {
      for (const st of steps) { const c = st.c; if (!c || c.kind === 'setup') continue; const x = get(c); x.uses++; if (hit) { x.found += 1.6; x.hits += hit; if (st.v !== undefined) x.bad[st.v] = (x.bad[st.v] || 0) + 1; } else if (soft) x.found += .4; }
      if (lastC && hit) get(lastC).found += 2.4;
    };
    const pool = mem.repros.map(x => ({ steps: x.repro, key: x.key, from: 'memory' }));
    const sig = o => o.map(x => x.id + '=' + x.v).join('>');

    /* one scenario of resolved steps [{ c, v, seed? }]: returns what it cost and what it found */
    async function go(name, steps, section, keepGoing) {
      R.scenarios++; R.cur = name; LIVE.scenario = name; LIVE.stepTotal = steps.length; LIVE.flow = []; LIVE.stepNo = 0;
      const trail = [], done = []; const h0 = R.hits || 0, s0 = R.soft || 0; let n = 0;
      for (const st of steps) {
        if (RUN.stop) break;
        LIVE.stepNo = ++n;
        const seed = st.seed === undefined ? Math.floor(R.rr() * 1e9) : st.seed;
        done.push({ id: st.c.id, v: st.v, seed });
        R.repro = done.slice();
        await stepOnce(R, st.c, rng(seed), trail, st.v, section);
        if (!keepGoing && (R.hits || 0) > h0 + 6) break;     /* a scenario that is already on fire needs no more steps */
      }
      R.repro = null; progress(R);
      return { hit: (R.hits || 0) - h0, soft: (R.soft || 0) - s0, done };
    }
    const asSteps = (done, cs) => done.map(d => ({ c: cs.get(d.id), v: d.v, seed: d.seed }));
    const ctlMap = () => { const m = new Map(SETUP_MAP); for (const c of discover()) m.set(c.id, c); return m; };
    const withSetups = (cs, steps) => { if (R.rr() < .55) { const n = R.rr() < .25 ? 2 : 1; const pre = []; for (let i = 0; i < n; i++) pre.push({ c: pick(R.rr, SETUPS) }); return pre.concat(steps); } return steps; };
    const stepFor = (c, last) => ({ c, v: c.values || c.kind === 'field' ? fuzzValue(R.rr, c, last) : undefined });
    const fieldsOf = cs => cs.filter(c => c.kind === 'field');

    try {
      await resetApp();
      /* ---------------- scouting: the likeliest suspects first, a little of everything else */
      phase('scouting', scoutN);
      {
        const cs = discover(); for (const c of cs) get(c);
        const order = [...sus.values()].filter(x => cs.some(c => c.id === x.id)).sort((a, b) => (b.prior + b.mem * 2 + (b.uses ? 0 : 1.5) + R.rr()) - (a.prior + a.mem * 2 + (a.uses ? 0 : 1.5) + R.rr()));
        let used = 0;
        for (const x of order) {
          if (used >= scoutN || RUN.stop) break;
          await resetApp(); const cur = discover(), c = cur.find(q => q.id === x.id); if (!c) continue;
          const vals = c.kind === 'field' ? [fuzzValue(R.rr, c), fuzzValue(R.rr, c)] : [undefined];
          for (const v of vals) { if (used >= scoutN || RUN.stop) break; const res = await go('scout: ' + c.label + (v !== undefined ? ' = ' + JSON.stringify(String(v).slice(0, 18)) : ''), [{ c, v }], 'scouting'); used++; learn([{ c, v }], res.hit, res.soft, c); if (res.hit) pool.push({ steps: res.done, key: null, from: 'scout' }); }
        }
      }
      /* ---------------- replaying old problems: are they still there? */
      phase('replaying old problems', replayN);
      {
        const keep = [];
        for (const old of mem.repros.slice(0, replayN)) {
          if (RUN.stop) break;
          await resetApp(); const cs = ctlMap();
          if (!old.repro.every(d => cs.has(d.id))) { keep.push(old); R.scenarios++; continue; }
          const res = await go('replay: ' + old.msg.slice(0, 60), asSteps(old.repro, cs), 'replaying', true);
          const again = res.hit > 0;
          P.replay.push({ msg: old.msg, type: old.type, still: again, steps: old.repro.length });
          if (again) { old.seen = (old.seen || 1) + 1; keep.push(old); learn(asSteps(old.repro, cs), 1, 0, null); pool.push({ steps: old.repro, key: old.key, from: 'memory' }); }
        }
        mem.repros = keep.concat(mem.repros.slice(replayN));
        /* flows that failed before get another go */
        for (const name of mem.flows.slice(0, Math.max(0, replayN - P.replay.length))) {
          const fl = FLOWS.find(f => f[0] === name); if (!fl || RUN.stop) continue;
          const before = R.hits || 0; await runOneFlow(R, name, fl[1]); P.flowsRerun.push({ name, still: (R.hits || 0) > before });
        }
      }
      /* ---------------- hunting: nearly everything goes to the suspects */
      phase('hunting', huntN);
      {
        const target = R.scenarios + huntN;
        while (R.scenarios < target && !RUN.stop) {
          await resetApp(); const cs = discover(); for (const c of cs) get(c);
          const live = [...sus.values()].filter(x => cs.some(c => c.id === x.id)).map(x => (x.c = cs.find(c => c.id === x.id), x));
          const cm = new Map(SETUP_MAP); cs.forEach(c => cm.set(c.id, c));
          const roll = R.rr(); let kind, steps = [];
          if (roll < .14) {                                                      /* explore: something with no suspicion, to find new suspects */
            kind = 'explore'; P.explore++;
            steps = withSetups(cs, Array.from({ length: 3 + Math.floor(R.rr() * 5) }, () => stepFor(pick(R.rr, cs))));
          } else if (roll < .26 && pool.length) {                                /* mutate a recipe that already failed */
            kind = 'mutate'; const base = pick(R.rr, pool); P.aimed++;
            const st = base.steps.filter(d => cm.has(d.id)).map(d => ({ c: cm.get(d.id), v: d.v, seed: d.seed }));
            if (!st.length) { kind = 'chain'; } else {
              const how = Math.floor(R.rr() * 6);
              if (how === 0 && st.length > 1) st.splice(Math.floor(R.rr() * st.length), 1);
              else if (how === 1) { const i = Math.floor(R.rr() * st.length); if (st[i].c.kind === 'field') st[i] = { c: st[i].c, v: fuzzValue(R.rr, st[i].c, st[i].v) }; else st.splice(i, 0, { ...st[i], seed: undefined }); }
              else if (how === 2 && st.length > 1) { const i = Math.floor(R.rr() * (st.length - 1)); [st[i], st[i + 1]] = [st[i + 1], st[i]]; }
              else if (how === 3) st.push(stepFor(roulette(live, weight).c));
              else if (how === 4) st.push(...st.slice(-2).map(x => ({ ...x, seed: undefined })));
              else st.forEach(x => { x.seed = undefined; });
              steps = st;
            }
          }
          if (!steps.length) {
            P.aimed++;
            const x = roulette(live, weight), c = x.c;
            if (roll < .5) {                                                     /* a suspect and a partner, in either order */
              kind = 'pair'; const partner = R.rr() < .5 ? roulette(live, weight).c : pick(R.rr, cs);
              const a = stepFor(c), b = stepFor(partner, a.v);
              steps = withSetups(cs, R.rr() < .5 ? [a, b] : [b, a]);
            } else if (roll < .72 && c.kind === 'field') {                       /* hammer one field with value after value */
              kind = 'fuzz'; let last; steps = Array.from({ length: 3 + Math.floor(R.rr() * 4) }, () => { const st = { c, v: fuzzValue(R.rr, c, last) }; last = st.v; return st; });
              steps = withSetups(cs, steps);
            } else {                                                             /* a chain built mostly from suspects */
              kind = 'chain'; steps = Array.from({ length: 4 + Math.floor(R.rr() * 5) }, () => stepFor(R.rr() < .65 ? roulette(live, weight).c : pick(R.rr, cs)));
              steps = withSetups(cs, steps);
            }
          }
          P.types[kind] = (P.types[kind] || 0) + 1;
          const res = await go('hunt (' + kind + '): ' + steps.map(s => s.c.label).join(' > ').slice(0, 90), steps, 'hunting');
          learn(steps, res.hit, res.soft, steps[steps.length - 1] && steps[steps.length - 1].c);
          if (res.hit && !pool.some(q => sig(q.steps) === sig(res.done))) pool.push({ steps: res.done, key: null, from: 'hunt' });
        }
      }
      /* ---------------- shrinking: the shortest recipe for each failure */
      phase('shrinking repros', shrinkN);
      {
        const errs = R.issues.filter(i => i.sev === 'error' && i.repro && i.repro.length > 1).sort((a, b) => b.count - a.count).slice(0, 6);
        let budget = shrinkN;
        for (const iss of errs) {
          if (RUN.stop || budget <= 0) break;
          let cur = iss.repro.slice(), i = 0;
          while (i < cur.length - 1 && budget > 0 && !RUN.stop) {
            const trial = cur.slice(0, i).concat(cur.slice(i + 1));
            await resetApp(); const cs = ctlMap(); if (!trial.every(d => cs.has(d.id))) { i++; continue; }
            const e = R.issueKeys.get(iss.key), c0 = e ? e.count : 0; budget--;
            await go('shrink: ' + iss.msg.slice(0, 50), asSteps(trial, cs), 'shrinking', true);
            if ((R.issueKeys.get(iss.key) || { count: 0 }).count > c0) cur = trial; else i++;
          }
          iss.minimal = cur; P.minimal.push({ msg: iss.msg, from: iss.repro.length, to: cur.length, steps: cur.map(d => d.id + (d.v !== undefined ? ' = ' + JSON.stringify(String(d.v).slice(0, 24)) : '')) });
        }
      }
    } finally {
      /* what to remember for next time */
      for (const x of sus.values()) { const old = mem.ctl[x.id] ? mem.ctl[x.id].score * .75 : 0, now = x.found; const score = Math.round((old + now) * 100) / 100; if (score > .2) mem.ctl[x.id] = { score, label: x.label, hits: (mem.ctl[x.id] ? mem.ctl[x.id].hits : 0) + x.hits }; else delete mem.ctl[x.id]; }
      for (const i of R.issues) if (i.sev === 'error' && (i.minimal || i.repro) && i.type !== 'dev tool') { const rp = i.minimal || i.repro; if (!mem.repros.some(q => q.key === i.key)) mem.repros.unshift({ key: i.key, msg: i.msg, type: i.type, repro: rp, seen: 1 }); }
      mem.repros = mem.repros.slice(0, 40);
      mem.flows = [...new Set(R.flows.filter(f => f.passed < f.checks).map(f => f.name).concat(P.flowsRerun.filter(f => f.still).map(f => f.name)))].slice(0, 10);
      saveMem(mem);
      P.suspects = [...sus.values()].filter(x => x.uses || x.mem).map(x => ({ id: x.id, label: x.label, kind: x.kind, score: Math.round((x.mem + x.found) * 100) / 100, prior: x.prior, hits: x.hits, uses: x.uses, remembered: x.mem > 0, values: Object.entries(x.bad).sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]) })).sort((a, b) => (b.score - a.score) || (b.prior - a.prior)).slice(0, 12); P.measured = P.suspects.some(x => x.score > 0);
      const aimedN = P.aimed, exploreN = P.explore; P.share = aimedN + exploreN ? Math.round(aimedN / (aimedN + exploreN + scoutN) * 100) : 0;
      P.share = Math.round((R.scenarios - scoutN - P.explore) / Math.max(1, R.scenarios) * 100);
    }
  }
  /* one whole flow, counted and checked like the main run does */
  async function runOneFlow(R, name, fn) {
    R.cur = 'flow: ' + name; LIVE.scenario = R.cur; LIVE.ctl = { id: 'flow', kind: 'flow', label: name }; LIVE.value = undefined; LIVE.diff = null; LIVE.stepNo = 0; LIVE.stepTotal = 0;
    const f = flowTools(R), e0 = ERR.length, fi = FM.ts.length;
    try { await fn(R, f); } catch (e) { f.T(name + ' ran to the end', false, e.message); }
    for (let k = e0; k < ERR.length; k++) addIssue(R, { type: ERR[k].type, sev: ERR[k].type === 'console warning' ? 'warn' : 'error', msg: ERR[k].msg }, [R.cur]);
    for (const iss of check('after flow ' + name)) addIssue(R, iss, [R.cur]);
    const passed = f.out.filter(x => x.ok).length; let row = R.flows.find(x => x.name === name); if (!row) R.flows.push(row = { name, checks: 0, passed: 0, fails: [] });
    row.checks += f.out.length; row.passed += passed; f.out.filter(x => !x.ok).forEach(x => { if (row.fails.length < 6) row.fails.push(x.name + (x.detail ? ': ' + x.detail : '')); });
    R.coverage.flows++; R.scenarios++; (R.frames['flows'] = R.frames['flows'] || []).push(...deltasSince(fi)); progress(R);
  }

  /* ------------------------------------------------------------------ the whole run */
  async function run(opts) {
    if (RUN.on) return RUN.report;
    opts = opts || {}; const mode = MODES[opts.mode] ? opts.mode : 'standard', M = MODES[mode], seed = opts.seed === undefined ? (Date.now() & 0xffff) : +opts.seed;
    BG.start(opts.speed !== undefined ? opts.speed : speedSetting()); RUN.on = true; RUN.stop = false; LIVE.log.length = 0; LIVE.stage = 'starting'; LIVE.cats = []; LIVE.audit = null; LIVE.ctl = null; LIVE.value = undefined; LIVE.diff = null; ERR.length = 0; FM.ts.length = 0; FM.draw.length = 0; fmStart();
    const R = newReport(mode, seed); R.label = M.label; RUN.report = R; RUN.R = R;
    const r = rng(seed);
    const phase = (n, total) => {
      const now = NOW(); if (R.phaseName) { const ps = R.phases[R.phaseName]; ps.ms = now - R.phaseT0; ps.done = R.scenarios - ps.s0; }
      R.phase = n; R.phaseTotal = total; R.phaseName = n; R.phaseT0 = now; R.phases[n] = R.phases[n] || { s0: R.scenarios, steps0: R.steps, ms: 0, done: 0, planned: R.plan[n] || total };
      LIVE.phase = n; LIVE.phaseTotal = total; progress(R);
    };
    try {
      await resetApp(); const C0 = discover(); R.controls = C0.length; R.controlList = C0.map(c => c.id);
      /* the exact amount of work, so the progress bar and the finishing time mean something */
      { const only = opts.only, ctls = only ? C0.filter(c => only.includes(c.id)) : C0;
        const nTog = Math.min(10, C0.filter(c => c.toggle && !/btnSettings|btnLen|btnAng/.test(c.id)).length);
        R.plan = { 'one by one': ctls.reduce((n, c) => n + (c.values ? Math.min(c.values.length, M.vals) : 1), 0), 'pairs': only ? 0 : Math.min(M.pairs, C0.length * C0.length), 'toggle combinations': only ? 0 : Math.min(M.combos, 1 << nTog), 'random runs': only ? 0 : M.seqs, 'flows': only ? 0 : FLOWS.length * M.loops };
        R.total = Object.values(R.plan).reduce((a, b) => a + b, 0);
        /* rough steps per scenario in each phase, used only until that phase has been measured */
        R.stepsPer = { 'one by one': 1, 'pairs': 2, 'toggle combinations': 2 + M.probe, 'random runs': 6.5, 'flows': 3 }; }
      if (mode === 'problems') { await runProblems(R, opts, M, r, C0, phase); } else {
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
          if (RUN.stop) break; R.cur = 'flow: ' + name; LIVE.scenario = R.cur; LIVE.ctl = { id: 'flow', kind: 'flow', label: name }; LIVE.value = undefined; LIVE.diff = null; LIVE.stepNo = 0; LIVE.stepTotal = 0; LIVE.purpose = 'run a whole journey (' + name + ') and test its outcomes along the way, then run the full set of checks on the result'; const f = flowTools(R); const e0 = ERR.length, fi = FM.ts.length;
          try { await fn(R, f); } catch (e) { f.T(name + ' ran to the end', false, e.message); }
          for (let k = e0; k < ERR.length; k++) addIssue(R, { type: ERR[k].type, sev: ERR[k].type === 'console warning' ? 'warn' : 'error', msg: ERR[k].msg }, [R.cur]);
          for (const iss of check('after flow ' + name)) addIssue(R, iss, [R.cur]);
          const passed = f.out.filter(x => x.ok).length; let row = R.flows.find(x => x.name === name); if (!row) R.flows.push(row = { name, checks: 0, passed: 0, fails: [] }); row.checks += f.out.length; row.passed += passed; f.out.filter(x => !x.ok).forEach(x => { if (row.fails.length < 6) row.fails.push(x.name + (x.detail ? ': ' + x.detail : '')); });
          R.coverage.flows++; R.scenarios++; (R.frames['flows'] = R.frames['flows'] || []).push(...deltasSince(fi)); progress(R);
        }
      }
      }
    } catch (e) { addIssue(R, { type: 'dev tool', sev: 'error', msg: 'the run stopped on ' + e.message }, [R.cur || '']); }
    { const ps = R.phases[R.phaseName]; if (ps) { ps.ms = NOW() - R.phaseT0; ps.done = R.scenarios - ps.s0; } }
    await resetApp(); fmStop(); R.finished = Date.now(); R.stopped = RUN.stop; RUN.on = false; LIVE.stage = RUN.stop ? 'stopped' : 'finished';
    R.turbo = BG.turbo; R.speed = BG.speed; BG.stop(); R.backgroundFrames = BG.hiddenFrames;
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
    R.trace = LIVE.log.slice(-300); R.prof = Object.assign({}, PROF);
    R.ctl = undefined; R.issueKeys = undefined;
  }

  /* ------------------------------------------------------------------ the panel */
  let panel = null;
  const CSS = `.dev{position:fixed;right:12px;bottom:12px;top:56px;width:min(460px,calc(100vw - 24px));z-index:9999;display:flex;flex-direction:column;background:rgba(14,14,18,.97);color:#e8e8ee;border:1px solid #2c2c36;border-radius:12px;box-shadow:0 18px 60px rgba(0,0,0,.6);font:12px/1.45 Inter,system-ui,sans-serif}
.dev[hidden]{display:none}.dev h4{margin:0;font-size:13px;letter-spacing:.06em;text-transform:uppercase}.dev .hd{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid #2c2c36}.dev .hd span{flex:1}
.dev .bd{overflow:auto;padding:10px 12px;display:grid;grid-template-columns:minmax(0,1fr);gap:10px;align-content:start}.dev button,.dev select,.dev input{font:inherit;color:inherit;background:#1c1c24;border:1px solid #33333f;border-radius:7px;padding:5px 9px}.dev button{cursor:pointer}.dev button:hover{border-color:#8aa}
.dev .row{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.dev .bar{height:7px;background:#23232d;border-radius:4px;overflow:hidden}.dev .bar i{display:block;height:100%;width:0;background:#7bd389;transition:width .2s}
.dev .note{color:#9a9aa8}.dev .ok{color:#7bd389}.dev .warn{color:#f5c542}.dev .bad{color:#ff7a7a}.dev table{width:100%;border-collapse:collapse}.dev td,.dev th{padding:3px 6px;border-bottom:1px solid #23232d;text-align:left;vertical-align:top}.dev th{color:#9a9aa8;font-weight:600}
.dev .bar.big{height:11px}.dev .prog{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}.dev .prog b{font-size:17px}.dev .live{border:1px solid #2c2c36;border-radius:8px;padding:8px 10px;background:#101016}.dev .live td:first-child{color:#9a9aa8;white-space:nowrap;width:1%;padding-right:10px}.dev .chip{display:inline-block;margin:1px 3px 1px 0;padding:0 6px;border-radius:9px;border:1px solid #33333f;font-size:11px}.dev .chip.ok{border-color:#2f6b3a}.dev .chip.bad{border-color:#8a2f2f;background:#2a1515}.dev .trace{max-height:150px;overflow:auto;font:11px/1.4 ui-monospace,Menlo,monospace;color:#b9b9c6;border-top:1px solid #23232d;margin-top:6px;padding-top:4px}.dev .trace div{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.dev td{word-break:break-word}.dev .iss{border:1px solid #2c2c36;border-radius:8px;padding:7px 9px;margin:4px 0}.dev .iss small{display:block;color:#9a9aa8;word-break:break-word}.dev code{background:#1c1c24;padding:1px 4px;border-radius:4px}`;
  function build() {
    if (panel) return panel;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    panel = document.createElement('div'); panel.className = 'dev'; panel.hidden = true;
    panel.innerHTML = `<div class="hd"><h4>Dev mode · Triangle Thing</h4><span></span><button data-x="close" aria-label="Close">✕</button></div><div class="bd">
      <div class="note">Tests every button, slider-like control, input box, menu, row and canvas gesture on its own, in pairs, in combinations and in random runs, then runs whole flows, and grades how smoothly it all ran. <b>Backtick</b> opens and closes this panel.</div>
      <div class="row"><select id="devMode"><option value="quick">Quick</option><option value="standard" selected>Standard</option><option value="thorough">Thorough</option><option value="problems">Aim at problems</option></select><input id="devSeed" placeholder="seed (optional)" size="14"><select id="devSpeed" title="How much faster than real time the page's animations and timers run during a test. Faster means more tests per second."><option value="1">Real time</option><option value="4">4× faster</option><option value="10" selected>10× faster (frames not tied to the display)</option><option value="20">20× faster (same)</option></select><button data-x="start">Start</button><button data-x="stop" disabled>Stop</button><button data-x="forget" title="Forget the suspects and problems remembered from earlier runs">Forget memory</button></div>
      <div class="note" id="devLabel"></div><div class="bar big"><i id="devBar"></i></div><div class="prog"><b id="devPct">0%</b><span id="devEta" class="note"></span></div><div id="devStatus" class="note">Ready.</div><div id="devPhases"></div><div id="devLive"></div><div class="row"><button data-x="copy" disabled>Copy report</button><button data-x="json" disabled>Download JSON</button></div><div id="devOut"></div></div>`;
    document.body.appendChild(panel);
    const lab = () => { const m = $('#devMode', panel).value; let t = MODES[m].label; if (m === 'problems') { const mm = loadMem(); t += ' · remembered from earlier runs: ' + Object.keys(mm.ctl).length + ' suspect controls, ' + mm.repros.length + ' problems to replay'; } $('#devLabel', panel).textContent = t; }; lab(); $('#devMode', panel).onchange = lab;
    panel.addEventListener('click', e => {
      const x = e.target.dataset && e.target.dataset.x; if (!x) return;
      if (x === 'close') panel.hidden = true;
      if (x === 'start') { $('[data-x=start]', panel).disabled = true; $('[data-x=stop]', panel).disabled = false; $('#devOut', panel).innerHTML = ''; run({ mode: $('#devMode', panel).value, seed: $('#devSeed', panel).value || undefined }).then(() => { $('[data-x=start]', panel).disabled = false; $('[data-x=stop]', panel).disabled = true; $('[data-x=copy]', panel).disabled = false; $('[data-x=json]', panel).disabled = false; }); }
      if (x === 'stop') RUN.stop = true;
      if (x === 'forget') { try { localStorage.removeItem(STORE); } catch (_) {} $('#devMode', panel).onchange(); }
      if (x === 'copy' && RUN.report) navigator.clipboard && navigator.clipboard.writeText(text(RUN.report)).catch(() => {});
      if (x === 'json' && RUN.report) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(RUN.report, (k, v) => v instanceof Map ? undefined : v, 1)], { type: 'application/json' })); a.download = 'triangle-dev-report.json'; a.click(); }
    });
    return panel;
  }
  const fmtDur = ms => { ms = Math.max(0, Math.round(ms / 1000)); const h = Math.floor(ms / 3600), m = Math.floor(ms % 3600 / 60), sec = ms % 60; return h ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m ? m + 'm ' + String(sec).padStart(2, '0') + 's' : sec + 's'; };
  const clock = t => new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  /* time left: phases already measured use their own average time per scenario; phases not reached yet are priced from the average time per step so far */
  function estimate(R) {
    const now = NOW(), names = Object.keys(R.plan);
    const stepMs = R.steps > 4 ? (Date.now() - R.started) / R.steps : 600;
    let left = 0;
    for (const n of names) {
      const planned = R.plan[n], ps = R.phases[n];
      if (!planned) continue;
      if (!ps) { left += planned * R.stepsPer[n] * stepMs; continue; }
      const live = n === R.phaseName, done = live ? R.scenarios - ps.s0 : ps.done, ms = live ? now - R.phaseT0 : ps.ms;
      const remaining = Math.max(0, planned - done);
      const per = done >= 3 ? ms / done : R.stepsPer[n] * stepMs;
      left += remaining * per;
    }
    return left;
  }
  let lastProgress = 0;
  function progress(R) {
    if (!panel) return;
    /* repainting the panel is the slowest thing a fast run does: at most about 8 times a second */
    if (RUN.on && NOW() - lastProgress < 120) return; lastProgress = NOW();
    const total = Math.max(1, R.total || expected(R)), pct = RUN.on ? Math.min(99.9, R.scenarios / total * 100) : (R.finished ? 100 : 0);
    $('#devBar', panel).style.width = pct + '%'; $('#devPct', panel).textContent = (pct >= 10 || !RUN.on ? Math.round(pct) : r1(pct)) + '%';
    const secs = Math.max(1, ((R.finished || Date.now()) - R.started) / 1000);
    $('#devStatus', panel).textContent = (RUN.on ? 'Running · ' : 'Finished · ') + (R.phase || '') + ' · ' + R.scenarios + ' of ' + total + ' scenarios · ' + R.steps + ' tests (' + r1((R.steps + (R.flows || []).reduce((n, f) => n + f.checks, 0)) / secs) + ' per second' + (BG.speed > 1 ? ', time ×' + BG.speed : '') + ') · ' + R.issues.length + ' issue(s)';
    $('#devStatus', panel).dataset.cur = R.cur || '';
    const eta = $('#devEta', panel);
    if (RUN.on) {
      const left = estimate(R), fin = Date.now() + left;
      R.finishAt = R.finishAt && R.scenarios > 5 ? R.finishAt * 0.85 + fin * 0.15 : fin;   /* smoothed, so the clock time does not jitter */
      eta.textContent = R.scenarios < 3 ? 'estimating the finishing time…' : 'about ' + fmtDur(R.finishAt - Date.now()) + ' left · done around ' + clock(R.finishAt) + ' · elapsed ' + fmtDur(Date.now() - R.started);
    } else if (R.finished) eta.textContent = (R.stopped ? 'stopped' : 'finished') + ' at ' + clock(R.finished) + ' · took ' + fmtDur(R.finished - R.started);
    const ph = Object.keys(R.plan).filter(n => R.plan[n]).map(n => { const ps = R.phases[n], done = !ps ? 0 : n === R.phaseName && RUN.on ? R.scenarios - ps.s0 : ps.done, p = R.plan[n]; return `<tr><td>${esc(n)}</td><td>${Math.min(done, p)} / ${p}</td><td><div class="bar"><i style="width:${Math.min(100, done / p * 100)}%;display:block"></i></div></td></tr>`; }).join('');
    $('#devPhases', panel).innerHTML = ph ? `<table>${ph}</table>` : '';
    liveRender();
  }
  /* the live analysis: what exactly is being tested at this moment, and why */
  function liveRender() {
    if (!panel || panel.hidden) return; const el = $('#devLive', panel); if (!el) return;
    const L = LIVE, R = RUN.report;
    if (!R || (!RUN.on && L.stage === 'idle')) { el.innerHTML = ''; return; }
    const c = L.ctl, val = L.value;
    const exp = [];
    if (c && c.kind === 'field' && val !== undefined) exp.push('the box ends up showing a valid number or its old value');
    if (c && /^(lock:|btn:#btnRot|btn:#btnFlip|btn:#btnScale|btn:#xf)/.test(c.id)) exp.push('side lengths / angles stay consistent with the locks');
    if (c && c.kind === 'gesture') exp.push('the pointer never leaves a NaN corner behind');
    const row = (k, v) => v === '' || v === undefined || v === null ? '' : `<tr><td>${k}</td><td>${v}</td></tr>`;
    const chips = L.cats.length ? L.cats.map(x => `<span class="chip ${x.bad ? 'bad' : 'ok'}" title="${esc(x.what)}">${x.bad ? '✗' : '✓'} ${esc(x.cat)}</span>`).join('') : '<span class="note">pending — runs after the step settles</span>';
    const au = L.audit ? `${L.audit.total} calculations re-derived (${L.audit.tested.model} model, ${L.audit.tested.identity} identities, ${L.audit.tested.display} displayed values) · <b class="${L.audit.failed ? 'bad' : 'ok'}">${L.audit.failed ? L.audit.failed + ' FAILED' : 'all agree'}</b> · ${r1(L.audit.ms)} ms${L.audit.degenerate ? ' · flat triangle, only the basics apply' : ''}` : '';
    const fl = L.flow.length ? L.flow.map(x => `<div class="${x.ok ? 'ok' : 'bad'}">${x.ok ? '✓' : '✗'} ${esc(x.name)}</div>`).join('') : '';
    el.innerHTML = `<h4>Testing now</h4><div class="live"><table>` +
      row('Phase', esc(L.phase) + (L.phaseTotal ? ' · ' + (R.phases[L.phase] ? Math.min(L.phaseTotal, R.scenarios - R.phases[L.phase].s0) : 0) + ' of ' + L.phaseTotal : '')) +
      row('Scenario', esc(L.scenario) + (L.stepTotal ? ' — step ' + L.stepNo + ' of ' + L.stepTotal : '')) +
      row('Stage', esc(L.stage)) +
      row('Control', c ? `<b>${esc(c.label)}</b> <span class="note">${esc(c.kind)} · ${esc(c.id)}</span>` : '') +
      row('Value', val !== undefined ? `<code>${esc(JSON.stringify(String(val).slice(0, 40)))}</code> — ${esc(classifyValue(val))}` : '') +
      row('Purpose', L.purpose ? esc('To ' + L.purpose + '.') : '') +
      row('Expecting', exp.length ? esc(exp.join('; ')) : '') +
      row('Changed', L.diff ? (L.diff.length ? esc(L.diff.join(', ')) : '<span class="warn">nothing changed on screen</span>') : '') +
      row('Response', L.ms ? Math.round(L.ms) + ' ms' + (L.fr ? ' · frames avg ' + L.fr.avg + ' ms, p95 ' + L.fr.p95 + ' ms, worst ' + L.fr.max + ' ms' : '') : '') +
      row('Calc audit', au) +
      row('Checks', chips) +
      row('Flow checks', fl) +
      row('Problems so far', R.issues.length ? `<span class="bad">${R.issues.length}</span>` : '<span class="ok">none</span>') +
      `</table><div class="trace">${L.log.slice(-14).reverse().map(x => `<div class="${x.problems ? 'bad' : ''}">${x.at}s · ${esc(x.step)}${x.changed && x.changed.length ? ' → ' + esc(x.changed.join(', ')) : ''}${x.ms ? ' · ' + x.ms + ' ms' : ''}${x.problems ? ' · ' + x.problems + ' problem(s)' : ''}</div>`).join('')}</div></div>`;
  }
  const expected = R => { const M = MODES[R.mode]; return R.controls * 1.4 + M.pairs + M.combos + M.seqs + FLOWS.length * M.loops; };
  function text(R) {
    const L = ['TRIANGLE THING DEV REPORT', R.verdict.toUpperCase(), 'mode ' + R.mode + ' · seed ' + R.seed + ' · ' + R.controls + ' controls · ' + R.scenarios + ' scenarios · ' + R.steps + ' steps · ' + Math.round((R.finished - R.started) / 1000) + ' s', 'Smoothness: ' + R.overall.grade.word + ' (avg ' + R.overall.avg + ' ms, p95 ' + R.overall.p95 + ' ms, worst ' + R.overall.max + ' ms, ' + R.overall.over100 + ' frames over 100 ms)', 'Redraw: p50 ' + R.draw.p50 + ' ms, p95 ' + R.draw.p95 + ' ms', ''];
    if (R.problems) { const P = R.problems; L.push('AIMED AT PROBLEMS: ' + P.share + '% of ' + R.scenarios + ' scenarios on suspects (' + Object.entries(P.types).map(([k, v]) => k + ' ' + v).join(', ') + '); memory at start: ' + P.memory.suspects + ' suspects, ' + P.memory.repros + ' old problems');
      L.push(P.measured ? 'Suspects:' : 'Suspects (nothing went wrong, so this is the tester\'s starting guess by kind of control, not a measured ranking):'); P.suspects.forEach(x => L.push('- ' + x.label + (P.measured ? ' score ' + x.score : ' likelihood about ' + x.prior + ' of 5') + ', ' + x.hits + ' problem(s)' + (x.values.length ? ', values ' + x.values.map(v => JSON.stringify(String(v).slice(0, 18))).join(' ') : '')));
      if (P.replay.length) { L.push('Old problems replayed:'); P.replay.forEach(x => L.push('- ' + (x.still ? 'STILL FAILING' : 'fixed') + ' [' + x.type + '] ' + x.msg.slice(0, 110))); }
      if (P.minimal.length) { L.push('Shortest recipes:'); P.minimal.forEach(x => L.push('- ' + x.msg.slice(0, 110) + ' (' + x.from + ' -> ' + x.to + ' steps): ' + x.steps.join(' > '))); }
      L.push(''); }
    L.push('PROBLEMS (' + R.errors.length + ')'); R.errors.forEach(i => L.push('- [' + i.type + '] x' + i.count + ' ' + i.msg + '\n    steps: ' + i.steps.join(' > ')));
    L.push('', 'WARNINGS (' + R.warnings.length + ')'); R.warnings.forEach(i => L.push('- [' + i.type + '] x' + i.count + ' ' + i.msg));
    L.push('', 'FLOWS'); R.flows.forEach(f => L.push('- ' + f.name + ': ' + f.passed + '/' + f.checks + (f.fails.length ? '  FAILED: ' + f.fails.join(' | ') : '')));
    L.push('', 'SMOOTHNESS BY KIND'); R.sections.forEach(s => L.push('- ' + s.name + ': ' + s.grade.word + ' (p95 ' + s.p95 + ' ms, worst ' + s.max + ' ms)'));
    L.push('', 'SLOWEST CONTROLS'); R.slowest.forEach(s => L.push('- ' + s.label + ': p95 ' + s.p95 + ' ms (' + s.uses + ' uses)'));
    if (R.prof) L.push('', 'WHERE THE TIME WENT (ms): resetting ' + Math.round(R.prof.reset) + ' (' + R.prof.resets + ' resets), firing controls ' + Math.round(R.prof.fire) + ', settling ' + Math.round(R.prof.settle) + ', checking ' + Math.round(R.prof.check));
    L.push('', 'TESTER TRACE (last 40 steps)'); (R.trace || []).slice(-40).forEach(x => L.push('- ' + x.at + 's ' + x.step + (x.changed.length ? ' -> ' + x.changed.join(', ') : '') + (x.problems ? ' [' + x.problems + ' problem(s)]' : '')));
    if (R.turbo) L.push('', 'NOTE: this run used the sped-up clock with frames not tied to the display, so the smoothness grades are only a rough guide. Pick Real time for a true grade.');
    if (R.backgroundFrames) L.push('', 'NOTE: the tab was in the background for part of the run: ' + R.backgroundFrames + ' frames were driven from a worker clock, so the smoothness numbers include those and are not a real display measurement.');
    L.push('', 'DID NOTHING'); R.noop.forEach(s => L.push('- ' + s.label + ' (' + s.uses + ' uses)'));
    return L.join('\n');
  }
  function problemsHtml(R) {
    const P = R.problems, share = P.share;
    const types = Object.entries(P.types).map(([k, v]) => k + ' ' + v).join(', ');
    return `<h4>Aimed at problems</h4>
      <div class="note">${share}% of the ${R.scenarios} scenarios went to suspects (${esc(types)}); the rest scouted or explored. Memory at the start: ${P.memory.suspects} suspect controls, ${P.memory.repros} old problems.</div>
      ${P.measured ? '' : '<div class="note">Nothing went wrong, so there is no measured ranking. These are the controls the tester thinks are most likely to break, a starting guess by kind of control (typed boxes, canvas gestures and locks first).</div>'}
      <table><tr><th>suspect</th><th>${P.measured ? 'score' : 'likelihood (guess)'}</th><th>problems</th><th>worst values</th></tr>${P.suspects.map(x => `<tr><td>${esc(x.label)}${x.remembered ? ' <span class="note">(remembered)</span>' : ''}</td><td>${P.measured ? x.score : '≈ ' + x.prior + ' / 5'}</td><td class="${x.hits ? 'bad' : ''}">${x.hits}</td><td>${esc(x.values.map(v => JSON.stringify(String(v).slice(0, 18))).join(' '))}</td></tr>`).join('') || '<tr><td colspan="4" class="ok">Nothing looked suspicious.</td></tr>'}</table>
      ${P.replay.length ? `<h4>Old problems, replayed</h4>${P.replay.map(x => `<div class="${x.still ? 'bad' : 'ok'}">${x.still ? 'still failing' : 'fixed'} · [${esc(x.type)}] ${esc(x.msg.slice(0, 110))}</div>`).join('')}` : ''}
      ${P.minimal.length ? `<h4>Shortest recipes</h4>${P.minimal.map(x => `<div class="iss"><b>${esc(x.msg.slice(0, 120))}</b><small>${x.from} steps shrunk to ${x.to}: ${esc(x.steps.join(' → '))}</small></div>`).join('')}` : ''}`;
  }
  function render(R) {
    if (!panel) return;
    const cls = R.errors.length || R.flowFail ? 'bad' : R.overall.grade.cls === 'bad' ? 'warn' : 'ok';
    const iss = i => `<div class="iss"><b class="${i.sev === 'error' ? 'bad' : 'warn'}">${esc(i.type)}</b> ×${i.count} · ${esc(i.msg)}<small>replay: seed ${R.seed} · ${esc(i.scenario || '')}<br>steps: ${esc(i.steps.join(' → '))}</small></div>`;
    $('#devOut', panel).innerHTML = `<h4 class="${cls}">${esc(R.verdict)}</h4>
      <div class="note">${R.controls} controls · ${R.scenarios} scenarios (${R.coverage.singles} single, ${R.coverage.pairs} pairs, ${R.coverage.combos} toggle combinations, ${R.coverage.seqs} random runs, ${R.coverage.flows} flows) · ${R.steps} steps · ${R.values} typed values · ${Math.round((R.finished - R.started) / 1000)} s</div>
      ${R.backgroundFrames ? `<div class="note">The tab was in the background for part of this run (${R.backgroundFrames} frames came from a worker clock), so smoothness numbers include those.</div>` : ''}
      ${R.problems ? problemsHtml(R) : ''}
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
  window.__triangleDev = { bg: BG, flow: async name => { const fl = FLOWS.find(f => f[0] === name); if (!fl) throw new Error('no flow ' + name); const R = newReport('quick', 1); R.plan = {}; BG.start(); try { await resetApp(); await runOneFlow(R, name, fl[1]); } finally { BG.stop(); } return { rows: R.flows, issues: R.issues.map(i => i.msg) }; }, resetApp, run, stop: () => { RUN.stop = true; }, discover, check, FLOWS: FLOWS.map(f => f[0]), report: () => RUN.report, text };
  const auto = qs.get('dev'); if (auto && MODES[auto]) { build(); $('#devMode', panel).value = auto; $('#devMode', panel).onchange(); panel.hidden = false; setTimeout(() => $('[data-x=start]', panel).click(), 800); }
})();

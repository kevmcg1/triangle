/* Dev mode: seeing it the way a person does.
 *
 * A number can be right and still be unreadable: grey on grey, a value hidden under a floating panel, a label cut off by its box, a triangle
 * drawn in a colour the background swallows, three side colours a colour-blind person cannot tell apart. This file looks at the page the way a
 * user's eyes would, in whatever colours are active (the app has one theme, dark, and custom colours):
 *
 *   contrast     every visible piece of text against what is really behind it (backgrounds and opacities of every ancestor stacked up,
 *                gradients averaged): 4.5 : 1, or 3 : 1 for large text; icons and the canvas's lines and handles 3 : 1
 *   visibility   every control a user can see is also one they can click: not covered by another element, not clipped by a box,
 *                not outside the screen; a value box shows its whole value; a label is not cut off
 *   canvas       the pixels actually painted: each edge, each corner handle and the fill stand out from the background by 3 : 1
 *   colour       the three side / corner colours are told apart (CIE Lab distance) with normal vision and with protan / deutan / tritan
 *                colour blindness, and each stands out from the background
 *
 * review({ full }) -> [{ type, msg, sev }]     cheap checks every call, the full text-contrast sweep when `full` or when the look changed
 */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s), $$ = (s, r) => [...(r || document).querySelectorAll(s)];

  /* ---------- colour maths ---------- */
  const px = document.createElement('canvas'); px.width = px.height = 1;
  const pg = px.getContext('2d', { willReadFrequently: true });
  const parsed = new Map();
  function rgba(str) {        /* any CSS colour -> [r, g, b, a] (a 0..1), via a real 1x1 canvas so color-mix(), hsl(), named colours all work */
    if (parsed.has(str)) return parsed.get(str);
    let out = [0, 0, 0, 0];
    try { pg.clearRect(0, 0, 1, 1); pg.fillStyle = '#000'; pg.fillStyle = str; pg.fillRect(0, 0, 1, 1); const d = pg.getImageData(0, 0, 1, 1).data; out = [d[0], d[1], d[2], d[3] / 255]; } catch (e) { /* keep transparent */ }
    if (parsed.size > 4000) parsed.clear();
    parsed.set(str, out); return out;
  }
  const over = (top, bot) => { const a = top[3] + bot[3] * (1 - top[3]); if (a <= 0) return [0, 0, 0, 0]; return [0, 1, 2].map(i => (top[i] * top[3] + bot[i] * bot[3] * (1 - top[3])) / a).concat(a); };
  const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = c => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (p, q) => { const a = lum(p), b = lum(q); return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); };
  const hex = c => '#' + c.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
  function lab(c) {
    const r = lin(c[0]), g = lin(c[1]), b = lin(c[2]);
    let x = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047, y = 0.2126729 * r + 0.7151522 * g + 0.072175 * b, z = (0.0193339 * r + 0.119192 * g + 0.9503041 * b) / 1.08883;
    const f = t => t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116;
    x = f(x); y = f(y); z = f(z); return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  }
  const dE = (p, q) => { const a = lab(p), b = lab(q); return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); };
  const CVD = { protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]], deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]], tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]] };
  const unlin = v => { v = Math.max(0, Math.min(1, v)); return 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055); };
  const simulate = (c, M) => { const l = [lin(c[0]), lin(c[1]), lin(c[2])]; return M.map(row => unlin(row[0] * l[0] + row[1] * l[1] + row[2] * l[2])).concat(c[3]); };

  /* ---------- what is really behind an element ---------- */
  function avgGradient(img) {         /* a gradient (the sidebar cards) is judged by its average colour: close enough to say "readable" */
    const toks = img.match(/(?:rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b)/gi) || [];
    if (!toks.length) return null;
    const cs = toks.map(rgba); const a = cs.reduce((s, c) => s + c[3], 0) / cs.length; if (a <= 0) return [0, 0, 0, 0];
    return [0, 1, 2].map(i => cs.reduce((s, c) => s + c[i] * c[3], 0) / (a * cs.length)).concat(a);
  }
  function backdrop(el) {
    const chain = []; for (let e = el; e && e.nodeType === 1; e = e.parentElement) chain.push(e);
    let opac = 1; const layers = [];
    for (const e of chain) { const cs = getComputedStyle(e); opac *= +cs.opacity; layers.push({ cs, opac }); }
    let bg = rgba(getComputedStyle(document.documentElement).backgroundColor); if (bg[3] < 1) bg = over(bg, [255, 255, 255, 1]);
    let unknown = false;
    for (let i = layers.length - 1; i >= 0; i--) {
      const { cs, opac: o } = layers[i];
      const col = rgba(cs.backgroundColor);
      if (col[3] > 0) bg = over([col[0], col[1], col[2], col[3] * o], bg);
      if (cs.backgroundImage && cs.backgroundImage !== 'none') { const g = /gradient/.test(cs.backgroundImage) ? avgGradient(cs.backgroundImage) : null; if (g) bg = over([g[0], g[1], g[2], g[3] * o], bg); else unknown = true; }
    }
    return { bg, opac: layers[0] ? layers[0].opac : 1, unknown };
  }
  const describe = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; else if (e.className && typeof e.className === 'string') s += '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.'); const t = (e.textContent || e.value || '').trim().replace(/\s+/g, ' ').slice(0, 24); return s + (t ? ' "' + t + '"' : ''); };
  const onScreen = r => r.width > 0 && r.height > 0 && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
  function shown(e) {
    for (let x = e; x && x.nodeType === 1; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return false;
      if (x.hidden || x.inert || x.getAttribute('aria-hidden') === 'true' && x.classList.contains('modal-backdrop')) return false;
    }
    const r = e.getBoundingClientRect(); if (!onScreen(r)) return false;
    /* clipped away by a scroll container or a collapsed section? */
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x); if (cs.overflow === 'visible' && cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const q = x.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < q.left || cx > q.right || cy < q.top || cy > q.bottom) return false;   /* scrolled mostly out of its box: not what the user is looking at */
    }
    return true;
  }

  /* ---------- text and icon contrast ---------- */
  const textSig = { n: 0 };
  function contrastSweep(issues, cap) {
    const seen = new Set(); let n = 0;
    /* colours the user picked in Settings are theirs to judge: a poor choice is a note, not an error */
    const custom = typeof customColors !== 'undefined' && Object.keys(customColors.dark || {}).length > 0;
    const els = $$('body *').filter(e => !e.closest('.dev,#dev,[data-dev],svg,canvas,script,style') && !e.disabled);
    for (const e of els) {
      if (n >= cap) break;
      let text = '';
      for (const ch of e.childNodes) if (ch.nodeType === 3) text += ch.nodeValue;
      const isIcon = e.tagName === 'I' && /\bfa-/.test(e.className), isField = (e.tagName === 'INPUT' && /^(text|number|search)$/.test(e.type)) || e.tagName === 'SELECT';
      text = text.trim(); if (!text && !isIcon && !(isField && e.value)) continue;
      if (!shown(e) || e.closest('button:disabled,[aria-disabled="true"],input:disabled')) continue;   /* an inactive control is exempt from contrast */
      const cs = getComputedStyle(e), key = [cs.color, cs.fontSize, cs.fontWeight, isIcon, (function () { const b = backdrop(e); return hex(b.bg) + b.opac.toFixed(2); })(), e.className].join('|');
      if (seen.has(key)) continue; seen.add(key); n++;
      const b = backdrop(e); if (b.unknown) continue;
      let fg = rgba(cs.color); fg = [fg[0], fg[1], fg[2], fg[3] * b.opac];
      if (parseFloat(cs.webkitTextStrokeWidth) > 0.5 && fg[3] < 0.5 + 1e-9 + 0.5 && ratio(over(fg, b.bg), b.bg) < 1.2) { const sc = rgba(cs.webkitTextStrokeColor); fg = [sc[0], sc[1], sc[2], sc[3] * b.opac]; }   /* outlined lettering is read by its outline */
      const mix = over(fg, b.bg), r = ratio(mix, b.bg);
      const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700);
      const need = isIcon || large ? 3 : 4.5;
      if (r < need - 0.02) issues.push({ type: 'user sight', sev: custom || r >= 2.5 ? 'warn' : 'error', msg: (isIcon ? 'icon ' : 'text ') + describe(e) + ' is ' + hex(mix) + ' on ' + hex(b.bg) + ': ' + r.toFixed(2) + ' : 1 (needs ' + need + ' : 1)', key: describe(e) });
    }
    textSig.n = n;
  }

  /* ---------- can the user see and reach it ---------- */
  function visibilityChecks(issues) {
    const vw = innerWidth, vh = innerHeight;
    /* an open dialog (the What's new card) sits over everything on purpose: only what is inside it is judged */
    const dialog = $$('[role="dialog"][aria-modal="true"]').find(e => !e.hidden);
    const popover = e => !!(e && e.closest && e.closest('.menu,.menu-item,.dropdown,[role="menu"],[role="listbox"],[role="tooltip"],select,.tip,.dev,#dev,.modal-backdrop .copy-btn'));
    const cands = $$('button,input,select,.row.clickable,.trow,.sec-head,.pill,.chip,.menu-item,#searchBox,a[href]').filter(e => !e.closest('.dev,#dev,[data-dev]') && !e.disabled && e.tabIndex !== -2 && (!dialog || dialog.contains(e)));
    let n = 0;
    for (const e of cands) {
      if (n > 220) break;
      if (!shown(e)) continue;
      const r = e.getBoundingClientRect(); n++;
      const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 3, r.top + 3], [r.right - 3, r.top + 3], [r.left + 3, r.bottom - 3], [r.right - 3, r.bottom - 3]].filter(p => p[0] >= 0 && p[1] >= 0 && p[0] < vw && p[1] < vh);
      if (!pts.length) continue;
      const covered = [], free = [];
      for (const [x, y] of pts) { const t = document.elementFromPoint(x, y); if (!t) continue; (t === e || e.contains(t) || t.contains(e) || t.closest('.pill') === e.closest('.pill') && e.closest('.pill') || popover(t)) ? free.push(t) : covered.push(t); }
      if (covered.length >= Math.max(2, Math.ceil(pts.length * 0.6)) && !free.length) issues.push({ type: 'user sight', sev: 'error', msg: describe(e) + ' [' + [r.left, r.top, r.right, r.bottom].map(Math.round) + '] is covered by ' + describe(covered[0]) + ' [' + (q => [q.left, q.top, q.right, q.bottom].map(Math.round))(covered[0].getBoundingClientRect()) + '] (' + covered.length + ' of ' + pts.length + ' points)', key: describe(e) });
      /* a value box shows its whole value; a row's value is not cut off */
      if ((e.tagName === 'INPUT' && e.type === 'text') && e.id !== 'searchBox' && e.scrollWidth > e.clientWidth + 2 && e.value && document.activeElement !== e) issues.push({ type: 'user sight', sev: 'warn', msg: 'the value in ' + describe(e) + ' is cut off (' + e.scrollWidth + ' px of text in a ' + e.clientWidth + ' px box)', key: describe(e) });
    }
    for (const e of $$('#stats .row .v,#stats .row .k,.pill .tag,.pill-alt')) {
      if (e.closest('.dev,#dev') || !shown(e)) continue;
      const cs = getComputedStyle(e);
      if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 2) issues.push({ type: 'user sight', sev: 'warn', msg: describe(e) + ' is cut off by its box', key: describe(e) });
    }
    /* what the user needs to see on the canvas is on the canvas */
    const cv = $('#cv'); if (cv && typeof S !== 'undefined' && S.P) {
      const cr = cv.getBoundingClientRect();
      for (const p of document.querySelectorAll('.pill')) {
        if (!shown(p)) continue; const r = p.getBoundingClientRect();
        if (r.left < cr.left - 1 || r.right > cr.right + 1 || r.top < cr.top - 1 || r.bottom > cr.bottom + 1) issues.push({ type: 'user sight', sev: 'error', msg: 'the value label ' + describe(p) + ' is partly off the canvas', key: describe(p) });
      }
    }
  }

  /* ---------- the pixels actually painted ---------- */
  function canvasChecks(issues) {
    if (typeof renderNow === 'function') renderNow();   /* the canvas must show the current state before its pixels are read */
    const cv = $('#cv'); if (!cv || typeof S === 'undefined' || !S.P) return;
    let g; try { g = cv.getContext('2d'); } catch (e) { return; }
    const cr = cv.getBoundingClientRect(), W = cr.width, H = cr.height, dpr = cv.width / Math.max(1, W);
    const at = (x, y) => { const d = g.getImageData(Math.max(0, Math.min(cv.width - 1, Math.round(x * dpr))), Math.max(0, Math.min(cv.height - 1, Math.round(y * dpr))), 1, 1).data; return [d[0], d[1], d[2], 1]; };
    const sp = S.P.map(toScreen); if (!sp.every(q => Number.isFinite(q.x) && Number.isFinite(q.y))) return;
    let area = Math.abs((sp[1].x - sp[0].x) * (sp[2].y - sp[0].y) - (sp[2].x - sp[0].x) * (sp[1].y - sp[0].y)) / 2;
    if (area < 400) return;     /* a speck of a triangle: nothing to see, and that is not a colour problem */
    const bgFar = (x, y, nx, ny) => at(x + nx * 12, y + ny * 12);
    for (let e = 0; e < 3; e++) {
      const a = sp[e], c = sp[(e + 1) % 3], L = Math.hypot(c.x - a.x, c.y - a.y); if (L < 40) continue;
      const nx = (c.y - a.y) / L, ny = -(c.x - a.x) / L; let best = 0, tried = 0;
      for (const f of [0.3, 0.4, 0.5, 0.6, 0.7]) {
        const x = a.x + (c.x - a.x) * f, y = a.y + (c.y - a.y) * f; if (x < 6 || y < 6 || x > W - 6 || y > H - 6) continue; tried++;
        const bgA = bgFar(x, y, nx, ny), bgB = bgFar(x, y, -nx, -ny); let top = 0;
        for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) { const p = at(x + dx, y + dy); top = Math.max(top, Math.min(ratio(p, bgA), ratio(p, bgB))); }
        best = Math.max(best, top);
      }
      if (tried >= 3 && best < 3) issues.push({ type: 'user sight', sev: best < 2.2 ? 'error' : 'warn', msg: 'side ' + 'abc'[(e + 2) % 3] + ' is drawn at only ' + best.toFixed(2) + ' : 1 against the background (it nearly disappears)', key: 'edge' + e });
    }
    sp.forEach((q, v) => {
      if (q.x < 14 || q.y < 14 || q.x > W - 14 || q.y > H - 14) return;
      let ring = 0, tot = 0; for (let k = 0; k < 16; k++) { const ang = k / 16 * 6.283; let hit = 0; for (const rr of [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9]) { const p = at(q.x + Math.cos(ang) * rr, q.y + Math.sin(ang) * rr), bgc = at(q.x + Math.cos(ang) * 26, q.y + Math.sin(ang) * 26); hit = Math.max(hit, ratio(p, bgc)); } tot += hit; if (hit > 2) ring++; }   /* the handle is a ring of radius 5 (7 when hovered), about 2 px thick */
      if (ring < 10) issues.push({ type: 'user sight', sev: 'error', msg: 'corner ' + 'ABC'[v] + '’s handle is not visible (' + ring + ' of 16 directions stand out)', key: 'handle' + v });
    });
  }

  /* ---------- the colours themselves ---------- */
  function colourChecks(issues) {
    const probe = cls => { const e = document.createElement('span'); e.className = cls; e.style.cssText = 'position:absolute;left:-999px;top:0'; e.textContent = 'x'; document.body.appendChild(e); const c = rgba(getComputedStyle(e).color); e.remove(); return c; };
    const set = { 'side a': probe('var-a'), 'side b': probe('var-b'), 'side c': probe('var-c') };
    const bg = (() => { const t = $('#modal,.modal-body') || document.body; const b = backdrop(t); return b.bg; })();
    const names = Object.keys(set);
    for (const k of names) { const r = ratio(set[k], bg); if (r < 3) issues.push({ type: 'user sight', sev: 'warn', msg: 'the colour of ' + k + ' (' + hex(set[k]) + ') is only ' + r.toFixed(2) + ' : 1 against the panel (' + hex(bg) + ')', key: 'colour ' + k }); }
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      const p = set[names[i]], q = set[names[j]], d0 = dE(p, q);
      if (d0 < 20) issues.push({ type: 'user sight', sev: 'warn', msg: names[i] + ' and ' + names[j] + ' colours are hard to tell apart (ΔE ' + d0.toFixed(0) + ')', key: 'pair ' + i + j });
      for (const [kind, M] of Object.entries(CVD)) { const d = dE(simulate(p, M), simulate(q, M)); if (d < 8) issues.push({ type: 'user sight', sev: 'warn', msg: names[i] + ' and ' + names[j] + ' look alike to a ' + kind + ' colour-blind person (ΔE ' + d.toFixed(1) + '); the letters a / b / c still tell them apart', key: 'cvd ' + kind + i + j }); }
    }
  }

  /* ---------- put together ---------- */
  let tick = 0, lastLook = '';
  const lookKey = () => [JSON.stringify(typeof customColors !== 'undefined' ? customColors : {}), ($('#mTitle') || {}).textContent, $$('.sec.collapsed').length, innerWidth, innerHeight, document.body.className, document.documentElement.className, window.__hw && __hw.PR && __hw.PR.on].join('|');
  function review(opt) {
    opt = opt || {}; tick++;
    const issues = [], key = lookKey(), changed = key !== lastLook;
    try { visibilityChecks(issues); } catch (e) { issues.push({ type: 'checker', sev: 'warn', msg: 'sight (visibility) threw: ' + e.message }); }
    if (opt.full || changed || tick % 40 === 0) { lastLook = key; try { contrastSweep(issues, opt.cap || 900); colourChecks(issues); } catch (e) { issues.push({ type: 'checker', sev: 'warn', msg: 'sight (contrast) threw: ' + e.message }); } }
    if (opt.full || tick % 6 === 0) { try { canvasChecks(issues); } catch (e) { issues.push({ type: 'checker', sev: 'warn', msg: 'sight (canvas) threw: ' + e.message }); } }
    const seen = new Set(); return issues.filter(i => { const k = i.type + i.key + i.msg; if (seen.has(k)) return false; seen.add(k); return true; });
  }
  window.__devSight = { review, backdrop, rgba, ratio, dE, simulate, CVD, contrastSweep };
})();

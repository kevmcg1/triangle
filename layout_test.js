/* Layout and drawing test: node layout_test.js [playwright-path]
 * For phone (portrait and landscape), tablet and desktop viewports, over random triangles:
 *   - no horizontal page scroll
 *   - every value label (pill) is fully on the canvas, no two overlap, and none sits under a floating control (undo bar, Transform panel, zoom tag)
 *   - every edge and every vertex handle is actually painted on the canvas, in the dark theme (the app's only theme)
 * Exits non-zero on any failure. */
const path = require('path');
const { chromium } = require(process.argv[2] || 'playwright');
(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const phoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const cfgs = [['phone 280', 280, 653, 1], ['phone 320', 320, 568, 1], ['phone 390', 390, 844, 1], ['phone landscape', 844, 390, 1], ['tablet', 768, 1024, 0], ['desktop 1024', 1024, 700, 0], ['desktop', 1400, 900, 0]];
  let failed = 0;
  for (const [name, w, h, mobile] of cfgs) for (const theme of ['dark']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, screen: { width: w, height: h }, isMobile: !!mobile, hasTouch: !!mobile, deviceScaleFactor: 2, userAgent: mobile ? phoneUA : undefined });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto('file://' + path.join(__dirname, 'index.html')); await page.waitForTimeout(1800);
    const r = await page.evaluate(theme => {
      const fails = [], cvEl = document.querySelector('canvas'), g = cvEl.getContext('2d');
      const cvr = cvEl.getBoundingClientRect(), dpr = cvEl.width / cvr.width, W0 = cvr.width, H0 = cvr.height;
      if (document.documentElement.scrollWidth > innerWidth) fails.push('horizontal scroll');
      let seed = 5; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
      const px = (x, y) => { const d = g.getImageData(Math.round(x * dpr), Math.round(y * dpr), 1, 1).data; return [d[0], d[1], d[2]]; };
      const diff = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
      const blockers = ['toolbar', 'grpHist', 'xform', 'zoomtag', 'cornerHints', 'navtoggle'].map(id => document.getElementById(id)).filter(e => e && e.offsetParent);
      let n = 0;
      for (let t = 0; t < 60 && n < 25; t++) {
        S.P = [0, 1, 2].map(() => ({ x: (rnd() - 0.5) * 5, y: (rnd() - 0.5) * 4 }));
        if (derive().area < 0.6) continue; n++;
        S.view.z = Math.min(W0, H0) / 7; S.view.cx = 0; S.view.cy = 0; renderNow();
        const rects = pills.map(p => p.el.getBoundingClientRect());
        rects.forEach((a, i) => {
          if (a.left < cvr.left - 1 || a.right > cvr.right + 1 || a.top < cvr.top - 1 || a.bottom > cvr.bottom + 1) fails.push('tri ' + t + ': pill ' + i + ' off the canvas');
          for (let j = i + 1; j < rects.length; j++) { const c = rects[j]; if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) fails.push('tri ' + t + ': pills ' + i + ' and ' + j + ' overlap'); }
          for (const e of blockers) { const c = e.getBoundingClientRect(); if (Math.min(a.right, c.right) - Math.max(a.left, c.left) > 4 && Math.min(a.bottom, c.bottom) - Math.max(a.top, c.top) > 4) fails.push('tri ' + t + ': pill ' + i + ' under #' + e.id); }
        });
        const sp = S.P.map(toScreen);
        for (let e = 0; e < 3; e++) {
          const a = sp[e], c = sp[(e + 1) % 3], L = Math.hypot(c.x - a.x, c.y - a.y); let hit = 0, tried = 0;
          for (const f of [0.3, 0.4, 0.5, 0.6, 0.7]) {
            const x = a.x + (c.x - a.x) * f, y = a.y + (c.y - a.y) * f; if (x < 4 || y < 4 || x > W0 - 4 || y > H0 - 4) continue; tried++;
            const bg = px(x + (c.y - a.y) / L * 9, y - (c.x - a.x) / L * 9); let best = 0;
            for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) best = Math.max(best, diff(px(x + dx, y + dy), bg));
            if (best > 60) hit++;
          }
          if (tried >= 3 && hit < 2) fails.push('tri ' + t + ': edge ' + e + ' not painted');
        }
        sp.forEach((q, v) => { if (q.x < 12 || q.y < 12 || q.x > W0 - 12 || q.y > H0 - 12) return; let ring = 0; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.283; for (const rr of [6, 7, 8, 9, 10]) if (diff(px(q.x + Math.cos(a) * rr, q.y + Math.sin(a) * rr), px(q.x + Math.cos(a) * 26, q.y + Math.sin(a) * 26)) > 80) { ring++; break; } } if (ring < 6) fails.push('tri ' + t + ': vertex ' + v + ' handle not painted'); });
      }
      return { fails, n };
    }, theme);
    const bad = [...new Set(r.fails)];
    console.log((bad.length || errors.length ? 'FAIL ' : 'ok   ') + name + ' ' + theme + ' (' + r.n + ' triangles)' + bad.slice(0, 4).map(f => '\n       ' + f).join('') + (errors.length ? '\n       page error: ' + errors[0] : ''));
    if (bad.length || errors.length) failed++;
    await ctx.close();
  }
  await browser.close(); process.exit(failed ? 1 : 0);
})();

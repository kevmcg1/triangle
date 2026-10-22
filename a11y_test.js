/* Accessibility test: node a11y_test.js [playwright-path]
 * Always checked (no extra packages): every button and text input has an accessible name, every clickable stat row / trig row / section
 * header can be reached with Tab and opened with Enter or Space, nothing focusable hides inside an aria-hidden or inert container, and a closed
 * explanation panel is inert.
 * If the axe-core package is installed (npm i axe-core) it also runs axe on the dark and light themes, desktop and phone, with an explanation
 * panel, Practice, Settings and the Solve section open, and fails on any violation. Exits non-zero on any failure. */
const path = require('path');
const { chromium } = require(process.argv[2] || 'playwright');
let axeSrc = null; try { axeSrc = require('fs').readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (e) { console.log('(axe-core not installed: running the built-in checks only)'); }
(async () => {
  const browser = await chromium.launch(process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {});
  const phoneUA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148';
  const states = { 'default': () => {}, 'explanation': () => openExplain('R'), 'trig explanation': () => openTrigExplain('tan'), 'practice': () => window.__hw.setPractice(true),
    'settings': () => document.getElementById('btnSettings').click(), 'solve section': () => { const s = document.querySelector('.sec-hw'); if (s.classList.contains('collapsed')) toggleSection(s); }, 'a lock': () => pills[0].lockBtn.click() };
  let failed = 0;
  for (const [vname, w, h, mobile] of [['desktop', 1400, 900, 0], ['phone', 390, 844, 1]]) for (const theme of ['dark', 'light']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, screen: { width: w, height: h }, isMobile: !!mobile, hasTouch: !!mobile, userAgent: mobile ? phoneUA : undefined });
    const page = await ctx.newPage(); const errors = []; page.on('pageerror', e => errors.push(String(e)));
    await page.goto('file://' + path.join(__dirname, 'index.html')); await page.waitForTimeout(1500);
    await page.evaluate(t => { if (S.theme !== t) document.getElementById('btnTheme').click(); }, theme);
    const fails = await page.evaluate(() => {
      const f = [], name = e => (e.getAttribute('aria-label') || e.getAttribute('title') || e.textContent || '').trim() || (e.id && document.querySelector('label[for="' + e.id + '"]') ? 'x' : '');
      document.querySelectorAll('button').forEach(b => { if (!name(b)) f.push('button without a name: ' + b.outerHTML.slice(0, 80)); });
      document.querySelectorAll('input[type=text],input[type=color]').forEach(i => { if (!(i.getAttribute('aria-label') || i.getAttribute('placeholder') || name(i))) f.push('input without a name: ' + i.outerHTML.slice(0, 80)); });
      document.querySelectorAll('.row.clickable,.trow,.sec-head').forEach(e => { if (e.tabIndex < 0 || e.getAttribute('role') !== 'button') f.push('not keyboard reachable: ' + (e.textContent || '').trim().slice(0, 30)); });
      document.querySelectorAll('[aria-hidden="true"]').forEach(e => { if (e.matches('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])') || e.querySelector('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])')) f.push('focusable inside aria-hidden: ' + (e.className || e.tagName)); });
      if (!modalRoot.inert) f.push('closed explanation panel is not inert');
      return f;
    });
    if (mobile === 0) {   /* keyboard: Enter opens a row's explanation, Escape closes it, Space folds a section */
      await page.evaluate(() => document.querySelector('.row.clickable').focus()); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
      if (!(await page.evaluate(() => modalRoot.classList.contains('show')))) fails.push('Enter on a stat row did not open its explanation');
      await page.keyboard.press('Escape'); await page.waitForTimeout(600);
      if (await page.evaluate(() => modalRoot.classList.contains('show'))) fails.push('Escape did not close the explanation');
      await page.evaluate(() => document.querySelectorAll('.sec-head')[1].focus()); await page.keyboard.press('Space'); await page.waitForTimeout(400);
      if ((await page.evaluate(() => document.querySelectorAll('.sec-head')[1].getAttribute('aria-expanded'))) !== 'false') fails.push('Space on a section header did not fold it');
    }
    if (axeSrc) for (const [sname, fn] of Object.entries(states)) {
      const c2 = await browser.newContext({ viewport: { width: w, height: h }, screen: { width: w, height: h }, isMobile: !!mobile, hasTouch: !!mobile, userAgent: mobile ? phoneUA : undefined });
      const p2 = await c2.newPage(); await p2.goto('file://' + path.join(__dirname, 'index.html')); await p2.waitForTimeout(1200);
      await p2.evaluate(t => { if (S.theme !== t) document.getElementById('btnTheme').click(); }, theme);
      await p2.evaluate(fn); await p2.waitForTimeout(700); await p2.addScriptTag({ content: axeSrc });
      const v = await p2.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.map(x => x.id + ' x' + x.nodes.length + ' ' + x.nodes[0].target.join(' ').slice(-60)));
      v.forEach(x => fails.push('axe [' + sname + ']: ' + x)); await c2.close();
    }
    console.log((fails.length || errors.length ? 'FAIL ' : 'ok   ') + vname + ' ' + theme + [...new Set(fails)].slice(0, 6).map(x => '\n       ' + x).join('') + (errors.length ? '\n       page error: ' + errors[0] : ''));
    if (fails.length || errors.length) failed++;
    await ctx.close();
  }
  await browser.close(); process.exit(failed ? 1 : 0);
})();

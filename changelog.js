// The What’s new button: the version as a small chip under the logo, and the changelog (version.js) it opens. Same look as the one in
// Shop Tool Sim. On a phone the chip is also at the end of the Tools sheet, since the logo block is hidden there.
(function(){
  const V = window.__TRIANGLE; if (!V) return;
  const css = document.createElement('style');
  css.textContent = `
.shop-vrow{display:flex;justify-content:center;margin:8px 0 2px}
.shop-vchip{display:inline-flex;align-items:center;gap:6px;padding:3px 11px;font:600 11px/1.3 "Inter",system-ui,sans-serif;letter-spacing:.03em;color:var(--txt-2,#8a8f97);background:transparent;border:1px solid var(--side-line,#2a2d31);border-radius:999px;cursor:pointer}
.shop-vchip:hover,.shop-vchip:focus-visible{color:var(--side-ink,#ececee);border-color:var(--txt-2,#8a8f97);background:transparent}
.shop-cl{position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,.6);display:flex;justify-content:center;overflow-y:auto;overscroll-behavior:contain;padding:16px;font-family:"Inter",system-ui,sans-serif;user-select:text}
.shop-cl{opacity:1;visibility:visible;transition:opacity .28s ease,visibility 0s linear 0s}
.shop-cl[hidden]{display:flex;opacity:0;visibility:hidden;pointer-events:none;transition:opacity .22s ease,visibility 0s linear .22s}
.shop-cl-card{transform:none;transition:transform .34s cubic-bezier(.22,.8,.25,1)}
.shop-cl[hidden] .shop-cl-card{transform:translateY(14px) scale(.97)}
.shop-vchip{transition:color .22s ease,border-color .22s ease}
@media (prefers-reduced-motion: reduce){.shop-cl,.shop-cl[hidden],.shop-cl-card,.shop-vchip{transition:none}}
.shop-cl-card{position:relative;background:var(--side-bg,#131416);color:var(--side-ink,#ececee);border:1px solid var(--side-line,#222428);border-radius:12px;padding:20px 22px;max-width:480px;width:100%;margin:auto;flex:0 0 auto;font-size:13.5px;line-height:1.5}
.shop-cl-card h3{margin:0;font-size:18px;font-weight:600}
.shop-cl-sub{margin:2px 0 14px;color:var(--txt-2,#8a8f97);font-size:12.5px}
.shop-cl-card h4{margin:16px 0 2px;font-size:14px;font-weight:600;display:flex;align-items:baseline;gap:8px}
.shop-cl-card h4 small{font-size:11.5px;font-weight:500;color:var(--txt-2,#8a8f97)}
.shop-cl-card h4 em{font-style:normal;font-size:9.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:1px 6px;border-radius:999px;background:color-mix(in srgb,var(--c0,#5b93ea) 22%,transparent);color:color-mix(in srgb,var(--c0,#5b93ea) 45%,#fff)}
.shop-cl-card .t{margin:0 0 4px;color:var(--txt-2,#8a8f97);font-size:12.5px}
.shop-cl-card ul{margin:0;padding-left:18px}
.shop-cl-card li{margin:0 0 4px;color:var(--txt-2,#c9ccd1)}
.shop-cl-x{position:absolute;top:12px;right:12px;width:28px;height:28px;padding:0;display:grid;place-items:center;border:0;border-radius:50%;background:var(--raise,#1b1d20);color:var(--side-ink,#ececee);font:inherit;font-size:12px;cursor:pointer}
.shop-cl-x:hover{background:var(--raise-2,#24272b)}
html.mobile .shop-vrow.in-tools{margin:14px 0 0}
html.mobile .shop-vchip{height:38px;padding:0 16px;font-size:12px}
`;
  document.head.appendChild(css);

  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  let modal = null;
  function build(){
    modal = document.createElement('div');
    modal.className = 'shop-cl'; modal.hidden = true;
    modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true'); modal.setAttribute('aria-label', 'Changelog');
    modal.innerHTML = '<div class="shop-cl-card"><button type="button" class="shop-cl-x" aria-label="Close">✕</button>' +
      '<h3>What’s new</h3><p class="shop-cl-sub">Triangle Thing · version ' + esc(V.version) + '</p>' +
      V.changelog.map((e, i) => '<h4>v' + esc(e.v) + (e.date ? ' <small>' + esc(e.date) + '</small>' : '') + (i === 0 ? ' <em>current</em>' : '') + '</h4>' +
        '<p class="t">' + esc(e.title) + '</p><ul>' + e.items.map(x => '<li>' + esc(x) + '</li>').join('') + '</ul>').join('') + '</div>';
    modal.addEventListener('click', e => { if (e.target === modal || e.target.closest('.shop-cl-x')) close(); });
    document.body.appendChild(modal);
  }
  function open(){ if (!modal) build(); if (typeof setSheet === 'function') setSheet(null); modal.hidden = false; modal.querySelector('.shop-cl-x').focus({ preventScroll: true }); }
  function close(){ if (modal) modal.hidden = true; }
  document.addEventListener('keydown', e => { if (modal && !modal.hidden && e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); close(); } }, true);

  function chip(){
    const c = document.createElement('button');
    c.type = 'button'; c.className = 'shop-vchip'; c.textContent = 'v' + V.version + ' · What’s new';
    c.title = 'Version ' + V.version + ' and the changelog';
    c.addEventListener('click', open);
    return c;
  }
  function mount(){
    if (document.querySelector('.shop-vchip')) return;
    const mark = document.querySelector('.side-logo .logo-mark');
    if (mark){ const row = document.createElement('div'); row.className = 'shop-vrow'; row.appendChild(chip()); mark.insertAdjacentElement('afterend', row); }   // right under the name, above the rule and the tagline
    const tools = document.getElementById('toolbar');
    if (window.__mobile && tools){ const row = document.createElement('div'); row.className = 'shop-vrow in-tools'; row.appendChild(chip()); tools.appendChild(row); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
  window.__changelog = { open, close };
})();

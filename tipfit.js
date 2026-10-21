/* Keeps every CSS tooltip (the [data-tip] ::after boxes) on screen. When a control is hovered or focused, the tip's size is read from its
   computed style, where it would land is worked out from data-tip-pos, and it is nudged sideways (--tip-dx), up or down (--tip-dy),
   or flipped to the other side (data-tip-flip) so no part of it is cut off by a window edge. */
(function () {
  const M = 6, G = 7;
  function fit(el) {
    el.style.removeProperty('--tip-dx'); el.style.removeProperty('--tip-dy'); el.removeAttribute('data-tip-flip');
    const cs = getComputedStyle(el, '::after');
    let w = parseFloat(cs.width), h = parseFloat(cs.height);
    if (!(w > 0) || !(h > 0)) return;
    const r = el.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight, pos = el.getAttribute('data-tip-pos') || '';
    const side = pos === 'left';
    let left, top;
    if (side) { left = r.left - G - w; top = r.top + r.height / 2 - h / 2; }
    else {
      left = /-end$/.test(pos) ? r.right - w : /-start$/.test(pos) ? r.left : r.left + r.width / 2 - w / 2;
      top = /^top/.test(pos) ? r.top - G - h : r.bottom + G;
      if (top + h > vh - M && r.top - G - h >= M) { el.setAttribute('data-tip-flip', 'up'); top = r.top - G - h; }
      else if (top < M && r.bottom + G + h <= vh - M) { el.setAttribute('data-tip-flip', 'down'); top = r.bottom + G; }
    }
    const dx = left < M ? M - left : left + w > vw - M ? vw - M - (left + w) : 0;
    const dy = side ? (top < M ? M - top : top + h > vh - M ? vh - M - (top + h) : 0) : (top < M ? M - top : top + h > vh - M ? vh - M - (top + h) : 0);
    if (dx) el.style.setProperty('--tip-dx', Math.round(dx) + 'px');
    if (dy) el.style.setProperty('--tip-dy', Math.round(dy) + 'px');
  }
  const on = e => { const el = e.target && e.target.closest && e.target.closest('[data-tip]'); if (el) fit(el); };
  document.addEventListener('mouseover', on, true);
  document.addEventListener('focusin', on, true);
  window.addEventListener('resize', () => { const el = document.querySelector('[data-tip]:hover'); if (el) fit(el); });
})();

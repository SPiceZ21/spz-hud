// spz-tutorial page: places the spotlight and the card for each step.
(() => {
  const $ = (id) => document.getElementById(id);
  const root = $('root'), dim = $('dim'), spot = $('spot'), card = $('card');
  const GAP = 18, PAD = 8, EDGE = 16;
  let current = null;

  const post = (name, data) =>
    fetch(`https://${GetParentResourceName()}/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}),
    }).catch(() => {});

  // "3.5vh" / "14.1vw" / 32 → px
  function px(v, axis) {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return v;
    const n = parseFloat(v);
    if (String(v).endsWith('vh')) return (n / 100) * innerHeight;
    if (String(v).endsWith('vw')) return (n / 100) * innerWidth;
    return n;
  }

  // `zoom` matches the target page's own CSS zoom (spz-raceUI renders at 1.1),
  // which scales its px AND viewport units alike.
  function rectOf(spec) {
    const W = innerWidth, H = innerHeight, z = spec.zoom || 1;
    const s = {};
    for (const k of ['left', 'right', 'top', 'bottom', 'width', 'height']) {
      const v = px(spec[k]);
      s[k] = v == null ? null : v * z;
    }
    s.cx = spec.cx; s.cy = spec.cy;
    const w = s.width ?? 200, h = s.height ?? 100;
    let x, y;
    if (s.cx) x = (W - w) / 2;
    else if (s.left != null) x = s.left;
    else if (s.right != null) x = W - s.right - w;
    else x = (W - w) / 2;
    if (s.cy) y = (H - h) / 2;
    else if (s.top != null) y = s.top;
    else if (s.bottom != null) y = H - s.bottom - h;
    else y = (H - h) / 2;
    return { x: x - PAD, y: y - PAD, w: w + PAD * 2, h: h + PAD * 2 };
  }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  function placeCard(mode, r) {
    const W = innerWidth, H = innerHeight;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const at = (x, y) => { card.style.left = clamp(x, EDGE, W - cw - EDGE) + 'px'; card.style.top = clamp(y, EDGE, H - ch - EDGE) + 'px'; };
    const corner = {
      center: () => at((W - cw) / 2, (H - ch) / 2),
      tl: () => at(EDGE * 2, EDGE * 2), tr: () => at(W - cw - EDGE * 2, EDGE * 2),
      bl: () => at(EDGE * 2, H - ch - EDGE * 2), br: () => at(W - cw - EDGE * 2, H - ch - EDGE * 2),
      top: () => at((W - cw) / 2, EDGE * 2), bottom: () => at((W - cw) / 2, H - ch - EDGE * 2),
    };
    if (corner[mode]) return corner[mode]();
    if (!r) return corner.center();

    const midY = r.y + r.h / 2 - ch / 2, midX = r.x + r.w / 2 - cw / 2;
    const fits = {
      right: W - (r.x + r.w) - GAP >= cw + EDGE,
      left: r.x - GAP >= cw + EDGE,
      below: H - (r.y + r.h) - GAP >= ch + EDGE,
      above: r.y - GAP >= ch + EDGE,
    };
    const side = {
      right: () => at(r.x + r.w + GAP, midY),
      left: () => at(r.x - GAP - cw, midY),
      below: () => at(midX, r.y + r.h + GAP),
      above: () => at(midX, r.y - GAP - ch),
    };
    if (mode === 'right' || mode === 'left') return side[mode]();
    for (const k of ['right', 'left', 'below', 'above']) if (fits[k]) return side[k]();
    return corner.center();
  }

  function render(s) {
    current = s;
    root.classList.remove('hidden');
    card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    $('section').textContent = s.section || '';
    $('count').textContent = s.total ? `${s.index} / ${s.total}` : '';
    $('title').textContent = s.title || '';
    $('body').innerHTML = s.body || '';   // trusted: our own steps.lua
    $('bar-fill').style.width = s.total ? `${(s.index / s.total) * 100}%` : '0';

    $('back').disabled = s.index <= 1;
    $('back').style.display = s.welcome ? 'none' : '';
    $('next').textContent = s.welcome ? 'Start tour' : s.finale ? 'Finish' : 'Next';
    $('exit').textContent = s.welcome ? 'Not now' : 'Skip tour';
    $('exit').style.display = s.finale ? 'none' : '';
    card.classList.toggle('wide', s.card === 'center');

    let r = null;
    if (s.spot) {
      r = rectOf(s.spot);
      Object.assign(spot.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
      spot.classList.remove('off');
      dim.classList.add('off');
    } else {
      spot.classList.add('off');
      dim.classList.toggle('off', !s.dim);
    }
    // measure after content changed
    requestAnimationFrame(() => placeCard(s.card, r));
  }

  function hide() { current = null; root.classList.add('hidden'); }

  function applyTheme(t) {
    if (!t) return;
    const r = document.documentElement.style;
    if (t.accent) r.setProperty('--accent', t.accent);
    if (t.accent2) r.setProperty('--accent2', t.accent2);
    if (t.bg2) r.setProperty('--bg', t.bg2);
  }

  $('next').onclick = () => post('next');
  $('back').onclick = () => post('back');
  $('exit').onclick = () => post('exit');

  window.addEventListener('keydown', (e) => {
    if (!current) return;
    if (e.repeat) return;
    if (e.key === 'Enter' || e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); post('next'); }
    else if (e.key === 'Backspace' || e.key === 'ArrowLeft') { e.preventDefault(); if (!current.welcome) post('back'); }
    else if (e.key === 'Escape') { e.preventDefault(); post('exit'); }
  });

  window.addEventListener('resize', () => { if (current) render(current); });

  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (d.action === 'step') render(d.step);
    else if (d.action === 'hide') hide();
    else if (d.action === 'theme') applyTheme(d.theme);
  });
})();

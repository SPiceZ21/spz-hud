// spz-tunners NUI — renders the menus built in client/menu.lua.
// Lua sends { action: 'menu', data: { title, crumbs, options, selected } };
// every option is a value row (values + index), a submenu or an action.
(() => {
  const $ = (id) => document.getElementById(id);
  const root = $('root'), list = $('strip'), stage = $('stage');
  let menu = null, sel = 0;

  const post = (name, data) =>
    fetch(`https://${GetParentResourceName()}/${name}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}),
    }).catch(() => {});

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ── render ──────────────────────────────────────────────────────────────
  // Price lives in the option description ("$500 · primary + secondary"); the
  // first chunk goes on the tile's corner, the rest stays as the description.
  const split = (d) => {
    const m = /^\s*([$€£]\s?[\d,.]+|[\d,.]+\s?(?:CR|\$)|Free)\s*(?:·\s*)?(.*)$/i.exec(d || '');
    return m ? { price: m[1], desc: m[2] } : { price: '', desc: d || '' };
  };

  function tileHtml(o, i) {
    const { price, desc } = split(o.desc);
    const isSel = i === sel;
    const hasVals = o.kind === 'value' && o.values;
    const kind = o.kind === 'submenu' ? '›' : o.kind === 'action' ? '↵' : '';
    let foot;
    if (hasVals && isSel) {
      foot = `<button class="arr" data-step="-1" data-i="${i}">‹</button>
        <span class="t-val">${esc(o.values[o.index - 1])}</span>
        <span class="v-count">${o.index}/${o.values.length}</span>
        <button class="arr" data-step="1" data-i="${i}">›</button>`;
    } else {
      foot = `<span class="t-val">${hasVals ? esc(o.values[o.index - 1]) : (o.kind === 'submenu' ? 'Open' : 'Select')}</span>
        <span class="t-kind">${kind}</span>`;
    }
    return `<div class="tile${isSel ? ' sel' : ''}" data-i="${i}">
      <div>
        ${price ? `<span class="t-price">${esc(price)}</span>` : ''}
        <div class="t-name">${esc(o.label)}</div>
        ${isSel && desc ? `<div class="t-desc">${esc(desc)}</div>` : ''}
      </div>
      <div class="t-foot">${foot}</div>
    </div>`;
  }

  function render() {
    if (!menu) return;
    $('title').textContent = menu.title || '';
    const crumbs = (menu.crumbs || []).slice(0, -1);
    $('crumbs').innerHTML = crumbs.map(esc).map((c) => `<span>${c}</span>`).join('<i>/</i>');
    $('count').textContent = menu.options.length ? `${sel + 1}/${menu.options.length}` : '';
    list.innerHTML = menu.options.map(tileHtml).join('');
    const el = list.querySelector('.tile.sel');
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest' });
  }

  function renderVehicle(v) {
    if (!v) return;
    $('make').textContent = v.make || '';
    $('model').textContent = v.name || '';
    $('stats').innerHTML = (v.stats || []).map((s) => {
      const val = Math.max(0, Math.min(10, +s.v || 0));
      return `<div><div class="st-lbl">${esc(s.label)}</div>
        <div class="st-row"><div class="st-bar"><i style="width:${val * 10}%"></i></div>
        <span class="st-val">${val.toFixed(1)}</span></div></div>`;
    }).join('');
    const w = $('wallet');
    if (typeof v.credits === 'number') {
      w.textContent = `${Math.round(v.credits).toLocaleString('en-US')} CR`;
      w.classList.remove('hidden');
    } else w.classList.add('hidden');
  }

  // ── actions ─────────────────────────────────────────────────────────────
  function setSel(i) {
    if (!menu || !menu.options.length) return;
    const n = menu.options.length;
    i = ((i % n) + n) % n;
    if (i === sel) return;
    sel = i;
    render();
    post('hover', { i: sel + 1 });
  }

  function step(i, d) {
    const o = menu && menu.options[i];
    if (!o || o.kind !== 'value' || !o.values) return;
    const n = o.values.length;
    o.index = ((o.index - 1 + d + n) % n) + 1;
    sel = i;
    render();
    post('scroll', { i: i + 1, v: o.index });
  }

  function activate(i) {
    const o = menu && menu.options[i];
    if (!o) return;
    post('select', { i: i + 1, v: o.index });
  }

  // ── mouse: rows ─────────────────────────────────────────────────────────
  list.addEventListener('click', (e) => {
    const a = e.target.closest('.arr');
    if (a) { step(+a.dataset.i, +a.dataset.step); return; }
    const r = e.target.closest('.tile');
    if (!r) return;
    const i = +r.dataset.i;
    if (i === sel) activate(i); else setSel(i);   // first click selects, second opens / installs
  });
  list.addEventListener('dblclick', (e) => {
    const r = e.target.closest('.tile');
    if (r && !e.target.closest('.arr')) activate(+r.dataset.i);
  });
  $('close').onclick = () => post('exit');

  // ── mouse: camera (anywhere off the panel) ──────────────────────────────
  let dragging = false, acc = { x: 0, y: 0 }, queued = false;
  stage.addEventListener('mousedown', (e) => { if (e.button === 0) { dragging = true; stage.classList.add('drag'); } });
  window.addEventListener('mouseup', () => { dragging = false; stage.classList.remove('drag'); });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    acc.x += e.movementX; acc.y += e.movementY;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      post('cam', { t: 'drag', dx: acc.x, dy: acc.y });
      acc = { x: 0, y: 0 };
    });
  });
  stage.addEventListener('wheel', (e) => post('cam', { t: 'zoom', dir: e.deltaY > 0 ? 1 : -1 }), { passive: true });

  // ── keyboard ────────────────────────────────────────────────────────────
  window.addEventListener('keydown', (e) => {
    if (root.classList.contains('hidden') || !menu) return;
    switch (e.key) {
      case 'ArrowLeft': e.preventDefault(); setSel(sel - 1); break;
      case 'ArrowRight': e.preventDefault(); setSel(sel + 1); break;
      case 'ArrowUp': e.preventDefault(); step(sel, 1); break;
      case 'ArrowDown': e.preventDefault(); step(sel, -1); break;
      case 'Enter': e.preventDefault(); if (!e.repeat) activate(sel); break;
      case 'Backspace': case 'Escape': e.preventDefault(); if (!e.repeat) post('back'); break;
      case 'd': case 'D': if (!e.repeat) post('cam', { t: 'doors' }); break;
      case 'v': case 'V': if (!e.repeat) post('cam', { t: 'view' }); break;
    }
  });

  // ── messages ────────────────────────────────────────────────────────────
  function applyTheme(t) {
    if (!t || !/^#[0-9a-f]{6}$/i.test(t.accent || '')) return;
    const h = t.accent, r = document.documentElement.style;
    r.setProperty('--accent', h);
    r.setProperty('--accent-rgb', [1, 3, 5].map((i) => parseInt(h.substr(i, 2), 16)).join(', '));
  }

  window.addEventListener('message', (ev) => {
    const d = ev.data || {};
    if (d.action === 'open') root.classList.remove('hidden');
    else if (d.action === 'close') { root.classList.add('hidden'); menu = null; dragging = false; }
    else if (d.action === 'theme') applyTheme(d.theme);
    else if (d.action === 'vehicle') renderVehicle(d.data);
    else if (d.action === 'menu') {
      menu = d.data;
      sel = Math.max(0, Math.min((menu.selected || 1) - 1, menu.options.length - 1));
      root.classList.remove('hidden');
      render();
    }
  });
})();

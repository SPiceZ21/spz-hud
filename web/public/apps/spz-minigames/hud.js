// In-game minigame HUD. Driven by client/hud.lua — see the export docs there.
(() => {
  const root = document.getElementById('hud');
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // Colours arrive as '#hex', 'var(--x)' or an {r,g,b} array from Lua.
  const col = (c) => (Array.isArray(c) ? `rgb(${c.slice(0, 3).join(',')})` : c || '');
  const named = { ok: 'var(--ok)', bad: 'var(--bad)', warn: 'var(--warn)', dim: 'var(--tx-3)', accent: 'var(--c)' };
  const tone = (c) => named[c] || col(c);
  const asObj = (v) => (typeof v === 'string' ? { text: v } : v);

  const top = document.createElement('div'); top.className = 'hud-top';
  const bot = document.createElement('div'); bot.className = 'hud-bot';
  const fx = document.createElement('div');
  const board = document.createElement('div');
  root.append(top, bot, board, fx);

  // Scoreboard: { title, note, rows: [{ name, value, sub, icon, color, valueColor, me, out, sep }] }
  // The box is built once (its entry animation plays once); after that only the
  // header and rows are rewritten, and only when they actually changed — the
  // HUD updates ~10x a second, and rebuilding the box each time replayed its
  // animation (the flicker).
  let boardHead = '', boardRows = '';
  function renderBoard(b) {
    if (!b || !(b.rows || []).length) { board.innerHTML = ''; boardHead = boardRows = ''; return; }
    let box = board.firstElementChild;
    if (!box) {
      board.innerHTML = '<div class="hud-board glass"><div class="hud-board-h"></div><div class="hud-rows"></div></div>';
      box = board.firstElementChild;
      boardHead = boardRows = '';
    }
    const head = `<span>${esc(b.title || 'Players')}</span>${b.note ? `<b>${esc(b.note)}</b>` : ''}`;
    if (head !== boardHead) { boardHead = head; box.firstElementChild.innerHTML = head; }
    const rows = b.rows.slice(0, 12).map((r, i) => `
        <div class="hud-row${r.me ? ' me' : ''}${r.out ? ' out' : ''}${r.sep ? ' sep' : ''}">
          <span class="n">${b.numbered === false ? '' : i + 1}</span>
          <span class="i" style="--ic:${tone(r.color)}">${r.icon ? `<i class="fa-solid fa-${esc(r.icon)}"></i>` : ''}</span>
          <span class="nm">${esc(r.name)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>
          <span class="v" style="--vc:${tone(r.valueColor)}">${esc(r.value ?? '')}</span>
        </div>`).join('');
    if (rows !== boardRows) { boardRows = rows; box.lastElementChild.innerHTML = rows; }
  }

  let shape = '';
  let keysHtml = '';   // last key bar markup; rewritten only when it changes   // which blocks exist; re-render the DOM only when it changes

  function render(d) {
    if (!d) { top.innerHTML = bot.innerHTML = board.innerHTML = ''; shape = boardHead = boardRows = ''; return; }
    root.style.setProperty('--c', col(d.accent) || 'var(--accent)');
    renderBoard(d.board);

    const st = d.status, al = d.alert, hi = asObj(d.hint), bar = d.bar, ft = asObj(d.foot);
    const keys = (d.keys || []).filter((k) => k && k.key);
    const next = [!!st, !!(st && st.label), !!(st && st.sub), !!al, !!hi, !!bar, !!ft, (d.chips || []).length, keys.length > 0].join();
    if (next !== shape) {
      shape = next;
      top.innerHTML = `
        <div class="hud-strip glass"><div class="hud-ico"><i class="fa-solid fa-${esc(d.icon || 'gamepad')}"></i></div>
          <div class="hud-title"></div><div class="hud-chips">${(d.chips || []).map(() => '<span class="hud-chip"></span>').join('')}</div></div>
        ${st ? `<div class="hud-status glass">${st.label ? '<div class="hud-label"></div>' : ''}<div class="hud-value"></div>${st.sub ? '<div class="hud-sub"></div>' : ''}</div>` : ''}
        ${al ? '<div class="hud-alert"></div>' : ''}
        ${hi ? '<div class="hud-hint glass"></div>' : ''}`;
      bot.innerHTML = `
        ${bar ? '<div class="hud-meter glass"><div class="hud-meter-h"><span></span><b></b></div><div class="bar"><i></i></div></div>' : ''}
        ${ft ? '<div class="hud-foot glass"></div>' : ''}
        ${keys.length ? '<div class="hud-keys"></div>' : ''}`;
      keysHtml = '';
    }

    top.querySelector('.hud-title').textContent = d.title || '';
    top.querySelectorAll('.hud-chip').forEach((el, i) => {
      const c = asObj(d.chips[i]);
      el.textContent = c.text;
      el.classList.toggle('hot', !!c.hot);
    });
    if (st) {
      const box = top.querySelector('.hud-status');
      box.style.setProperty('--v', tone(st.color) || 'var(--tx-1)');
      box.querySelector('.hud-value').textContent = st.value ?? '';
      if (st.label) box.querySelector('.hud-label').textContent = st.label;
      if (st.sub) box.querySelector('.hud-sub').textContent = st.sub;
    }
    if (al) top.querySelector('.hud-alert').textContent = al;
    if (hi) {
      const el = top.querySelector('.hud-hint');
      el.textContent = hi.text; el.style.setProperty('--h', tone(hi.color) || 'var(--tx-2)');
    }
    if (bar) {
      const pct = Math.max(0, Math.min(1, +bar.pct || 0));
      const m = bot.querySelector('.hud-meter');
      m.style.setProperty('--m', tone(bar.color) || (pct > 0.6 ? 'var(--ok)' : pct > 0.3 ? 'var(--warn)' : 'var(--bad)'));
      m.querySelector('span').textContent = bar.label || '';
      m.querySelector('b').textContent = bar.value ?? `${Math.round(pct * 100)}%`;
      m.querySelector('i').style.width = `${pct * 100}%`;
    }
    // Key bar: live bindings from client/hud.lua. hot = the key for right now.
    if (keys.length) {
      const html = keys.map((k) => `<span class="hud-key${k.hot ? ' hot' : ''}${k.dim ? ' dim' : ''}">`
        + `${window.KeyGlyph ? KeyGlyph.html(k.key) : `<kbd>${esc(k.key)}</kbd>`}<span>${esc(k.label || '')}</span></span>`).join('');
      if (html !== keysHtml) { keysHtml = html; bot.querySelector('.hud-keys').innerHTML = html; }
    }
    if (ft) {
      const el = bot.querySelector('.hud-foot');
      el.innerHTML = (ft.key ? (window.KeyGlyph ? KeyGlyph.html(ft.key) : `<kbd>${esc(ft.key)}</kbd>`) : '') + esc(ft.text);
      el.style.setProperty('--f', tone(ft.color) || 'var(--tx-2)');
    }
  }

  let flashEl = null;
  function flash({ text, color, ms = 900 }) {
    if (flashEl) flashEl.remove();
    flashEl = document.createElement('div');
    flashEl.className = 'hud-flash' + (String(text).length > 4 ? ' long' : '');
    flashEl.textContent = text;
    flashEl.style.setProperty('--ms', `${ms}ms`);
    if (color) flashEl.style.setProperty('--fl', tone(color));
    fx.append(flashEl);
    const el = flashEl;
    setTimeout(() => el.remove(), ms + 50);
  }

  let shardEl = null, shardT = 0;
  function shard({ kicker, title, sub, color, ms = 4000 }) {
    if (shardEl) shardEl.remove();
    clearTimeout(shardT);
    const el = shardEl = document.createElement('div');
    el.className = 'hud-shard glass';
    el.innerHTML = `${kicker ? `<div class="k">${esc(kicker)}</div>` : ''}<div class="t">${esc(title)}</div>${sub ? `<div class="s">${esc(sub)}</div>` : ''}`;
    if (color) el.style.setProperty('--s', tone(color));
    fx.append(el);
    shardT = setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, ms);
  }

  window.addEventListener('message', ({ data }) => {
    if (!data || data.hud === undefined) return;
    if (data.hud === 'set') render(data.d);
    else if (data.hud === 'flash') flash(data.d);
    else if (data.hud === 'shard') shard(data.d);
    else if (data.hud === 'clear') { render(null); fx.innerHTML = ''; }
  });
})();

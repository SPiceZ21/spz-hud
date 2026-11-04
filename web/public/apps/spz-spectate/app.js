(function () {
  const el = (id) => document.getElementById(id);
  const root = el('root');
  const show = (cond, node) => node.classList.toggle('hidden', !cond);

  function update(d) {
    // Nation flag (local asset)
    const flag = el('flag');
    if (d.nation) { flag.src = 'asset/flags/' + String(d.nation).toLowerCase() + '.webp'; show(true, flag); }
    else show(false, flag);

    // Race number plate
    if (d.number != null) { el('num').textContent = d.number; show(true, el('num')); }
    else show(false, el('num'));

    el('name').textContent = d.name || '—';

    // Record-holder marker
    const recs = d.records || 0;
    show(recs > 0, el('rec'));
    el('rec').textContent = (recs > 1) ? ('REC ' + recs) : 'REC';

    if (d.rank) { el('rank').textContent = d.rank; show(true, el('rank')); }
    else show(false, el('rank'));

    if (d.crew) { el('crew').textContent = d.crew; show(true, el('crew')); }
    else show(false, el('crew'));

    // Status
    const status = el('status');
    if (d.racing) {
      const bits = ['RACING'];
      if (d.position != null) bits.push('P' + d.position);
      if (d.lap != null) bits.push('L' + d.lap);
      status.textContent = bits.join(' · ');
      status.className = 'status-val racing';
    } else {
      status.textContent = 'FREEROAM';
      status.className = 'status-val freeroam';
    }

    // Speed
    el('speed').textContent = d.speed != null ? d.speed : 0;
    el('veh').textContent = d.vehicle || 'On foot';

    el('counter').textContent = (d.index || 1) + ' / ' + (d.total || 1);
  }

  // Base theme (server.cfg spz_theme_* convars, pushed from spz-core).
  const THEME_VARS = { accent: '--primary', gold: '--gold' };
  const THEME_RGB_VARS = { accent: '--primary-rgb' };
  function hexToRgbTriplet(hex) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
    return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : null;
  }
  function applyTheme(theme) {
    if (!theme) return;
    for (const key in THEME_VARS) {
      if (theme[key]) document.documentElement.style.setProperty(THEME_VARS[key], theme[key]);
    }
    for (const key in THEME_RGB_VARS) {
      const rgb = theme[key] && hexToRgbTriplet(theme[key]);
      if (rgb) document.documentElement.style.setProperty(THEME_RGB_VARS[key], rgb);
    }
  }

  /* ── Live race board ──────────────────────────────────────────────────────
     Independent of the spectator bar above: shown to everyone outside the race,
     whether or not they are spectating. Own root, own show/hide messages. */

  const rfRoot = el('rf-root');

  function boardRow(r) {
    const div = document.createElement('div');
    div.className = 'rrow'
      + (r.position === 1 ? ' leader' : '')
      + (r.dnf ? ' dnf' : '')
      + (r.dc ? ' dc' : '');

    const pos = document.createElement('span');
    pos.className = 'rpos';
    pos.textContent = r.position != null ? r.position : '–';
    div.appendChild(pos);

    if (r.nation) {
      const flag = document.createElement('img');
      flag.className = 'rflag';
      flag.src = 'asset/flags/' + String(r.nation).toLowerCase() + '.webp';
      flag.alt = '';
      flag.onerror = () => flag.remove();
      div.appendChild(flag);
    }

    if (r.number != null) {
      const num = document.createElement('span');
      num.className = 'rnum';
      num.textContent = r.number;
      div.appendChild(num);
    }

    const name = document.createElement('span');
    name.className = 'rname';

    const text = document.createElement('span');
    text.textContent = r.crew ? r.crew + ' ' + (r.name || 'Racer') : (r.name || 'Racer');
    name.appendChild(text);

    // Ghost-bots and held reconnect slots are marked, not hidden — someone
    // reading the order should know which cars are not human and which have
    // stopped driving.
    if (r.bot || r.dc) {
      const tag = document.createElement('span');
      tag.className = 'rtag ' + (r.bot ? 'bot' : 'dc');
      tag.textContent = r.bot ? 'BOT' : 'DC';
      name.appendChild(tag);
    }

    div.appendChild(name);

    const gap = document.createElement('span');
    gap.className = 'rgap';
    gap.textContent = r.gap || '--';
    div.appendChild(gap);

    return div;
  }

  function renderBoard(b, maxRows, view, keys) {
    rfRoot.classList.toggle('final', !!b.final);
    // Mini drops the track strip and keeps the order. CSS does the hiding so
    // the markup is identical between views and nothing is rebuilt on a toggle.
    rfRoot.classList.toggle('mini', view === 'mini');

    if (keys) {
      // The player can rebind these, so the hint reads from what the client
      // actually registered rather than repeating a hardcoded default.
      el('rf-k-cycle').textContent = keys.cycle || '/raceboard';
      el('rf-k-hide').textContent = keys.hide || '/raceboard_hide';
    }

    el('rf-state').textContent = b.final ? 'RESULT' : 'LIVE RACE';

    // A sprint has no lap count worth showing — it is one run, start to finish.
    const isSprint = b.type === 'sprint' || (b.laps || 1) <= 1;
    el('rf-lap').textContent = isSprint
      ? (b.final ? 'FINISHED' : 'SPRINT')
      : 'LAP ' + (b.lap || 1) + '/' + (b.laps || 1);

    el('rf-track').textContent = b.track || '—';
    el('rf-class').textContent = b.class != null ? 'CLASS ' + b.class : '';

    const list = el('rf-list');
    list.innerHTML = '';

    const rows = b.rows || [];
    const cap = maxRows || 8;
    rows.slice(0, cap).forEach((r) => list.appendChild(boardRow(r)));

    // Say what was trimmed rather than silently showing a partial field.
    if (rows.length > cap) {
      const more = document.createElement('div');
      more.className = 'rf-more';
      more.textContent = '+' + (rows.length - cap) + ' MORE';
      list.appendChild(more);
    }
  }

  window.addEventListener('message', (e) => {
    const m = e.data || {};
    if (m.action === 'show') {
      root.classList.remove('hidden');
    } else if (m.action === 'hide') {
      root.classList.add('hidden');
    } else if (m.action === 'update') {
      root.classList.remove('hidden');
      update(m.data || {});
    } else if (m.action === 'board') {
      renderBoard(m.board || {}, m.maxRows, m.view, m.keys);
      rfRoot.classList.remove('hidden');
    } else if (m.action === 'boardHide') {
      rfRoot.classList.add('hidden');
    } else if (m.action === 'theme') {
      applyTheme(m.theme);
    }
  });

  // Browser preview: no NUI host, so seed a representative board.
  // ?view=mini renders the collapsed size; ?spectate=1 also shows the bar.
  if (!window.invokeNative) {
    const qs = new URLSearchParams(location.search);
    const previewView = qs.get('view') || 'full';
    renderBoard({
      track: 'DOWNTOWN GRAND PRIX', type: 'circuit', lap: 2, laps: 3, class: 'A',
      rows: [
        { position: 1, name: 'DRIFT_KING',  gap: 'LEADER',       nation: 'jp', number: 7,  crew: '[APX]' },
        { position: 2, name: 'SPICEZ',      gap: '+1.25',        nation: 'in', number: 21, crew: '[NR]' },
        { position: 3, name: 'SHADOW_GRID', gap: '+3.42',        nation: 'de', number: 44 },
        { position: 4, name: 'GHOST PACE',  gap: '+5.10',        nation: 'fr', number: 88, bot: true },
        { position: 5, name: 'NIGHT_OWL',   gap: '+8.77',        nation: 'gb', number: 18, dc: true },
        { position: 6, name: 'REDLINE',     gap: '+1:02.88 1L',  nation: 'us', number: 96 },
        { position: 7, name: 'APEX_HUNTER', gap: '+1:11.40 1L',  nation: 'br', number: 5 },
        { position: 8, name: 'LATE_BRAKER', gap: '+1:19.02 1L',  nation: 'ca', number: 33 },
        { position: 9, name: 'BACKMARKER',  gap: '+2:03.55 2L',  nation: 'au', number: 12 },
      ],
    }, previewView === 'mini' ? 3 : 8, previewView, { cycle: 'F7', hide: 'F8' });
    rfRoot.classList.remove('hidden');

    if (qs.get('spectate') === '1') {
      update({ name: 'DRIFT_KING', nation: 'jp', number: 7, rank: 'S-1', crew: '[APX]',
               racing: true, position: 1, lap: 2, speed: 214, vehicle: 'Sultan RS', index: 1, total: 6 });
      root.classList.remove('hidden');
    }
  }
})();

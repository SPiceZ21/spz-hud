'use strict';
// spz-pausemenu page. Lua (client/pausemenu.lua) sends open / menu / close /
// theme / face; the page posts select / close / sound / setting.
// An item id the menu did not offer does nothing on the Lua side.

const RES   = () => (typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'spz-pausemenu');
const inNui = () => typeof GetParentResourceName === 'function';
const $ = (id) => document.getElementById(id);
const root = $('root');
const post = (name, body) => (inNui()
  ? fetch(`https://${RES()}/${name}`, { method: 'POST', body: JSON.stringify(body || {}) }).then((r) => r.json()).catch(() => null)
  : Promise.resolve(null));
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// "Game settings" -> "<b>GAME</b>SETTINGS": the header's bold-first-word style.
const split = (t, gap = '') => { const w = String(t || '').split(' '); return `<b>${esc(w[0])}</b>${w.length > 1 ? gap : ''}${esc(w.slice(1).join(gap || ''))}`; };

// ── Sections ─────────────────────────────────────────────────────────────────
// GTA graphics cannot be changed from a script: Game settings explain each
// page and open GTA's own settings screen. UI settings are ours, applied live.
const GAME_PAGES = [
  ['Graphics', 'Quality, shadows, reflections, textures and distance scaling.'],
  ['Display', 'Resolution, refresh rate, screen type and safe zone.'],
  ['Audio', 'Volumes, output, radio and voice levels.'],
  ['Controls', 'Mouse and controller sensitivity, aiming and vehicle controls.'],
  ['Key bindings', 'Every key, including the server keys (FiveM tab).'],
  ['Camera', 'Field of view, first-person options and camera shake.'],
];
const SECTIONS = {
  game: {
    label: 'Game settings', glyph: 'G', desc: 'Change your game settings through the pause menu.',
    opts: GAME_PAGES.map(([name, d]) => ({
      name,
      rows: () => [
        { label: `${name}`, info: d, head: true },
        { label: `Open GTA ${name.toLowerCase()} settings`, go: 'settings' },
      ],
      note: 'These are GTA\'s own settings. Changes are made and confirmed in the game\'s settings screen.',
    })),
  },
  ui: {
    label: 'UI settings', glyph: 'U', desc: 'The SPiceZ HUD: speedometer, layout and players.',
    opts: [
      { name: 'HUD', rows: () => [
          { label: 'Speedometer', key: 'speedo', values: [['analogue', 'Analogue'], ['digital', 'Digital']] },
          { label: 'HUD layout', key: 'layout', go: 'layout', goLabel: 'Edit' },
        ], note: 'Applied straight away and saved for next time. HUD layout closes the menu and opens the editor.' },
      { name: 'Players', rows: () => [
          { label: 'Nametags', key: 'nametags', values: [['on', 'On'], ['off', 'Off']] },
        ], note: 'Names over other players\' heads.' },
    ],
  },
};

const S = { open: false, main: [], quick: [], col: 0, mi: 0, oi: 0, ri: 0, ui: {}, modal: null, lastNav: 0 };

function sound(name) {
  const now = performance.now();
  if (name === 'nav' && now - S.lastNav < 45) return;
  S.lastNav = now;
  post('sound', { name });
}

// Lua's item list, with its single Settings row split into our two sections
// and Quit sent to the bottom of the column.
function buildMain(items) {
  const out = [];
  for (const it of items || []) {
    if (it.quick) continue;
    if (it.id === 'settings') { out.push({ id: '§game', label: SECTIONS.game.label, sec: 'game' }, { id: '§ui', label: SECTIONS.ui.label, sec: 'ui' }); continue; }
    out.push(it);
  }
  const quitAt = out.findIndex((x) => x.id === 'disconnect');
  if (quitAt >= 0) { const [q] = out.splice(quitAt, 1); q.bottom = true; out.push(q); }
  return out;
}

const cur = () => S.main[S.mi];
const sec = () => (cur() && cur().sec ? SECTIONS[cur().sec] : null);
const opt = () => (sec() ? sec().opts[S.oi] : null);
const rows = () => (opt() ? opt().rows() : []);
const selectable = () => rows().map((r, i) => (r.head ? -1 : i)).filter((i) => i >= 0);

// ── Render ───────────────────────────────────────────────────────────────────
function render() {
  const c = cur(), s = sec(), o = opt();
  const trail = [c && c.label, s && S.col > 0 && o && o.name].filter(Boolean);
  $('crumb').innerHTML = `<b>SPICEZ</b> RACING` + trail.map((t) => `<span class="sep">/</span>${S.col > 0 && t === trail[trail.length - 1] ? `<b>${esc(t)}</b>` : esc(t)}`).join('');

  $('main').innerHTML = `<div class="kick">Menu</div>` + S.main.map((it, i) =>
    `<div class="m${it.danger ? ' danger' : ''}${it.bottom ? ' bottom' : ''}${i === S.mi ? ' sel' : ''}" data-c="0" data-i="${i}">${esc(it.label)}</div>`).join('');
  $('main').classList.toggle('focus', S.col === 0);

  $('opts').classList.toggle('show', !!s);
  $('opts').classList.toggle('focus', S.col === 1);
  $('opts').innerHTML = s ? `<div class="kick">${esc(s.label)}</div><div class="tile">` + s.opts.map((x, i) =>
    `<div class="o${i === S.oi ? ' sel' : ''}" data-c="1" data-i="${i}">${esc(x.name)}</div>`).join('') + `</div>` : '';

  $('panel').classList.toggle('show', !!o);
  $('panel').classList.toggle('focus', S.col === 2);
  if (o) {
    const rs = rows();
    const head = rs.find((x) => x.head);
    $('panel').innerHTML = `<div class="kick">Settings</div><div class="tile"><h3>${esc(o.name)}</h3>` +
      (head ? `<div class="sub">${esc(head.info)}</div>` : '') + `<div class="rows">` + rs.map((r, i) => {
      const sel = S.col === 2 && i === S.ri ? ' sel' : '';
      if (r.head) return `<div class="r head-row"><span class="rl">${esc(r.info)}</span></div>`;
      let right = '';
      if (r.values) {
        const v = S.ui[r.key] ?? r.values[0][0];
        right = `<div class="rv">` + r.values.map(([val, lbl]) =>
          `<div class="seg${val === v ? ' on' : ''}" data-val="${esc(val)}">${esc(lbl)}</div>`).join('') + `</div>`;
      } else if (r.go) right = `<span class="go">${esc(r.goLabel || 'Open')} &rsaquo;</span>`;
      return `<div class="r${sel}" data-c="2" data-i="${i}"><span class="rl">${esc(r.label)}</span>${right}</div>`;
    }).join('') + `</div><div class="note">${esc(o.note || '')}</div></div>`;
  } else $('panel').innerHTML = '';

  // Info block: the section's own blurb, or the selected item's description.
  const info = S.col > 0 ? null : s ? { g: s.glyph, t: s.label, d: s.desc } : c ? { g: (c.label || '?')[0], t: c.label, d: c.desc || '' } : null;
  $('info').innerHTML = info && info.d ? `<div class="tile"><div class="k">${s ? 'Section' : 'Selected'}</div><div class="t">${esc(info.t)}</div><div class="d">${esc(info.d)}</div></div>` : '';

  $('quick').innerHTML = S.quick.map((q, i) => `<div class="link" data-q="${i}">${esc(q.label)}</div>`).join('');
}

// ── Navigation ───────────────────────────────────────────────────────────────
function moveIn(col, d) {
  if (col === 0) { S.mi = (S.mi + d + S.main.length) % S.main.length; S.oi = 0; }
  else if (col === 1) { const n = sec().opts.length; S.oi = (S.oi + d + n) % n; }
  else {
    const sel = selectable(); if (!sel.length) return;
    const k = sel.indexOf(S.ri); S.ri = sel[(k + d + sel.length) % sel.length];
  }
  sound('nav'); render();
}
function enter() {
  if (S.col === 0) {
    const c = cur(); if (!c) return;
    if (c.sec) { S.col = 1; sound('nav'); render(); return; }
    choose(c);
  } else if (S.col === 1) {
    const sel = selectable(); if (!sel.length) return;
    S.col = 2; S.ri = sel[0]; sound('nav'); render();
  } else {
    const r = rows()[S.ri]; if (!r) return;
    if (r.values) step(r, 1);
    else if (r.go === 'settings') post('select', { id: 'settings' });
    else if (r.go === 'layout') post('setting', { key: 'layout' });
  }
}
function back() {
  if (S.col > 0) { S.col -= 1; sound('back'); render(); return; }
  close();
}
function step(r, d) {
  const vals = r.values.map((x) => x[0]);
  const k = Math.max(0, vals.indexOf(S.ui[r.key]));
  setVal(r, vals[(k + d + vals.length) % vals.length]);
}
function setVal(r, v) {
  if (S.ui[r.key] === v) return;
  S.ui[r.key] = v; render();
  post('setting', { key: r.key, value: v }).then((ui) => { if (ui && typeof ui === 'object') { S.ui = ui; render(); } });
}
function choose(it) {
  if (it.confirm) { S.modal = { it, c: 0 }; paintModal(); sound('nav'); return; }
  post('select', { id: it.id });
  if (!inNui()) close(true);
}
function paintModal() {
  const m = S.modal; $('modal').classList.toggle('on', !!m); if (!m) return;
  $('mt').textContent = m.it.confirm.title || m.it.label;
  $('mb').textContent = m.it.confirm.body || '';
  $('mc').classList.toggle('sel', m.c === 0); $('mk').classList.toggle('sel', m.c === 1);
}
function modalDone(confirm) {
  const m = S.modal; S.modal = null; paintModal();
  if (confirm) { post('select', { id: m.it.id }); if (!inNui()) close(true); } else sound('back');
}

// ── Open / close ─────────────────────────────────────────────────────────────
function setItems(items) {
  const prev = cur() && cur().id;
  S.main = buildMain(items);
  S.quick = (items || []).filter((x) => x.quick);
  const k = S.main.findIndex((x) => x.id === prev);
  if (k >= 0) S.mi = k; else { S.mi = 0; S.col = 0; }
  render();
}
function setDriver(p) {
  p = p || {}; const st = p.stats || {};
  $('dname').textContent = p.name || 'Driver';
  $('dsub').textContent = [p.rank, p.crew, st.iRating != null ? `iR ${st.iRating}` : null,
    st.credits != null ? `${Number(st.credits).toLocaleString('en-US')} CR` : null].filter(Boolean).join('  ·  ');
}
let outTimer = null;
function open(m) {
  S.open = true; S.col = 0; S.mi = 0; S.oi = 0; S.ri = 0; S.modal = null; paintModal();
  S.ui = m.ui || S.ui || {};
  setItems(m.items); setDriver(m.player);
  clearTimeout(outTimer); root.classList.remove('out');
  void root.offsetWidth;
  root.classList.add('on');
  tickClock();
}
function tickClock() {
  if (!S.open) return;
  const d = new Date();
  $('clock').textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  setTimeout(tickClock, 15000);
}
function close(local) {
  if (!S.open) return;
  S.open = false; S.modal = null; paintModal();
  root.classList.remove('on'); root.classList.add('out');
  clearTimeout(outTimer); outTimer = setTimeout(() => root.classList.remove('out'), 450);
  if (!local) post('close');
}

// ── Input ────────────────────────────────────────────────────────────────────
document.addEventListener('keydown', (e) => {
  if (!S.open) return;
  const k = e.key;
  if (S.modal) {
    if (['ArrowLeft', 'ArrowRight', 'Tab', 'a', 'd', 'A', 'D'].includes(k)) { S.modal.c ^= 1; paintModal(); sound('nav'); }
    else if (k === 'Enter' || k === ' ') modalDone(S.modal.c === 1);
    else if (k === 'Escape' || k === 'Backspace') modalDone(false);
    e.preventDefault(); return;
  }
  const row = S.col === 2 ? rows()[S.ri] : null;
  if (k === 'ArrowUp' || k === 'w' || k === 'W') moveIn(S.col, -1);
  else if (k === 'ArrowDown' || k === 's' || k === 'S') moveIn(S.col, 1);
  else if (k === 'ArrowRight' || k === 'd' || k === 'D') { if (row && row.values) step(row, 1); else if (S.col < 2) enter(); }
  else if (k === 'ArrowLeft' || k === 'a' || k === 'A') { if (row && row.values) step(row, -1); else back(); }
  else if (k === 'Enter' || k === ' ') enter();
  else if (k === 'Escape' || k === 'Backspace') back();
  else if ((k === 'p' || k === 'P') && S.col === 0) close();
  else return;
  e.preventDefault();
});
document.addEventListener('mouseover', (e) => {
  if (S.modal) return;
  const t = e.target.closest('[data-c]'); if (!t) return;
  const c = +t.dataset.c, i = +t.dataset.i;
  if (c === 0 && (S.mi !== i || S.col !== 0)) { S.col = 0; if (S.mi !== i) { S.mi = i; S.oi = 0; sound('nav'); } render(); }
  else if (c === 1 && (S.oi !== i || S.col !== 1)) { S.col = 1; if (S.oi !== i) sound('nav'); S.oi = i; render(); }
  else if (c === 2 && (S.ri !== i || S.col !== 2)) { S.col = 2; if (S.ri !== i) sound('nav'); S.ri = i; render(); }
});
document.addEventListener('click', (e) => {
  if (!S.open) return;
  if (S.modal) {
    if (e.target.closest('#mk')) modalDone(true);
    else if (e.target.closest('#mc')) modalDone(false);
    return;
  }
  const q = e.target.closest('[data-q]');
  if (q) { const it = S.quick[+q.dataset.q]; if (it) choose(it); return; }
  const seg = e.target.closest('[data-val]');
  const t = e.target.closest('[data-c]'); if (!t) return;
  const c = +t.dataset.c;
  S.col = c;
  if (c === 0) S.mi = +t.dataset.i; else if (c === 1) S.oi = +t.dataset.i; else S.ri = +t.dataset.i;
  const row = c === 2 ? rows()[S.ri] : null;
  if (row && row.values && seg) setVal(row, seg.dataset.val);
  else enter();
});
$('mc').addEventListener('mouseenter', () => { if (S.modal) { S.modal.c = 0; paintModal(); } });
$('mk').addEventListener('mouseenter', () => { if (S.modal) { S.modal.c = 1; paintModal(); } });

function applyTheme(theme) {
  if (!theme || !theme.accent) return;
  document.documentElement.style.setProperty('--accent', theme.accent);
  const x = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(theme.accent);
  if (x) document.documentElement.style.setProperty('--accent-rgb', `${parseInt(x[1], 16)}, ${parseInt(x[2], 16)}, ${parseInt(x[3], 16)}`);
}

window.addEventListener('message', (ev) => {
  const m = ev.data || {};
  if (m.action === 'open') open(m);
  else if (m.action === 'close') close(true);
  else if (m.action === 'menu') { if (S.open) setItems(m.items); }
  else if (m.action === 'theme') applyTheme(m.theme);
});

// Browser preview: a daylight stand-in for the blurred game.
if (!inNui()) {
  document.body.style.background = 'linear-gradient(180deg,#5d7894 0%,#9fb3c4 45%,#5e5a52 46%,#2b2a28 100%)';
  open({
    player: { name: 'SpiceZ21', rank: 'C-5', crew: '[NR]', stats: { iRating: 1500, credits: 1050 } },
    ui: { speedo: 'analogue', nametags: 'on' },
    items: [
      { id: 'resume', label: 'Resume', desc: 'Back to the session.' },
      { id: 'map', label: 'Map', desc: 'Waypoints, blips and the race route.' },
      { id: 'hub', label: 'Hub', desc: "Teleport back to Pop's Diner.", confirm: { title: 'Teleport to hub?', body: 'You will be moved across the map. Your car comes with you if you are driving it.' } },
      { id: 'settings', label: 'Settings', desc: 'Graphics, audio, controls and key bindings.' },
      { id: 'disconnect', label: 'Quit', desc: 'Leave the server.', danger: true, confirm: { title: 'Quit?', body: 'You will leave the server.' } },
      { id: 'q_join', label: 'Join race', quick: true }, { id: 'q_crew', label: 'Crew', quick: true }, { id: 'q_char', label: 'Character', quick: true },
    ],
  });
}

// spz-minigames hub — NUI
// The client pushes { action: "state", games: [...] } every poll; this file
// only renders it and posts button presses back as "action" callbacks.

const RES = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'spz-minigames';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ic = (n) => `<i class="fa-solid fa-${n}"></i>`;

let games = [];
let sel = 'colorrush';
let inviteFor = null;
let inviteList = [];

// Create-room form values per game, kept across the 1.5 s re-renders.
const forms = {};

function post(name, data = {}) {
  return fetch(`https://${RES}/${name}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  }).then((r) => r.json()).catch(() => null);
}
const act = (id, action, extra = {}) => post('action', { id, action, ...extra });

// ── status helpers ──────────────────────────────────────────────────────────

function status(g) {
  if (!g.online) return { cls: 'off', text: 'Offline', sub: 'Not running' };
  if (g.kind === 'pursuit') {
    if (g.room) {
      const s = g.room.state === 'match' ? 'In match' : `Your room · ${g.room.counts.total}/${g.room.limits.size}`;
      return { cls: 'me', text: g.room.state === 'match' ? 'Playing' : 'In room', sub: s };
    }
    const n = (g.rooms || []).length;
    return n ? { cls: 'queue', text: `${n} open`, sub: `${n} public lobb${n === 1 ? 'y' : 'ies'}` }
             : { cls: 'idle', text: 'Idle', sub: 'No lobbies — create one' };
  }
  const l = g.lobby;
  if (!l) return { cls: 'idle', text: '…', sub: 'Loading' };
  const rooms = l.rooms || [];
  const live = rooms.filter((r) => r.live).length;
  if (l.inRound) return { cls: 'me', text: 'Playing', sub: `In ${l.room ? l.room.name : 'a round'}` };
  if (l.practicing) return { cls: 'me', text: 'Practice', sub: 'Solo practice' };
  if (l.inLobby) return { cls: 'me', text: 'In room', sub: `${l.room.name} · ${l.count}/${l.max}` };
  if (rooms.length) {
    return { cls: live ? 'live' : 'queue', text: `${rooms.length} room${rooms.length === 1 ? '' : 's'}`,
             sub: live ? `${live} playing · ${rooms.length - live} open` : `${rooms.length} open` };
  }
  return { cls: 'idle', text: 'Idle', sub: 'No rooms — create one' };
}

// ── render ──────────────────────────────────────────────────────────────────

function renderList() {
  $('list').innerHTML = games.map((g) => {
    const s = status(g);
    return `<button class="item ${g.id === sel ? 'on' : ''} ${g.online ? '' : 'off'}" data-sel="${g.id}" style="--c:${g.accent}">
      <div class="ico">${ic(g.icon)}</div>
      <div><div class="nm">${esc(g.title)}</div><div class="sub">${esc(s.sub)}</div></div>
      <span class="pill ${s.cls}">${esc(s.text)}</span>
    </button>`;
  }).join('');
}

function hero(g, s) {
  return `<section class="hero">
    <div class="hero-ico">${ic(g.icon)}</div>
    <div class="hero-t">${esc(g.title)}</div>
    <div class="hero-b">${esc(g.blurb)}</div>
    <div class="hero-meta"><span class="pill ${s.cls}">${esc(s.text)}</span><span class="pill idle">${esc(s.sub)}</span></div>
  </section>`;
}

function roomList(rooms, joinable) {
  if (!rooms.length) return '<div class="empty">No rooms yet — create one.</div>';
  return rooms.map((r) => {
    const state = r.live
      ? `<span class="pill live">${r.score ? `${r.score.blue}-${r.score.orange}` : r.wave ? 'Wave ' + r.wave : 'Live'}</span>`
      : r.armed ? `<span class="pill queue">${ic('clock')} ${r.armedRemain ?? 0}s</span>` : '';
    const full = r.count >= r.max;
    const btn = r.mine ? '<span class="pill me">Yours</span>'
      : joinable ? `<button class="btn sm" data-a="joinRoom" data-room="${r.id}" ${r.live || full ? 'disabled' : ''}>${full ? 'Full' : 'Join'}</button>` : '';
    return `<div class="row room ${r.mine ? 'me' : ''}">
      <div class="room-main">
        <div class="room-nm">${r.private ? ic('lock') + ' ' : ''}${r.invited ? ic('envelope') + ' ' : ''}${esc(r.name)}</div>
        <div class="tag">${ic('crown')}${esc(r.host)} &nbsp;·&nbsp; ${ic('users')}${r.count}/${r.max}</div>
      </div>
      <div class="room-side">${state}${btn}</div>
    </div>`;
  }).join('');
}

function createForm(g, l) {
  const f = forms[g.id] ||= { name: '', max: l.max, private: false, team: '', mode: g.modes ? g.modes[0].id : '' };
  const full = (l.rooms || []).length >= (l.maxRooms || Infinity);
  return `<div class="form" data-form="${g.id}">
    <div class="h">Create room</div>
    <input class="search" data-f="name" maxlength="24" placeholder="Room name (optional)" value="${esc(f.name)}" spellcheck="false">
    <div class="field"><span>Max players</span><b data-out="max">${f.max}</b></div>
    <input type="range" class="range" data-f="max" min="${l.min}" max="${l.max}" step="${g.teams ? 2 : 1}" value="${f.max}">
    <label class="toggle"><input type="checkbox" data-f="private" ${f.private ? 'checked' : ''}><span></span>${ic('lock')} Invite-only</label>
    ${g.modes ? `<div class="btn-row">${g.modes.map((m) =>
      `<button class="btn sm ${f.mode === m.id ? 'sel' : ''}" data-mode="${esc(m.id)}">${esc(m.label)}</button>`).join('')}</div>` : ''}
    ${g.teams ? `<div class="btn-row">
      <button class="btn sm team-blue ${f.team === 'blue' ? 'sel' : ''}" data-pick="blue">Blue</button>
      <button class="btn sm team-orange ${f.team === 'orange' ? 'sel' : ''}" data-pick="orange">Orange</button></div>` : ''}
    <button class="btn primary" data-a="create" ${full ? 'disabled' : ''}>${ic('plus')} Create room</button>
    ${full ? `<div class="note">All ${l.maxRooms} rooms are in use.</div>` : ''}
  </div>`;
}

function lobbyBody(g) {
  const l = g.lobby || { count: 0, min: 2, max: 2, roster: [], rooms: [] };
  const rooms = l.rooms || [];

  // Not in a room: browse, quick join, create.
  if (!l.inLobby) {
    const side = l.practicing
      ? `<div class="note">You are in solo practice.</div><button class="btn danger" data-a="practice">${ic('stop')} Stop practice</button>`
      : `<button class="btn primary" data-a="quick">${ic('bolt')} Quick join</button>${createForm(g, l)}`
        + (g.practice ? `<button class="btn" data-a="practice">${ic('futbol')} Solo practice</button>` : '');
    return `<div class="body">
      <div class="col">
        <div class="h">Rooms <span class="h-sub">${rooms.length}/${l.maxRooms || '∞'}</span></div>
        <div class="roster">${roomList(rooms, !l.practicing)}</div>
      </div>
      <div class="col">${side}</div>
    </div>`;
  }

  // In a room.
  const room = l.room;
  const pct = l.max ? Math.min(100, (l.count / l.max) * 100) : 0;
  const roster = l.roster.map((r) => `<div class="row ${r.isMe ? 'me' : ''}">
      <span>${r.host ? ic('crown') + ' ' : ''}${esc(r.name)}${r.isMe ? ' <span class="tag">(you)</span>' : ''}</span>
      <span class="tag">${r.want ? `<span class="dot ${r.want}"></span>${esc(r.want)}` : ''}${
        l.isHost && !r.isMe && !l.roundLive ? `<button class="icon-btn" title="Remove" data-a="kick" data-target="${r.src}">${ic('user-xmark')}</button>` : ''}</span>
    </div>`).join('');

  let actions;
  if (l.inRound) {
    actions = '<div class="note">You are playing. Use the pause / radial menu to leave the minigame.</div>';
  } else if (l.roundLive) {
    actions = '<div class="note">Your room is mid-round.</div>';
  } else {
    const can = l.count >= l.min;
    if (l.isHost) {
      actions = `<button class="btn ok" data-a="start" ${can ? '' : 'disabled'}>${ic('play')} Start match</button>`;
      if (!can) actions += `<div class="note">Need ${l.min} players to start.</div>`;
    } else {
      actions = `<div class="note">${ic('crown')} Waiting for the host to start the match.</div>`;
    }
    if (g.teams) {
      actions += `<div class="btn-row">
        <button class="btn sm team-blue ${l.want === 'blue' ? 'sel' : ''}" data-a="team" data-team="blue">Blue</button>
        <button class="btn sm team-orange ${l.want === 'orange' ? 'sel' : ''}" data-a="team" data-team="orange">Orange</button></div>`;
    }
    actions += `<button class="btn" data-a="invite">${ic('user-plus')} Invite player</button>
      <button class="btn danger" data-a="leave">${ic('door-open')} Leave room</button>`;
  }

  const others = rooms.filter((r) => !r.mine);
  return `<div class="body">
    <div class="col">
      <div class="h">${room.private ? ic('lock') + ' ' : ''}${esc(room.name)} <span class="h-sub">#${room.id}${room.mode ? ' · ' + esc(room.mode) : ''}</span></div>
      <div class="stats">
        <div class="stat"><b>${l.count}/${l.max}</b><span>Players</span></div>
        <div class="stat"><b>${l.min}</b><span>To start</span></div>
        <div class="stat"><b>${l.roundLive ? (l.wave ? 'W' + l.wave : 'LIVE') : 'LOBBY'}</b><span>Status</span></div>
      </div>
      <div class="bar"><i style="width:${pct}%"></i></div>
      <div class="roster">${roster}</div>
      ${others.length ? `<div class="h">Other rooms</div><div class="roster">${roomList(others, false)}</div>` : ''}
    </div>
    <div class="col">
      <div class="h">Actions</div>
      ${actions}
    </div>
  </div>`;
}

function pursuitBody(g) {
  const room = g.room;
  if (!room) {
    const rooms = (g.rooms || []).map((r) => `<div class="row room">
        <div class="room-main">
          <div class="room-nm">${r.invited ? ic('envelope') + ' ' : ''}${esc(r.host)}'s lobby</div>
          <div class="tag">${ic('users')}${r.size}/${r.max}${r.robber ? ' &nbsp;·&nbsp; robber set' : ''}</div>
        </div>
        <div class="room-side"><button class="btn sm" data-a="joinRoom" data-room="${r.id}">Join</button></div>
      </div>`).join('') || '<div class="empty">No public lobbies right now.</div>';
    return `<div class="body">
      <div class="col"><div class="h">Public lobbies</div><div class="roster">${rooms}</div></div>
      <div class="col">
        <div class="h">Actions</div>
        <button class="btn primary" data-a="quick">${ic('bolt')} Quick join</button>
        <button class="btn" data-a="create">${ic('plus')} Create room</button>
        <div class="note">Roles (robber, cops, chopper) are dealt once everyone is ready. Pick cars and tuning in the room setup.</div>
      </div>
    </div>`;
  }

  const ICON = { robber: ic('mask'), cop: ic('car-on'), pilot: ic('helicopter') };
  const members = room.members.map((m) => `<div class="row ${m.me ? 'me' : ''}">
      <span>${m.host ? ic('crown') + ' ' : ''}${esc(m.name)}</span>
      <span class="tag">${m.role ? ICON[m.role] + ' ' + m.role : ''}</span></div>`).join('');
  const c = room.counts, lim = room.limits;
  const inMatch = room.state === 'match';
  return `<div class="body">
    <div class="col">
      <div class="h">Room ${room.id}${room.countdown ? ' · starting…' : ''}</div>
      <div class="stats">
        <div class="stat"><b>${c.total}/${lim.size}</b><span>Players</span></div>
        <div class="stat"><b>${c.cop}/${lim.cops}</b><span>Cops</span></div>
        <div class="stat"><b>${c.pilot}/${lim.pilots}</b><span>Chopper</span></div>
      </div>
      <div class="roster">${members}</div>
    </div>
    <div class="col">
      <div class="h">Actions</div>
      ${inMatch ? '<div class="note">Match in progress.</div>' : `
        ${room.isHost ? `<button class="btn primary" data-a="start" ${room.countdown ? 'disabled' : ''}>${ic('play')} Start match</button>`
                      : `<div class="note">${ic('crown')} Only the host can start.</div>`}
        <button class="btn primary" data-a="menu">${ic('wrench')} Cars &amp; tuning</button>
        <button class="btn" data-a="invite">${ic('user-plus')} Invite player</button>
        <button class="btn danger" data-a="leave">${ic('door-open')} Leave room</button>`}
    </div>
  </div>`;
}

function renderDetail() {
  const g = games.find((x) => x.id === sel) || games[0];
  if (!g) { $('detail').innerHTML = ''; return; }
  const d = $('detail');
  d.style.setProperty('--c', g.accent);
  const s = status(g);
  const scroll = d.querySelector('.body')?.scrollTop || 0;
  if (!g.online) {
    d.innerHTML = hero(g, s) + `<div class="offline"><b>OFFLINE</b>${esc(g.title)} is not running on this server.</div>`;
    return;
  }
  d.innerHTML = hero(g, s) + (g.kind === 'pursuit' ? pursuitBody(g) : lobbyBody(g));
  const body = d.querySelector('.body');
  if (body) body.scrollTop = scroll;
}

// While typing a room name, only the sidebar refreshes (a full redraw would
// steal the caret).
function render(force) {
  renderList();
  const a = document.activeElement;
  if (!force && a && a.dataset && a.dataset.f === 'name') return;
  renderDetail();
}

// ── invite modal ────────────────────────────────────────────────────────────

function renderInvites() {
  const q = $('modal-q').value.trim().toLowerCase();
  const list = inviteList.filter((p) => !q || p.name.toLowerCase().includes(q));
  $('modal-list').innerHTML = list.length
    ? list.map((p) => `<div class="row" data-inv="${p.source}"><span>${esc(p.name)}</span><span class="tag">${p.busy ? esc(p.busy) : 'ID ' + p.source}</span></div>`).join('')
    : '<div class="empty">No one to invite.</div>';
}

async function openInvite(id) {
  inviteFor = id;
  inviteList = [];
  $('modal-q').value = '';
  renderInvites();
  $('modal').classList.remove('hidden');
  inviteList = (await post('online', { id })) || [];
  renderInvites();
  $('modal-q').focus();
}
const closeInvite = () => { $('modal').classList.add('hidden'); inviteFor = null; };

// ── events ──────────────────────────────────────────────────────────────────

document.addEventListener('click', (e) => {
  const item = e.target.closest('[data-sel]');
  if (item) { sel = item.dataset.sel; render(true); return; }

  const inv = e.target.closest('[data-inv]');
  if (inv && inviteFor) { act(inviteFor, 'invite', { target: Number(inv.dataset.inv) }); closeInvite(); return; }

  const mode = e.target.closest('[data-mode]');
  if (mode) {
    const f = forms[sel];
    if (f) f.mode = mode.dataset.mode;
    render(true);
    return;
  }

  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const f = forms[sel];
    if (f) f.team = f.team === pick.dataset.pick ? '' : pick.dataset.pick;
    render(true);
    return;
  }

  const b = e.target.closest('[data-a]');
  if (!b || b.disabled) return;
  const a = b.dataset.a;
  if (a === 'invite') return openInvite(sel);
  if (a === 'create') {
    const f = forms[sel] || {};
    act(sel, 'create', { name: f.name, max: f.max, private: !!f.private, team: f.team || undefined, mode: f.mode || undefined });
    delete forms[sel];
    return;
  }
  act(sel, a, { team: b.dataset.team, room: b.dataset.room, target: b.dataset.target });
});

// Create-room form inputs write straight into `forms` so a re-render keeps them.
document.addEventListener('input', (e) => {
  const el = e.target;
  const box = el.closest && el.closest('[data-form]');
  if (!box || !el.dataset.f) return;
  const f = forms[box.dataset.form];
  if (!f) return;
  if (el.type === 'checkbox') f.private = el.checked;
  else if (el.type === 'range') {
    f.max = Number(el.value);
    const o = box.querySelector('[data-out="max"]');
    if (o) o.textContent = el.value;
  } else f[el.dataset.f] = el.value;
});

$('x').onclick = () => post('close');
$('modal-x').onclick = closeInvite;
$('modal-q').oninput = renderInvites;

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const a = document.activeElement;
  if (a && a.dataset && a.dataset.f) { a.blur(); return; }
  if (!$('modal').classList.contains('hidden')) closeInvite();
  else post('close');
});

// Server theme (server.cfg spz_theme_* via spz-core): the brand accent and
// backgrounds. Per-game accents (Config.Games) are left alone.
function applyTheme(t) {
  if (!t) return;
  const r = document.documentElement.style;
  if (t.accent) r.setProperty('--accent', t.accent);
  if (t.bg) r.setProperty('--bg', t.bg);
  if (t.bg2) r.setProperty('--bg-card', t.bg2);
}
window.addEventListener('message', ({ data }) => { if (data && data.action === 'theme') applyTheme(data.theme); });

window.addEventListener('message', ({ data }) => {
  if (!data) return;
  if (data.action === 'open') { $('hub').classList.remove('hidden'); if (data.select) { sel = data.select; render(true); } }
  if (data.action === 'close') { $('hub').classList.add('hidden'); closeInvite(); }
  if (data.action === 'state') {
    games = data.games || [];
    if (!games.some((g) => g.id === sel) && games[0]) sel = games[0].id;
    render();
  }
});

// Browser preview (outside FiveM): fake a snapshot so the layout can be checked.
if (typeof GetParentResourceName !== 'function') {
  window.postMessage({ action: 'open' }, '*');
  window.postMessage({ action: 'state', games: [
    { id: 'colorrush', title: 'Color Rush', icon: 'palette', accent: '#a855f7', blurb: 'A colour is called — rush to it before the rest of the grid drops away.', kind: 'lobby', hasStart: true, online: true,
      lobby: { inLobby: true, isHost: true, count: 3, min: 2, max: 32, armed: true, armedRemain: 31, maxRooms: 8,
        room: { id: 1, name: 'SpiceZ room', private: false, host: 'SpiceZ', count: 3, max: 32 },
        roster: [{ src: 1, name: 'SpiceZ', isMe: true, host: true }, { src: 2, name: 'Nova' }, { src: 3, name: 'Drift' }],
        rooms: [{ id: 1, name: 'SpiceZ room', host: 'SpiceZ', count: 3, max: 32, mine: true, armed: true, armedRemain: 31 },
                { id: 4, name: 'Sweats only', host: 'Ace', count: 6, max: 8, live: true, wave: 7 }] } },
    { id: 'pursuit', title: 'Hot Pursuit', icon: 'car-on', accent: '#3b82f6', blurb: 'One robber, a squad of cops.', kind: 'pursuit', online: true,
      rooms: [{ id: 2, host: 'Nova', size: 3, max: 12, robber: true, invited: true }] },
    { id: 'rocketleague', title: 'Rocket League', icon: 'futbol', accent: '#ff6200', blurb: 'Car soccer.', kind: 'lobby', teams: true, practice: true, hasStart: true, online: true,
      lobby: { count: 0, min: 2, max: 8, maxRooms: 6, roster: [],
        rooms: [{ id: 2, name: 'Ranked 2v2', host: 'Ace', count: 3, max: 4, invited: true, private: true },
                { id: 3, name: 'Chill', host: 'Kai', count: 6, max: 8, live: true, score: { blue: 2, orange: 1 } }] } },
    { id: 'bomb', title: 'Bomb Tag', icon: 'bomb', accent: '#ef4444', blurb: 'Pass the bomb.', kind: 'lobby', hasStart: true, online: true,
      lobby: { count: 0, min: 2, max: 16, maxRooms: 8, roster: [], rooms: [] } },
    { id: 'demolition', title: 'Demolition', icon: 'car-burst', accent: '#f5b942', blurb: 'Destruction derby.', kind: 'lobby', hasStart: true, online: false },
  ] }, '*');
}

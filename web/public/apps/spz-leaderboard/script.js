'use strict';

const root        = document.getElementById('root');
const body        = document.getElementById('body');
const podiumEl    = document.getElementById('podium');
const railEl      = document.getElementById('rail');
const classpick   = document.getElementById('classpick');
const classGroup  = classpick;
const sortSeg     = document.getElementById('sortSeg');
const chipbar     = document.getElementById('chipbar');
const scrollEl    = document.getElementById('scroll');
const heroTitle   = document.getElementById('heroTitle');
const heroSub     = document.getElementById('heroSub');
const heroCount   = document.getElementById('heroCount');
const searchInput = document.getElementById('searchInput');
const searchCount = document.getElementById('searchCount');

let activeTab   = 'standings';
let activeClass = 'S';
let activeSort  = null;
let lastData    = [];
let filterText  = '';
let openRow     = null;   // key of the expanded row
let openRaceId  = null;   // Races tab: the race whose classification is open
let myName      = '';
let meTrack       = 'ALL';   // My-stats chart filter
let meTrackSearch = '';      // track-list search text
let meTrackOpen   = true;    // track list maximised / minimised

const RES   = () => (typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'spz-leaderboard');
const inNui = () => typeof GetParentResourceName === 'function';

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
function fmtNum(n) { return (Number(n) || 0).toLocaleString(); }
function num(v, d = 0) { const n = Number(v); return Number.isFinite(n) ? n : d; }

// ── Icons ────────────────────────────────────────────────────────────────────
function ico(path) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}
const ICONS = {
  standings: ico('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
  classes:   ico('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>'),
  records:   ico('<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'),
  activity:  ico('<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'),
  me:        ico('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  rivals:    ico('<path d="M16 3h5v5"/><path d="M8 21H3v-5"/><path d="M21 3 14 10"/><path d="m3 21 7-7"/><path d="M8 3H3v5"/><path d="m3 3 7 7"/><path d="M16 21h5v-5"/><path d="m21 21-7-7"/>'),
  duels:     ico('<path d="M14.5 17.5 3 6V3h3l11.5 11.5"/><path d="m13 19 6-6"/><path d="m16 16 4 4"/><path d="M19 21 21 19"/><path d="M9.5 6.5 21 18v3h-3L6.5 9.5"/>'),
  races:     ico('<path d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.3 2q2 0 3.1-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.5"/>'),
  caret:     ico('<polyline points="6 9 12 15 18 9"/>'),
  play:      ico('<polygon points="6 4 20 12 6 20 6 4"/>'),
};

// ── Tab definitions ──────────────────────────────────────────────────────────
// `sorts` mirror the reference's Rank / Win Rate / KDA segment: each one is a
// column of the loaded rows, sorted highest-first.
const TABS = {
  races: {
    label: 'Races',
    title: 'Race archive',
    sub: 'Every race that has been run, newest first. Open one for its full classification.',
    unit: 'Races',
    sorts: [
      { key: '_recent',      label: 'Recent'  },
      { key: 'player_count', label: 'Drivers' },
      { key: 'duration_ms',  label: 'Length'  },
    ],
  },
  standings: {
    label: 'Standings',
    title: 'Global standings',
    sub: 'Every driver on the server, ranked by championship points, iRating and safety.',
    unit: 'Drivers',
    sorts: [
      { key: 'points',  label: 'Points'  },
      { key: 'iRating', label: 'iRating' },
      { key: 'sr',      label: 'Safety'  },
    ],
  },
  classes: {
    label: 'Classes',
    title: 'Class championship',
    sub: 'Per-class standings — wins, win rate and class points for the selected car class.',
    unit: 'Drivers',
    sorts: [
      { key: 'points',   label: 'Points'   },
      { key: 'wins',     label: 'Wins'     },
      { key: 'win_rate', label: 'Win rate' },
    ],
  },
  records: {
    label: 'Track records',
    title: 'Track records',
    sub: 'The fastest lap set on every track, and the driver holding it.',
    unit: 'Records',
    sorts: [
      { key: '_time',  label: 'Best lap', asc: true },
      { key: '_track', label: 'Track',    asc: true, text: true },
      { key: '_class', label: 'Class',    asc: true, text: true },
    ],
  },
  rivals: {
    label: 'Rival',
    title: 'Your rival',
    sub: 'Matched on iRating. Head-to-head best laps, track by track.',
    unit: 'Tracks',
    sorts: [
      { key: '_margin', label: 'Margin' },
      { key: '_track',  label: 'Track', asc: true, text: true },
    ],
  },
  duels: {
    label: 'Ghost duels',
    title: 'Ghost duels',
    sub: 'Staked runs against a stored ghost — who took the pot, and by how much.',
    unit: 'Duels',
    sorts: [
      { key: '_recent', label: 'Recent' },
      { key: 'stake',   label: 'Stake'  },
      { key: '_margin', label: 'Margin' },
    ],
  },
  activity: {
    label: 'Activity',
    title: 'Race activity',
    sub: 'The latest results, records and podium finishes across the server.',
    unit: 'Events',
    sorts: [],
  },
  me: {
    label: 'My stats',
    title: 'My stats',
    sub: 'Your career numbers — races, victories, podiums and ratings.',
    unit: '',
    sorts: [],
  },
};

const LIST_TABS = ['standings', 'classes', 'records', 'races', 'rivals', 'duels', 'activity', 'me'];
const SEARCHABLE = { standings: true, classes: true, records: true, duels: true, races: true };
const HAS_PODIUM = { standings: true, classes: true };

// ── Small helpers ────────────────────────────────────────────────────────────
function hashHue(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
// Discord picture when spz-identity has one on the profile (players.avatar_url),
// otherwise a coloured initial so the row never renders a broken image.
function avatar(name, url, big) {
  const n = String(name || '?').trim();
  const cls = `avatar${big ? ' av-lg' : ''}`;
  const hue = hashHue(n.toLowerCase());
  const initial = esc(n.charAt(0).toUpperCase() || '?');
  if (url && /^https?:\/\//i.test(url)) {
    return `<div class="${cls}" style="--av:hsl(${hue} 62% 62%)">
      <img src="${esc(url)}" alt="" draggable="false" loading="lazy"
           onerror="this.remove();this.parentNode.textContent='${initial}'">
    </div>`;
  }
  return `<div class="${cls}" style="--av:hsl(${hue} 62% 62%)">${initial}</div>`;
}
// ── Rank badges ──────────────────────────────────────────────────────────────
// spz-progression stores the rank as "<tier>-<sub>" (C-1 … S-5, see
// spz-progression/server/ranks.lua). Assets/ranks holds one SVG per rank,
// named RANK<tier><sub> for every tier (RANKC1 … RANKS5).
const RANK_FILES = (() => {
  const map = {};
  for (const t of ['A', 'B', 'C', 'S']) for (let i = 1; i <= 5; i++) map[t + i] = `RANK${t}${i}`;
  return map;
})();

// "S-3" / "s3" → "Assets/ranks/RANKS3.svg", or null when the rank has no art
// (an unranked / D-tier profile, or a value the DB has never seen).
// Badges use the Blender renders (Assets/rankfx/<RANK>.png — the 3D glass
// badge with its earned bars lit; built by _source/rankfx). The flat SVG in
// Assets/ranks is the fallback if a render is missing.
function rankFile(rank) {
  const m = /^\s*([SABC])\s*-?\s*([1-5])\s*$/i.exec(String(rank || ''));
  return m ? RANK_FILES[m[1].toUpperCase() + m[2]] || null : null;
}
function rankAsset(rank) {
  const file = rankFile(rank);
  return file ? `Assets/rankfx/${file}.png` : null;
}
function rankSvg(rank) {
  const file = rankFile(rank);
  return file ? `Assets/ranks/${file}.svg` : null;
}

// Where the badge sits inside the full idle video frame (Assets/rankfx/crop.json,
// written by _source/rankfx/stills.py), so the live video can be cropped to the
// same framing as the stills.
let RANK_CROP = { x: 0.2, y: 0.25, w: 0.6, h: 0.5 };
fetch('Assets/rankfx/crop.json').then((r) => r.json()).then((c) => { if (c && c.w) RANK_CROP = c; }).catch(() => {});

// The big "current rank" badge: the live 3D idle loop, cropped to the badge.
// Width in px; the height follows the badge's aspect.
function rankVideo(rank, width) {
  const file = rankFile(rank);
  if (!file) return '';
  const c = RANK_CROP;
  const FRAME_W = 1280, FRAME_H = 1152;                 // rendered video size
  const vw = width / c.w;                               // whole video, scaled so the badge = width
  const vh = vw * FRAME_H / FRAME_W;
  const h = Math.round(c.h * vh);
  return `<span class="rank-vid" style="width:${width}px;height:${h}px">
    <video src="Assets/rankfx/${file}_idle.webm" autoplay loop muted playsinline
      style="width:${vw}px;height:${vh}px;left:${-c.x * vw}px;top:${-c.y * vh}px"
      poster="Assets/rankfx/${file}.png"></video>
  </span>`;
}

// The badge itself. Falls back to the lettered class chip when the profile has
// no drawable rank, so the column is never blank.
function rankBadge(rank, tier, big) {
  const src = rankAsset(rank);
  const label = String(rank || tier || '').toUpperCase();
  if (!src) {
    const t = String(tier || label.charAt(0) || 'D').toUpperCase();
    return `<span class="chip ${esc(t)}">${esc(t)}</span>`;
  }
  const svg = rankSvg(rank);
  return `<span class="rank-badge${big ? ' rb-lg' : ''}" title="${esc(label)}">
    <img src="${esc(src)}" alt="${esc(label)}" draggable="false" loading="lazy"
      onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${esc(svg)}'}else{this.remove()}">
  </span>`;
}

// Bar under a value, scaled against the biggest value in the column — the
// reference's sparkline underline, but driven by real data.
function bar(value, max, colour) {
  const pct = max > 0 ? Math.max(3, Math.min(100, (num(value) / max) * 100)) : 0;
  return `<div class="col-bar"><i style="width:${pct}%${colour ? `;--bar:${colour}` : ''}"></i></div>`;
}
function maxOf(rows, pick) { return rows.reduce((m, r) => Math.max(m, num(pick(r))), 0); }

// Lap times sort ascending; parse "01:12.45" into seconds.
function timeSeconds(t) {
  const s = String(t || '');
  const m = /^(?:(\d+):)?(\d+)(?:\.(\d+))?$/.exec(s.trim());
  if (!m) return Infinity;
  return num(m[1]) * 60 + num(m[2]) + num(m[3] ? '0.' + m[3] : 0);
}

function rowKey(r, i) { return String(r.player_id || r.id || r.name || r.track_name || r.track || i); }

// ── NUI fetch ────────────────────────────────────────────────────────────────
async function fetchTab(tab, cls, raceId) {
  if (!inNui()) return raceId ? (MOCK.raceDetail || null) : (MOCK[tab] || []);
  try {
    const res = await fetch(`https://${RES()}/lbFetch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tab, class: cls, raceId }),
    });
    return await res.json();
  } catch (e) { return []; }
}

// ── Chrome: rail nav + sort segment ──────────────────────────────────────────
function buildNav() {
  railEl.innerHTML = LIST_TABS.map(t =>
    `<button class="rail-btn${t === activeTab ? ' active' : ''}" data-tab="${t}" title="${TABS[t].label}">${ICONS[t]}</button>`
  ).join('');
}

function buildSorts() {
  const sorts = TABS[activeTab].sorts;
  if (!sorts.length) { sortSeg.innerHTML = ''; sortSeg.style.display = 'none'; return; }
  sortSeg.style.display = '';
  if (!sorts.some(s => s.key === activeSort)) activeSort = sorts[0].key;
  sortSeg.innerHTML = sorts.map(s =>
    `<button class="seg-btn${s.key === activeSort ? ' active' : ''}" data-sort="${s.key}">${s.label}</button>`
  ).join('');
}

function buildChips(count) {
  const cls = (activeTab === 'classes') ? `<div class="chip-info">Class <b>${esc(activeClass)}</b></div>` : '';
  chipbar.innerHTML = `
    ${cls}
    <div class="chip-info"><span class="live-dot"></span>Live</div>
    <div class="chip-info">Showing <b>${count}</b></div>`;
}

// ── Sorting ──────────────────────────────────────────────────────────────────
function sortRows(rows) {
  const spec = (TABS[activeTab].sorts || []).find(s => s.key === activeSort);
  if (!spec) return rows;

  const pick = r => {
    switch (spec.key) {
      case '_time':   return timeSeconds(r.lap_time_f || r.best_time_f);
      case '_track':  return String(r.track_name || r.track || '').toLowerCase();
      case '_class':  return String(r.car_class || r.class || '').toLowerCase();
      // Rivals: biggest gap first, either direction. Duels: same idea.
      case '_margin': return Math.abs(num(r.margin != null ? r.margin : r.margin_ms));
      case '_recent': return Date.parse(String(r.settled_at || r.raced_at || r.created_at || '').replace(' ', 'T')) || 0;
      default:       return num(r[spec.key]);
    }
  };

  return rows.slice().sort((a, b) => {
    const va = pick(a), vb = pick(b);
    if (spec.text) return spec.asc ? String(va).localeCompare(vb) : String(vb).localeCompare(va);
    return spec.asc ? va - vb : vb - va;
  });
}

// ── Renderers ────────────────────────────────────────────────────────────────
// Panels only carry facts the collapsed row does not already show.
function detailCards(items) {
  const cards = items
    .filter(d => d && d[1] != null && d[1] !== '')
    .map(d => `<div class="dcard"><div class="dcard-l">${esc(d[0])}</div><div class="dcard-v">${d[2] ? d[1] : esc(d[1])}</div></div>`)
    .join('');
  const inner = cards || `<div class="dcard"><div class="dcard-v" style="color:var(--tx-4)">Nothing else recorded yet.</div></div>`;
  return `<div class="row-detail"><div class="detail-grid">${inner}</div></div>`;
}

// 184000 (seconds) → "51h 6m"
function playtime(sec) {
  const s = num(sec);
  if (s <= 0) return null;
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}
// unix seconds → "2026-08-29"
function stampDay(unix) {
  const n = num(unix);
  if (!n) return null;
  return new Date(n * 1000).toISOString().slice(0, 10);
}

function podiumCards(rows, metrics) {
  const MEDAL = { 1: 'gold', 2: 'silver', 3: 'brozen' };
  return rows.slice(0, 3).map((r, i) => {
    const place = i + 1;
    const stats = metrics(r).map(m => `
      <div class="metric">
        <div class="metric-l">${esc(m.label)}</div>
        <div class="metric-v">${esc(m.value)}</div>
        <div class="metric-bar"><i style="width:${m.pct}%${m.colour ? `;--bar:${m.colour}` : ''}"></i></div>
      </div>`).join('');

    return `<div class="pod pod-${place}">
      <div class="pod-head">
        ${avatar(r.name, r.avatar, true)}
        <div class="pod-name">${esc(r.name || 'Racer')}</div>
        <div class="pod-trophy"><img src="Assets/${MEDAL[place]}.png" alt="#${place}" draggable="false"></div>
      </div>
      <div class="pod-sub">${rankAsset(r.rank_title) ? rankBadge(r.rank_title, r.tier, true) : ''}#${place} · ${esc(r._sub || '')}</div>
      <div class="pod-stats">${stats}</div>
    </div>`;
  }).join('');
}

function renderStandings(rows) {
  if (!rows.length) return { head: '', html: emptyState('No standings recorded yet.'), podium: '' };

  const maxPts = maxOf(rows, r => r.points);
  const maxIr  = maxOf(rows, r => r.iRating);
  const maxSr  = maxOf(rows, r => r.sr);

  const head = `<div class="thead">
    <span style="min-width:46px">Place</span>
    <span style="flex:1;margin-left:10px">Driver</span>
    <span style="width:62px;text-align:center">Rank</span>
    <span style="width:104px">iRating</span>
    <span style="width:104px">Safety</span>
    <span style="width:104px">Points</span>
    <span style="width:20px"></span>
  </div>`;

  const html = rows.map((r, i) => {
    const rk   = num(r.rank, i + 1);
    const name = r.name || 'Racer';
    const key  = rowKey(r, i);
    const tier = String(r.tier || 'D').toUpperCase();

    return `<div class="row ${rk <= 3 ? 'r' + rk : ''} ${isMine(name) ? 'mine' : ''} ${openRow === key ? 'open' : ''}" data-key="${esc(key)}" data-name="${esc(name)}">
      <div class="row-main">
        <div class="pos">#${rk}</div>
        <div class="who">${avatar(name, r.avatar)}<div class="who-txt">
          <div class="nm">${esc(name)}</div>
          <div class="meta">${esc(r.rank_title || tier)} · LVL ${num(r.level, 1)}</div>
        </div></div>
        ${rankBadge(r.rank_title, tier)}
        <div class="col"><div class="col-v">${fmtNum(r.iRating)}</div>${bar(r.iRating, maxIr, 'var(--blue)')}</div>
        <div class="col"><div class="col-v">${num(r.sr, 0).toFixed(2)}</div>${bar(r.sr, maxSr, 'var(--green)')}</div>
        <div class="col"><div class="col-v">${fmtNum(r.points)}</div>${bar(r.points, maxPts)}</div>
        <div class="caret">${ICONS.caret}</div>
      </div>
      ${detailCards([
        ['Races', r.total_races ? fmtNum(r.total_races) : null],
        ['Wins / podiums', r.total_races ? `${fmtNum(r.wins)} / ${fmtNum(r.podiums)}` : null],
        ['Win rate', r.total_races ? Math.round(num(r.win_rate) * 100) + '%' : null],
        ['Average finish', r.avg_position ? 'P' + num(r.avg_position).toFixed(1) : null],
        ['DNFs', r.total_races ? fmtNum(r.dnfs) : null],
        ['Playtime', playtime(r.playtime)],
        ['Last raced', r.last_track ? `${r.last_track}${stampDay(r.last_race_at) ? ' · ' + stampDay(r.last_race_at) : ''}` : null],
        ['Racing since', r.joined_at ? String(r.joined_at).slice(0, 10) : null],
      ])}
    </div>`;
  }).join('');

  const podium = podiumCards(rows.map(r => ({ ...r, _sub: `${r.rank_title || r.tier || 'Driver'} · LVL ${num(r.level, 1)}` })), r => ([
    { label: 'Points',  value: fmtNum(r.points),          pct: pct(r.points, maxPts) },
    { label: 'iRating', value: fmtNum(r.iRating),         pct: pct(r.iRating, maxIr), colour: 'var(--blue)' },
    { label: 'Safety',  value: num(r.sr, 0).toFixed(2),   pct: pct(r.sr, maxSr),      colour: 'var(--green)' },
  ]));

  return { head, html, podium };
}

function renderClasses(rows) {
  if (!rows.length) return { head: '', html: emptyState('No racers in this class yet.'), podium: '' };

  const maxPts  = maxOf(rows, r => r.points);
  const maxWins = maxOf(rows, r => r.wins);

  const head = `<div class="thead">
    <span style="min-width:46px">Place</span>
    <span style="flex:1;margin-left:10px">Driver</span>
    <span style="width:62px;text-align:center">Rank</span>
    <span style="width:104px">Wins</span>
    <span style="width:104px">Win rate</span>
    <span style="width:104px">Points</span>
    <span style="width:20px"></span>
  </div>`;

  const html = rows.map((r, i) => {
    const rk   = num(r.rank, i + 1);
    const name = r.name || 'Racer';
    const key  = rowKey(r, i);
    const wr   = r.win_rate != null ? Math.round(num(r.win_rate) * 100) : null;

    return `<div class="row ${rk <= 3 ? 'r' + rk : ''} ${isMine(name) ? 'mine' : ''} ${openRow === key ? 'open' : ''}" data-key="${esc(key)}" data-name="${esc(name)}">
      <div class="row-main">
        <div class="pos">#${rk}</div>
        <div class="who">${avatar(name, r.avatar)}<div class="who-txt">
          <div class="nm">${esc(name)}</div>
          <div class="meta">${fmtNum(r.total_races)} races driven</div>
        </div></div>
        ${rankBadge(r.rank_title, activeClass)}
        <div class="col pos-v"><div class="col-v">${fmtNum(r.wins)}</div>${bar(r.wins, maxWins, 'var(--green)')}</div>
        <div class="col"><div class="col-v">${wr == null ? '—' : wr + '%'}</div>${bar(wr || 0, 100, 'var(--blue)')}</div>
        <div class="col"><div class="col-v">${fmtNum(r.points)}</div>${bar(r.points, maxPts)}</div>
        <div class="caret">${ICONS.caret}</div>
      </div>
      ${detailCards([
        ['Podiums', r.total_races ? fmtNum(r.podiums) : null],
        ['Average finish', r.avg_position ? 'P' + num(r.avg_position).toFixed(1) : null],
        ['DNFs', r.total_races ? fmtNum(r.dnfs) : null],
        ['Best lap', r.best_lap_f],
        ['iRating', r.iRating ? fmtNum(r.iRating) : null],
        ['Safety rating', r.sr != null ? num(r.sr, 3).toFixed(2) : null],
        ['Last raced', r.last_track ? `${r.last_track}${stampDay(r.last_race_at) ? ' · ' + stampDay(r.last_race_at) : ''}` : null],
      ])}
    </div>`;
  }).join('');

  const podium = podiumCards(rows.map(r => ({ ...r, _sub: `Class ${activeClass} · ${fmtNum(r.total_races)} races` })), r => ([
    { label: 'Points',   value: fmtNum(r.points), pct: pct(r.points, maxPts) },
    { label: 'Wins',     value: fmtNum(r.wins),   pct: pct(r.wins, maxWins), colour: 'var(--green)' },
    { label: 'Win rate', value: r.win_rate != null ? Math.round(num(r.win_rate) * 100) + '%' : '—', pct: pct(num(r.win_rate) * 100, 100), colour: 'var(--blue)' },
  ]));

  return { head, html, podium };
}

function renderRecords(rows) {
  if (!rows.length) return { head: '', html: emptyState('No track records established yet.'), podium: '' };

  const head = `<div class="thead">
    <span style="min-width:46px">Class</span>
    <span style="flex:1;margin-left:10px">Track / holder</span>
    <span style="width:104px">Best lap</span>
    <span style="width:104px">Set</span>
    <span style="width:20px"></span>
  </div>`;

  const html = rows.map((r, i) => {
    const cls    = String(r.car_class || r.class || 'S').toUpperCase();
    const track  = r.track_name || r.track || 'Track';
    const holder = r.player_name || r.holder || 'Racer';
    const time   = r.lap_time_f || r.best_time_f || '--:--';
    const when   = r.set_at || r.updated_at || r.raced_at;
    const key    = rowKey(r, i);

    return `<div class="row ${isMine(holder) ? 'mine' : ''} ${openRow === key ? 'open' : ''}" data-key="${esc(key)}" data-name="${esc(holder)}">
      <div class="row-main">
        <span class="chip ${cls}" style="min-width:46px">${esc(cls)}</span>
        <div class="who">${avatar(holder, r.avatar)}<div class="who-txt">
          <div class="nm">${esc(track)}</div>
          <div class="meta">Held by ${esc(holder)}</div>
        </div></div>
        ${rankAsset(r.rank_title) ? rankBadge(r.rank_title, cls) : ''}
        <div class="col time"><div class="col-v">${esc(time)}</div></div>
        <div class="col"><div class="col-v date">${esc(when ? String(when).slice(0, 10) : '—')}</div></div>
        <div class="caret">${ICONS.caret}</div>
      </div>
      ${detailCards([
        ['Holder rank', r.rank_title],
        ['Runner-up', r.runner_up],
        ['Runner-up time', r.runner_up_f],
        ['Lead over 2nd', r.margin_ms != null ? (num(r.margin_ms) / 1000).toFixed(3) + 's' : null],
        ['Drivers with a time', r.entrants ? fmtNum(r.entrants) : null],
        ['Vehicle', r.vehicle_name || r.vehicle],
        ['Set at', when ? String(when).slice(0, 16).replace('T', ' ') : null],
      ])}
    </div>`;
  }).join('');

  return { head, html, podium: '' };
}

// ── Rivals ───────────────────────────────────────────────────────────────────
// Head-to-head against the iRating-matched rival: one row per track, showing
// both stored best laps and who holds it.
function renderRivals(data) {
  const d = data || {};
  if (!d.rival) {
    return { head: '', html: emptyState('No rival assigned yet — race a few laps and check back.'), podium: '' };
  }

  const me = d.me || {};
  const h2h = d.head_to_head || {};
  const tracks = Array.isArray(d.tracks) ? d.tracks : [];

  // Only tracks where both have a time can be compared.
  const contested = tracks.filter(t => t.my_ms && t.rival_ms);
  const lead = num(h2h.wins) - num(h2h.losses);

  const header = `
    <div class="versus">
      <div class="vs-side">
        ${avatar(me.name, me.avatar, true)}
        ${rankAsset(me.rank_title) ? rankBadge(me.rank_title, null, true) : ''}
        <div class="vs-txt">
          <div class="vs-name">${esc(me.name || 'You')}</div>
          <div class="vs-meta">${fmtNum(me.iRating)} iR</div>
        </div>
      </div>

      <div class="vs-mid">
        <div class="vs-score"><b class="${lead > 0 ? 'up' : ''}">${fmtNum(h2h.wins)}</b><span>–</span><b class="${lead < 0 ? 'down' : ''}">${fmtNum(h2h.losses)}</b></div>
        <div class="vs-label">${contested.length} contested track${contested.length === 1 ? '' : 's'}${d.assigned_at ? ' · since ' + esc(String(d.assigned_at).slice(0, 10)) : ''}</div>
        <button class="btn btn-sm vs-reroll" id="rerollRival">Draw a new rival</button>
      </div>

      <div class="vs-side vs-right">
        <div class="vs-txt">
          <div class="vs-name">${esc(d.rival.name || 'Rival')}</div>
          <div class="vs-meta">${fmtNum(d.rival.iRating)} iR · ${esc(d.rival.rank_title || 'Driver')}</div>
        </div>
        ${rankAsset(d.rival.rank_title) ? rankBadge(d.rival.rank_title, null, true) : ''}
        ${avatar(d.rival.name, d.rival.avatar, true)}
      </div>
    </div>`;

  const feed = Array.isArray(d.feed) ? d.feed : [];
  const feedCard = feed.length ? `
    <div class="chart feed">
      <div class="chart-head"><span class="chart-title">Recent takeovers</span></div>
      <div class="feed-list">
        ${feed.map(f => `
          <div class="feed-row ${f.ours ? 'ours' : 'theirs'}">
            <i></i>
            <div class="who-txt">
              <div class="nm">${esc(f.actor || 'A driver')} took ${esc(f.track)}</div>
              <div class="meta">${f.margin_ms != null ? 'by ' + (num(f.margin_ms) / 1000).toFixed(3) + 's' : ''}${f.new_ms ? ' · ' + msToLap(f.new_ms) : ''}${f.created_at ? ' · ' + esc(String(f.created_at).slice(0, 16).replace('T', ' ')) : ''}</div>
            </div>
            <span class="chip ${f.ours ? 'C' : 'A'}">${f.ours ? 'You' : 'Rival'}</span>
          </div>`).join('')}
      </div>
    </div>` : '';

  if (!tracks.length) {
    return { head: '', html: header + feedCard + emptyState('Neither of you has a stored lap yet.'), podium: '' };
  }

  const head = `<div class="thead">
    <span style="flex:1;margin-left:4px">Track</span>
    <span style="width:104px">Your best</span>
    <span style="width:104px">${esc(d.rival.name || 'Rival')}</span>
    <span style="width:104px">Margin</span>
    <span style="width:20px"></span>
  </div>`;

  const maxMargin = Math.max(...contested.map(t => Math.abs(num(t.margin))), 1);

  const rows = tracks.map((t, i) => {
    const mine = num(t.my_ms), theirs = num(t.rival_ms);
    const both = mine > 0 && theirs > 0;
    const margin = both ? theirs - mine : null;          // +ve = you are faster
    const ahead = margin != null && margin > 0;
    const key = rowKey({ track: t.track }, i);

    const marginCell = margin == null
      ? `<div class="col"><div class="col-v" style="color:var(--tx-4)">—</div></div>`
      : `<div class="col"><div class="col-v ${ahead ? 'lead' : 'trail'}">${ahead ? '−' : '+'}${(Math.abs(margin) / 1000).toFixed(3)}s</div>
           ${bar(Math.abs(margin), maxMargin, ahead ? 'var(--green)' : '#ef4444')}</div>`;

    return `<div class="row ${both ? (ahead ? 'r-lead' : 'r-trail') : ''} ${openRow === key ? 'open' : ''}" data-key="${esc(key)}">
      <div class="row-main">
        <div class="who"><div class="who-txt">
          <div class="nm">${esc(t.track || 'Track')}</div>
          <div class="meta">${both ? (ahead ? 'You hold it' : 'Rival holds it') : (mine ? 'Rival has no time' : 'You have no time')}</div>
        </div></div>
        <div class="col time"><div class="col-v">${mine ? msToLap(mine) : '—'}</div></div>
        <div class="col time"><div class="col-v" style="color:var(--tx-2)">${theirs ? msToLap(theirs) : '—'}</div></div>
        ${marginCell}
        <div class="caret">${ICONS.caret}</div>
      </div>
      ${detailCards([
        ['Server best', t.track_best ? msToLap(t.track_best) : null],
        ['Held by', t.track_best_by],
        ['Your gap to best', t.gap_to_best != null ? '+' + (num(t.gap_to_best) / 1000).toFixed(3) + 's' : null],
        ['Your position', t.my_position ? `#${t.my_position} of ${fmtNum(t.drivers)}` : null],
        ['Drivers with a time', t.drivers ? fmtNum(t.drivers) : null],
      ])}
    </div>`;
  }).join('');

  return { head: header + feedCard + head, html: rows, podium: '' };
}

// ── Ghost duels ──────────────────────────────────────────────────────────────
function renderDuels(data) {
  const d = data || {};
  const rec = d.record || {};
  const rows = Array.isArray(d.rows) ? d.rows : (Array.isArray(d) ? d : []);

  const cell = (v, l) => `<div class="mscell sm"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const net = num(rec.won_credits) - num(rec.lost_credits);
  const record = `
    <div class="mystats duel-record">
      ${cell(fmtNum(rec.wins), 'Duels won')}
      ${cell(fmtNum(rec.losses), 'Duels lost')}
      ${cell(rec.total ? Math.round(num(rec.win_rate) * 100) + '%' : '—', 'Win rate')}
      ${cell(`${net >= 0 ? '+' : '−'}${fmtNum(Math.abs(net))}`, 'Net credits')}
      ${cell(fmtNum(rec.defended), 'Ghost defended')}
      ${cell(fmtNum(rec.pending), 'Pending')}
    </div>`;

  if (!rows.length) return { head: record, html: emptyState('No duels have been run yet.'), podium: '' };

  const head = `<div class="thead">
    <span style="min-width:62px">Result</span>
    <span style="flex:1;margin-left:10px">Challenger vs ghost</span>
    <span style="width:140px">Track</span>
    <span style="width:104px">Margin</span>
    <span style="width:104px">Stake</span>
    <span style="width:20px"></span>
  </div>`;

  const html = rows.map((r, i) => {
    const key = rowKey({ id: r.id }, i);
    const out = String(r.outcome || 'pending');
    const margin = r.margin_ms;
    const won = out === 'win';
    const when = r.settled_at || r.created_at;

    const marginCell = margin == null
      ? `<div class="col"><div class="col-v" style="color:var(--tx-4)">—</div></div>`
      : `<div class="col"><div class="col-v ${margin > 0 ? 'lead' : 'trail'}">${margin > 0 ? '−' : '+'}${(Math.abs(margin) / 1000).toFixed(3)}s</div></div>`;

    return `<div class="row ${openRow === key ? 'open' : ''} ${isMine(r.challenger) || isMine(r.opponent) ? 'mine' : ''}" data-key="${esc(key)}" data-name="${esc(r.challenger)}">
      <div class="row-main">
        <span class="outcome o-${esc(out)}">${esc(out === 'win' ? 'WIN' : out === 'loss' ? 'LOSS' : out === 'void' ? 'VOID' : 'OPEN')}</span>
        <div class="who">
          ${avatar(r.challenger, r.challenger_avatar)}
          ${rankAsset(r.challenger_rank) ? rankBadge(r.challenger_rank, null) : ''}
          <div class="who-txt">
            <div class="nm">${esc(r.challenger || 'Racer')} <span class="vs-sep">vs</span> ${esc(r.opponent || 'Ghost')}</div>
            <div class="meta">${esc(when ? String(when).slice(0, 16).replace('T', ' ') : 'Pending')}</div>
          </div>
          ${rankAsset(r.opponent_rank) ? rankBadge(r.opponent_rank, null) : ''}
          ${avatar(r.opponent, r.opponent_avatar)}
        </div>
        <div class="col" style="width:140px"><div class="col-v" style="font-size:12.5px">${esc(r.track || 'Track')}</div></div>
        ${marginCell}
        <div class="col"><div class="col-v ${won ? 'lead' : ''}">${fmtNum(r.stake)}<small>CR</small></div></div>
        <div class="caret">${ICONS.caret}</div>
      </div>
      ${detailCards([
        ['Ghost time to beat', r.target_f],
        ['Challenger ran', r.result_f],
        ['Payout', out === 'win' ? `+${fmtNum(num(r.stake) * 2)} CR` : out === 'loss' ? `−${fmtNum(r.stake)} CR` : null],
        ['Opened', r.created_at ? String(r.created_at).slice(0, 16).replace('T', ' ') : null],
        ['Settled', r.settled_at ? String(r.settled_at).slice(0, 16).replace('T', ' ') : 'Still open'],
      ])}
    </div>`;
  }).join('');

  return { head: record + head, html, podium: '' };
}

function renderActivity(rows) {
  if (!rows.length) return { head: '', html: emptyState('No recent activity.'), podium: '' };

  const html = rows.map((r, i) => {
    const who   = r.player || r.name || '';
    const title = r.title || (who ? `${who} ${r.action || 'raced at'} ${r.detail || 'a track'}` : 'Race result');
    const when  = r.raced_at || r.timestamp;
    const key   = rowKey(r, i);

    return `<div class="row ${openRow === key ? 'open' : ''}" data-key="${esc(key)}" data-name="${esc(who)}">
      <div class="row-main">
        ${avatar(who || title, r.avatar)}
        <div class="who"><div class="who-txt">
          <div class="nm">${esc(title)}</div>
          <div class="meta">${esc(when ? String(when).slice(0, 16).replace('T', ' ') : 'Just now')}</div>
        </div></div>
        ${rankAsset(r.rank_title) ? rankBadge(r.rank_title, r.car_class) : ''}
        <div class="caret">${ICONS.caret}</div>
      </div>
      ${detailCards([
        ['Driver', who],
        ['Track', r.detail || r.track_name || r.track],
        ['Class', r.car_class || r.class],
        ['Rank', r.rank_title],
        ['Position', r.position != null ? `P${r.position}` : null],
        ['Lap time', r.lap_time_f || r.best_time_f],
      ])}
    </div>`;
  }).join('');

  return { head: '', html, podium: '' };
}

// ── Charts (inline SVG, no libraries) ────────────────────────────────────────
// All of them read the player's recent-race history; nothing is invented — a
// card renders an empty note when the data behind it is missing.

const CH_W = 640, CH_H = 190, CH_PAD = { t: 14, r: 12, b: 22, l: 34 };

function chartCard(title, note, svg, cls) {
  return `<div class="chart${cls ? ' ' + cls : ''}">
    <div class="chart-head"><span class="chart-title">${esc(title)}</span>${note ? `<span class="chart-note">${esc(note)}</span>` : ''}</div>
    ${svg}
  </div>`;
}

// 84512 → "1:24.512"
function msToLap(ms) {
  const n = num(ms);
  if (n <= 0) return '—';
  const m = Math.floor(n / 60000);
  const s = Math.floor((n % 60000) / 1000);
  const t = Math.floor(n % 1000);
  return `${m}:${String(s).padStart(2, '0')}.${String(t).padStart(3, '0')}`;
}
function chartEmpty(msg) { return `<div class="chart-empty">${esc(msg)}</div>`; }

function gridLines(rows) {
  const x0 = CH_PAD.l, x1 = CH_W - CH_PAD.r;
  const y0 = CH_PAD.t, y1 = CH_H - CH_PAD.b;
  let out = '';
  for (let i = 0; i <= rows; i++) {
    const y = y0 + (y1 - y0) * (i / rows);
    out += `<line class="grid" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;
  }
  return out;
}

// Cumulative championship points across the recent races (oldest → newest).
function chartPoints(hist) {
  if (hist.length < 2) return chartCard('Points earned', '', chartEmpty('Needs at least two races.'));

  let acc = 0;
  const vals = hist.map(h => (acc += num(h.points_earned)));
  const max = Math.max(...vals, 1);
  const x0 = CH_PAD.l, x1 = CH_W - CH_PAD.r, y0 = CH_PAD.t, y1 = CH_H - CH_PAD.b;
  const px = i => x0 + (x1 - x0) * (i / (vals.length - 1));
  const py = v => y1 - (y1 - y0) * (v / max);

  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const area = `${line} L${px(vals.length - 1).toFixed(1)},${y1} L${px(0).toFixed(1)},${y1} Z`;
  const last = vals[vals.length - 1];

  return chartCard('Points earned', `${fmtNum(last)} over ${vals.length} races`, `
    <svg class="chart-svg" viewBox="0 0 ${CH_W} ${CH_H}" preserveAspectRatio="xMidYMid meet">
      <defs><linearGradient id="ptsFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.35"/>
        <stop offset="100%" stop-color="var(--accent)" stop-opacity="0"/>
      </linearGradient></defs>
      ${gridLines(3)}
      <text class="axis" x="${x0 - 6}" y="${y0 + 4}" text-anchor="end">${fmtNum(max)}</text>
      <text class="axis" x="${x0 - 6}" y="${y1}" text-anchor="end">0</text>
      <path d="${area}" fill="url(#ptsFill)"/>
      <path d="${line}" class="spark-line"/>
      <circle class="spark-dot" cx="${px(vals.length - 1).toFixed(1)}" cy="${py(last).toFixed(1)}" r="3.5"/>
    </svg>`);
}

// Finish position per race — shorter bar = better finish.
function chartPositions(hist) {
  if (!hist.length) return chartCard('Finish positions', '', chartEmpty('No races recorded yet.'));

  const worst = Math.max(...hist.map(h => (h.dnf ? 0 : num(h.finish_position, 0))), 5);
  const x0 = CH_PAD.l, x1 = CH_W - CH_PAD.r, y0 = CH_PAD.t, y1 = CH_H - CH_PAD.b;
  const slot = (x1 - x0) / hist.length;
  const bw = Math.max(3, Math.min(22, slot - 4));

  const bars = hist.map((h, i) => {
    const dnf = !!h.dnf;
    const p = num(h.finish_position, worst);
    const frac = dnf ? 1 : Math.min(1, p / worst);
    const h2 = Math.max(3, (y1 - y0) * frac);
    const x = x0 + slot * i + (slot - bw) / 2;
    const cls = dnf ? 'b-dnf' : p === 1 ? 'b-1' : p <= 3 ? 'b-3' : 'b-n';
    return `<rect class="bar ${cls}" x="${x.toFixed(1)}" y="${(y1 - h2).toFixed(1)}" width="${bw.toFixed(1)}" height="${h2.toFixed(1)}" rx="2">
      <title>${esc(h.track || 'Race')} — ${dnf ? 'DNF' : 'P' + p}</title>
    </rect>`;
  }).join('');

  return chartCard('Finish positions', `last ${hist.length} races · P1 at the bottom`, `
    <svg class="chart-svg" viewBox="0 0 ${CH_W} ${CH_H}" preserveAspectRatio="xMidYMid meet">
      ${gridLines(3)}
      <text class="axis" x="${x0 - 6}" y="${y0 + 4}" text-anchor="end">P${worst}</text>
      <text class="axis" x="${x0 - 6}" y="${y1}" text-anchor="end">P1</text>
      ${bars}
      <line class="grid axis-base" x1="${x0}" y1="${y1}" x2="${x1}" y2="${y1}"/>
    </svg>`);
}

// Wins / podiums / other finishes / DNFs as a donut.
function chartResults(s) {
  const total = num(s.total_races);
  if (!total) return chartCard('Result split', '', chartEmpty('No races recorded yet.'));

  const wins = num(s.wins);
  const pod  = Math.max(0, num(s.podiums) - wins);
  const dnf  = num(s.dnfs);
  const rest = Math.max(0, total - wins - pod - dnf);
  const parts = [
    { label: 'Wins',    value: wins, colour: 'var(--gold)'   },
    { label: 'Podiums', value: pod,  colour: 'var(--accent)' },
    { label: 'Finished',value: rest, colour: 'var(--blue)'   },
    { label: 'DNF',     value: dnf,  colour: '#ef4444'       },
  ].filter(p => p.value > 0);

  const R = 62, C = 2 * Math.PI * R;
  let offset = 0;
  const rings = parts.map(p => {
    const len = C * (p.value / total);
    const seg = `<circle class="donut-seg" cx="95" cy="95" r="${R}" stroke="${p.colour}"
        stroke-dasharray="${(len - 2).toFixed(1)} ${(C - len + 2).toFixed(1)}"
        stroke-dashoffset="${(-offset).toFixed(1)}"><title>${esc(p.label)}: ${p.value}</title></circle>`;
    offset += len;
    return seg;
  }).join('');

  const legend = parts.map(p => `<div class="legend-row">
      <i style="background:${p.colour}"></i>
      <span class="legend-l">${esc(p.label)}</span>
      <span class="legend-v">${fmtNum(p.value)}<small>${Math.round(p.value / total * 100)}%</small></span>
    </div>`).join('');

  return chartCard('Result split', `${fmtNum(total)} races`, `
    <div class="donut-wrap">
      <svg class="donut" viewBox="0 0 190 190">
        <circle class="donut-track" cx="95" cy="95" r="${R}"/>
        <g transform="rotate(-90 95 95)">${rings}</g>
        <text class="donut-v" x="95" y="92" text-anchor="middle">${Math.round(num(s.win_rate, wins / total) * 100)}%</text>
        <text class="donut-l" x="95" y="110" text-anchor="middle">WIN RATE</text>
      </svg>
      <div class="legend">${legend}</div>
    </div>`);
}

// Best lap per race. Y axis is inverted — faster laps sit higher — and the
// quickest lap in the range is marked.
function chartLap(hist) {
  const laps = hist.map(h => ({ ms: num(h.best_lap_ms), track: h.track })).filter(l => l.ms > 0);
  if (laps.length < 2) return chartCard('Best lap per race', '', chartEmpty('Needs at least two timed laps.'));

  const vals = laps.map(l => l.ms);
  const fastest = Math.min(...vals);
  const slowest = Math.max(...vals);
  const span = Math.max(1, slowest - fastest);
  // Pad so a flat series doesn't collapse onto the axis.
  const lo = fastest - span * 0.15, hi = slowest + span * 0.15;

  // Full-width card, so a wider viewBox keeps the plot from ballooning in height.
  const W = 1320;
  const x0 = CH_PAD.l + 22, x1 = W - CH_PAD.r, y0 = CH_PAD.t, y1 = CH_H - CH_PAD.b;
  const px = i => x0 + (x1 - x0) * (i / (laps.length - 1));
  const py = v => y0 + (y1 - y0) * ((v - lo) / (hi - lo));   // faster = higher

  const line = vals.map((v, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const dots = laps.map((l, i) => {
    const best = l.ms === fastest;
    return `<circle class="lap-dot${best ? ' best' : ''}" cx="${px(i).toFixed(1)}" cy="${py(l.ms).toFixed(1)}" r="${best ? 4 : 2.4}">
      <title>${esc(l.track || 'Race')} — ${msToLap(l.ms)}</title></circle>`;
  }).join('');

  const grid = [0, 1, 2, 3].map(i => {
    const y = y0 + (y1 - y0) * (i / 3);
    return `<line class="grid" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`;
  }).join('');

  return chartCard('Best lap per race', `fastest ${msToLap(fastest)}`, `
    <svg class="chart-svg" viewBox="0 0 ${W} ${CH_H}" preserveAspectRatio="xMidYMid meet">
      ${grid}
      <text class="axis" x="${x0 - 6}" y="${y0 + 4}" text-anchor="end">${msToLap(fastest)}</text>
      <text class="axis" x="${x0 - 6}" y="${y1}" text-anchor="end">${msToLap(slowest)}</text>
      <line class="grid best-line" x1="${x0}" y1="${py(fastest).toFixed(1)}" x2="${x1}" y2="${py(fastest).toFixed(1)}"/>
      <path d="${line}" class="lap-line"/>
      ${dots}
    </svg>`, 'wide');
}

// Safety-rating movement race by race.
function chartSr(hist) {
  const deltas = hist.map(h => num(h.sr_delta));
  if (!deltas.some(d => d !== 0)) return chartCard('Safety rating change', '', chartEmpty('No SR movement recorded.'));

  const max = Math.max(...deltas.map(Math.abs), 0.1);
  const x0 = CH_PAD.l, x1 = CH_W - CH_PAD.r, y0 = CH_PAD.t, y1 = CH_H - CH_PAD.b;
  const mid = (y0 + y1) / 2;
  const slot = (x1 - x0) / deltas.length;
  const bw = Math.max(3, Math.min(22, slot - 4));

  const bars = deltas.map((d, i) => {
    const h2 = Math.abs(d) / max * (mid - y0);
    const x = x0 + slot * i + (slot - bw) / 2;
    return `<rect class="bar ${d >= 0 ? 'b-up' : 'b-down'}" x="${x.toFixed(1)}" y="${(d >= 0 ? mid - h2 : mid).toFixed(1)}"
      width="${bw.toFixed(1)}" height="${Math.max(2, h2).toFixed(1)}" rx="2"><title>${d >= 0 ? '+' : ''}${d.toFixed(2)} SR</title></rect>`;
  }).join('');

  const net = deltas.reduce((a, b) => a + b, 0);
  return chartCard('Safety rating change', `${net >= 0 ? '+' : ''}${net.toFixed(2)} net`, `
    <svg class="chart-svg" viewBox="0 0 ${CH_W} ${CH_H}" preserveAspectRatio="xMidYMid meet">
      <text class="axis" x="${x0 - 6}" y="${y0 + 4}" text-anchor="end">+${max.toFixed(1)}</text>
      <text class="axis" x="${x0 - 6}" y="${y1}" text-anchor="end">-${max.toFixed(1)}</text>
      ${bars}
      <line class="grid axis-base" x1="${x0}" y1="${mid}" x2="${x1}" y2="${mid}"/>
    </svg>`);
}

// Race-day calendar, LeetCode-style: twelve month blocks laid side by side.
// Each block flexes by its own column count, so the row fills the card exactly
// — no dead space on the right — and every square stays square.
// Prefers the server's day x track aggregate (`getPlayerActivity`), falling
// back to the loaded history rows.
const HEAT_MONTHS = 12;

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function chartHeatmap(hist, activity, track) {
  const byDay = {};
  const add = (day, races, wins) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const cur = byDay[day] || (byDay[day] = { races: 0, wins: 0 });
    cur.races += races;
    cur.wins  += wins;
  };

  if (activity && activity.length) {
    activity.forEach(a => {
      if (track !== 'ALL' && (a.track || 'Unknown') !== track) return;
      add(String(a.day || '').slice(0, 10), num(a.races), num(a.wins));
    });
  } else {
    hist.forEach(h => add(String(h.raced_at || '').slice(0, 10), 1, num(h.finish_position) === 1 ? 1 : 0));
  }

  const dayKeys = Object.keys(byDay);
  if (!dayKeys.length) return chartCard('Race days', '', chartEmpty('No dated races in this range.'));

  const max = Math.max(...dayKeys.map(k => byDay[k].races));
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Twelve blocks ending with the current month.
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() - (HEAT_MONTHS - 1));

  let blocks = '';
  for (let m = 0; m < HEAT_MONTHS; m++) {
    const first = new Date(cursor.getFullYear(), cursor.getMonth() + m, 1);
    const year = first.getFullYear(), month = first.getMonth();
    const daysIn = new Date(year, month + 1, 0).getDate();
    const lead = first.getDay();                              // Sun = 0
    const cols = Math.ceil((lead + daysIn) / 7);

    let cells = '';
    for (let d = 1; d <= daysIn; d++) {
      const idx = lead + d - 1;
      const col = Math.floor(idx / 7) + 1;
      const row = (idx % 7) + 1;
      const key = isoDay(new Date(year, month, d));
      const e = byDay[key];
      const lvl = e ? Math.min(4, Math.ceil(e.races / max * 4)) : 0;
      const title = e
        ? `${key} — ${e.races} race${e.races > 1 ? 's' : ''}${e.wins ? `, ${e.wins} win${e.wins > 1 ? 's' : ''}` : ''}`
        : `${key} — no races`;
      cells += `<i class="heat-cell l${lvl}" style="grid-column:${col};grid-row:${row}" title="${esc(title)}"></i>`;
    }

    // flex-grow = column count keeps every square the same size across blocks.
    blocks += `<div class="heat-mblock" style="flex:${cols} 1 0">
      <div class="heat-mgrid" style="grid-template-columns:repeat(${cols}, 1fr)">${cells}</div>
      <div class="heat-mlabel">${MONTHS[month]}${month === 0 ? ` ’${String(year).slice(2)}` : ''}</div>
    </div>`;
  }

  const totalRaces = dayKeys.reduce((a, k) => a + byDay[k].races, 0);
  return chartCard('Race days', `${fmtNum(totalRaces)} races over ${dayKeys.length} active days · last year`, `
    <div class="heat">
      <div class="heat-row">${blocks}</div>
      <div class="heat-legend">
        <span>Less</span><i class="heat-cell l0"></i><i class="heat-cell l1"></i><i class="heat-cell l2"></i><i class="heat-cell l3"></i><i class="heat-cell l4"></i><span>More</span>
      </div>
    </div>`, 'wide');
}

// Track filter for the charts. Uses the server's per-track career summary when
// present so the counts cover every race, not just the plotted page.
function trackFilter(hist, summary) {
  const counts = {};
  if (summary && summary.length) {
    summary.forEach(t => { counts[t.track || 'Unknown'] = num(t.races); });
  } else {
    hist.forEach(h => { const t = h.track || 'Unknown'; counts[t] = (counts[t] || 0) + 1; });
  }
  const all = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (all.length < 2) return '';

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const q = meTrackSearch.trim().toLowerCase();
  const matched = q ? all.filter(t => t.toLowerCase().includes(q)) : all;

  const btn = (val, label, n) =>
    `<button class="seg-btn${meTrack === val ? ' active' : ''}" data-track="${esc(val)}">${esc(label)}${n != null ? ` <small>${fmtNum(n)}</small>` : ''}</button>`;

  // Minimised: only the active selection stays on screen.
  const chips = meTrackOpen
    ? (matched.length
        ? `${q ? '' : btn('ALL', 'All', total)}${matched.map(t => btn(t, t, counts[t])).join('')}`
        : `<span class="track-none">No track matches “${esc(meTrackSearch)}”</span>`)
    : btn(meTrack, meTrack === 'ALL' ? 'All tracks' : meTrack, meTrack === 'ALL' ? total : counts[meTrack]);

  const caret = meTrackOpen
    ? '<polyline points="18 15 12 9 6 15"/>'
    : '<polyline points="6 9 12 15 18 9"/>';

  return `<div class="track-filter">
    <span class="track-filter-l">Track</span>

    ${meTrackOpen ? `<label class="track-search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      <input id="trackSearch" type="text" placeholder="Find a track" autocomplete="off" value="${esc(meTrackSearch)}" />
      ${q ? `<button class="track-clear" id="trackClear" title="Clear">✕</button>` : ''}
    </label>` : ''}

    <div class="seg track-chips">${chips}</div>

    <button class="track-toggle" id="trackToggle" title="${meTrackOpen ? 'Minimise' : 'Maximise'}">
      ${meTrackOpen ? 'Minimise' : `Maximise <small>${all.length}</small>`}
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${caret}</svg>
    </button>
  </div>`;
}

// Career totals when unfiltered. Filtered uses the track's career row from the
// SQL summary when available, else the plotted races.
function splitFor(stats, hist, filtered, summary) {
  if (!filtered) return stats;

  const row = (summary || []).find(t => (t.track || 'Unknown') === meTrack);
  if (row) {
    return {
      total_races: num(row.races),
      wins: num(row.wins),
      podiums: num(row.podiums),
      dnfs: num(row.dnfs),
      win_rate: num(row.races) ? num(row.wins) / num(row.races) : 0,
    };
  }

  const wins = hist.filter(h => !h.dnf && num(h.finish_position) === 1).length;
  const podiums = hist.filter(h => !h.dnf && num(h.finish_position) <= 3 && num(h.finish_position) > 0).length;
  const dnfs = hist.filter(h => h.dnf).length;
  return {
    total_races: hist.length,
    wins, podiums, dnfs,
    win_rate: hist.length ? wins / hist.length : 0,
  };
}

function renderMe(data) {
  // New shape is { stats, history }; a bare stats object still works.
  const s = (data && data.stats) ? data.stats : (data || {});
  const all = (data && Array.isArray(data.history) ? data.history : []).slice().reverse(); // oldest → newest
  const activity = (data && Array.isArray(data.activity)) ? data.activity : [];
  const summary  = (data && Array.isArray(data.tracks))   ? data.tracks   : [];
  if (!s || !Object.keys(s).length) return { head: '', html: emptyState('No stats profile yet.'), podium: '' };

  const known = summary.length ? summary.map(t => t.track || 'Unknown')
                               : all.map(h => h.track || 'Unknown');
  if (meTrack !== 'ALL' && !known.includes(meTrack)) meTrack = 'ALL';
  const filtered = meTrack !== 'ALL';
  const hist = filtered ? all.filter(h => (h.track || 'Unknown') === meTrack) : all;

  const cell = (v, l) => `<div class="mscell"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const wr = s.total_races ? Math.round(num(s.wins) / num(s.total_races, 1) * 100) + '%' : '0%';

  const rankArt = rankAsset(s.rank);
  const html = `
    ${rankArt ? `<div class="me-rank">
      <span class="rank-badge rb-xl" title="${esc(String(s.rank))}">${rankVideo(s.rank, 132)}</span>
      <div class="me-rank-txt">
        <div class="me-rank-v">${esc(String(s.rank))}</div>
        <div class="me-rank-l">Current rank · LVL ${num(s.level, 1)}</div>
      </div>
    </div>` : ''}
    <div class="mystats">
      ${cell(fmtNum(s.total_races), 'Races completed')}
      ${cell(fmtNum(s.wins), 'Victories')}
      ${cell(fmtNum(s.podiums), 'Podium finishes')}
      ${cell(wr, 'Win ratio')}
      ${cell(fmtNum(num(s.iRating, 1000)), 'iRating')}
      ${cell(num(s.sr, 3).toFixed(2), 'Safety rating')}
    </div>
    ${trackFilter(all, summary)}
    <div class="charts">
      ${chartPoints(hist)}
      ${chartPositions(hist)}
      ${chartLap(hist)}
      ${chartResults(splitFor(s, hist, filtered, summary))}
      ${chartSr(hist)}
      ${chartHeatmap(hist, activity, meTrack)}
    </div>`;

  return { head: '', html, podium: '' };
}

function emptyState(msg) { return `<div class="state"><span>${esc(msg)}</span></div>`; }
function pct(v, max) { return max > 0 ? Math.max(3, Math.min(100, (num(v) / max) * 100)) : 0; }
function isMine(name) { return !!myName && String(name).toLowerCase() === myName.toLowerCase(); }

const RENDER = {
  races:     renderRaces,
  standings: renderStandings,
  classes:   renderClasses,
  records:   renderRecords,
  rivals:    renderRivals,
  duels:     renderDuels,
  activity:  renderActivity,
  me:        renderMe,
};

// ── Race archive ─────────────────────────────────────────────────────────────
// Two views behind one tab: the list of races, and one race's classification.
// `openRaceId` decides which, so going back is just clearing it.

// 214500 → "3:34.5" — a race duration, not a lap, so tenths are enough.
function msToDuration(ms) {
  const n = num(ms);
  if (n <= 0) return '—';
  const m = Math.floor(n / 60000);
  const sec = (n % 60000) / 1000;
  return `${m}:${sec.toFixed(1).padStart(4, '0')}`;
}

// "2026-08-30 18:22:41" → "30 Aug, 18:22". Never throws on a malformed value:
// the archive is the one screen that must render whatever the DB holds.
function whenLabel(v) {
  const raw = String(v || '').replace(' ', 'T');
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(v || '—').slice(0, 16);
  const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${MON[d.getMonth()]}, ${hh}:${mm}`;
}

function renderRaces(rows) {
  if (!rows.length) {
    return { head: '', html: emptyState('No races have been run yet.'), podium: '' };
  }

  const html = rows.map((r, i) => {
    const key = String(r.race_id || i);
    // A race where everyone retired has no winner — say so rather than
    // rendering an empty name cell.
    const winner = r.winner || null;
    const type = String(r.track_type || 'circuit').toUpperCase();

    return `<div class="row" data-key="${esc(key)}" data-race="${esc(r.race_id || '')}">
      <div class="row-main">
        ${avatar(winner || r.track || '?', r.winner_avatar)}
        <div class="who"><div class="who-txt">
          <div class="nm">${esc(r.track || 'Unknown track')}</div>
          <div class="meta">${esc(whenLabel(r.raced_at))} · ${esc(type)} · ${num(r.laps) || 1} lap${(num(r.laps) || 1) === 1 ? '' : 's'} · Class ${esc(r.car_class || '?')}</div>
        </div></div>
        ${rankAsset(r.winner_rank) ? rankBadge(r.winner_rank, r.car_class) : ''}
        <div class="race-cols">
          <span class="race-col"><b>${winner ? esc(winner) : '—'}</b><i>Winner</i></span>
          <span class="race-col"><b>${fmtNum(r.player_count)}</b><i>Drivers</i></span>
          <span class="race-col"><b>${esc(msToDuration(r.duration_ms))}</b><i>Length</i></span>
        </div>
        ${r.has_replay ? `<button class="replay-btn sm" data-replay="${esc(r.race_id)}" title="Watch replay">${ICONS.play}<span>Replay</span></button>` : ''}
        <div class="caret">${ICONS.caret}</div>
      </div>
    </div>`;
  }).join('');

  return { head: '', html, podium: '' };
}

// One race, in full. Finishers in position order, then anyone who retired.
function renderRaceDetail(d) {
  const entries = Array.isArray(d.entries) ? d.entries : [];
  const type = String(d.track_type || 'circuit').toUpperCase();

  const head = `<div class="race-head">
    <button class="race-back" id="raceBack">← All races</button>
    <div class="race-head-main">
      <div class="race-head-title">${esc(d.track || 'Unknown track')}</div>
      <div class="race-head-meta">${esc(whenLabel(d.raced_at))} · ${esc(type)} · ${num(d.laps) || 1} lap${(num(d.laps) || 1) === 1 ? '' : 's'} · Class ${esc(d.car_class || '?')} · ${fmtNum(d.player_count)} drivers · ${esc(msToDuration(d.duration_ms))}</div>
    </div>
    ${d.has_replay && d.race_id ? `<button class="replay-btn" data-replay="${esc(d.race_id)}">${ICONS.play}<span>Watch replay</span></button>` : ''}
  </div>`;

  if (!entries.length) {
    return { head, html: emptyState('No classification stored for this race.'), podium: '' };
  }

  const html = entries.map((e, i) => {
    const key = String(e.player_id || i);
    const posLabel = e.dnf ? 'DNF' : `P${e.position != null ? e.position : '?'}`;
    // Winner shows their time; everyone else the gap to it, which is the
    // number people actually compare.
    const timeLabel = e.dnf
      ? (e.dnf_reason ? String(e.dnf_reason).toUpperCase() : 'RETIRED')
      : (e.gap_ms ? `+${(e.gap_ms / 1000).toFixed(2)}` : msToLap(e.finish_time));

    return `<div class="row ${openRow === key ? 'open' : ''}${e.dnf ? ' race-dnf' : ''}" data-key="${esc(key)}" data-name="${esc(e.name || '')}">
      <div class="row-main">
        <span class="race-pos">${esc(posLabel)}</span>
        ${avatar(e.name, e.avatar)}
        <div class="who"><div class="who-txt">
          <div class="nm">${esc(e.name || 'Racer')}${e.personal_best ? ' <span class="race-pb">PB</span>' : ''}</div>
          <div class="meta">Best lap ${esc(msToLap(e.best_lap))}</div>
        </div></div>
        ${rankAsset(e.rank_title) ? rankBadge(e.rank_title, d.car_class) : ''}
        <span class="race-time">${esc(timeLabel)}</span>
        <div class="caret">${ICONS.caret}</div>
      </div>
      ${detailCards([
        ['Finish time', e.dnf ? null : msToLap(e.finish_time)],
        ['Gap', e.dnf || !e.gap_ms ? null : `+${(e.gap_ms / 1000).toFixed(2)}`],
        ['Best lap', msToLap(e.best_lap)],
        ['Rank', e.rank_title],
        ['Points', e.points_earned],
        ['XP', e.xp_earned],
        ['iRating', e.irating_change ? (e.irating_change > 0 ? `+${e.irating_change}` : String(e.irating_change)) : null],
        ['Safety', e.sr_change ? (e.sr_change > 0 ? `+${e.sr_change.toFixed(2)}` : e.sr_change.toFixed(2)) : null],
        ['Retired', e.dnf ? (e.dnf_reason || 'Unknown') : null],
      ])}
    </div>`;
  }).join('');

  return { head, html, podium: '' };
}

// ── Filtering + paint ────────────────────────────────────────────────────────
function matches(r, f) {
  if (!f) return true;
  let hay;
  if (activeTab === 'races')       hay = `${r.track || ''} ${r.winner || ''} ${r.car_class || ''}`;
  else if (activeTab === 'records') hay = `${r.track_name || r.track || ''} ${r.player_name || r.holder || ''}`;
  else if (activeTab === 'duels')  hay = `${r.challenger || ''} ${r.opponent || ''} ${r.track || ''}`;
  else                             hay = (r.name || r.player || r.title || '');
  return hay.toLowerCase().includes(f);
}

function renderCurrent() {
  const tab = TABS[activeTab];
  heroTitle.textContent = tab.title;
  heroSub.textContent = tab.sub;

  // Rivals and Duels arrive as objects with their rows nested, so they sort and
  // filter on the inner list rather than the payload itself.
  if (activeTab === 'rivals') {
    const d = lastData || {};
    const out = renderRivals({ ...d, tracks: sortRows(Array.isArray(d.tracks) ? d.tracks : []) });
    podiumEl.innerHTML = '';
    body.innerHTML = out.head + out.html;
    heroCount.textContent = fmtNum((d.tracks || []).length);
    buildChips((d.tracks || []).length);
    searchCount.textContent = '';
    return;
  }

  if (activeTab === 'duels') {
    const d = lastData || {};
    const source = Array.isArray(d.rows) ? d.rows : [];
    const filtered = filterText ? source.filter(r => matches(r, filterText)) : source;
    const out = renderDuels({ record: d.record, rows: sortRows(filtered) });
    podiumEl.innerHTML = '';
    body.innerHTML = out.head + out.html;
    heroCount.textContent = fmtNum(filtered.length);
    buildChips(filtered.length);
    searchCount.textContent = filterText ? `${filtered.length}/${source.length}` : '';
    return;
  }

  // Races: an array is the archive list, an object is one race's classification.
  if (activeTab === 'races' && !Array.isArray(lastData)) {
    const out = renderRaceDetail(lastData || {});
    podiumEl.innerHTML = '';
    body.innerHTML = out.head + out.html;
    heroTitle.textContent = lastData && lastData.track ? lastData.track : tab.title;
    heroSub.textContent = 'Full classification.';
    heroCount.textContent = fmtNum((lastData && lastData.entries || []).length);
    chipbar.innerHTML = '';
    searchCount.textContent = '';
    return;
  }

  if (!Array.isArray(lastData)) {                       // My stats is an object
    const out = RENDER[activeTab](lastData);
    podiumEl.innerHTML = '';
    body.innerHTML = out.html;
    heroCount.textContent = '—';
    chipbar.innerHTML = '';
    searchCount.textContent = '';
    return;
  }

  const rows = SEARCHABLE[activeTab] && filterText ? lastData.filter(r => matches(r, filterText)) : lastData;
  const sorted = sortRows(rows);
  const out = RENDER[activeTab](sorted);

  podiumEl.innerHTML = (HAS_PODIUM[activeTab] && !filterText) ? out.podium : '';
  body.innerHTML = out.head + out.html;

  heroCount.textContent = fmtNum(sorted.length);
  buildChips(sorted.length);
  searchCount.textContent = filterText ? `${rows.length}/${lastData.length}` : '';
}

// ── Load a tab ───────────────────────────────────────────────────────────────
async function loadTab() {
  buildNav();
  buildSorts();
  classGroup.classList.toggle('hidden', activeTab !== 'classes');

  // Inside a single race the list chrome does not apply: there is nothing to
  // sort a classification by (it IS the order) and nothing to search within
  // five rows. Both come back when you go back to the archive.
  const inRaceDetail = activeTab === 'races' && !!openRaceId;
  document.querySelector('.search').classList.toggle('hidden', !SEARCHABLE[activeTab] || inRaceDetail);
  if (inRaceDetail) sortSeg.style.display = 'none';
  // "Show my place" only means something on a ranked list.
  document.getElementById('myPlaceBtn').classList.toggle('hidden', activeTab === 'me' || activeTab === 'races');
  openRow = null;
  podiumEl.innerHTML = '';
  body.innerHTML = `<div class="state"><div class="spinner"></div><span>Loading telemetry…</span></div>`;

  lastData = await fetchTab(activeTab, activeClass, activeTab === 'races' ? openRaceId : null);
  renderCurrent();
}

function setTab(tab) {
  if (!TABS[tab] || tab === activeTab) return;
  activeTab = tab;
  activeSort = null;
  meTrack = 'ALL';
  meTrackSearch = '';
  meTrackOpen = true;
  filterText = '';
  searchInput.value = '';
  loadTab();
}

// ── Events ───────────────────────────────────────────────────────────────────
railEl.addEventListener('click', e => {
  const b = e.target.closest('.rail-btn'); if (b) setTab(b.dataset.tab);
});
sortSeg.addEventListener('click', e => {
  const b = e.target.closest('.seg-btn'); if (!b) return;
  activeSort = b.dataset.sort;
  buildSorts();
  renderCurrent();
});
classpick.addEventListener('click', e => {
  const b = e.target.closest('[data-cls]'); if (!b) return;
  classpick.querySelectorAll('[data-cls]').forEach(x => x.classList.remove('active'));
  b.classList.add('active');
  activeClass = b.dataset.cls;
  loadTab();
});

// Track filter on the My stats charts: pick a track, minimise/maximise the
// list, or clear the search.
body.addEventListener('click', e => {
  const t = e.target.closest('[data-track]');
  if (t) {
    meTrack = t.dataset.track;
    // Picking from the minimised chip re-opens the list.
    if (!meTrackOpen) meTrackOpen = true;
    renderCurrent();
    return;
  }
  if (e.target.closest('#trackToggle')) {
    meTrackOpen = !meTrackOpen;
    if (!meTrackOpen) meTrackSearch = '';
    renderCurrent();
    return;
  }
  if (e.target.closest('#trackClear')) {
    meTrackSearch = '';
    renderCurrent();
    focusTrackSearch();
  }
});

// The whole tab re-renders on every keystroke, so put the caret back.
function focusTrackSearch() {
  const el = document.getElementById('trackSearch');
  if (!el) return;
  el.focus();
  el.setSelectionRange(el.value.length, el.value.length);
}

body.addEventListener('input', e => {
  if (e.target.id !== 'trackSearch') return;
  meTrackSearch = e.target.value;
  renderCurrent();
  focusTrackSearch();
});

// Races: a row opens that race's classification; the back button clears it.
// Replay buttons: capture phase, so neither the row expand nor the open-race
// handler below sees the click.
body.addEventListener('click', e => {
  const btn = e.target.closest('[data-replay]');
  if (!btn) return;
  e.stopPropagation();
  e.preventDefault();
  if (!inNui()) return;
  fetch(`https://${RES()}/lbWatchReplay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raceId: btn.dataset.replay }),
  }).catch(() => {});
}, true);

// Registered BEFORE the generic row-expand handler so opening a race does not
// also toggle the row it was clicked on.
body.addEventListener('click', e => {
  if (e.target.closest('#raceBack')) {
    openRaceId = null;
    loadTab();
    return;
  }
  const card = e.target.closest('[data-race]');
  if (card && activeTab === 'races' && Array.isArray(lastData)) {
    openRaceId = card.dataset.race;
    if (openRaceId) loadTab();
  }
});

// Row expand / collapse — one open at a time, like the reference.
body.addEventListener('click', e => {
  const main = e.target.closest('.row-main'); if (!main) return;
  const row = main.parentElement;
  const key = row.dataset.key;
  const wasOpen = row.classList.contains('open');
  body.querySelectorAll('.row.open').forEach(r => r.classList.remove('open'));
  if (!wasOpen) { row.classList.add('open'); openRow = key; }
  else openRow = null;
});

searchInput.addEventListener('input', e => {
  filterText = String(e.target.value || '').trim().toLowerCase();
  renderCurrent();
});

document.getElementById('refreshBtn').addEventListener('click', loadTab);

// Redraw the rival pairing (server enforces its own cooldown).
body.addEventListener('click', e => {
  if (!e.target.closest('#rerollRival')) return;
  fetch(`https://${RES()}/rerollRival`, { method: 'POST', body: '{}' })
    .then(r => r.json().catch(() => ({})))
    .then(res => { if (res && res.ok) loadTab(); })
    .catch(() => {});
});

document.getElementById('myPlaceBtn').addEventListener('click', () => {
  const row = body.querySelector('.row.mine');
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'center' });
  row.classList.remove('flash');
  void row.offsetWidth;
  row.classList.add('flash');
});

function close() {
  root.classList.add('hidden');
  if (inNui()) fetch(`https://${RES()}/lbClose`, { method: 'POST', body: '{}' }).catch(() => {});
}
document.getElementById('closeBtn').addEventListener('click', close);
document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });

// ── Theme (server.cfg spz_theme_* convars, pushed from spz-core) ─────────────
const THEME_VARS = { accent: '--accent', bg: '--bg', bg2: '--bg-card', gold: '--gold' };
const THEME_RGB_VARS = { accent: '--accent-rgb' };
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

// Only used to mark and jump to the player's own row.
function setMe(name) { myName = String(name || ''); }

window.addEventListener('message', e => {
  const m = e.data || {};
  if (m.action === 'open') {
    if (m.player) setMe(m.player);
    // Opened straight from a finished race: land on that race's classification
    // instead of making the player find it in the archive.
    if (m.tab && TABS[m.tab]) {
      activeTab = m.tab;
      activeSort = null;
      filterText = '';
      searchInput.value = '';
    }
    openRaceId = m.raceId || null;
    root.classList.remove('hidden');
    loadTab();
  }
  else if (m.action === 'close') root.classList.add('hidden');
  else if (m.action === 'theme') applyTheme(m.theme);
});

// ── Browser preview mock ─────────────────────────────────────────────────────
const MOCK = {
  races: [
    { race_id: 'R4821', track: 'Downtown Grand Prix', track_type: 'circuit', car_class: 'A', laps: 3, player_count: 8, duration_ms: 642300, raced_at: '2026-08-30 18:22:41', winner: 'SPICEZ', winner_rank: 'S-1' },
    { race_id: 'R4820', track: 'Vinewood Hills Sprint', track_type: 'sprint', car_class: 'B', laps: 1, player_count: 6, duration_ms: 318900, raced_at: '2026-08-30 17:58:02', winner: 'Ghost', winner_rank: 'A-4' },
    { race_id: 'R4819', track: 'Docks Lines', track_type: 'circuit', car_class: 'S', laps: 2, player_count: 11, duration_ms: 511400, raced_at: '2026-08-30 17:31:19', winner: null },
  ],
  raceDetail: {
    race_id: 'R4821', track: 'Downtown Grand Prix', track_type: 'circuit', car_class: 'A',
    laps: 3, player_count: 8, duration_ms: 642300, raced_at: '2026-08-30 18:22:41',
    entries: [
      { position: 1, player_id: 1, name: 'SPICEZ', rank_title: 'S-1',      finish_time: 214500, best_lap: 71200, gap_ms: 0,     points_earned: 25, xp_earned: 350, irating_change: 32,  sr_change: 0.12, personal_best: true,  dnf: false },
      { position: 2, player_id: 2, name: 'DRIFT_KING', rank_title: 'A-2',  finish_time: 215750, best_lap: 71900, gap_ms: 1250,  points_earned: 18, xp_earned: 280, irating_change: 11,  sr_change: 0.04, personal_best: false, dnf: false },
      { position: 3, player_id: 3, name: 'SHADOW_GRID', rank_title: 'A-5', finish_time: 217920, best_lap: 72400, gap_ms: 3420,  points_earned: 15, xp_earned: 240, irating_change: -4,  sr_change: -0.02, personal_best: false, dnf: false },
      { position: 4, player_id: 4, name: 'NIGHT_OWL', rank_title: 'B-2',   finish_time: 223270, best_lap: 73800, gap_ms: 8770,  points_earned: 12, xp_earned: 200, irating_change: -12, sr_change: 0.01, personal_best: false, dnf: false },
      { position: null, player_id: 5, name: 'REDLINE', rank_title: 'C-3',  finish_time: null,   best_lap: 74100, points_earned: 0, xp_earned: 40, irating_change: -21, sr_change: -0.30, personal_best: false, dnf: true, dnf_reason: 'disconnect' },
    ],
  },
  standings: [
    { rank: 1, name: 'SPICEZ', avatar: 'https://cdn.discordapp.com/embed/avatars/0.png',   tier: 'S', rank_title: 'S-1', level: 24, iRating: 1840, sr: 3.42, points: 12500, total_races: 60, wins: 42, podiums: 51, dnfs: 0, win_rate: 0.70, avg_position: 1.8, playtime: 180000, last_track: 'Downtown GP', last_race_at: 1787000000, joined_at: '2026-01-14' },
    { rank: 2, name: 'ItzSteve', avatar: 'https://cdn.discordapp.com/embed/avatars/1.png', tier: 'A', rank_title: 'A-2',    level: 18, iRating: 1620, sr: 2.98, points: 9800,  total_races: 55, wins: 24, podiums: 38, dnfs: 1, win_rate: 0.61, avg_position: 2.5, playtime: 158000, last_track: 'Route 68', last_race_at: 1786910000, joined_at: '2026-02-14' },
    { rank: 3, name: 'Ghost', avatar: 'https://cdn.discordapp.com/embed/avatars/2.png',    tier: 'A', rank_title: 'A-4',    level: 15, iRating: 1510, sr: 2.10, points: 8100,  total_races: 51, wins: 20, podiums: 31, dnfs: 2, win_rate: 0.52, avg_position: 3.2, playtime: 136000, last_track: 'Docks Lines', last_race_at: 1786820000, joined_at: '2026-03-14' },
    { rank: 4, name: 'Rens',     tier: 'B', rank_title: 'B-1',  level: 12, iRating: 1320, sr: 2.75, points: 6400,  total_races: 44, wins: 11, podiums: 22, dnfs: 0, win_rate: 0.43, avg_position: 3.9, playtime: 114000, last_track: 'Vinewood Loop', last_race_at: 1786730000, joined_at: '2026-04-14' },
    { rank: 5, name: 'Kimberly', tier: 'B', rank_title: 'B-3',  level: 11, iRating: 1240, sr: 3.10, points: 5900,  total_races: 40, wins: 8,  podiums: 19, dnfs: 1, win_rate: 0.34, avg_position: 4.6, playtime: 92000, last_track: 'Airport Sprint', last_race_at: 1786640000, joined_at: '2026-05-14' },
    { rank: 6, name: 'n0name',   tier: 'C', rank_title: 'C-5', level: 7,  iRating: 1090, sr: 1.80, points: 3200,  total_races: 28, wins: 3,  podiums: 9, dnfs: 2, win_rate: 0.25, avg_position: 5.3, playtime: 70000, last_track: 'Sandy Ridge', last_race_at: 1786550000, joined_at: '2026-06-14' },
  ],
  classes: [
    { rank: 1, name: 'SPICEZ', avatar: 'https://cdn.discordapp.com/embed/avatars/0.png', wins: 42, total_races: 60, win_rate: 0.70, points: 400, podiums: 51, dnfs: 0, win_rate: 0.16, avg_position: 6.0, playtime: 48000, last_track: 'undefined', last_race_at: 1786460000, joined_at: '2026-01-14' },
    { rank: 2, name: 'Ghost', avatar: 'https://cdn.discordapp.com/embed/avatars/2.png',  wins: 20, total_races: 55, win_rate: 0.36, points: 260, podiums: 31, dnfs: 1, win_rate: 0.07, avg_position: 6.7, playtime: 26000, last_track: 'undefined', last_race_at: 1786370000, joined_at: '2026-02-14' },
    { rank: 3, name: 'Rens',   wins: 11, total_races: 44, win_rate: 0.25, points: 180, podiums: 22, dnfs: 2, win_rate: -0.02, avg_position: 7.4, playtime: 4000, last_track: 'undefined', last_race_at: 1786280000, joined_at: '2026-03-14' },
    { rank: 4, name: 'Pudge',  wins: 6,  total_races: 33, win_rate: 0.18, points: 120, podiums: 14, dnfs: 0, win_rate: -0.11, avg_position: 8.1, playtime: -18000, last_track: 'undefined', last_race_at: 1786190000, joined_at: '2026-04-14' },
  ],
  records: [
    { track: 'Downtown GP', car_class: 'S', player_name: 'SPICEZ', rank_title: 'S-1', lap_time_f: '01:12.45', vehicle: 'Zentorno', set_at: '2026-07-12', runner_up: 'Ghost', runner_up_f: '01:13.02', margin_ms: 570, entrants: 14 },
    { track: 'Docks Lines', car_class: 'A', player_name: 'Ghost', rank_title: 'A-4', lap_time_f: '01:44.02', vehicle: 'Sultan RS', set_at: '2026-07-10', runner_up: 'Rens', runner_up_f: '01:45.61', margin_ms: 1590, entrants: 9 },
    { track: 'Route 68',    car_class: 'B', player_name: 'Rens', rank_title: 'B-1',   lap_time_f: '02:03.88', vehicle: 'Futo',      set_at: '2026-07-08' },
  ],
  activity: [
    { title: 'SPICEZ won Downtown GP (S)', player: 'SPICEZ', rank_title: 'S-1', detail: 'Downtown GP', car_class: 'S', position: 1, raced_at: '2026-07-13 20:11' },
    { title: 'Ghost set a record on Docks Lines', player: 'Ghost', rank_title: 'A-4', detail: 'Docks Lines', car_class: 'A', lap_time_f: '01:44.02', raced_at: '2026-07-13 19:40' },
  ],
  rivals: {"me":{"name":"SPICEZ","avatar":"https://cdn.discordapp.com/embed/avatars/0.png","iRating":1840,"rank_title":"S-1"},"rival":{"name":"Ghost","avatar":"https://cdn.discordapp.com/embed/avatars/2.png","iRating":1810,"rank_title":"A-4","level":19,"points":9400,"assigned_at":"2026-08-01"},"head_to_head":{"wins":3,"losses":1,"tracks":6},"assigned_at":"2026-08-01","feed":[{"track":"Docks Lines","actor":"SPICEZ","ours":true,"new_ms":77100,"old_ms":79200,"margin_ms":2100,"created_at":"2026-08-28 20:11"},{"track":"Route 68","actor":"Ghost","ours":false,"new_ms":84200,"old_ms":85650,"margin_ms":1450,"created_at":"2026-08-26 18:35"}],"tracks":[{"track":"Downtown GP","my_ms":72000,"rival_ms":70550,"margin":-1450,"track_best":71200,"track_best_by":"ItzSteve","drivers":12,"my_position":3,"gap_to_best":1400},{"track":"Docks Lines","my_ms":77100,"rival_ms":79200,"margin":2100,"track_best":71200,"track_best_by":"ItzSteve","drivers":12,"my_position":3,"gap_to_best":1400},{"track":"Route 68","my_ms":80400,"rival_ms":82500,"margin":2100,"track_best":71200,"track_best_by":"ItzSteve","drivers":12,"my_position":3,"gap_to_best":1400},{"track":"Vinewood Loop","my_ms":85500,"rival_ms":null,"margin":null,"track_best":71200,"track_best_by":"ItzSteve","drivers":12,"my_position":3,"gap_to_best":1400},{"track":"Airport Sprint","my_ms":88800,"rival_ms":90900,"margin":2100,"track_best":71200,"track_best_by":"ItzSteve","drivers":12,"my_position":3,"gap_to_best":1400},{"track":"Sandy Ridge","my_ms":null,"rival_ms":96000,"margin":null,"track_best":71200,"track_best_by":"ItzSteve","drivers":12,"my_position":3,"gap_to_best":1400}]},
  duels: {"record":{"total":6,"wins":4,"losses":2,"pending":1,"win_rate":0.6666666666666666,"won_credits":1850,"lost_credits":700,"challenged":5,"defended":3},"rows":[{"id":100,"track":"Downtown GP","stake":250,"outcome":"win","target_ms":78000,"result_ms":77400,"target_f":"1:18.000","result_f":"1:17.400","margin_ms":600,"challenger":"SPICEZ","challenger_avatar":"https://cdn.discordapp.com/embed/avatars/0.png","challenger_rank":"S-1","opponent_rank":"A-2","opponent":"ItzSteve","opponent_avatar":"https://cdn.discordapp.com/embed/avatars/2.png","created_at":"2026-08-10 19:20","settled_at":"2026-08-10 19:41"},{"id":101,"track":"Docks Lines","stake":375,"outcome":"loss","target_ms":80600,"result_ms":81170,"target_f":"1:20.600","result_f":"1:21.170","margin_ms":-570,"challenger":"Rens","challenger_avatar":"https://cdn.discordapp.com/embed/avatars/1.png","challenger_rank":"B-1","opponent_rank":"A-4","opponent":"Ghost","opponent_avatar":"https://cdn.discordapp.com/embed/avatars/3.png","created_at":"2026-08-11 19:20","settled_at":"2026-08-11 19:41"},{"id":102,"track":"Route 68","stake":500,"outcome":"win","target_ms":83200,"result_ms":82420,"target_f":"1:23.200","result_f":"1:22.420","margin_ms":780,"challenger":"Ghost","challenger_avatar":"https://cdn.discordapp.com/embed/avatars/2.png","opponent":"Pudge","opponent_avatar":"https://cdn.discordapp.com/embed/avatars/4.png","created_at":"2026-08-12 19:20","settled_at":"2026-08-12 19:41"},{"id":103,"track":"Vinewood Loop","stake":625,"outcome":"pending","target_ms":85800,"result_ms":null,"target_f":"1:25.800","result_f":null,"margin_ms":null,"challenger":"Kimberly","challenger_avatar":"https://cdn.discordapp.com/embed/avatars/3.png","opponent":"SPICEZ","opponent_avatar":"https://cdn.discordapp.com/embed/avatars/0.png","created_at":"2026-08-13 19:20","settled_at":null},{"id":104,"track":"Airport Sprint","stake":750,"outcome":"win","target_ms":88400,"result_ms":87440,"target_f":"1:28.400","result_f":"1:27.440","margin_ms":960,"challenger":"SPICEZ","challenger_avatar":"https://cdn.discordapp.com/embed/avatars/4.png","opponent":"ItzSteve","opponent_avatar":"https://cdn.discordapp.com/embed/avatars/1.png","created_at":"2026-08-14 19:20","settled_at":"2026-08-14 19:41"},{"id":105,"track":"Sandy Ridge","stake":875,"outcome":"loss","target_ms":91000,"result_ms":92050,"target_f":"1:31.000","result_f":"1:32.050","margin_ms":-1050,"challenger":"Rens","challenger_avatar":"https://cdn.discordapp.com/embed/avatars/0.png","opponent":"Ghost","opponent_avatar":"https://cdn.discordapp.com/embed/avatars/2.png","created_at":"2026-08-15 19:20","settled_at":"2026-08-15 19:41"},{"id":106,"track":"Downtown GP","stake":1000,"outcome":"void","target_ms":93600,"result_ms":94770,"target_f":"1:33.600","result_f":"1:34.770","margin_ms":-1170,"challenger":"Ghost","challenger_avatar":"https://cdn.discordapp.com/embed/avatars/1.png","opponent":"Pudge","opponent_avatar":"https://cdn.discordapp.com/embed/avatars/3.png","created_at":"2026-08-16 19:20","settled_at":"2026-08-16 19:41"},{"id":107,"track":"Docks Lines","stake":1125,"outcome":"win","target_ms":96200,"result_ms":94970,"target_f":"1:36.200","result_f":"1:34.970","margin_ms":1230,"challenger":"Kimberly","challenger_avatar":"https://cdn.discordapp.com/embed/avatars/2.png","opponent":"SPICEZ","opponent_avatar":"https://cdn.discordapp.com/embed/avatars/4.png","created_at":"2026-08-17 19:20","settled_at":"2026-08-17 19:41"}]},
  me: { stats: { total_races: 60, wins: 42, podiums: 51, dnfs: 3, win_rate: 0.7, iRating: 1840, sr: 3.42, rank: 'S-1', level: 24 }, history: [{"track":"Airport Sprint","car_class":"S","finish_position":4,"best_lap_ms":101494,"points_earned":132,"sr_delta":-0.1,"dnf":false,"raced_at":"2026-07-20"},{"track":"Vinewood Loop","car_class":"S","finish_position":2,"best_lap_ms":98782,"points_earned":176,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-19"},{"track":"Route 68","car_class":"S","finish_position":1,"best_lap_ms":87833,"points_earned":198,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-18"},{"track":"Docks Lines","car_class":"S","finish_position":3,"best_lap_ms":93266,"points_earned":154,"sr_delta":0.17,"dnf":false,"raced_at":"2026-07-17"},{"track":"Downtown GP","car_class":"S","finish_position":8,"best_lap_ms":95253,"points_earned":44,"sr_delta":-0.1,"dnf":false,"raced_at":"2026-07-16"},{"track":"Airport Sprint","car_class":"S","finish_position":1,"best_lap_ms":98687,"points_earned":198,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-15"},{"track":"Vinewood Loop","car_class":"S","finish_position":2,"best_lap_ms":98454,"points_earned":176,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-14"},{"track":"Route 68","car_class":"S","finish_position":6,"best_lap_ms":91186,"points_earned":88,"sr_delta":-0.03,"dnf":true,"raced_at":"2026-07-13"},{"track":"Docks Lines","car_class":"S","finish_position":1,"best_lap_ms":93886,"points_earned":198,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-12"},{"track":"Downtown GP","car_class":"S","finish_position":3,"best_lap_ms":93543,"points_earned":154,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-11"},{"track":"Airport Sprint","car_class":"S","finish_position":1,"best_lap_ms":97750,"points_earned":198,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-10"},{"track":"Vinewood Loop","car_class":"S","finish_position":7,"best_lap_ms":99152,"points_earned":66,"sr_delta":-0.03,"dnf":false,"raced_at":"2026-07-09"},{"track":"Route 68","car_class":"S","finish_position":2,"best_lap_ms":88646,"points_earned":176,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-08"},{"track":"Docks Lines","car_class":"S","finish_position":1,"best_lap_ms":94638,"points_earned":198,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-07"},{"track":"Downtown GP","car_class":"S","finish_position":4,"best_lap_ms":95545,"points_earned":132,"sr_delta":-0.1,"dnf":false,"raced_at":"2026-07-06"},{"track":"Airport Sprint","car_class":"S","finish_position":1,"best_lap_ms":98676,"points_earned":198,"sr_delta":0.17,"dnf":false,"raced_at":"2026-07-05"},{"track":"Vinewood Loop","car_class":"S","finish_position":5,"best_lap_ms":97700,"points_earned":110,"sr_delta":-0.1,"dnf":false,"raced_at":"2026-07-04"},{"track":"Route 68","car_class":"S","finish_position":2,"best_lap_ms":87124,"points_earned":176,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-03"},{"track":"Docks Lines","car_class":"S","finish_position":3,"best_lap_ms":94445,"points_earned":154,"sr_delta":0.1,"dnf":false,"raced_at":"2026-07-02"},{"track":"Downtown GP","car_class":"S","finish_position":1,"best_lap_ms":94537,"points_earned":198,"sr_delta":0.17,"dnf":false,"raced_at":"2026-07-01"}], activity: [{"day":"2025-10-04","track":"Docks Lines","races":3,"wins":1,"dnfs":0},{"day":"2025-10-12","track":"Vinewood Loop","races":3,"wins":0,"dnfs":0},{"day":"2025-10-13","track":"Route 68","races":1,"wins":0,"dnfs":1},{"day":"2025-10-16","track":"Route 68","races":2,"wins":0,"dnfs":0},{"day":"2025-10-17","track":"Docks Lines","races":2,"wins":0,"dnfs":0},{"day":"2025-10-19","track":"Docks Lines","races":3,"wins":0,"dnfs":0},{"day":"2025-10-20","track":"Downtown GP","races":1,"wins":0,"dnfs":0},{"day":"2025-10-22","track":"Airport Sprint","races":1,"wins":0,"dnfs":0},{"day":"2025-10-24","track":"Airport Sprint","races":1,"wins":0,"dnfs":0},{"day":"2025-10-25","track":"Vinewood Loop","races":1,"wins":0,"dnfs":0},{"day":"2025-10-26","track":"Airport Sprint","races":1,"wins":0,"dnfs":0},{"day":"2025-10-28","track":"Vinewood Loop","races":3,"wins":0,"dnfs":0},{"day":"2025-10-31","track":"Docks Lines","races":2,"wins":0,"dnfs":0},{"day":"2025-11-02","track":"Route 68","races":2,"wins":0,"dnfs":0},{"day":"2025-11-04","track":"Airport Sprint","races":3,"wins":0,"dnfs":0},{"day":"2025-11-13","track":"Route 68","races":3,"wins":1,"dnfs":0},{"day":"2025-11-14","track":"Vinewood Loop","races":2,"wins":0,"dnfs":0},{"day":"2025-11-15","track":"Downtown GP","races":2,"wins":0,"dnfs":1},{"day":"2025-11-19","track":"Vinewood Loop","races":3,"wins":0,"dnfs":0},{"day":"2025-11-24","track":"Downtown GP","races":1,"wins":0,"dnfs":0},{"day":"2025-12-02","track":"Downtown GP","races":3,"wins":1,"dnfs":0},{"day":"2025-12-04","track":"Docks Lines","races":2,"wins":1,"dnfs":0},{"day":"2025-12-10","track":"Docks Lines","races":1,"wins":0,"dnfs":0},{"day":"2025-12-11","track":"Airport Sprint","races":1,"wins":0,"dnfs":0},{"day":"2025-12-13","track":"Docks Lines","races":2,"wins":0,"dnfs":0},{"day":"2025-12-15","track":"Route 68","races":1,"wins":1,"dnfs":0},{"day":"2025-12-16","track":"Downtown GP","races":2,"wins":1,"dnfs":0},{"day":"2025-12-18","track":"Downtown GP","races":2,"wins":0,"dnfs":0},{"day":"2025-12-19","track":"Route 68","races":1,"wins":1,"dnfs":0},{"day":"2025-12-26","track":"Airport Sprint","races":3,"wins":0,"dnfs":0},{"day":"2025-12-29","track":"Downtown GP","races":1,"wins":1,"dnfs":0},{"day":"2026-01-02","track":"Downtown GP","races":2,"wins":0,"dnfs":0},{"day":"2026-01-12","track":"Route 68","races":3,"wins":1,"dnfs":0},{"day":"2026-01-21","track":"Airport Sprint","races":2,"wins":0,"dnfs":0},{"day":"2026-01-26","track":"Route 68","races":1,"wins":1,"dnfs":0},{"day":"2026-02-02","track":"Downtown GP","races":3,"wins":0,"dnfs":0},{"day":"2026-02-03","track":"Route 68","races":2,"wins":0,"dnfs":0},{"day":"2026-02-05","track":"Vinewood Loop","races":2,"wins":1,"dnfs":0},{"day":"2026-02-08","track":"Docks Lines","races":2,"wins":1,"dnfs":0},{"day":"2026-02-09","track":"Vinewood Loop","races":2,"wins":0,"dnfs":0},{"day":"2026-02-17","track":"Downtown GP","races":3,"wins":0,"dnfs":0},{"day":"2026-02-20","track":"Route 68","races":2,"wins":1,"dnfs":0},{"day":"2026-02-23","track":"Docks Lines","races":2,"wins":0,"dnfs":0},{"day":"2026-03-02","track":"Downtown GP","races":2,"wins":1,"dnfs":0},{"day":"2026-03-08","track":"Vinewood Loop","races":2,"wins":0,"dnfs":0},{"day":"2026-03-14","track":"Downtown GP","races":1,"wins":1,"dnfs":0},{"day":"2026-03-15","track":"Route 68","races":3,"wins":1,"dnfs":0},{"day":"2026-03-17","track":"Vinewood Loop","races":2,"wins":1,"dnfs":0},{"day":"2026-03-19","track":"Downtown GP","races":3,"wins":1,"dnfs":0},{"day":"2026-03-24","track":"Downtown GP","races":1,"wins":0,"dnfs":0},{"day":"2026-03-31","track":"Downtown GP","races":1,"wins":0,"dnfs":0},{"day":"2026-04-04","track":"Downtown GP","races":3,"wins":0,"dnfs":0},{"day":"2026-04-06","track":"Downtown GP","races":1,"wins":1,"dnfs":0},{"day":"2026-04-09","track":"Docks Lines","races":2,"wins":0,"dnfs":0},{"day":"2026-04-14","track":"Docks Lines","races":1,"wins":0,"dnfs":0},{"day":"2026-04-17","track":"Vinewood Loop","races":2,"wins":0,"dnfs":0},{"day":"2026-04-19","track":"Route 68","races":2,"wins":0,"dnfs":0},{"day":"2026-04-21","track":"Route 68","races":1,"wins":0,"dnfs":0},{"day":"2026-04-23","track":"Docks Lines","races":1,"wins":1,"dnfs":0},{"day":"2026-04-26","track":"Airport Sprint","races":3,"wins":0,"dnfs":0},{"day":"2026-05-02","track":"Downtown GP","races":2,"wins":1,"dnfs":1},{"day":"2026-05-06","track":"Docks Lines","races":1,"wins":1,"dnfs":0},{"day":"2026-05-08","track":"Downtown GP","races":3,"wins":1,"dnfs":0},{"day":"2026-05-15","track":"Docks Lines","races":2,"wins":0,"dnfs":0},{"day":"2026-05-23","track":"Airport Sprint","races":1,"wins":0,"dnfs":0},{"day":"2026-05-24","track":"Airport Sprint","races":3,"wins":0,"dnfs":0},{"day":"2026-05-30","track":"Vinewood Loop","races":1,"wins":1,"dnfs":0},{"day":"2026-05-31","track":"Airport Sprint","races":1,"wins":0,"dnfs":0},{"day":"2026-06-01","track":"Docks Lines","races":3,"wins":1,"dnfs":0},{"day":"2026-06-04","track":"Airport Sprint","races":3,"wins":0,"dnfs":0},{"day":"2026-06-16","track":"Docks Lines","races":3,"wins":0,"dnfs":0},{"day":"2026-06-18","track":"Downtown GP","races":2,"wins":1,"dnfs":0},{"day":"2026-06-22","track":"Airport Sprint","races":1,"wins":0,"dnfs":0},{"day":"2026-06-24","track":"Vinewood Loop","races":2,"wins":1,"dnfs":0},{"day":"2026-06-26","track":"Airport Sprint","races":2,"wins":1,"dnfs":0},{"day":"2026-06-29","track":"Airport Sprint","races":3,"wins":0,"dnfs":0},{"day":"2026-06-30","track":"Airport Sprint","races":2,"wins":0,"dnfs":0},{"day":"2026-07-04","track":"Route 68","races":3,"wins":0,"dnfs":0},{"day":"2026-07-08","track":"Route 68","races":1,"wins":1,"dnfs":0},{"day":"2026-07-09","track":"Airport Sprint","races":3,"wins":1,"dnfs":0},{"day":"2026-07-18","track":"Docks Lines","races":2,"wins":1,"dnfs":0},{"day":"2026-07-20","track":"Docks Lines","races":1,"wins":0,"dnfs":0},{"day":"2026-07-21","track":"Vinewood Loop","races":3,"wins":1,"dnfs":0},{"day":"2026-07-23","track":"Downtown GP","races":3,"wins":0,"dnfs":0},{"day":"2026-07-26","track":"Route 68","races":3,"wins":0,"dnfs":0},{"day":"2026-07-27","track":"Airport Sprint","races":3,"wins":1,"dnfs":0},{"day":"2026-08-01","track":"Route 68","races":3,"wins":0,"dnfs":0},{"day":"2026-08-10","track":"Airport Sprint","races":2,"wins":1,"dnfs":0},{"day":"2026-08-13","track":"Downtown GP","races":1,"wins":1,"dnfs":0},{"day":"2026-08-14","track":"Route 68","races":1,"wins":0,"dnfs":0},{"day":"2026-08-25","track":"Airport Sprint","races":3,"wins":0,"dnfs":0},{"day":"2026-08-26","track":"Downtown GP","races":3,"wins":0,"dnfs":1}], tracks: [{"track":"Downtown GP","races":46,"wins":11,"podiums":21,"dnfs":0},{"track":"Airport Sprint","races":42,"wins":4,"podiums":10,"dnfs":0},{"track":"Docks Lines","races":35,"wins":7,"podiums":12,"dnfs":0},{"track":"Route 68","races":35,"wins":8,"podiums":11,"dnfs":0},{"track":"Vinewood Loop","races":28,"wins":5,"podiums":12,"dnfs":0}] },
};

if (!inNui()) { setMe('SPICEZ'); root.classList.remove('hidden'); loadTab(); }

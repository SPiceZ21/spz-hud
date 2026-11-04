const $ = id => document.getElementById(id);
const hud = $('hud');
let lastScore = { blue: 0, orange: 0 };
let shardTimer = null, countTimer = null, hintTimer = null;

// ── theme: spz_theme_* (via spz-core) + prl_rl_blue / prl_rl_orange convars ─────
function rgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '');
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : null;
}
function setColour(name, hex) {
  const t = rgb(hex);
  if (!t) return;
  document.documentElement.style.setProperty(`--${name}`, hex);
  document.documentElement.style.setProperty(`--${name}-rgb`, t);
}
function applyTheme(theme) {
  if (!theme) return;
  if (theme.accent) setColour('accent', theme.accent);
  if (theme.bg) document.documentElement.style.setProperty('--bg', theme.bg);
  if (theme.bg2) document.documentElement.style.setProperty('--bg-card', theme.bg2);
  if (theme.gold) document.documentElement.style.setProperty('--gold', theme.gold);
}
const teamColour = t => getComputedStyle(document.documentElement).getPropertyValue(`--${t}`).trim();

// ── renderers ──────────────────────────────────────────────────────────────────
const fmt = t => { t = Math.max(0, Math.floor(t)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

function renderState(s, me) {
  for (const t of ['blue', 'orange']) {
    const el = $(t === 'blue' ? 'sBlue' : 'sOrange');
    const v = (s.score && s.score[t]) || 0;
    el.textContent = v;
    if (v !== lastScore[t]) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
    lastScore[t] = v;
  }
  $('clock').textContent = s.overtime ? '+OT' : fmt(s.time || 0);
  $('ot').classList.toggle('hidden', !s.overtime);

  const rB = [], rO = [];
  for (const id in (s.teams || {})) {
    const p = s.teams[id];
    const html = `<div class="${String(id) === String(me) ? 'me' : ''}">${escapeHtml(p.name || ('#' + id))}</div>`;
    (p.team === 'blue' ? rB : rO).push(html);
  }
  $('rBlue').innerHTML = rB.join(''); $('rOrange').innerHTML = rO.join('');

  let banner = null;
  if (s.phase === 'intro') banner = 'GETTING READY · CARS INCOMING';
  else if (s.phase === 'countdown') banner = `MATCH STARTS IN ${s.countdown || 0}`;
  $('banner').classList.toggle('hidden', !banner);
  $('rBlue').parentElement.classList.toggle('hidden', !!banner);
  if (banner) $('banner').textContent = banner;
}

function kickoff(ms) {
  clearInterval(countTimer);
  const el = $('count');
  const end = Date.now() + ms;
  let last = null;
  const tick = () => {
    const left = Math.ceil((end - Date.now()) / 1000);
    const txt = left > 0 ? String(left) : 'GO!';
    if (txt !== last) {
      last = txt;
      el.textContent = txt; el.classList.remove('hidden', 'tick', 'go'); void el.offsetWidth;
      el.classList.add('tick'); if (left <= 0) el.classList.add('go');
    }
    if (Date.now() > end + 700) { clearInterval(countTimer); el.classList.add('hidden'); }
  };
  tick(); countTimer = setInterval(tick, 50);
}

function shard(title, sub, colour, ms) {
  clearTimeout(shardTimer);
  const el = $('shard');
  el.style.setProperty('--team', colour);
  $('shardTitle').textContent = title; $('shardSub').textContent = sub || '';
  el.classList.remove('hidden'); el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  shardTimer = setTimeout(() => el.classList.add('hidden'), ms || 4000);
}

function hint(keys) {
  const el = $('hint');
  el.innerHTML = [
    [keys.boost, 'Boost'], [keys.jump, 'Jump · again to dodge'], [keys.ballcam, 'Ball cam'], ['/rlleave', 'Leave'],
  ].map(([k, t]) => `<div><kbd>${escapeHtml(k)}</kbd>${t}</div>`).join('');
  // Stays up for the whole match (it used to fade after 12 s).
  el.classList.remove('fade'); clearTimeout(hintTimer);
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ── messages from client/main.lua ────────────────────────────────────────────────
window.addEventListener('message', e => {
  const m = e.data || {};
  switch (m.action) {
    case 'show': hud.classList.remove('hidden'); break;
    case 'hide': hud.classList.add('hidden'); break;
    case 'theme': applyTheme(m.theme); break;
    case 'teams': setColour('blue', m.blue); setColour('orange', m.orange); break;
    case 'state': renderState(m.state || {}, m.me); break;
    case 'kickoff': kickoff(m.ms); break;
    case 'hint': hint(m.keys || {}); break;
    case 'goal':
      shard(m.warmup ? 'PRACTICE GOAL' : 'GOAL!', `${m.scorer ? m.scorer.toUpperCase() + ' · ' : ''}${m.team.toUpperCase()} SCORES`, teamColour(m.team), 4000);
      break;
    case 'ended':
      shard(`${m.winner.toUpperCase()} WINS`, `${m.score.blue} — ${m.score.orange}`, teamColour(m.winner), 8000);
      break;
  }
});

// ── browser preview (no FiveM) ───────────────────────────────────────────────────
if (typeof GetParentResourceName !== 'function') {
  hud.classList.remove('hidden');
  renderState({ phase: 'playing', score: { blue: 2, orange: 1 }, time: 204, teams: { 1: { team: 'blue', name: 'SPiceZ' }, 2: { team: 'orange', name: 'Rival' } } }, 1);
  hint({ boost: 'LSHIFT', jump: 'E', ballcam: 'Y' });
}

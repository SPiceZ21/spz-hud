const $ = (id) => document.getElementById(id);
const IN_GAME = typeof GetParentResourceName === 'function';
const RES = IN_GAME ? GetParentResourceName() : 'spz-radio';

const audio = $('audio');
const ui = { stations: [], station: 'mix', volume: 0.35, on: true, ducked: false, open: false, np: {} };
let retryTimer = null, retryDelay = 2000, toastTimer = null;
const lastTitle = {};

let post = (name, data = {}) =>
  fetch(`https://${RES}/${name}`, { method: 'POST', body: JSON.stringify(data) }).catch(() => {});

const current = () => ui.stations.find((s) => s.id === ui.station) || ui.stations[0];

// ── Audio ───────────────────────────────────────────────────
function applyAudio() {
  const st = current();
  audio.volume = ui.ducked ? 0 : ui.volume;
  if (!ui.on || !st) {
    clearTimeout(retryTimer);
    delete audio.dataset.station;
    audio.pause(); audio.removeAttribute('src'); audio.load();
    return;
  }
  if (audio.dataset.station !== st.id) connect();
}

function connect() {
  const st = current();
  clearTimeout(retryTimer);
  audio.dataset.station = st.id;
  const sep = st.url.includes('?') ? '&' : '?';
  audio.src = `${st.url}${sep}t=${Date.now()}`; // join live, not a stale cached buffer
  audio.play().catch(() => {});
}

function scheduleRetry() {
  if (!ui.on) return;
  clearTimeout(retryTimer);
  retryTimer = setTimeout(() => { delete audio.dataset.station; applyAudio(); }, retryDelay);
  retryDelay = Math.min(retryDelay * 2, 30000);
}
audio.addEventListener('playing', () => { retryDelay = 2000; });
audio.addEventListener('error', scheduleRetry);
audio.addEventListener('ended', scheduleRetry);

// ── Render ──────────────────────────────────────────────────
function splitTitle(np) {
  // Icecast usually only fills "Artist - Title" in the title field.
  if (np.artist) return { title: np.title, artist: np.artist };
  const parts = (np.title || '').split(' - ');
  return parts.length > 1 ? { artist: parts[0], title: parts.slice(1).join(' - ') } : { title: np.title || '', artist: '' };
}

// Icecast carries no artwork. Covers extracted from our own files are served at
// <stream origin>/covers/<fnv1a("artist - title")>.jpg; anything else falls back to iTunes.
const coverCache = {};

function coverKey(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(url);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function itunes(title, artist) {
  const term = encodeURIComponent(`${artist} ${title}`.replace(/\s*[\(\[].*?[\)\]]/g, '')); // drop "(Remix)" etc
  return fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`)
    .then((r) => r.json())
    .then((j) => (j.results && j.results[0] ? j.results[0].artworkUrl100.replace('100x100bb', '600x600bb') : null))
    .catch(() => null);
}

function cover(title, artist) {
  const raw = artist ? `${artist} - ${title}` : title;
  if (!raw) return Promise.resolve(null);
  if (raw in coverCache) return Promise.resolve(coverCache[raw]);
  const st = current();
  const origin = st && st.url.match(/^https?:\/\/[^/]+/);
  const own = origin ? loadImage(`${origin[0]}/covers/${coverKey(raw.trim().toLowerCase())}.jpg`) : Promise.resolve(null);
  return own
    .then((url) => url || itunes(title, artist))
    .then((url) => (coverCache[raw] = url));
}

function setArt(el, url) {
  el.style.backgroundImage = url ? `url("${url}")` : '';
  el.classList.toggle('has-art', !!url);
}

let artKey = '';
function updateArt(title, artist) {
  const key = `${artist}|${title}`;
  if (key === artKey) return;
  artKey = key;
  cover(title, artist).then((url) => {
    if (artKey !== key) return; // song changed while fetching
    setArt($('heroArt'), url);
    setArt($('toastArt'), url);
  });
}

function render() {
  const st = current();
  if (!st) return;
  const np = ui.np[st.id] || {};
  const { title, artist } = splitTitle(np);

  $('heroStation').textContent = `NOW PLAYING · ${st.label.toUpperCase()}`;
  $('heroTitle').textContent = ui.on ? (title || 'Live stream') : 'Radio off';
  $('heroArtist').textContent = ui.on ? (artist || st.tag) : 'Press power to tune in';
  $('heroListeners').textContent = np.listeners ?? '—';
  updateArt(ui.on ? title : '', ui.on ? artist : '');
  $('liveKicker').classList.toggle('live', ui.on);
  $('liveKicker').querySelector('span').textContent = ui.on ? 'ON AIR' : 'OFF';
  $('heroEq').classList.toggle('paused', !ui.on);
  $('power').classList.toggle('off', !ui.on);

  const pct = Math.round(ui.volume * 100);
  $('volume').value = pct;
  $('volume').style.setProperty('--p', pct + '%');
  $('volVal').textContent = pct + '%';

  document.querySelectorAll('.station').forEach((el) => {
    el.classList.toggle('active', el.dataset.id === ui.station);
    el.querySelector('.eq').classList.toggle('paused', !ui.on);
  });
}

function buildStations() {
  $('stations').innerHTML = ui.stations.map((s, i) => `
    <button class="station tile" data-id="${s.id}" style="--d:${120 + i * 40}ms">
      <div class="row"><span class="num">0${i + 1}</span><div class="eq"><i></i><i></i><i></i><i></i></div></div>
      <div><h2>${s.label}</h2><span class="tag">${s.tag}</span></div>
    </button>`).join('');
  document.querySelectorAll('.station').forEach((el) => el.addEventListener('click', () => {
    ui.station = el.dataset.id; ui.on = true;
    post('station', { id: ui.station });
    applyAudio(); render();
  }));
}

function toast() {
  const st = current();
  const np = st && ui.np[st.id];
  if (!ui.on || ui.open || !np || !np.title) return;
  const { title, artist } = splitTitle(np);
  $('toastTag').textContent = `SPZ RADIO · ${st.label.toUpperCase()}`;
  $('toastTitle').textContent = title;
  $('toastArtist').textContent = artist;
  const t = $('toast');
  t.classList.remove('hidden', 'out'); void t.offsetWidth;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.add('out'); setTimeout(() => t.classList.add('hidden'), 300); }, 6000);
}

// ── Input ───────────────────────────────────────────────────
$('volume').addEventListener('input', (e) => {
  ui.volume = e.target.value / 100;
  applyAudio(); render();
  post('volume', { value: ui.volume });
});
$('power').addEventListener('click', () => { ui.on = !ui.on; post('power'); applyAudio(); render(); });
document.addEventListener('keydown', (e) => { if (ui.open && (e.key === 'Escape' || e.key === 'Backspace')) post('close'); });

// ── Messages from Lua ───────────────────────────────────────
const handlers = {
  init: (m) => { ui.stations = m.stations; buildStations(); render(); },
  state: (m) => { Object.assign(ui, { station: m.station, volume: m.volume, on: m.on, ducked: m.ducked }); applyAudio(); render(); },
  open: () => { ui.open = true; $('panel').classList.remove('hidden'); $('toast').classList.add('hidden'); render(); },
  close: () => { ui.open = false; $('panel').classList.add('hidden'); },
  nowPlaying: (m) => {
    ui.np = m.data || {};
    const st = current();
    const t = st && ui.np[st.id] && ui.np[st.id].title;
    if (t && lastTitle[st.id] !== t) { lastTitle[st.id] = t; toast(); }
    render();
  },
};
window.addEventListener('message', (e) => { const h = handlers[e.data && e.data.action]; if (h) h(e.data); });

// ── Browser preview (outside FiveM) ─────────────────────────
// Plays the same streams as config.lua and reads the Icecast status directly.
if (!IN_GAME) {
  document.body.style.background = 'radial-gradient(ellipse at 30% 20%, #3a4a5c, #12161c 70%)';
  const send = (d) => window.postMessage(d, '*');
  const stations = [
    { id: 'mix', label: 'Mix', tag: 'TAMIL × ENGLISH', url: 'https://radio.spicez.xyz/mix', mount: 'mix' },
    { id: 'english', label: 'English', tag: 'ENGLISH ONLY', url: 'https://radio.spicez.xyz/english', mount: 'english' },
    { id: 'tamil', label: 'Tamil', tag: 'TAMIL ONLY', url: 'https://radio.spicez.xyz/tamil', mount: 'tamil' },
  ];
  post = (name, data) => {
    if (name === 'close') send({ action: 'close' });
    if (name === 'station') send({ action: 'state', station: data.id, volume: ui.volume, on: true, ducked: false });
    return Promise.resolve();
  };
  const poll = () => fetch('https://radio.spicez.xyz/status-json.xsl').then((r) => r.json()).then((j) => {
    let src = j.icestats.source || [];
    if (!Array.isArray(src)) src = [src];
    const np = {};
    stations.forEach((s) => {
      const m = src.find((x) => (x.listenurl || '').endsWith('/' + s.mount));
      if (m) np[s.id] = { title: m.title || '', artist: m.artist || '', listeners: m.listeners || 0 };
    });
    send({ action: 'nowPlaying', data: np });
  }).catch(() => {
    send({ action: 'nowPlaying', data: { mix: { title: 'KUURO, Clockvice - 1000 Cuts', listeners: 14 } } });
  });

  send({ action: 'init', stations });
  send({ action: 'state', station: 'mix', volume: 0.35, on: false, ducked: false }); // browsers block autoplay; hit power
  poll(); setInterval(poll, 10000);
  setTimeout(() => send({ action: 'open' }), 1500);
  document.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'r') send({ action: ui.open ? 'close' : 'open' }); });
}

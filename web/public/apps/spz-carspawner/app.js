// spz-carspawner — NUI
// Client sends { action: 'open', vehicles: [{ model, label, className, classId, isAddon }, shots?] }.
// Images are found by model name in the page itself (see renderGrid).

const RES = typeof GetParentResourceName === 'function' ? GetParentResourceName() : 'spz-carspawner';
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const post = (name, data = {}) => fetch(`https://${RES}/${name}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
}).catch(() => null);

const CLASS_ICON = { 0: 'car-side', 1: 'car', 2: 'truck-pickup', 3: 'car-side', 4: 'gauge-high', 5: 'car-rear',
  6: 'flag-checkered', 7: 'bolt', 9: 'mountain', 12: 'van-shuttle', 22: 'circle-dot' };

// GTA race classes: Coupes, Muscle, Sports Classics, Sports, Super, Open Wheel
const RACE_CLASS = new Set([3, 4, 5, 6, 7, 22]);

let vehicles = [];
let cat = 'all';
let q = '';
let shots = null;   // { base, fmt } of uz_AutoShot vehicle captures, if running
let selected = null; // model shown in the preview (click / hover)

function categories() {
  const byClass = new Map();
  for (const v of vehicles) {
    const c = byClass.get(v.className) || { id: 'c:' + v.className, name: v.className, classId: v.classId, n: 0 };
    c.n++; byClass.set(v.className, c);
  }
  const top = [{ id: 'all', name: 'All vehicles', icon: 'layer-group', n: vehicles.length }];
  const addons = vehicles.filter((v) => v.isAddon).length;
  if (addons) top.push({ id: 'addon', name: 'Custom mods', icon: 'star', n: addons });
  const all = [...byClass.values()].sort((a, b) => a.classId - b.classId)
    .map((c) => ({ ...c, icon: CLASS_ICON[c.classId] || 'car' }));
  // Car classes always; any other section only exists because it holds mod
  // cars (the client never lists vanilla vans/SUVs/etc.), so it goes under Mods.
  const classes = all.filter((c) => RACE_CLASS.has(c.classId));
  const modSections = all.filter((c) => !RACE_CLASS.has(c.classId));
  return { top, classes, modSections };
}

function renderCats() {
  const { top, classes, modSections } = categories();
  const row = (c) => `<button class="cat ${cat === c.id ? 'on' : ''}" data-cat="${esc(c.id)}">
    <i class="fa-solid fa-${c.icon}"></i><span>${esc(c.name)}</span><b>${c.n}</b></button>`;
  $('cats').innerHTML = top.map(row).join('')
    + '<div class="h sep">Cars</div>' + classes.map(row).join('')
    + (modSections.length ? '<div class="h sep">Mods</div>' + modSections.map(row).join('') : '');
  $('total').textContent = `${vehicles.length} vehicles`;
}

function filtered() {
  const s = q.trim().toLowerCase();
  return vehicles.filter((v) => {
    if (cat === 'addon' && !v.isAddon) return false;
    if (cat.startsWith('c:') && v.className !== cat.slice(2)) return false;
    return !s || v.label.toLowerCase().includes(s) || v.model.includes(s);
  });
}

const placeholder = '<div class="none"><i class="fa-solid fa-car-side"></i>No image</div>';

function renderGrid() {
  const list = filtered();
  const { top, classes, modSections } = categories();
  const c = [...top, ...classes, ...modSections].find((x) => x.id === cat) || top[0];
  $('cat-title').textContent = c.name;
  $('cat-sub').textContent = `${list.length} shown`;

  $('grid').innerHTML = list.length ? list.map((v) => `
    <div class="card" data-model="${esc(v.model)}">
      <div class="pic">
        <img src="img/${esc(v.model)}.png" loading="lazy" alt="" data-try="0">
        <span class="cls">${esc(v.className)}</span>
        ${v.isAddon ? '<span class="badge">Mod</span>' : ''}
        <span class="spawn"><i class="fa-solid fa-key"></i> Spawn</span>
      </div>
      <div class="info">
        <div class="nm">${esc(v.label)}</div>
        <div class="md">${esc(v.model)}</div>
      </div>
    </div>`).join('') : '<div class="empty">No vehicles match.</div>';

  $('grid').querySelectorAll('img').forEach((img) => wireImage(img, img.closest('[data-model]').dataset.model));
  if (selected) $('grid').querySelector(`[data-model="${CSS.escape(selected)}"]`)?.classList.add('sel');
}

// Auto-map by model name: ui/img/<model>.png -> uz_AutoShot capture -> placeholder.
// Images that match no listed car are never requested.
function wireImage(img, model) {
  img.onerror = () => {
    if (img.dataset.try === '0' && shots) {
      img.dataset.try = '1';
      img.src = `${shots.base}/${model}.${shots.fmt}`;
      return;
    }
    img.onerror = null;
    img.insertAdjacentHTML('afterend', placeholder);
    img.remove();
  };
}

// ── preview panel ──
function showPreview(model) {
  const v = vehicles.find((x) => x.model === model);
  if (!v) return;
  const pic = $('pv-pic');
  if (pic.dataset.model !== model) {
    pic.dataset.model = model;
    pic.innerHTML = `<img src="img/${esc(model)}.png" alt="" data-try="0">`;
    wireImage(pic.firstElementChild, model);
  }
  $('pv-tags').innerHTML = `<span>${esc(v.className)}</span>${v.isAddon ? '<span class="mod">Mod</span>' : ''}`;
  $('pv-name').textContent = v.label;
  $('pv-model').textContent = v.model;
  $('pv-spawn').disabled = false;
}

function select(model) {
  selected = model;
  $('grid').querySelectorAll('.card.sel').forEach((c) => c.classList.remove('sel'));
  $('grid').querySelector(`[data-model="${CSS.escape(model)}"]`)?.classList.add('sel');
  showPreview(model);
}

const spawn = (model) => { if (model) post('spawn', { model }); };

function render() { renderCats(); renderGrid(); }

document.addEventListener('click', (e) => {
  const c = e.target.closest('[data-cat]');
  if (c) { cat = c.dataset.cat; render(); $('grid').scrollTop = 0; return; }
  const card = e.target.closest('#grid [data-model]');
  if (card) select(card.dataset.model);       // click = preview; double-click / Enter / Spawn = spawn
});

document.addEventListener('dblclick', (e) => {
  const card = e.target.closest('#grid [data-model]');
  if (card) spawn(card.dataset.model);
});

// hovering previews too; leaving the grid snaps back to the selected car
$('grid').addEventListener('mouseover', (e) => {
  const card = e.target.closest('[data-model]');
  if (card) showPreview(card.dataset.model);
});
$('grid').addEventListener('mouseleave', () => { if (selected) showPreview(selected); });

$('pv-spawn').onclick = () => spawn(selected || $('pv-pic').dataset.model);

$('q').addEventListener('input', (e) => { q = e.target.value; renderGrid(); });
$('x').onclick = () => post('close');
$('by-model').addEventListener('submit', (e) => {
  e.preventDefault();
  const m = $('model-in').value.trim();
  if (m) { post('spawn', { model: m }); $('model-in').value = ''; }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') post('close');
  // Enter spawns the selected car (unless typing in the by-model box)
  if (e.key === 'Enter' && selected && document.activeElement !== $('model-in')) spawn(selected);
});

function applyTheme(t) {
  if (!t) return;
  const r = document.documentElement.style;
  if (t.accent) r.setProperty('--accent', t.accent);
  if (t.bg) r.setProperty('--bg', t.bg);
  if (t.bg2) r.setProperty('--bg2', t.bg2);
}

window.addEventListener('message', ({ data }) => {
  if (!data) return;
  if (data.action === 'theme') applyTheme(data.theme);
  if (data.action === 'open') {
    vehicles = data.vehicles || [];
    shots = data.shots || null;
    const { top, classes, modSections } = categories();
    if (![...top, ...classes, ...modSections].some((c) => c.id === cat)) cat = 'all';
    $('app').classList.remove('hidden');
    render();
    // preview the first car straight away (keeps the last pick if it's still listed)
    const keep = selected && vehicles.some((v) => v.model === selected) ? selected : filtered()[0]?.model;
    if (keep) select(keep);
    $('q').focus();
  }
  if (data.action === 'close') $('app').classList.add('hidden');
});

post('uiReady');

// Browser preview outside FiveM.
if (typeof GetParentResourceName !== 'function') {
  window.postMessage({ action: 'open', vehicles: [
    { model: 'adder', label: 'Truffade Adder', className: 'Super', classId: 7 },
    { model: 'sultan', label: 'Karin Sultan', className: 'Sports', classId: 6 },
    { model: 'gtr', label: 'Nissan GT-R', className: 'Sports', classId: 6, isAddon: true },
  ] }, '*');
}

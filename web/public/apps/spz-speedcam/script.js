'use strict';

const flash       = document.getElementById('flash');
const capture     = document.getElementById('capture');
const speedValue  = document.getElementById('speed-value');
const speedUnit   = document.getElementById('speed-unit');
const camLocation = document.getElementById('cam-location');
const badges      = document.getElementById('badges');
const capRecords  = document.getElementById('cap-records');
const capVehicle  = document.getElementById('cap-vehicle');
const plateEl     = document.getElementById('plate');
const dismissBar  = document.getElementById('dismiss-progress');
const recordPanel = document.getElementById('records-panel');
const recordsList = document.getElementById('records-list');

let dismissTimer  = null;
let cardUnit      = 'KM/H';

// Base theme (server.cfg spz_theme_* convars, pushed from spz-core).
const THEME_VARS = { accent: '--orange', danger: '--red' };
// rgba(...) glows/tints reference these as raw components so they can carry
// their own alpha — keep those in sync too.
const THEME_RGB_VARS = { accent: '--orange-rgb', danger: '--red-rgb' };
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function svgIcon(path, size = 14) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
}

const ICONS = {
  camera: svgIcon('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>', 16),
  trophy: svgIcon('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>'),
  star:   svgIcon('<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>'),
  arrow:  svgIcon('<line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>'),
  close:  svgIcon('<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'),
};

// ── Minimap anchor ────────────────────────────────────────────────────────────
// The client pushes the real minimap rect (fractions of the screen) so the card
// lines up with the map at any resolution / safezone setting.

function applyMinimap(m) {
  if (!m) return;
  const root = document.documentElement.style;
  root.setProperty('--map-left', `${m.left * 100}vw`);
  root.setProperty('--map-w',    `${m.width * 100}vw`);
  root.setProperty('--map-top',  `${(1 - m.top) * 100}vh`);
}

// ── Number plate ──────────────────────────────────────────────────────────────
// Drawn from the game's own textures: the plate backgrounds (256x128) and the
// shared glyph atlas `vehicle_generic_plate_font.png`. The atlas is greyscale
// (16 columns x 32px rows, chars 0-9 then A-Z), so glyphs are cut out and
// tinted per plate the way the game shades them.

const PLATE_TEXTURES = {
  0: 'plate01',        // Blue on White 1
  1: 'plate02',        // Yellow on Black
  2: 'plate03',        // Yellow on Blue
  3: 'plate04',        // Blue on White 2
  4: 'plate05',        // Blue on White 3 / SR Exempt
  5: 'yankton_plate',  // North Yankton
};

// Ink colour + text box (in 256x128 texture space) per plate.
const PLATE_INK = {
  0: '#1d2b57',
  1: '#f2c744',
  2: '#f2c744',
  3: '#1d2b57',
  4: '#20242b',
  5: '#2c2620',
};

const PLATE_TEXT_BOX = {
  default: { x: 30, y: 48, w: 196, h: 44 },
  5:       { x: 28, y: 56, w: 200, h: 40 },
};

const ATLAS_COLS = 16;
const ATLAS_CELL_W = 16;
const ATLAS_CELL_H = 32;
const GLYPH_INSET_X = 2;      // inked columns inside a cell: 2 → 14
const GLYPH_INSET_W = 12;
const GLYPH_INSET_Y = 2;      // inked rows inside a cell
const GLYPH_INSET_H = 28;

const plateImages = {};
let atlasMask = null;         // atlas re-cut as white glyphs on transparent

function loadImage(src) {
  if (plateImages[src]) return plateImages[src];
  const img = new Image();
  img.src = `plates/${src}.png`;
  plateImages[src] = img;
  return img;
}

// Turn the greyscale atlas into an alpha mask once, so glyphs can be tinted.
function buildAtlasMask(img) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0);

  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  // Each cell is a mid-grey block (~90-110) with the glyph face stamped
  // brighter on top (~140-165); isolate the face, not the block.
  const LO = 112, HI = 148;
  for (let i = 0; i < px.length; i += 4) {
    const a = Math.max(0, Math.min(1, (px[i] - LO) / (HI - LO)));
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = Math.round(a * 255);
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

function charCell(ch) {
  const code = ch.charCodeAt(0);
  let idx = -1;
  if (code >= 48 && code <= 57) idx = code - 48;        // 0-9
  else if (code >= 65 && code <= 90) idx = code - 65 + 10; // A-Z
  if (idx < 0) return null;
  return {
    x: (idx % ATLAS_COLS) * ATLAS_CELL_W,
    y: Math.floor(idx / ATLAS_COLS) * ATLAS_CELL_H,
  };
}

function drawPlate(text, index) {
  const idx = PLATE_TEXTURES[index] !== undefined ? index : 0;
  const bg = loadImage(PLATE_TEXTURES[idx]);
  const atlas = loadImage('vehicle_generic_plate_font');

  const ready = bg.complete && bg.naturalWidth && atlas.complete && atlas.naturalWidth;
  if (!ready) {
    // Both textures are local; retry once they decode.
    Promise.all([bg.decode(), atlas.decode()])
      .then(() => drawPlate(text, index))
      .catch(() => {});
    return;
  }

  if (!atlasMask) atlasMask = buildAtlasMask(atlas);

  const ctx = plateEl.getContext('2d');
  const scale = plateEl.width / 256;   // canvas is a multiple of texture size

  ctx.clearRect(0, 0, plateEl.width, plateEl.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bg, 0, 0, plateEl.width, plateEl.height);

  const chars = text.split('').map(charCell).filter(Boolean);
  if (!chars.length) return;

  const box = PLATE_TEXT_BOX[idx] || PLATE_TEXT_BOX.default;
  // Fit the string inside the plate's text box, keeping the glyph aspect.
  const advance = Math.min(box.w / chars.length, (box.h / GLYPH_INSET_H) * GLYPH_INSET_W * 1.15);
  const glyphW  = advance / 1.15;
  const glyphH  = glyphW * (GLYPH_INSET_H / GLYPH_INSET_W);
  const startX  = box.x + (box.w - advance * chars.length) / 2 + (advance - glyphW) / 2;
  const startY  = box.y + (box.h - glyphH) / 2;

  // Glyphs are drawn as a mask, then flooded with the plate's ink colour.
  const layer = document.createElement('canvas');
  layer.width = plateEl.width;
  layer.height = plateEl.height;
  const lctx = layer.getContext('2d');
  lctx.imageSmoothingQuality = 'high';

  chars.forEach((cell, i) => {
    lctx.drawImage(
      atlasMask,
      cell.x + GLYPH_INSET_X, cell.y + GLYPH_INSET_Y, GLYPH_INSET_W, GLYPH_INSET_H,
      (startX + advance * i) * scale, startY * scale, glyphW * scale, glyphH * scale
    );
  });

  lctx.globalCompositeOperation = 'source-in';
  lctx.fillStyle = PLATE_INK[idx] || '#1d2b57';
  lctx.fillRect(0, 0, layer.width, layer.height);

  ctx.drawImage(layer, 0, 0);
}

function renderPlate(plate, index) {
  const text = (plate || '').trim().toUpperCase();
  if (!text) {
    plateEl.style.display = 'none';
    return;
  }
  plateEl.style.display = '';
  drawPlate(text, index);
}

// Driver headshot: a runtime texture the client registered for this capture.
const faceEl = document.getElementById('cap-face');
const profileEl = document.getElementById('cap-profile');
const topRowEl = document.querySelector('.cap-pills');
function setFace(on) {
  profileEl.classList.toggle('empty', !on);
  topRowEl.classList.toggle('no-face', !on);
}
function renderFace(txd) {
  if (!txd) { setFace(false); faceEl.removeAttribute('src'); return; }
  faceEl.onerror = () => setFace(false);
  faceEl.src = `https://nui-img/${txd}/${txd}?t=${Date.now()}`;
  setFace(true);
}

// ── Capture card ──────────────────────────────────────────────────────────────

function showCapture(data) {
  cardUnit = data.unit || 'KM/H';

  // Flash
  flash.classList.remove('fire');
  void flash.offsetWidth; // reflow
  flash.classList.add('fire');

  // Speed colour by value
  const spd = data.speed || 0;
  speedValue.className = 'speed-value';
  if (spd >= 200) speedValue.classList.add('sonic');
  else if (spd >= 130) speedValue.classList.add('fast');

  speedValue.textContent = spd;
  speedUnit.textContent  = cardUnit;
  camLocation.textContent = data.cameraName || 'Unknown Location';

  renderPlate(data.plate, data.plateIndex);
  renderFace(data.headshot);

  // World-record tag — floats ABOVE the box, not inside it
  const capGlobal = document.getElementById('cap-global');
  if (data.globalRecord) {
    capGlobal.innerHTML = ICONS.trophy + ' NEW WR';
    capGlobal.classList.add('show');
  } else {
    capGlobal.innerHTML = '';
    capGlobal.classList.remove('show');
  }

  // Badges (inside the box)
  badges.innerHTML = '';

  // A world record is also a personal best — both pills show, side by side.
  if (data.personalBest) {
    const b = document.createElement('div');
    b.className = 'badge badge-personal';
    b.innerHTML = ICONS.star + ' NEW PB';
    badges.appendChild(b);
  }

  if (data.prevBest && !data.personalBest) {
    const diff = spd - data.prevBest;
    const b = document.createElement('div');
    b.className = 'badge badge-improvement';
    b.innerHTML = ICONS.arrow + ` PB ${data.prevBest} ${cardUnit}`;
    badges.appendChild(b);
  }

  // Collapse the record group when neither pill fired, and drop the whole
  // plate pill when there is nothing at all to show in it.
  const hasRecords = capGlobal.classList.contains('show') || badges.children.length > 0;
  capRecords.classList.toggle('empty', !hasRecords);
  // No plate: hide its box; the picture keeps its one-third width.
  const hasPlate = !!(data.plate && String(data.plate).trim());
  capVehicle.style.display = hasPlate ? '' : 'none';
  topRowEl.classList.toggle('no-plate', !hasPlate);

  // Show card
  capture.classList.remove('hiding');
  capture.classList.add('visible');

  // Dismiss progress bar
  const duration = data.duration || 6000;
  dismissBar.style.transition = 'none';
  dismissBar.style.width = '100%';
  void dismissBar.offsetWidth;
  dismissBar.style.transition = `width ${duration}ms linear`;
  dismissBar.style.width = '0%';

  // Auto-dismiss
  if (dismissTimer) clearTimeout(dismissTimer);
  dismissTimer = setTimeout(hideCapture, duration);
}

function hideCapture() {
  capture.classList.remove('visible');
  capture.classList.add('hiding');
  const capGlobal = document.getElementById('cap-global');
  if (capGlobal) capGlobal.classList.remove('show');
  dismissTimer = null;
}

// ── Records panel ─────────────────────────────────────────────────────────────

function showRecords(data) {
  const records = data.records || [];

  recordsList.innerHTML = '';

  if (records.length === 0) {
    recordsList.innerHTML = '<div class="empty-msg">No personal bests recorded yet.<br>Get caught speeding to set records.</div>';
  } else {
    records.forEach(rec => {
      const cam  = (data.cameraList || []).find(c => c.id === rec.camera_id);
      const name = cam ? cam.name : rec.camera_id;
      const spd  = Math.floor(cardUnit === 'MPH' ? rec.speed_kmh * 0.621371 : rec.speed_kmh);
      const date = rec.updated_at ? rec.updated_at.slice(0, 10) : '';

      const row = document.createElement('div');
      row.className = 'record-row';
      row.innerHTML = `
        <div class="record-cam">
          <div class="record-cam-name">${name}</div>
          <div class="record-cam-date">${date}</div>
        </div>
        <div class="record-speed">${spd}<span>${cardUnit}</span></div>
      `;
      recordsList.appendChild(row);
    });
  }

  recordPanel.classList.add('visible');
}

function hideRecords() {
  recordPanel.classList.remove('visible');
  fetch(`https://${GetParentResourceName()}/closeRecords`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  }).catch(() => {});
}

// ── Message handler ───────────────────────────────────────────────────────────

window.addEventListener('message', e => {
  const msg = e.data;
  if (!msg || !msg.type) return;

  switch (msg.type) {
    case 'theme':
      applyTheme(msg.theme);
      break;
    case 'minimap':
      applyMinimap(msg.minimap);
      break;
    case 'capture':
      showCapture(msg);
      break;
    case 'openRecords':
      recordsList.innerHTML = '<div class="empty-msg">Loading records...</div>';
      recordPanel.classList.add('visible');
      break;
    case 'records':
      showRecords(msg);
      break;
    case 'closeRecords':
      hideRecords();
      break;
  }
});

// Close records on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    hideRecords();
  }
});

// Close btn
document.getElementById('close-records-btn').addEventListener('click', hideRecords);

// ── Browser preview (no FiveM) ──────────────────────────────────────────────
// Open index.html directly in a browser to preview. Buttons re-trigger the
// card / records with mock data. Does nothing inside the FiveM NUI.
(function () {
  const inNui = typeof GetParentResourceName === 'function';
  if (inNui) return;

  document.body.style.pointerEvents = 'auto';
  document.body.style.background = '#11161d';   // stand-in backdrop

  const MOCK_CAPTURE = {
    type: 'capture',
    cameraName: 'Vespucci Blvd',
    speed: 168,
    unit: 'KM/H',
    plate: '46EEK572',
    plateIndex: 0,
    personalBest: true,
    globalRecord: false,
    prevBest: 152,
    duration: 6000,
  };

  const MOCK_RECORDS = {
    type: 'records',
    cameraList: [
      { id: 'speedcam_vespucci_bvd', name: 'Vespucci Blvd' },
      { id: 'speedcam_richman',      name: 'Richman' },
      { id: 'speedcam_route68',      name: 'Route 68' },
    ],
    records: [
      { camera_id: 'speedcam_route68',      speed_kmh: 214.6, updated_at: '2026-07-12' },
      { camera_id: 'speedcam_vespucci_bvd', speed_kmh: 168.2, updated_at: '2026-07-13' },
      { camera_id: 'speedcam_richman',      speed_kmh: 133.9, updated_at: '2026-07-10' },
    ],
  };

  function bar(label, onClick) {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText =
      'font:600 12px/1 sans-serif;padding:8px 12px;margin:0 6px 0 0;' +
      'background:var(--orange);color:#000;border:0;border-radius:5px;cursor:pointer;';
    b.onclick = onClick;
    return b;
  }

  const dock = document.createElement('div');
  dock.style.cssText = 'position:fixed;top:12px;left:12px;z-index:9999;pointer-events:auto;';
  dock.appendChild(bar('▶ Capture',  () => showCapture(MOCK_CAPTURE)));
  dock.appendChild(bar('★ Global',   () => showCapture({ ...MOCK_CAPTURE, cameraName: 'Route 68', speed: 231, globalRecord: true, personalBest: false, plate: 'SPZ 001', plateIndex: 1 })));
  dock.appendChild(bar('🏁 Records',  () => showRecords(MOCK_RECORDS)));
  dock.appendChild(bar('✕ Hide',     () => { hideCapture(); recordPanel.classList.remove('visible'); }));
  document.body.appendChild(dock);

  // records close button + Esc work without the NUI fetch
  window.GetParentResourceName = window.GetParentResourceName || (() => 'preview');

  // Auto-show the capture once on load
  setTimeout(() => showCapture(MOCK_CAPTURE), 400);
})();

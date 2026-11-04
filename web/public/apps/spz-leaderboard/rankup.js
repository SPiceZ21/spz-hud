// Rank-up overlay. Driven by { action: 'rankUp', oldRank, newRank } from
// client/main.lua (promotions only). Videos are Blender renders with alpha in
// Assets/rankfx (see _source/rankfx):
//
//   tier change (B-5 → A-1) : <NEW>_up.webm   — the new badge builds itself in
//                             glass over the old one, fills in, flash, sweep
//   same tier   (A-2 → A-3) : <NEW>_step.webm — the newly earned bar lights up
//                             along its length, flares, sweep
//   then                     : <NEW>_idle.webm — seamless loop until the exit
//
// The old rank's loop plays underneath at the start and fades as the new one
// takes over. Below the badge: "RANK UP" and [old badge] old ▶ [new badge] new.

(() => {
  const RK_FILES = {};
  for (const t of ['A', 'B', 'C', 'S']) for (let i = 1; i <= 5; i++) RK_FILES[t + i] = `RANK${t}${i}`;

  // glow colour per tier, matches the badge art
  const TIER_GLOW = { C: '#ff5a2c', B: '#2fe05a', A: '#4b5bff', S: '#c23bff' };
  const TIER_ORDER = { C: 0, B: 1, A: 2, S: 3 };

  const HOLD_MS = 13000;      // total time on screen before the exit starts
  const OUT_MS = 950;         // exit animation

  const parse = (rank) => {
    const m = /^\s*([SABC])\s*-?\s*([1-5])\s*$/i.exec(String(rank || ''));
    if (!m) return null;
    const tier = m[1].toUpperCase(), sub = +m[2];
    return { tier, sub, file: RK_FILES[tier + sub], label: `${tier}-${sub}` };
  };

  const root = document.createElement('div');
  root.className = 'rankup';
  root.innerHTML = `
    <div class="rankup-stage">
      <video class="rk-old" muted playsinline loop preload="auto"></video>
      <video class="rk-new" muted playsinline preload="auto"></video>
      <video class="rk-idle hide" muted playsinline loop preload="auto"></video>
    </div>
    <div class="rankup-text">
      <div class="rankup-kicker"></div>
      <div class="rankup-line">
        <span class="rk-from"><img alt=""><b></b></span>
        <span class="rk-arrow"><i></i><i></i><i></i></span>
        <span class="rk-to"><img alt=""><b></b></span>
      </div>
    </div>`;
  document.body.appendChild(root);

  const vOld = root.querySelector('.rk-old');
  const vNew = root.querySelector('.rk-new');
  const vIdle = root.querySelector('.rk-idle');
  const queue = [];
  let busy = false;
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  function reset() {
    timers.splice(0).forEach(clearTimeout);
    for (const v of [vOld, vNew, vIdle]) { v.pause(); v.removeAttribute('src'); v.load(); }
    root.classList.remove('show', 'text', 'out');
    vOld.classList.remove('gone');
    vIdle.classList.add('hide');
    vNew.classList.remove('hide');
  }

  function play(d) {
    const nw = parse(d.newRank);
    if (!nw || !nw.file) { busy = false; return next(); }
    const od = parse(d.oldRank);
    busy = true;
    reset();

    // same tier, higher sub-rank -> the step animation; anything else -> full build
    const sameTier = !!od && od.tier === nw.tier && nw.sub > od.sub;
    const kind = sameTier ? 'step' : 'up';

    root.style.setProperty('--rk', TIER_GLOW[nw.tier] || '#8a8aff');
    root.querySelector('.rankup-kicker').textContent =
      !sameTier && od && TIER_ORDER[nw.tier] > TIER_ORDER[od.tier] ? 'Tier promotion' : 'Rank up';
    const from = root.querySelector('.rk-from'), to = root.querySelector('.rk-to');
    from.style.display = od ? '' : 'none';
    root.querySelector('.rk-arrow').style.display = od ? '' : 'none';
    if (od) { from.querySelector('img').src = `Assets/ranks/${od.file}.svg`; from.querySelector('b').textContent = od.label; }
    to.querySelector('img').src = `Assets/ranks/${nw.file}.svg`;
    to.querySelector('b').textContent = nw.label;

    // old rank underneath, fading as the new one takes over
    if (od && od.file) {
      vOld.src = `Assets/rankfx/${od.file}_idle.webm`;
      vOld.play().catch(() => {});
      later(sameTier ? 350 : 1650, () => vOld.classList.add('gone'));
    } else {
      vOld.classList.add('gone');
    }

    vIdle.src = `Assets/rankfx/${nw.file}_idle.webm`;
    vIdle.load();
    delete vNew.dataset.fallback;
    vNew.src = `Assets/rankfx/${nw.file}_${kind}.webm`;

    // build -> loop: only swap once the loop's first frame is actually up, so
    // there is never a blank frame between them
    vNew.onended = () => {
      vIdle.currentTime = 0;
      vIdle.onplaying = () => {
        vIdle.onplaying = null;
        vIdle.classList.remove('hide');
        vNew.classList.add('hide');
      };
      vIdle.play().catch(() => { vIdle.classList.remove('hide'); vNew.classList.add('hide'); });
    };
    // missing step video (older render): fall back to the full build
    vNew.onerror = () => {
      if (kind === 'step' && !vNew.dataset.fallback) {
        vNew.dataset.fallback = '1';
        vNew.src = `Assets/rankfx/${nw.file}_up.webm`;
        vNew.play().catch(() => {});
      } else {
        root.classList.add('text');
      }
    };

    vNew.play().catch(() => {});
    requestAnimationFrame(() => root.classList.add('show'));
    later(sameTier ? 1400 : 2100, () => root.classList.add('text'));

    // exit: text first, then the badge eases down and out
    later(HOLD_MS, () => root.classList.add('out'));
    later(HOLD_MS + OUT_MS, () => { reset(); busy = false; next(); });
  }

  function next() {
    if (busy || !queue.length) return;
    play(queue.shift());
  }

  window.addEventListener('message', ({ data }) => {
    if (!data || data.action !== 'rankUp') return;
    queue.push(data);
    next();
  });

  // Browser preview outside FiveM: ?rankup=A-3&from=A-2
  const qs = new URLSearchParams(location.search);
  if (qs.get('rankup')) {
    window.postMessage({ action: 'rankUp', oldRank: qs.get('from') || 'B-5', newRank: qs.get('rankup') }, '*');
  }
})();

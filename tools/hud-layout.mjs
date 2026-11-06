// tools/hud-layout.mjs — what players can move in /hudedit, per hosted app.
//
//   moves  the app's HUD elements, each placed on its own:
//            id      key part (layout key = app:<resource>:<id>)
//            sel     CSS selector of the element in the app's page
//            label   shown on the handle
//            origin  the corner it scales from (match how its CSS anchors it)
//   demo   messages that put the app on screen with sample data while placing
//          it, sent only when some of its elements are not drawn (on foot, not
//          in a race…), and the messages that take that back down afterwards.
//
// Placement is applied with the CSS `translate` / `scale` properties, which add
// to an element's own `transform` instead of replacing it, so elements that
// animate with transform keep doing so.
//
// Left out on purpose: things that follow a point in the world (the checkpoint
// marker, other players' nametags) and full-screen moments (countdown, intro,
// results card).

const RACE_ROWS = [
  { source: 2, name: 'DRIFT_KING',  position: 1, gap: 'LEADER', licenseClass: 'S', nation: 'jp', raceNumber: 7 },
  { source: 1, name: 'SPICEZ',      position: 2, gap: '+1.25', gapMs: 1250, licenseClass: 'S', nation: 'in', raceNumber: 21 },
  { source: 3, name: 'SHADOW_GRID', position: 3, gap: '+3.42', gapMs: 3420, licenseClass: 'A', nation: 'de', raceNumber: 44 },
]

export const LAYOUT = {
  'spz-speedometer': {
    moves: [{ id: 'gauge', sel: '.hud-wrap', label: 'Speedometer', origin: 'bottom right' }],
    demo: {
      on: [{ type: 'show' }, { type: 'update', speed: 184, gear: 4, pct: 72, inRedline: false,
             shifting: false, limiter: false, launch: false, tcsCut: false, boost: 0, status: {} }],
      off: [{ type: 'hide' }],
    },
  },

  'spz-raceUI': {
    moves: [
      { id: 'standings', sel: '.standings-list', label: 'Standings',          origin: 'top left' },
      { id: 'sectors',   sel: '.sector-strip',   label: 'Sectors',            origin: 'top left' },
      { id: 'keys',      sel: '.key-hints',      label: 'Key hints',          origin: 'top left' },
      { id: 'timer',     sel: '.telemetry-hud',  label: 'Lap · timer',        origin: 'top right' },
      { id: 'radar',     sel: '.prox',           label: 'Proximity radar',    origin: 'center' },
      { id: 'warmup',    sel: '.warmup-panel',   label: 'Warmup',             origin: 'center' },
      { id: 'finish',    sel: '.finish-window',  label: 'Finish countdown',   origin: 'center' },
      { id: 'lobby',     sel: '.lobby-row',      label: 'Lobby / queue',      origin: 'center' },
      { id: 'wanted',    sel: '.wanted',         label: 'Wanted level',       origin: 'top center' },
      { id: 'profile',   sel: '.fr-hud',         label: 'Freeroam profile',   origin: 'top right' },
      { id: 'fastest',   sel: '.fastest-lap',    label: 'Fastest lap',        origin: 'center' },
      { id: 'flourish',  sel: '.fl',             label: 'Flourish',           origin: 'center' },
    ],
    demo: {
      on: [
        { action: 'spzBooted' },
        { action: 'raceOverlay', data: { visible: true, mySource: 1, lapNum: 2, totalLaps: 3, checkpoint: 12,
          totalCheckpoints: 24, bestLapTime: 72450, raceType: 'circuit', positions: RACE_ROWS } },
        { action: 'sector', data: { sector: 1, time: 24310, colour: 'purple', delta: -0.212 } },
        { action: 'keyhints', data: { standings: 'N', results: 'F6', respawn: 'F4', flip: 'K', rewind: 'B' } },
        { action: 'radar', data: { w: 2, l: 4.5, cars: [{ x: -2.6, y: 3.5, h: 0, w: 2, l: 4.5 }] } },
        { action: 'warmup', data: { remaining: 47, total: 90, track: 'DOWNTOWN GRAND PRIX', class: 'A', gridPos: 4 } },
        { action: 'finishWindow', data: { seconds: 30 } },
        { action: 'lobby', data: { mode: 'queued', queueCount: 6, queuePos: 2, track: 'DOWNTOWN GRAND PRIX' } },
        { action: 'wanted', data: { stars: 3, max: 5 } },
        { action: 'freeroam', data: { visible: true, license: 'S-1', credits: 125400, rank: 'A-3', crew: 'NR', rating: 1840, avatar: 'https://cdn.discordapp.com/embed/avatars/0.png' } },
      ],
      off: [
        { action: 'raceOverlay', data: { visible: false } },
        { action: 'sectorReset' },
        { action: 'radar', data: { w: 2, l: 4.5, cars: [] } },
        { action: 'warmupEnd' },
        { action: 'finishWindowEnd' },
        { action: 'lobby', data: { mode: 'hidden' } },
        { action: 'wanted', data: { stars: 0, max: 5 } },
        { action: 'freeroam', data: { visible: false } },
      ],
    },
  },

  'spz-nametag': {
    moves: [{ id: 'self', sel: '#self-nametag-container', label: 'Your nametag', origin: 'bottom center' }],
    demo: {
      on: [{ action: 'updateSelf', payload: { name: 'SPICEZ', licenseClass: 'S', license: 'S-1', crew: 'SPZ', isTalking: false, isRacing: false } }],
      off: [{ action: 'updateSelf', payload: null }],
    },
  },

  'spz-minigames': {
    moves: [
      { id: 'top',   sel: '#hud .hud-top',   label: 'Minigame status', origin: 'top left' },
      { id: 'bot',   sel: '#hud .hud-bot',   label: 'Minigame keys',   origin: 'bottom center' },
      { id: 'board', sel: '#hud .hud-board', label: 'Minigame board',  origin: 'center right' },
    ],
    demo: {
      on: [{ hud: 'set', d: {
        title: 'BOMB', icon: 'bomb', accent: '#ff4d4d', chips: ['3 / 8 ALIVE'],
        status: { label: 'FUSE', value: '12.4', color: 'bad' },
        bar: { label: 'CAR', pct: 0.8 }, keys: [{ key: 'E', label: 'Jump', hot: true }],
        board: { title: 'Standings', numbered: true, rows: [{ src: 1, name: 'SPICEZ', value: '1 W' }, { src: 2, name: 'DRIFT_KING', value: '2 W' }] },
      } }],
      off: [{ hud: 'clear' }],
    },
  },

  'spz-spectate': {
    moves: [
      { id: 'bar',   sel: '#root',    label: 'Spectate bar',    origin: 'bottom center' },
      { id: 'board', sel: '#rf-root', label: 'Live race board', origin: 'top right' },
    ],
    demo: {
      on: [
        { action: 'update', data: { name: 'DRIFT_KING', nation: 'jp', number: 7, rank: 'S-3', crew: 'APX', racing: true, records: 2 } },
        { action: 'board', view: 'full', maxRows: 8, board: { track: 'DOWNTOWN GRAND PRIX', type: 'circuit', lap: 2, laps: 3, class: 'A',
          rows: RACE_ROWS.map(r => ({ position: r.position, name: r.name, gap: r.gap, nation: r.nation, number: r.raceNumber })) } },
      ],
      off: [{ action: 'hide' }, { action: 'boardHide' }],
    },
  },

  'spz-speedcam': {
    moves: [{ id: 'capture', sel: '#capture', label: 'Speed camera', origin: 'top center' }],
    demo: {
      on: [{ type: 'capture', cameraName: 'Vespucci Blvd', speed: 168, unit: 'KM/H', plate: '46EEK572', plateIndex: 0,
             personalBest: true, globalRecord: false, prevBest: 152, duration: 60000 }],
      // No hide message exists: the card dismisses itself after `duration`.
      off: [{ type: 'capture', cameraName: '', speed: 0, unit: 'KM/H', duration: 1 }],   // no hide message: a 1 ms capture replaces it
    },
  },

  'spz-rocketleague': {
    moves: [{ id: 'score', sel: '#hud .board', label: 'Rocket League score', origin: 'top center' }],
  },

  'spz-chat': {
    moves: [{ id: 'chat', sel: '#dock', label: 'Chat', origin: 'top left' }],
  },

  'spz-radio': {
    moves: [{ id: 'toast', sel: '#toast', label: 'Radio · now playing', origin: 'bottom left' }],
  },
}

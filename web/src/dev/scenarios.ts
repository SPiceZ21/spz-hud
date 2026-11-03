// Browser preview: what each game state puts on screen, as the messages the
// Lua side sends, filled with sample data.
//
// The data comes from the apps' own mocks (spz-raceUI/ui/src/mockdata.ts,
// spz-nametag/ui/src/mockdata.ts, spz-spectate/ui/app.js) and the minigame HUD
// format documented in spz-minigames/client/hud.lua. Message shapes match what
// each resource's client Lua sends, so a scenario that looks right here looks
// right in game.

export interface Msg { app: string; msg: unknown }

export interface Scenario {
  id: string
  label: string
  /** The game state the HUD is put in (decides spz-hud's own widgets). */
  state: 'freeroam' | 'race' | 'minigame' | 'spectate'
  msgs: Msg[]
  /** Live values sent every 50 ms while the scenario is on (speedometer). */
  tick?: (t: number) => Msg[]
}

// ── Shared pieces ───────────────────────────────────────────────────────────

const speedo = (base: number, swing: number) => (t: number): Msg[] => {
  const speed = Math.round(base + swing * Math.sin(t * 0.6))
  const pct = Math.round(55 + 40 * ((Math.sin(t * 2.1) + 1) / 2))
  return [{ app: 'spz-speedometer', msg: {
    type: 'update', speed, gear: Math.max(1, Math.min(6, 1 + Math.floor(speed / 40))), pct,
    inRedline: pct >= 90, shifting: false, limiter: false, launch: false, tcsCut: false,
    boost: 0, status: {}, rewindMax: 5, rewindLeft: 3, sideBoost: -1,
  } }]
}

const NAMETAGS = [
  { id: 1, name: 'DRIFT_KING', licenseClass: 'S', license: 'S-3', crew: 'DK', isTalking: true, isRacing: true,
    banner: 'gradient:linear-gradient(60deg, #F39C12 0%, #F1C40F 100%)', x: 35, y: 40, scale: 0.95, opacity: 1, distance: 12, vehicleName: 'BANSHEE' },
  { id: 2, name: 'TURBO_RACER', licenseClass: 'A', license: 'A-2', crew: 'TR', isTalking: false, isRacing: false,
    banner: 'gradient:linear-gradient(90deg, #FF2E93 0%, #FF6200 100%)', x: 65, y: 32, scale: 0.82, opacity: 0.9, distance: 45, vehicleName: 'ELEGY' },
  { id: 3, name: 'SHADOW_GRID', licenseClass: 'B', license: 'B-5', crew: 'SHD', isTalking: true, isRacing: false,
    banner: 'gradient:linear-gradient(220deg, #00C6FF 0%, #0072FF 100%)', x: 18, y: 48, scale: 0.88, opacity: 0.95, distance: 28, vehicleName: 'JESTER' },
]

const SELF_TAG = { name: 'SPICEZ', licenseClass: 'S', license: 'S-1', crew: 'SPZ', isTalking: false, isRacing: false,
  banner: 'gradient:linear-gradient(90deg, #FF2E93 0%, #FF6200 100%)' }

const POSITIONS = [
  { source: 2, name: 'DRIFT_KING',  position: 1, gap: 'LEADER', licenseClass: 'S', nation: 'jp', raceNumber: 7,  crew_tag: '[APX]' },
  { source: 1, name: 'SPICEZ',      position: 2, gap: '+1.25', gapMs: 1250, licenseClass: 'S', nation: 'in', raceNumber: 21, crew_tag: '[NR]' },
  { source: 3, name: 'SHADOW_GRID', position: 3, gap: '+3.42', gapMs: 3420, licenseClass: 'A', nation: 'de', raceNumber: 44, crew_tag: '[NR]' },
  { source: 4, name: 'APEX_HUNTER', position: 4, gap: '+5.10', gapMs: 5100, licenseClass: 'A', nation: 'fr', raceNumber: 88 },
  { source: 5, name: 'NIGHT_OWL',   position: 5, gap: '+8.77', gapMs: 8770, licenseClass: 'B', nation: 'gb', raceNumber: 18, dc: true },
  { source: 6, name: 'REDLINE',     position: 6, gap: '+1:02.88 1L', gapMs: 62880, gapLaps: 1, licenseClass: 'C', nation: 'us', raceNumber: 96 },
]

// id -> key text, as spz-raceUI's PushKeyHints sends it (ids registered by
// spz-raceUI, spz-races and spz-leaderboard through SetKeyHints).
const KEYHINTS = { action: 'keyhints', data: { standings: 'N', results: 'F6', respawn: 'F4', flip: 'K', rewind: 'B' } }

const freeroamCard = (visible: boolean) => ({ app: 'spz-raceUI', msg: { action: 'freeroam', data: visible
  ? { visible: true, license: 'S-1', credits: 125400, rank: 'A-3', crew: 'NR', rating: 1840, key: 'PAGEDOWN' }
  : { visible: false } } })

const nametags = (racing: boolean): Msg[] => [
  { app: 'spz-nametag', msg: { action: 'update', nametags: NAMETAGS.map(n => ({ ...n, isRacing: racing || n.isRacing })) } },
  { app: 'spz-nametag', msg: { action: 'updateSelf', payload: { ...SELF_TAG, isRacing: racing } } },
]

const speedoOn: Msg = { app: 'spz-speedometer', msg: { type: 'show' } }

// Pages that stay hidden until the loading screen is down (their client
// boot.lua sends this in game once spz-loading finishes).
export const BOOT: Msg[] = [
  { app: 'spz-raceUI', msg: { action: 'spzBooted' } },
  { app: 'spz-chat', msg: { action: 'spzBooted' } },
]

// ── Everything a scenario might have put up, taken down again ───────────────
export const CLEAR: Msg[] = [
  { app: 'spz-raceUI', msg: { action: 'hideAll' } },
  { app: 'spz-raceUI', msg: { action: 'raceOverlay', data: { visible: false } } },
  { app: 'spz-raceUI', msg: { action: 'warmupEnd' } },
  { app: 'spz-raceUI', msg: { action: 'sectorReset' } },
  freeroamCard(false),
  { app: 'spz-speedometer', msg: { type: 'hide' } },
  { app: 'spz-nametag', msg: { action: 'clear' } },
  { app: 'spz-spectate', msg: { action: 'hide' } },
  { app: 'spz-spectate', msg: { action: 'boardHide' } },
  { app: 'spz-minigames', msg: { hud: 'clear' } },
]

// ── Scenarios ───────────────────────────────────────────────────────────────

export const SCENARIOS: Scenario[] = [
  {
    id: 'freeroam', label: 'Freeroam', state: 'freeroam',
    msgs: [freeroamCard(true), speedoOn, ...nametags(false)],
    tick: speedo(90, 40),
  },
  {
    id: 'warmup', label: 'Race · warmup', state: 'race',
    msgs: [
      freeroamCard(false),
      { app: 'spz-raceUI', msg: { action: 'warmup', data: { remaining: 47, total: 90, track: 'DOWNTOWN GRAND PRIX', class: 'A', gridPos: 4, tuneKey: 'F7' } } },
      { app: 'spz-raceUI', msg: KEYHINTS },
      speedoOn, ...nametags(true),
    ],
    tick: speedo(40, 30),
  },
  {
    id: 'race', label: 'Race · live', state: 'race',
    msgs: [
      freeroamCard(false),
      { app: 'spz-raceUI', msg: { action: 'warmupEnd' } },
      { app: 'spz-raceUI', msg: { action: 'raceOverlay', data: {
        visible: true, mySource: 1, lapNum: 2, totalLaps: 3, checkpoint: 12, totalCheckpoints: 24,
        bestLapTime: 72450, allTimeBest: 71200, delta: -0.45, raceType: 'circuit', positions: POSITIONS,
      } } },
      { app: 'spz-raceUI', msg: { action: 'sector', data: { sector: 1, time: 24310, colour: 'purple', delta: -0.212 } } },
      { app: 'spz-raceUI', msg: { action: 'sector', data: { sector: 2, time: 28094, colour: 'yellow', delta: 0.084 } } },
      { app: 'spz-raceUI', msg: { action: 'cpWaypoint', data: { dist: 184, pill: { onScreen: true, x: 0.62, y: 0.44 } } } },
      { app: 'spz-raceUI', msg: KEYHINTS },
      speedoOn, ...nametags(true),
    ],
    tick: speedo(170, 45),
  },
  {
    id: 'minigame', label: 'Minigame', state: 'minigame',
    msgs: [
      freeroamCard(false),
      { app: 'spz-minigames', msg: { hud: 'set', d: {
        title: 'BOMB', icon: 'bomb', accent: '#ff4d4d',
        chips: ['3 / 8 ALIVE', { text: 'WAVE 2', hot: true }],
        status: { label: 'FUSE', value: '12.4', color: 'bad', sub: 'pass it on!' },
        alert: 'YOU HAVE THE BOMB — RAM SOMEONE!',
        bar: { label: 'CAR', pct: 0.8 },
        keys: [{ key: 'E', label: 'Jump', hot: true }, { key: 'SPACE', label: 'Handbrake' }],
        board: { title: 'Standings', note: 'Round 2', numbered: true, rows: [
          { src: 3, name: 'DRIFT_KING', value: '2 W', sub: '4 waves', icon: 'crown', valueColor: 'ok' },
          { src: 1, name: 'SPICEZ', value: '1 W', sub: '3 waves', icon: 'bomb', color: 'bad' },
          { src: 4, name: 'NIGHT_OWL', value: '0 W', sub: 'out', out: true },
        ] },
      } } },
      speedoOn,
    ],
    tick: speedo(110, 50),
  },
  {
    id: 'spectate', label: 'Spectate', state: 'spectate',
    msgs: [
      freeroamCard(false),
      { app: 'spz-spectate', msg: { action: 'update', data: {
        name: 'DRIFT_KING', nation: 'jp', number: 7, rank: 'S-3', crew: 'APX', racing: true,
        records: 2,
      } } },
      { app: 'spz-spectate', msg: { action: 'board', view: 'full', maxRows: 8, keys: { cycle: 'F9', hide: 'F10' }, board: {
        track: 'DOWNTOWN GRAND PRIX', type: 'circuit', lap: 2, laps: 3, class: 'A',
        rows: POSITIONS.map(p => ({ position: p.position, name: p.name, gap: p.gap, nation: p.nation, number: p.raceNumber, crew: p.crew_tag, dc: p.dc })),
      } } },
    ],
  },
]

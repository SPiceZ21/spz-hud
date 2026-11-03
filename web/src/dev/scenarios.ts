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

// ── More moments of a race ──────────────────────────────────────────────────

const RACE_OVERLAY: Msg = { app: 'spz-raceUI', msg: { action: 'raceOverlay', data: {
  visible: true, mySource: 1, lapNum: 2, totalLaps: 3, checkpoint: 12, totalCheckpoints: 24,
  bestLapTime: 72450, allTimeBest: 71200, delta: -0.45, raceType: 'circuit', positions: POSITIONS,
} } }

SCENARIOS.push(
  {
    id: 'lobby', label: 'Lobby · queued', state: 'freeroam',
    msgs: [
      freeroamCard(true),
      { app: 'spz-raceUI', msg: { action: 'lobby', data: { mode: 'queued', queueCount: 6, queuePos: 2, seconds: 25, track: 'DOWNTOWN GRAND PRIX' } } },
      speedoOn, ...nametags(false),
    ],
    tick: speedo(60, 30),
  },
  {
    id: 'intro', label: 'Race · intro card', state: 'race',
    msgs: [{ app: 'spz-raceUI', msg: { action: 'raceIntro', data: {
      phase: 'reveal', holdMs: 600000, track: 'Vinewood Hills Sprint', type: 'sprint', laps: 3, length: '6.8 km',
      vehicle: 'Annis Elegy Retro Custom', class: 'A', topSpeed: 197, accel: 82, handling: 76, cops: false, traffic: 'light',
    } } }],
  },
  {
    id: 'countdown', label: 'Race · countdown', state: 'race',
    msgs: [{ app: 'spz-raceUI', msg: { action: 'countdown', data: {
      number: 3, totalSeconds: 5, isGo: false, track: 'DOWNTOWN GRAND PRIX', class: 'A', laps: 3, gridPos: 4, total: 12,
    } } }],
  },
  {
    id: 'finale', label: 'Race · last lap', state: 'race',
    msgs: [
      freeroamCard(false),
      { app: 'spz-raceUI', msg: { action: 'raceOverlay', data: { ...(RACE_OVERLAY.msg as any).data, lapNum: 3, checkpoint: 22 } } },
      { app: 'spz-raceUI', msg: { action: 'sector', data: { sector: 1, time: 24120, colour: 'green', delta: -0.19 } } },
      { app: 'spz-raceUI', msg: { action: 'sector', data: { sector: 2, time: 27880, colour: 'purple', delta: -0.21 } } },
      { app: 'spz-raceUI', msg: { action: 'sector', data: { sector: 3, time: 20410, colour: 'yellow', delta: 0.05 } } },
      { app: 'spz-raceUI', msg: { action: 'finishWindow', data: { seconds: 30 } } },
      { app: 'spz-raceUI', msg: { action: 'radar', data: { w: 2, l: 4.5, cars: [
        { x: -2.4, y: 2.8, h: 0.05, w: 2, l: 4.6 }, { x: 0.3, y: -7.5, h: -0.02, w: 2, l: 4.4 },
      ] } } },
      { app: 'spz-raceUI', msg: { action: 'fastestLap', data: { name: 'DRIFT_KING', ms: 71204, mine: false } } },
      { app: 'spz-raceUI', msg: KEYHINTS },
      speedoOn, ...nametags(true),
    ],
    tick: speedo(190, 30),
  },
  {
    id: 'results', label: 'Race · results', state: 'race',
    msgs: [{ app: 'spz-raceUI', msg: { action: 'postRaceStats', data: {
      trackName: 'DOWNTOWN GRAND PRIX', finishTime: '03:42.50', position: 2, bestLap: '01:12.45',
      xpGained: 350, xpNewProgress: 0.78, classPointsGained: 25, cpNewProgress: 0.65,
      iRatingDelta: 45, safetyRatingDelta: 0.12, level: 24, levelUp: true,
    } } }],
  },
  {
    id: 'timetrial', label: 'Time trial', state: 'race',
    msgs: [
      freeroamCard(false),
      { app: 'spz-raceUI', msg: { action: 'tt_hud_show', data: { cpIndex: 7, cpTotal: 24, bestLap: 71200 } } },
      { app: 'spz-raceUI', msg: { action: 'tt_timer', data: { formatted: '00:42.180' } } },
      { app: 'spz-raceUI', msg: { action: 'keyhints', data: { results: 'F6', respawn: 'F4', flip: 'K', rewind: 'B', restart: 'BKSP' } } },
      speedoOn,
    ],
    tick: speedo(150, 40),
  },
  {
    id: 'pursuit', label: 'Wanted (cops)', state: 'race',
    msgs: [
      RACE_OVERLAY,
      { app: 'spz-raceUI', msg: { action: 'wanted', data: { stars: 3, max: 5, escape: 0.4 } } },
      speedoOn,
    ],
    tick: speedo(180, 40),
  },
)

CLEAR.push(
  { app: 'spz-raceUI', msg: { action: 'lobby', data: { mode: 'hidden' } } },
  { app: 'spz-raceUI', msg: { action: 'raceIntro', data: { phase: 'end' } } },
  { app: 'spz-raceUI', msg: { action: 'finishWindowEnd' } },
  { app: 'spz-raceUI', msg: { action: 'wanted', data: { stars: 0, max: 5 } } },
  { app: 'spz-raceUI', msg: { action: 'radar', data: { w: 2, l: 4.5, cars: [] } } },
  { app: 'spz-raceUI', msg: { action: 'dismissStats' } },
  { app: 'spz-raceUI', msg: { action: 'tt_hide' } },
)

// ── One-off events: fire on top of whatever scenario is showing ─────────────

const raceEvent = (label: string, action: string, data: unknown) => ({ label, msgs: [{ app: 'spz-raceUI', msg: { action, data } }] })

export const EVENTS: { label: string; msgs: Msg[] }[] = [
  raceEvent('Fastest lap · mine', 'fastestLap', { name: 'SPICEZ', ms: 71088, mine: true }),
  raceEvent('Fastest lap · rival', 'fastestLap', { name: 'DRIFT_KING', ms: 71204, mine: false }),
  raceEvent('Split · ahead', 'splitDelta', { delta: -0.312, split: 38240, cp: 12, total: 24 }),
  raceEvent('Split · behind', 'splitDelta', { delta: 0.481, split: 38240, cp: 12, total: 24 }),
  raceEvent('Overtake', 'flourish', { title: 'OVERTAKE', value: 'P2', icon: 'overtake' }),
  raceEvent('Lost place', 'flourish', { title: 'POSITION LOST', value: 'P3', icon: 'down' }),
  raceEvent('New PB', 'flourish', { title: 'PERSONAL BEST', value: '1:11.08', icon: 'timer' }),
  raceEvent('Win', 'flourish', { title: 'VICTORY', value: '+350 RP', icon: 'crown' }),
  raceEvent('Credits', 'flourish', { title: 'CREDITS', value: '+2,500', icon: 'coins' }),
  raceEvent('Finish 30s', 'finishWindow', { seconds: 30 }),
  raceEvent('Wanted 3★', 'wanted', { stars: 3, max: 5 }),
  raceEvent('Car alongside', 'radar', { w: 2, l: 4.5, cars: [{ x: -2.3, y: 0.6, h: 0, w: 2, l: 4.6 }] }),
  raceEvent('Countdown GO', 'countdown', { number: 0, totalSeconds: 5, isGo: true, track: 'DOWNTOWN GRAND PRIX', class: 'A', laps: 3, gridPos: 4, total: 12 }),
  { label: 'Rank up', msgs: [{ app: 'spz-leaderboard', msg: { action: 'rankUp', oldRank: 'B-1', newRank: 'A-5', isPromotion: true } }] },
  { label: 'Speed camera', msgs: [{ app: 'spz-speedcam', msg: {
    type: 'capture', cameraName: 'Vespucci Blvd', speed: 168, unit: 'KM/H', plate: '46EEK572', plateIndex: 0,
    personalBest: true, globalRecord: false, prevBest: 152, duration: 6000,
  } }] },
  { label: 'Chat message', msgs: [
    { app: 'spz-chat', msg: { action: 'visible', visible: true } },
    { app: 'spz-chat', msg: { action: 'message', payload: { channel: 'global', from: 'DRIFT_KING', crewTag: 'APX', text: 'gg, see you on the next one' } } },
    { app: 'spz-chat', msg: { action: 'message', payload: { channel: 'crew', from: 'SHADOW_GRID', crewTag: 'NR', text: 'nice line through T3' } } },
  ] },
  { label: 'Radio track', msgs: [{ app: 'spz-radio', msg: { action: 'nowPlaying', data: { title: 'Midnight Run', artist: 'Neon Drive', listeners: 14 } } }] },
  { label: 'Minigame 3·2·1', msgs: [{ app: 'spz-minigames', msg: { hud: 'flash', d: { text: '3', color: 'accent', ms: 900 } } }] },
  { label: 'Minigame result', msgs: [{ app: 'spz-minigames', msg: { hud: 'shard', d: { kicker: 'ROUND 2', title: 'YOU SURVIVED', sub: '+250 credits', color: 'ok', ms: 4000 } } }] },
]

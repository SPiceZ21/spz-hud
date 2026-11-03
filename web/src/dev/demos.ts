// Browser preview: what clicking an app in the dev panel shows.
//
//   mock  the app has a browser mock mode of its own (sample data, already
//         open): its layer is reloaded as a plain page and it runs that.
//   open  the app has none (or only in its own dev build): the messages its
//         Lua sends to open it, filled with sample data, and the ones that
//         close it again.
//   focus a menu: it gets the mouse and keyboard while shown.
//
// Sample data matches what each resource's Lua sends (see the comment on each).

export interface AppDemo {
  mock?: boolean
  open?: unknown[]
  close?: unknown[]
  focus?: boolean
}

// spz-emotes/shared/emotes.lua (Categories, and the first emotes there; the
// keys match ui/previews/<sex>/<key>.webp).
const EMOTE_CATS = [
  { id: 'fav', label: 'Favourites' }, { id: 'dances', label: 'Dances' }, { id: 'gestures', label: 'Gestures' },
  { id: 'celebrate', label: 'Celebrate' }, { id: 'poses', label: 'Poses' }, { id: 'activities', label: 'Activities' },
  { id: 'shared', label: 'Shared' }, { id: 'walks', label: 'Walk styles' }, { id: 'moods', label: 'Moods' },
]
const EMOTES = [
  ['dance', 'Club dance', 'dances'], ['dance2', 'Club dance 2', 'dances'], ['dance3', 'Low dance', 'dances'],
  ['dance4', 'Shuffle', 'dances'], ['clown', 'Clown dance', 'dances'], ['buttwag', 'Butt wag', 'dances'],
  ['cheer', 'Cheer', 'celebrate'], ['crossarms', 'Arms crossed', 'poses'], ['bouncer', 'Bouncer', 'poses'],
  ['boss', 'Boss', 'poses'], ['handsup', 'Hands up', 'poses'], ['kneel', 'Kneel, hands on head', 'poses'],
  ['sitground', 'Sit on ground', 'poses'], ['lean', 'Lean', 'poses'], ['flex', 'Flex', 'poses'],
  ['smoke', 'Smoke', 'activities'], ['coffee', 'Coffee', 'activities'], ['drink', 'Drink', 'activities'],
].map(([key, label, cat]) => ({ key, label, cat, shared: false, upper: false }))

// Unix seconds, as the replay browser expects (spz-replay ui/app.js ago()).
const now = Math.floor(Date.now() / 1000)

// A loop of world XY points, for the poll's route preview.
const loop = (cx: number, cy: number, rx: number, ry: number, n = 18) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2
    return { x: Math.round(cx + rx * Math.cos(a) + 40 * Math.sin(a * 3)), y: Math.round(cy + ry * Math.sin(a)) }
  })

export const DEMOS: Record<string, AppDemo> = {
  // ── Own mock modes ──
  'spz-carspawner':   { mock: true, focus: true },
  'spz-crew':         { mock: true, focus: true },
  'spz-leaderboard':  { mock: true, focus: true },
  'spz-minigames':    { mock: true, focus: true },
  'spz-radio':        { mock: true, focus: true },
  'spz-pausemenu':    { mock: true, focus: true },
  'spz-speedcam':     { mock: true, focus: true },
  'spz-rocketleague': { mock: true },
  'spz-spectate':     { mock: true },
  'spz-nametag':      { mock: true },
  'spz-raceUI':       { mock: true },

  // ── Messages ──

  // spz-chat/client/main.lua: dock visible, a few lines on each channel, the
  // input bar open (its own mock only shows the launcher).
  'spz-chat': {
    open: [
      { action: 'spzBooted' },
      { action: 'visible', visible: true },
      { action: 'commands', list: [{ name: 'dm', help: 'Message a player' }, { name: 'crew', help: 'Crew chat' }, { name: 'hudedit', help: 'Move the HUD' }] },
      { action: 'message', payload: { channel: 'system', text: 'Race starting in 30 seconds — Downtown Grand Prix' } },
      { action: 'message', payload: { channel: 'global', from: 'DRIFT_KING', crewTag: 'APX', text: 'gg, see you on the next one' } },
      { action: 'message', payload: { channel: 'crew', from: 'SHADOW_GRID', crewTag: 'NR', text: 'nice line through T3' } },
      { action: 'message', payload: { channel: 'dm', from: 'NIGHT_OWL', dir: 'in', text: 'run it back?' } },
      { action: 'message', payload: { channel: 'tip', text: 'Press F6 for the results of your last race.' } },
      { action: 'show' },
    ],
    close: [{ action: 'hide' }],
    focus: true,
  },

  // spz-speedometer/client/main.lua
  'spz-speedometer': {
    open: [{ type: 'show' }, { type: 'update', speed: 184, gear: 4, pct: 72, inRedline: false, shifting: false,
      limiter: false, launch: false, tcsCut: false, boost: 0, status: {}, rewindMax: 5, rewindLeft: 3, sideBoost: -1 }],
    close: [{ type: 'hide' }],
  },

  // spz-emotes/client/menu.lua (open)
  'spz-emotes': {
    open: [{ action: 'open', categories: EMOTE_CATS, emotes: EMOTES, favs: ['dance', 'cheer'], playing: null, sex: 'male', cancelKey: 'X' }],
    close: [{ action: 'close' }],
    focus: true,
  },

  // spz-tunners/client/menu.lua (render → 'menu')
  'spz-tunners': {
    open: [{ action: 'open' },
      // client/menu.lua: stats are 0-10.
      { action: 'vehicle', data: { make: 'Annis', name: 'Elegy Retro Custom', credits: 125400, stats: [
        { label: 'Top Speed', v: 7.8 }, { label: 'Acceleration', v: 8.2 }, { label: 'Braking', v: 6.4 }, { label: 'Handling', v: 7.6 },
      ] } },
      { action: 'menu', data: {
      id: 'performance', title: 'Performance', crumbs: ['Tuning', 'Performance'], selected: 2, options: [
        { label: 'Engine', desc: 'More power, higher top speed.', values: ['Stock', 'Level 1', 'Level 2', 'Level 3', 'Level 4'], index: 4, kind: 'value' },
        { label: 'Transmission', desc: 'Quicker shifts.', values: ['Stock', 'Street', 'Sport', 'Race'], index: 3, kind: 'value' },
        { label: 'Brakes', desc: 'Shorter stops.', values: ['Stock', 'Street', 'Sport', 'Race'], index: 2, kind: 'value' },
        { label: 'Suspension', desc: 'Lower and stiffer.', values: ['Stock', 'Lowered', 'Street', 'Sport', 'Competition'], index: 3, kind: 'value' },
        { label: 'Turbo', desc: 'Forced induction.', values: ['None', 'Turbo'], index: 2, kind: 'value' },
        { label: 'Wheels', desc: 'Rims, tyres and smoke.', kind: 'submenu' },
        { label: 'Repair vehicle', desc: 'Fix body and engine.', kind: 'action' },
      ] } }],
    close: [{ action: 'close' }],
    focus: true,
  },

  // spz-replay/client (browser)
  'spz-replay': {
    open: [{ action: 'browser', data: { canDelete: true, recording: false, rows: [
      { id: 'R261103201455123', track: 'Downtown Grand Prix', race_type: 'circuit', laps: 3, car_class: 'A', racer_count: 8, winner: 'DRIFT_KING', duration_ms: 222500, created: now - 25 * 60 },
      { id: 'R261103194210456', track: 'Vinewood Hills Sprint', race_type: 'sprint', laps: 1, car_class: 'S', racer_count: 6, winner: 'SPICEZ', duration_ms: 158240, created: now - 3 * 3600 },
      { id: 'R261102221532789', track: 'LS River Drift Track', race_type: 'circuit', laps: 5, car_class: 'B', racer_count: 11, winner: 'SHADOW_GRID', duration_ms: 301880, created: now - 26 * 3600 },
      { id: 'R261102210004321', track: 'Chiliad Climb', race_type: 'sprint', laps: 1, car_class: 'A', racer_count: 4, winner: 'APEX_HUNTER', duration_ms: 412300, created: now - 4 * 86400 },
    ] } }],
    close: [{ action: 'browserClose' }],
    focus: true,
  },

  // spz-tutorial/client (step)
  'spz-tutorial': {
    open: [{ action: 'step', step: { index: 3, total: 9, section: 'Racing', title: 'Join the next race',
      body: 'Press E when the race poll opens to vote for the track and car. Everyone who voted is put on the grid when it closes.' } }],
    close: [{ action: 'hide' }],
  },

  // spz-races/server/poll.lua → spz-poll (openPoll, track phase)
  'spz-poll': {
    open: [{ action: 'openPoll', data: {
      phase: 'track', step: 1, steps: 3, duration: 45,
      reroll: { enabled: true, active: false },
      options: [
        { name: 'Downtown Grand Prix', type: 'circuit', laps: 3, checkpointCount: 24, recommendedClass: 'A',
          path: loop(-250, -850, 420, 300), pathKind: 'cp', loop: true },
        { name: 'Vinewood Hills Sprint', type: 'sprint', laps: 1, checkpointCount: 31, recommendedClass: 'S',
          path: loop(150, 700, 700, 260).slice(0, 13), pathKind: 'cp', loop: false },
        { name: 'LS River Drift Track', type: 'circuit', laps: 5, checkpointCount: 18, recommendedClass: 'B',
          path: loop(650, -1500, 260, 380), pathKind: 'cp', loop: true },
        { reroll: true, subtext: 'None of these' },
      ],
    } }],
    close: [{ action: 'closePoll' }],
    focus: true,
  },

  // spz-spawn (show), as its own dev harness (ui/src/mock.ts) sends it
  'spz-spawn': {
    open: [{ type: 'show', playerData: { name: 'SPiceZ', licenseClass: 'A-1', crew: '[SPZ]', playtime: 12500, stateText: 'IDLE' },
      spawns: [{ label: 'Legion Square' }, { label: 'Paleto Bay' }, { label: 'Sandy Shores' },
               { label: 'LSIA Terminal' }, { label: 'Vinewood Hills' }, { label: 'Del Perro Pier' }] }],
    close: [{ type: 'hide' }],
    focus: true,
  },
}

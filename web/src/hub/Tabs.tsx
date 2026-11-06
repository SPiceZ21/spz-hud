// Hub tabs rebuilt natively (they were the leaderboard tablet / speed camera
// screens squeezed into the hub): Standings, Rivals, Replays, Speed records.
// Data: the same callbacks those screens used (lbFetch on spz-races, and
// hubSpeedRecords on spz-races for the cameras). Styles: hx-* in hub.css.
import { useEffect, useState } from 'preact/hooks'
import { post, inGame } from '../core/nui'
import { ownerOf } from '../core/apps'
import { lap } from './Profile'

const n = (v?: number) => (v == null || Number.isNaN(v) ? '—' : Math.round(v).toLocaleString('en-US'))
const day = (s?: string) => (s ? String(s).slice(0, 10) : '—')
const CLASS = ['C', 'B', 'A', 'S']
const cls = (c?: string | number) => (typeof c === 'number' ? CLASS[c] ?? String(c) : c ?? '—')

/** lbFetch on spz-races (the owner of the old leaderboard page), with sample data in the preview. */
function useLb<T>(tab: string, extra: Record<string, unknown>, sample: T, deps: unknown[] = []): T | null {
  const [d, setD] = useState<T | null>(inGame ? null : sample)
  useEffect(() => {
    if (!inGame) { setD(sample); return }
    setD(null)
    post<T>('lbFetch', { tab, ...extra }, ownerOf('spz-leaderboard')).then(r => setD((r ?? ([] as unknown)) as T))
  }, [tab, ...deps])
  return d
}

function Page({ title, sub, right, children }: { title: string; sub?: string; right?: preact.ComponentChildren; children: preact.ComponentChildren }) {
  return (
    <div class="hx-page hx-col">
      <section class="hx-plate hx-grow">
        <header class="hx-pagehead">
          <div><h2 class="hx-title">{title}</h2>{sub && <div class="hx-label hx-mt">{sub}</div>}</div>
          {right}
        </header>
        <div class="hx-scroll">{children}</div>
      </section>
    </div>
  )
}
const Empty = ({ d, text }: { d: unknown; text: string }) => <div class="hx-empty">{d === null ? 'Loading…' : text}</div>

// ── Standings ─────────────────────────────────────────────────────────────────
interface Row { rank?: number; name?: string; rank_title?: string; points?: number; iRating?: number; races?: number; total_races?: number; wins?: number; podiums?: number; avg_position?: number; best_lap_ms?: number; sr?: number }
const SAMPLE_ROWS: Row[] = [
  { rank: 1, name: 'SPiceZ', rank_title: 'S-1', points: 12500, iRating: 1840, races: 60, wins: 42, podiums: 51, avg_position: 1.6 },
  { rank: 2, name: 'ItzSteve', rank_title: 'A-2', points: 9800, iRating: 1620, races: 48, wins: 24, podiums: 35, avg_position: 2.4 },
  { rank: 3, name: 'Ghost', rank_title: 'A-4', points: 8100, iRating: 1510, races: 41, wins: 20, podiums: 28, avg_position: 2.9 },
  { rank: 4, name: 'Rens', rank_title: 'B-1', points: 6400, iRating: 1320, races: 33, wins: 11, podiums: 19, avg_position: 3.6 },
]
function Table({ rows, me, cols }: { rows: Row[]; me?: string; cols: [string, (r: Row) => string][] }) {
  return (
    <table class="hx-table">
      <thead><tr><th>#</th><th>Driver</th>{cols.map(([h]) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} data-me={!!me && r.name === me}>
            <td class="hx-pos" data-p={r.rank ?? i + 1}>{r.rank ?? i + 1}</td>
            <td class="hx-strong">{r.name}<span class="hx-dim hx-ml">{r.rank_title}</span></td>
            {cols.map(([h, f]) => <td key={h} class="hx-num">{f(r)}</td>)}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// One component per sub-tab: hooks must not change between renders.
export function Standings({ sub, me }: { sub: string; me?: string }) {
  if (sub === 'records') return <Records />
  return <StandingsTable key={sub} classes={sub === 'classes'} me={me} />
}

function StandingsTable({ classes, me }: { classes: boolean; me?: string }) {
  const [klass, setKlass] = useState('S')
  const d = useLb<Row[]>(classes ? 'classes' : 'standings', classes ? { class: klass } : {}, SAMPLE_ROWS, [klass])
  const rows = Array.isArray(d) ? d : []
  return (
    <Page
      title={classes ? `Class ${klass} standings` : 'Global standings'}
      sub={classes ? 'Ranked by rank points in this class' : 'Every driver, ranked by championship points'}
      right={classes && (
        <div class="hx-seg">{CLASS.map(c => <button key={c} data-on={c === klass} onClick={() => setKlass(c)}>{c}</button>)}</div>
      )}
    >
      {rows.length === 0 ? <Empty d={d} text="No drivers yet." /> : (
        <Table rows={rows} me={me} cols={[
          ['Points', r => n(r.points)], ['iRating', r => n(r.iRating)], ['Races', r => n(r.races ?? r.total_races)],
          ['Wins', r => n(r.wins)], ['Podiums', r => n(r.podiums)], ['Avg', r => (r.avg_position ? r.avg_position.toFixed(1) : '—')],
        ]} />
      )}
    </Page>
  )
}

interface Rec { track: string; car_class?: string | number; lap_time_ms?: number; player_name?: string; runner_up?: string; runner_up_ms?: number; entrants?: number }
function Records() {
  const d = useLb<Rec[]>('records', {}, [
    { track: 'Downtown Grand Prix', car_class: 2, lap_time_ms: 71204, player_name: 'SPiceZ', runner_up: 'ItzSteve', runner_up_ms: 71988, entrants: 9 },
    { track: 'Vinewood Loop', car_class: 2, lap_time_ms: 84102, player_name: 'Ghost', runner_up: 'SPiceZ', runner_up_ms: 84512, entrants: 6 },
  ])
  const rows = Array.isArray(d) ? d : []
  return (
    <Page title="Track records" sub="The fastest lap on every track, per class">
      {rows.length === 0 ? <Empty d={d} text="No records set yet." /> : (
        <table class="hx-table">
          <thead><tr><th>Track</th><th>Class</th><th>Record</th><th>Holder</th><th>Runner-up</th><th>Gap</th><th>Drivers</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td class="hx-strong">{r.track}</td>
                <td class="hx-num">{cls(r.car_class)}</td>
                <td class="hx-num">{lap(r.lap_time_ms)}</td>
                <td class="hx-num">{r.player_name || '—'}</td>
                <td class="hx-num hx-dimnum">{r.runner_up || '—'}</td>
                <td class="hx-num hx-dimnum">{r.runner_up_ms && r.lap_time_ms ? `+${((r.runner_up_ms - r.lap_time_ms) / 1000).toFixed(3)}` : '—'}</td>
                <td class="hx-num">{n(r.entrants)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  )
}

// ── Rivals ────────────────────────────────────────────────────────────────────
interface RivalBoard { rival?: { username?: string; rank?: string; i_rating?: number; level?: number } | null; tracks?: { track: string; my_ms?: number; rival_ms?: number; margin?: number; my_position?: number; drivers?: number }[]; wins?: number; losses?: number }
interface Duel { track?: string; challenger?: string; opponent?: string; stake?: number; outcome?: string; target_f?: string; result_f?: string; created_at?: string }
interface Act { title?: string; player?: string; action?: string; detail?: string; raced_at?: string }

export function Rivals({ sub }: { sub: string }) {
  if (sub === 'duels') return <Duels />
  if (sub === 'activity') return <Activity />
  return <RivalBoardView />
}

function RivalBoardView() {
  const d = useLb<RivalBoard>('rivals', {}, {
    rival: { username: 'ItzSteve', rank: 'A-2', i_rating: 1620, level: 18 }, wins: 3, losses: 1,
    tracks: [
      { track: 'Downtown Grand Prix', my_ms: 71204, rival_ms: 71988, margin: 784, my_position: 1, drivers: 9 },
      { track: 'Vinewood Loop', my_ms: 84512, rival_ms: 84102, margin: -410, my_position: 2, drivers: 6 },
    ],
  })
  const rv = d && !Array.isArray(d) ? d : null
  const tracks = rv?.tracks || []
  const wins = tracks.filter(t => (t.margin ?? 0) > 0).length
  const losses = tracks.filter(t => t.margin != null && t.margin < 0).length
  return (
    <Page
      title={rv?.rival ? `Rival: ${rv.rival.username}` : 'Rival'}
      sub={rv?.rival ? [rv.rival.rank, rv.rival.i_rating != null ? `${n(rv.rival.i_rating)} iR` : null, rv.rival.level != null ? `Level ${rv.rival.level}` : null].filter(Boolean).join(' · ') : 'Your closest match, track by track'}
      right={rv?.rival && <div class="hx-score"><b>{wins}</b><span>ahead</span><b>{losses}</b><span>behind</span></div>}
    >
      {!rv?.rival ? <Empty d={d} text="No rival yet: race a few tracks and one is picked for you." /> : (
        <table class="hx-table">
          <thead><tr><th>Track</th><th>You</th><th>Rival</th><th>Margin</th><th>Your place</th></tr></thead>
          <tbody>
            {tracks.map(t => (
              <tr key={t.track}>
                <td class="hx-strong">{t.track}</td>
                <td class="hx-num">{lap(t.my_ms)}</td>
                <td class="hx-num">{lap(t.rival_ms)}</td>
                <td class="hx-num" data-sign={t.margin == null ? '' : t.margin > 0 ? 'up' : 'down'}>{t.margin == null ? '—' : `${t.margin > 0 ? '-' : '+'}${(Math.abs(t.margin) / 1000).toFixed(3)}`}</td>
                <td class="hx-num">{t.my_position ? `${t.my_position} / ${t.drivers ?? '—'}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  )
}

function Duels() {
  const d = useLb<Duel[]>('duels', {}, [
    { track: 'Downtown Grand Prix', challenger: 'SPiceZ', opponent: 'ItzSteve', stake: 500, outcome: 'won', target_f: '1:11.988', result_f: '1:11.204', created_at: '2026-11-06' },
    { track: 'Vinewood Loop', challenger: 'Ghost', opponent: 'SPiceZ', stake: 250, outcome: 'lost', target_f: '1:24.512', result_f: '1:24.890', created_at: '2026-11-05' },
  ])
  const rows = Array.isArray(d) ? d : []
  return (
    <Page title="Ghost duels" sub="Challenges against a driver's best lap, for credits">
      {rows.length === 0 ? <Empty d={d} text="No duels yet: /duel <player> <track> <stake>." /> : (
        <table class="hx-table">
          <thead><tr><th>Track</th><th>Challenger</th><th>Against</th><th>Target</th><th>Result</th><th>Stake</th><th>Outcome</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td class="hx-strong">{r.track}</td>
                <td class="hx-num">{r.challenger}</td>
                <td class="hx-num hx-dimnum">{r.opponent}</td>
                <td class="hx-num">{r.target_f || '—'}</td>
                <td class="hx-num">{r.result_f || '—'}</td>
                <td class="hx-num">{n(r.stake)}</td>
                <td class="hx-num" data-sign={r.outcome === 'won' ? 'up' : r.outcome === 'lost' ? 'down' : ''}>{(r.outcome || '—').toUpperCase()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  )
}

function Activity() {
  const d = useLb<Act[]>('activity', {}, [
    { title: 'SPiceZ won Downtown Grand Prix', raced_at: '2026-11-06 21:04' },
    { title: 'Ghost podium on Vinewood Loop', raced_at: '2026-11-06 20:51' },
  ])
  const rows = Array.isArray(d) ? d : []
  return (
    <Page title="Server activity" sub="The latest results from every race">
      {rows.length === 0 ? <Empty d={d} text="Nothing yet." /> : (
        <table class="hx-table">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td class="hx-strong">{r.title || `${r.player} ${r.action} ${r.detail}`}</td>
                <td class="hx-num hx-dimnum">{String(r.raced_at || '').slice(0, 16)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  )
}

// ── Replays ───────────────────────────────────────────────────────────────────
interface Archive { race_id?: string | number; track?: string; track_type?: string; car_class?: string | number; laps?: number; player_count?: number; winner_name?: string; winner_time?: number; raced_at?: string; has_replay?: boolean }
export function Replays({ onWatch }: { onWatch: () => void }) {
  const d = useLb<Archive[]>('races', {}, [
    { race_id: 1042, track: 'Downtown Grand Prix', track_type: 'circuit', car_class: 'A', laps: 3, player_count: 6, winner_name: 'SPiceZ', winner_time: 214612, raced_at: '2026-11-06', has_replay: true },
    { race_id: 1041, track: 'Port Sprint', track_type: 'sprint', car_class: 'S', laps: 1, player_count: 4, winner_name: 'Ghost', winner_time: 98120, raced_at: '2026-11-06', has_replay: false },
  ])
  const rows = Array.isArray(d) ? d : []
  const watch = (id?: string | number) => {
    if (!id || !inGame) return
    post('lbWatchReplay', { raceId: id }, ownerOf('spz-leaderboard')).then(() => onWatch())
  }
  return (
    <Page title="Race archive" sub="Every race on the server; watch the ones with a replay">
      {rows.length === 0 ? <Empty d={d} text="No races yet." /> : (
        <table class="hx-table">
          <thead><tr><th>Track</th><th>Class</th><th>Laps</th><th>Drivers</th><th>Winner</th><th>Time</th><th>Date</th><th>Replay</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={String(r.race_id)}>
                <td class="hx-strong">{r.track}<span class="hx-dim hx-ml">{r.track_type === 'sprint' ? 'Sprint' : 'Circuit'}</span></td>
                <td class="hx-num">{cls(r.car_class)}</td>
                <td class="hx-num">{n(r.laps)}</td>
                <td class="hx-num">{n(r.player_count)}</td>
                <td class="hx-num">{r.winner_name || '—'}</td>
                <td class="hx-num">{lap(r.winner_time)}</td>
                <td class="hx-num hx-dimnum">{day(r.raced_at)}</td>
                <td class="hx-num">{r.has_replay ? <button class="hx-btn" onClick={() => watch(r.race_id)}>Watch</button> : <span class="hx-dimnum">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Page>
  )
}

// ── Speed records ─────────────────────────────────────────────────────────────
interface SpeedData { records?: { camera_id: string; speed_kmh?: number; vehicle_model?: string; updated_at?: string }[]; cameras?: { id: string; name: string; minSpeedKmh?: number }[] }
export function SpeedRecords() {
  const [d, setD] = useState<SpeedData | null>(inGame ? null : {
    records: [{ camera_id: 'c1', speed_kmh: 243, vehicle_model: 'zentorno', updated_at: '2026-11-06' }, { camera_id: 'c2', speed_kmh: 201, vehicle_model: 'elegy', updated_at: '2026-11-05' }],
    cameras: [{ id: 'c1', name: 'Route 68', minSpeedKmh: 112 }, { id: 'c2', name: 'Richman', minSpeedKmh: 112 }, { id: 'c3', name: 'Vespucci Blvd', minSpeedKmh: 104 }],
  })
  useEffect(() => { if (inGame) post<SpeedData>('hubSpeedRecords', {}, 'spz-races').then(r => setD(r || {})) }, [])
  const best: Record<string, { speed_kmh?: number; vehicle_model?: string; updated_at?: string }> = {}
  for (const r of d?.records || []) best[r.camera_id] = r
  const cams = [...(d?.cameras || [])].sort((a, b) => (best[b.id]?.speed_kmh || 0) - (best[a.id]?.speed_kmh || 0))
  const hit = cams.filter(c => best[c.id]).length
  return (
    <Page title="Speed records" sub="Your fastest pass through every speed camera" right={d && <div class="hx-score"><b>{hit}</b><span>of {cams.length} cameras</span></div>}>
      {cams.length === 0 ? <Empty d={d} text="No speed cameras on this server." /> : (
        <table class="hx-table">
          <thead><tr><th>Camera</th><th>Trigger</th><th>Your best</th><th>Car</th><th>Date</th></tr></thead>
          <tbody>
            {cams.map(c => {
              const b = best[c.id]
              return (
                <tr key={c.id}>
                  <td class="hx-strong">{c.name}</td>
                  <td class="hx-num hx-dimnum">{c.minSpeedKmh ? `${Math.round(c.minSpeedKmh)} km/h` : '—'}</td>
                  <td class="hx-num">{b?.speed_kmh ? `${Math.round(b.speed_kmh)} km/h` : '—'}</td>
                  <td class="hx-num hx-dimnum">{b?.vehicle_model ? b.vehicle_model.toUpperCase() : '—'}</td>
                  <td class="hx-num hx-dimnum">{b ? day(b.updated_at) : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
    </Page>
  )
}

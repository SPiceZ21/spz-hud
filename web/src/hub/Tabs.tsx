// Hub tabs, natively (they were the leaderboard tablet / speed camera screens
// squeezed into the hub): Standings, Rivals, Replays, Speed records. Each is a
// grid of tiles (the pause menu's layout) with the key number large on each.
// Data: the same callbacks those screens used (lbFetch on spz-races, and
// hubSpeedRecords on spz-races for the cameras). Styles: hx-* in hub.css.
import { useEffect, useState } from 'preact/hooks'
import type { ComponentChildren } from 'preact'
import { post, inGame } from '../core/nui'
import { ownerOf } from '../core/apps'
import { lap } from './Profile'
import { Tile } from './Tile'
import { RankBadge } from './RankBadge'

const n = (v?: number) => (v == null || Number.isNaN(v) ? '—' : Math.round(v).toLocaleString('en-US'))
const day = (s?: string) => (s ? String(s).slice(0, 10) : '—')
const CLASS = ['C', 'B', 'A', 'S']
const cls = (c?: string | number) => (typeof c === 'number' ? CLASS[c] ?? String(c) : c ?? '—')
const secs = (ms?: number) => (ms == null ? '—' : `${(Math.abs(ms) / 1000).toFixed(3)}`)

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

/** A tab page: a plain header (no plate around the page: the tiles are the plates). */
function Page({ title, sub, right, children }: { title: string; sub?: string; right?: ComponentChildren; children: ComponentChildren }) {
  return (
    <div class="hx-page hx-col">
      <header class="hx-pagehead">
        <div><h2 class="hx-title">{title}</h2>{sub && <div class="hx-label hx-mt">{sub}</div>}</div>
        {right}
      </header>
      <div class="hx-scroll">{children}</div>
    </div>
  )
}
const Empty = ({ d, text }: { d: unknown; text: string }) => <div class="hx-empty">{d === null ? 'Loading…' : text}</div>
const Grid = ({ min, children }: { min: number; children: ComponentChildren }) => (
  <div class="hx-tiles" style={{ '--tile': `${min}px` } as any}>{children}</div>
)

// ── Standings ─────────────────────────────────────────────────────────────────
interface Row { rank?: number; name?: string; rank_title?: string; points?: number; iRating?: number; races?: number; total_races?: number; wins?: number; podiums?: number; avg_position?: number }
const SAMPLE_ROWS: Row[] = [
  { rank: 1, name: 'SPiceZ', rank_title: 'S-1', points: 12500, iRating: 1840, races: 60, wins: 42, podiums: 51, avg_position: 1.6 },
  { rank: 2, name: 'ItzSteve', rank_title: 'A-2', points: 9800, iRating: 1620, races: 48, wins: 24, podiums: 35, avg_position: 2.4 },
  { rank: 3, name: 'Ghost', rank_title: 'A-4', points: 8100, iRating: 1510, races: 41, wins: 20, podiums: 28, avg_position: 2.9 },
  { rank: 4, name: 'Rens', rank_title: 'B-1', points: 6400, iRating: 1320, races: 33, wins: 11, podiums: 19, avg_position: 3.6 },
  { rank: 5, name: 'NIGHT_OWL', rank_title: 'B-3', points: 5100, iRating: 1260, races: 30, wins: 8, podiums: 14, avg_position: 4.1 },
  { rank: 6, name: 'REDLINE', rank_title: 'C-1', points: 3900, iRating: 1150, races: 22, wins: 3, podiums: 9, avg_position: 5.0 },
]

// One component per sub-tab: hooks must not change between renders.
export function Standings({ sub, me }: { sub: string; me?: string }) {
  if (sub === 'records') return <Records />
  return <StandingsGrid key={sub} classes={sub === 'classes'} me={me} />
}

function StandingsGrid({ classes, me }: { classes: boolean; me?: string }) {
  const [klass, setKlass] = useState('S')
  const d = useLb<Row[]>(classes ? 'classes' : 'standings', classes ? { class: klass } : {}, SAMPLE_ROWS, [klass])
  const rows = Array.isArray(d) ? d : []
  const top = rows.slice(0, 3)
  const rest = rows.slice(3)
  // Podium order: 2nd, 1st, 3rd.
  const podium = [top[1], top[0], top[2]].filter(Boolean) as Row[]
  return (
    <Page
      title={classes ? `Class ${klass} standings` : 'Global standings'}
      sub={classes ? 'Ranked by rank points in this class' : 'Every driver, ranked by championship points'}
      right={classes && <div class="hx-seg">{CLASS.map(c => <button key={c} data-on={c === klass} onClick={() => setKlass(c)}>{c}</button>)}</div>}
    >
      {rows.length === 0 ? <Empty d={d} text="No drivers yet." /> : (
        <>
          <div class="hx-podium">
            {podium.map(r => (
              <div key={r.name} class="hx-tile" data-p={r.rank} data-me={r.name === me}>
                <div class="hx-podium-top"><div class="hx-place">{r.rank}</div><RankBadge rank={r.rank_title} size={r.rank === 1 ? 104 : 84} /></div>
                <div class="hx-tile-t">{r.name}</div>
                <div class="hx-tile-s">{r.rank_title}</div>
                <div class="hx-tile-foot">
                  <div><span>Points</span> {n(r.points)}</div>
                  <div><span>iR</span> {n(r.iRating)}</div>
                  <div><span>Wins</span> {n(r.wins)}</div>
                </div>
              </div>
            ))}
          </div>
          <Grid min={270}>
            {rest.map(r => (
              <Tile key={r.name} me={r.name === me} k={`#${r.rank} · ${r.rank_title || ''}`} v={n(r.points)} t={r.name} s="points"
                foot={[['iR', n(r.iRating)], ['Wins', n(r.wins)], ['Avg', r.avg_position ? r.avg_position.toFixed(1) : '—']]}>
                <div class="hx-tile-badge"><RankBadge rank={r.rank_title} size={46} /></div>
              </Tile>
            ))}
          </Grid>
        </>
      )}
    </Page>
  )
}

interface Rec { track: string; car_class?: string | number; lap_time_ms?: number; player_name?: string; runner_up?: string; runner_up_ms?: number; entrants?: number }
function Records() {
  const d = useLb<Rec[]>('records', {}, [
    { track: 'Downtown Grand Prix', car_class: 2, lap_time_ms: 71204, player_name: 'SPiceZ', runner_up: 'ItzSteve', runner_up_ms: 71988, entrants: 9 },
    { track: 'Vinewood Loop', car_class: 2, lap_time_ms: 84102, player_name: 'Ghost', runner_up: 'SPiceZ', runner_up_ms: 84512, entrants: 6 },
    { track: '10-80', car_class: 1, lap_time_ms: 92311, player_name: 'SPiceZ', entrants: 4 },
  ])
  const rows = Array.isArray(d) ? d : []
  return (
    <Page title="Track records" sub="The fastest lap on every track, per class">
      {rows.length === 0 ? <Empty d={d} text="No records set yet." /> : (
        <Grid min={280}>
          {rows.map((r, i) => (
            <Tile key={i} k={`Class ${cls(r.car_class)}`} v={lap(r.lap_time_ms)} t={r.track} s={r.player_name || '—'}
              foot={[['Runner-up', r.runner_up ? `${r.runner_up} +${secs((r.runner_up_ms || 0) - (r.lap_time_ms || 0))}` : '—'], ['Drivers', n(r.entrants)]]} />
          ))}
        </Grid>
      )}
    </Page>
  )
}

// ── Rivals ────────────────────────────────────────────────────────────────────
interface RivalBoard { rival?: { username?: string; rank?: string; i_rating?: number; level?: number } | null; tracks?: { track: string; my_ms?: number; rival_ms?: number; margin?: number; my_position?: number; drivers?: number }[] }
interface Duel { track?: string; challenger?: string; opponent?: string; stake?: number; outcome?: string; target_f?: string; result_f?: string; created_at?: string }
interface Act { title?: string; player?: string; action?: string; detail?: string; raced_at?: string }

export function Rivals({ sub }: { sub: string }) {
  if (sub === 'duels') return <Duels />
  if (sub === 'activity') return <Activity />
  return <RivalBoardView />
}

function RivalBoardView() {
  const d = useLb<RivalBoard>('rivals', {}, {
    rival: { username: 'ItzSteve', rank: 'A-2', i_rating: 1620, level: 18 },
    tracks: [
      { track: 'Downtown Grand Prix', my_ms: 71204, rival_ms: 71988, margin: 784, my_position: 1, drivers: 9 },
      { track: 'Vinewood Loop', my_ms: 84512, rival_ms: 84102, margin: -410, my_position: 2, drivers: 6 },
      { track: '10-80', my_ms: 92311, rival_ms: 93020, margin: 709, my_position: 1, drivers: 4 },
    ],
  })
  const rv = d && !Array.isArray(d) ? d : null
  const tracks = rv?.tracks || []
  const ahead = tracks.filter(t => (t.margin ?? 0) > 0).length
  const behind = tracks.filter(t => t.margin != null && t.margin < 0).length
  return (
    <Page
      title={rv?.rival ? `Rival: ${rv.rival.username}` : 'Rival'}
      sub={rv?.rival ? [rv.rival.rank, rv.rival.i_rating != null ? `${n(rv.rival.i_rating)} iR` : null, rv.rival.level != null ? `Level ${rv.rival.level}` : null].filter(Boolean).join(' · ') : 'Your closest match, track by track'}
      right={rv?.rival && (
        <div class="hx-vs">
          <div class="hx-score"><b>{ahead}</b><span>ahead</span><b>{behind}</b><span>behind</span></div>
          <RankBadge rank={rv.rival.rank} size={72} />
        </div>
      )}
    >
      {!rv?.rival ? <Empty d={d} text="No rival yet: race a few tracks and one is picked for you." /> : (
        <Grid min={380}>
          {tracks.map(t => (
            <Tile key={t.track} k={t.margin == null ? 'No time yet' : t.margin > 0 ? 'Ahead by' : 'Behind by'}
              v={t.margin == null ? '—' : secs(t.margin)} sign={t.margin == null ? '' : t.margin > 0 ? 'up' : 'down'} t={t.track}
              foot={[['You', lap(t.my_ms)], ['Rival', lap(t.rival_ms)], ['Place', t.my_position ? `${t.my_position}/${t.drivers ?? '—'}` : '—']]} />
          ))}
        </Grid>
      )}
    </Page>
  )
}

function Duels() {
  const d = useLb<Duel[]>('duels', {}, [
    { track: 'Downtown Grand Prix', challenger: 'SPiceZ', opponent: 'ItzSteve', stake: 500, outcome: 'won', target_f: '1:11.988', result_f: '1:11.204' },
    { track: 'Vinewood Loop', challenger: 'Ghost', opponent: 'SPiceZ', stake: 250, outcome: 'lost', target_f: '1:24.512', result_f: '1:24.890' },
  ])
  const rows = Array.isArray(d) ? d : []
  return (
    <Page title="Ghost duels" sub="Challenges against a driver's best lap, for credits">
      {rows.length === 0 ? <Empty d={d} text="No duels yet: /duel <player> <track> <stake>." /> : (
        <Grid min={260}>
          {rows.map((r, i) => (
            <Tile key={i} k={`${n(r.stake)} credits`} v={(r.outcome || '—').toUpperCase()} sign={r.outcome === 'won' ? 'up' : r.outcome === 'lost' ? 'down' : ''}
              t={r.track} s={`${r.challenger} vs ${r.opponent}`} foot={[['Target', r.target_f || '—'], ['Result', r.result_f || '—']]} />
          ))}
        </Grid>
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
        <Grid min={300}>
          {rows.map((r, i) => (
            <Tile key={i} k={String(r.raced_at || '').slice(0, 16)} t={r.title || `${r.player} ${r.action} ${r.detail}`} />
          ))}
        </Grid>
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
        <Grid min={280}>
          {rows.map(r => (
            <Tile key={String(r.race_id)} k={`${day(r.raced_at)} · Class ${cls(r.car_class)}`} v={lap(r.winner_time)} t={r.track}
              s={`Won by ${r.winner_name || '—'}`}
              foot={[[r.track_type === 'sprint' ? 'Sprint' : 'Laps', r.track_type === 'sprint' ? '' : n(r.laps)], ['Drivers', n(r.player_count)]]}>
              {r.has_replay && <button class="hx-btn" onClick={() => watch(r.race_id)}>Watch replay</button>}
            </Tile>
          ))}
        </Grid>
      )}
    </Page>
  )
}

// ── Speed records ─────────────────────────────────────────────────────────────
interface SpeedData { plate?: string; records?: { camera_id: string; speed_kmh?: number; vehicle_model?: string; updated_at?: string }[]; cameras?: { id: string; name: string; minSpeedKmh?: number }[] }
export function SpeedRecords() {
  const [d, setD] = useState<SpeedData | null>(inGame ? null : {
    records: [{ camera_id: 'c1', speed_kmh: 243, vehicle_model: 'zentorno', updated_at: '2026-11-06' }, { camera_id: 'c2', speed_kmh: 201, vehicle_model: 'elegy', updated_at: '2026-11-05' }],
    plate: '46EEK572',
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
        <Grid min={380}>
          {cams.map(c => {
            const b = best[c.id]
            return (
              <Tile key={c.id} k={c.minSpeedKmh ? `Trigger ${Math.round(c.minSpeedKmh)} km/h` : 'Camera'}
                v={b?.speed_kmh ? <>{Math.round(b.speed_kmh)}<small class="hx-unit">km/h</small></> : '—'} accent={!!b} t={c.name}
                s={b ? undefined : 'Not passed yet'}
                foot={b ? [['Car', b.vehicle_model ? b.vehicle_model.toUpperCase() : '—'], ['Date', day(b.updated_at)]] : undefined}>
                {b && d?.plate && <div class="hx-plate-sa"><span>{d.plate}</span></div>}
              </Tile>
            )
          })}
        </Grid>
      )}
    </Page>
  )
}

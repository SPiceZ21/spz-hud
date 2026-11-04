// Achievements: milestones worked out from your career stats (the same data
// the leaderboard's profile tab shows: spz-leaderboard → spz-races
// getPlayerStats / getPlayerTrackSummary). No extra server data needed.
import { useEffect, useState } from 'preact/hooks'
import { post, inGame } from '../core/nui'
import type { HubProfile } from './Hub'

interface Stats {
  total_races?: number; wins?: number; podiums?: number; dnfs?: number
  avg_position?: number; total_points?: number; iRating?: number; sr?: number
  rank?: string; level?: number
}
interface MeData { stats?: Stats; tracks?: unknown[] }

interface Def { id: string; group: string; title: string; desc: string; value: (s: Stats, tracks: number) => number; goal: number }

const CLASS_ORDER = ['D', 'C', 'B', 'A', 'S']
const classOf = (rank?: string) => Math.max(0, CLASS_ORDER.indexOf(String(rank || 'D')[0]))

const DEFS: Def[] = [
  { id: 'race1', group: 'Racing', title: 'Green flag', desc: 'Finish your first race', value: s => s.total_races ?? 0, goal: 1 },
  { id: 'race25', group: 'Racing', title: 'Regular', desc: 'Race 25 times', value: s => s.total_races ?? 0, goal: 25 },
  { id: 'race100', group: 'Racing', title: 'Veteran', desc: 'Race 100 times', value: s => s.total_races ?? 0, goal: 100 },
  { id: 'race500', group: 'Racing', title: 'Lifer', desc: 'Race 500 times', value: s => s.total_races ?? 0, goal: 500 },
  { id: 'win1', group: 'Winning', title: 'First blood', desc: 'Win a race', value: s => s.wins ?? 0, goal: 1 },
  { id: 'win10', group: 'Winning', title: 'Contender', desc: 'Win 10 races', value: s => s.wins ?? 0, goal: 10 },
  { id: 'win50', group: 'Winning', title: 'Champion', desc: 'Win 50 races', value: s => s.wins ?? 0, goal: 50 },
  { id: 'pod25', group: 'Winning', title: 'Podium habit', desc: 'Finish on the podium 25 times', value: s => s.podiums ?? 0, goal: 25 },
  { id: 'ir1500', group: 'Skill', title: 'Quick', desc: 'Reach 1,500 iRating', value: s => s.iRating ?? 0, goal: 1500 },
  { id: 'ir2000', group: 'Skill', title: 'Fast', desc: 'Reach 2,000 iRating', value: s => s.iRating ?? 0, goal: 2000 },
  { id: 'ir2500', group: 'Skill', title: 'Alien', desc: 'Reach 2,500 iRating', value: s => s.iRating ?? 0, goal: 2500 },
  { id: 'sr4', group: 'Skill', title: 'Clean hands', desc: 'Hold a 4.00 safety rating', value: s => (s.sr ?? 0) * 100, goal: 400 },
  { id: 'classB', group: 'Rank', title: 'B licence', desc: 'Reach class B', value: s => classOf(s.rank), goal: 2 },
  { id: 'classA', group: 'Rank', title: 'A licence', desc: 'Reach class A', value: s => classOf(s.rank), goal: 3 },
  { id: 'classS', group: 'Rank', title: 'S licence', desc: 'Reach class S', value: s => classOf(s.rank), goal: 4 },
  { id: 'lvl25', group: 'Rank', title: 'Seasoned', desc: 'Reach level 25', value: s => s.level ?? 0, goal: 25 },
  { id: 'trk5', group: 'Explorer', title: 'Tourist', desc: 'Race on 5 different tracks', value: (_, t) => t, goal: 5 },
  { id: 'trk15', group: 'Explorer', title: 'Cartographer', desc: 'Race on 15 different tracks', value: (_, t) => t, goal: 15 },
]

/** "34 / 100", "3.42 / 4.00" for safety, "A / S" for licence class. */
function progress(id: string, v: number, goal: number) {
  if (id.startsWith('sr')) return `${(v / 100).toFixed(2)} / ${(goal / 100).toFixed(2)}`
  if (id.startsWith('class')) return `${CLASS_ORDER[v] ?? 'D'} / ${CLASS_ORDER[goal]}`
  return `${Math.floor(v).toLocaleString('en-US')} / ${goal.toLocaleString('en-US')}`
}

// Browser preview: a mid-career driver.
const SAMPLE: MeData = { stats: { total_races: 60, wins: 42, podiums: 51, iRating: 1840, sr: 3.42, rank: 'S-1', level: 24 }, tracks: new Array(9).fill(0) }

export function Achievements({ profile }: { profile: HubProfile }) {
  const [data, setData] = useState<MeData | null>(null)
  useEffect(() => {
    if (!inGame) { setData(SAMPLE); return }
    post<MeData>('lbFetch', { tab: 'me' }, 'spz-leaderboard').then(d => setData(d || {}))
  }, [])

  if (!data) return <div class="ach-empty">Loading…</div>
  const s = data.stats || {}
  const tracks = Array.isArray(data.tracks) ? data.tracks.length : 0
  const rows = DEFS.map(d => {
    const v = d.value(s, tracks)
    return { ...d, v, done: v >= d.goal, pct: Math.min(100, (v / d.goal) * 100) }
  })
  const done = rows.filter(r => r.done).length
  const groups = [...new Set(DEFS.map(d => d.group))]

  return (
    <div class="ach">
      <div class="ach-head">
        <div>
          <h2>Achievements</h2>
          <p>Milestones from your career{profile.name ? `, ${profile.name}` : ''}.</p>
        </div>
        <div class="ach-count"><b>{done}</b><span>/ {rows.length} unlocked</span></div>
      </div>
      {groups.map(g => (
        <section key={g} class="ach-group">
          <h3>{g}</h3>
          <div class="ach-grid">
            {rows.filter(r => r.group === g).map(r => (
              <div key={r.id} class="ach-card" data-done={r.done}>
                <div class="ach-title">{r.title}</div>
                <div class="ach-desc">{r.desc}</div>
                <div class="ach-bar"><i style={{ width: `${r.pct}%` }} /></div>
                <div class="ach-prog">{r.done ? 'Unlocked' : progress(r.id, r.v, r.goal)}</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

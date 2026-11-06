// Hub › Profile, native (it used to be the leaderboard tablet's "me" tab).
// Data: the same callback the tablet used — lbFetch { tab: 'me' } on spz-races
// (stats, recent history, per-track totals).
import { useEffect, useState } from 'preact/hooks'
import { post, inGame } from '../core/nui'
import { ownerOf } from '../core/apps'
import type { HubProfile } from './Hub'

interface Stats {
  total_races?: number; wins?: number; podiums?: number; dnfs?: number
  win_rate?: number; podium_rate?: number; dnf_rate?: number; avg_position?: number
  total_points?: number; total_xp?: number; iRating?: number; sr?: number; rank?: string; level?: number
}
interface Race { track: string; car_class?: string | number; position?: number; finish_time?: number; best_lap?: number; points_earned?: number; personal_best?: number | boolean; dnf?: number | boolean; created_at?: string }
interface Track { track: string; races?: number; wins?: number; podiums?: number; best_lap_ms?: number; points?: number }
interface Me { stats?: Stats; history?: Race[]; tracks?: Track[] }

const n = (v?: number) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'))
const pct = (v?: number) => (v == null ? '—' : `${Math.round(v * 100)}%`)
export const lap = (ms?: number) => {
  if (!ms || ms <= 0) return '—'
  const m = Math.floor(ms / 60000), s = (ms % 60000) / 1000
  return `${m}:${s.toFixed(3).padStart(6, '0')}`
}
const CLASS = ['C', 'B', 'A', 'S']
const cls = (c?: string | number) => (typeof c === 'number' ? CLASS[c] ?? c : c ?? '—')
const place = (r: Race) => (r.dnf ? 'DNF' : r.position ? `P${r.position}` : '—')

// Browser preview: a mid-career driver.
const SAMPLE: Me = {
  stats: { total_races: 60, wins: 42, podiums: 51, dnfs: 3, win_rate: 0.7, podium_rate: 0.85, dnf_rate: 0.05, avg_position: 1.6, total_points: 12500, total_xp: 48200, iRating: 1840, sr: 3.42, rank: 'S-1', level: 24 },
  history: [
    { track: 'Downtown Grand Prix', car_class: 2, position: 1, best_lap: 71204, points_earned: 120, personal_best: 1, created_at: '2026-11-06' },
    { track: 'Vinewood Loop', car_class: 2, position: 3, best_lap: 84512, points_earned: 60, created_at: '2026-11-06' },
    { track: 'Port Sprint', car_class: 3, position: 1, best_lap: 0, points_earned: 120, created_at: '2026-11-05' },
    { track: 'Del Perro Circuit', car_class: 2, dnf: 1, best_lap: 69880, points_earned: 0, created_at: '2026-11-05' },
    { track: '10-80', car_class: 1, position: 2, best_lap: 92311, points_earned: 90, created_at: '2026-11-04' },
  ],
  tracks: [
    { track: 'Downtown Grand Prix', races: 14, wins: 11, best_lap_ms: 71204 },
    { track: 'Vinewood Loop', races: 9, wins: 5, best_lap_ms: 84102 },
    { track: '10-80', races: 8, wins: 6, best_lap_ms: 92311 },
    { track: 'Del Perro Circuit', races: 6, wins: 4, best_lap_ms: 69880 },
  ],
}

export function Profile({ profile }: { profile: HubProfile }) {
  const [me, setMe] = useState<Me | null>(inGame ? null : SAMPLE)
  useEffect(() => {
    if (!inGame) return
    post<Me>('lbFetch', { tab: 'me' }, ownerOf('spz-leaderboard')).then(d => setMe(d || {}))
  }, [])

  const s = me?.stats || {}
  const tracks = [...(me?.tracks || [])].sort((a, b) => (b.races || 0) - (a.races || 0)).slice(0, 6)
  const history = (me?.history || []).slice(0, 8)

  return (
    <div class="hx-page hp">
      <section class="hx-plate hp-id">
        {profile.avatar ? <img class="hp-avatar" src={profile.avatar} alt="" /> : <div class="hp-avatar" />}
        <h2 class="hx-title">{profile.name || 'Driver'}</h2>
        <div class="hx-label">{[s.rank || profile.rank, profile.crew].filter(Boolean).join(' · ') || 'Racer'}</div>
        <dl class="hx-rows">
          <div><dt>iRating</dt><dd>{n(s.iRating ?? profile.rating)}</dd></div>
          <div><dt>Safety rating</dt><dd>{s.sr != null ? s.sr.toFixed(2) : '—'}</dd></div>
          <div><dt>Level</dt><dd>{n(s.level ?? profile.level)}</dd></div>
          <div><dt>Total XP</dt><dd>{n(s.total_xp)}</dd></div>
          <div><dt>Credits</dt><dd>{n(profile.credits)}</dd></div>
        </dl>
      </section>

      <div class="hp-main">
        <section class="hx-plate hp-figs">
          {[
            ['Races', n(s.total_races)], ['Wins', n(s.wins)], ['Podiums', n(s.podiums)],
            ['Win rate', pct(s.win_rate)], ['Avg finish', s.avg_position ? s.avg_position.toFixed(1) : '—'], ['DNF rate', pct(s.dnf_rate)],
          ].map(([l, v]) => <div key={l} class="hx-fig"><b>{v}</b><span>{l}</span></div>)}
        </section>

        <div class="hp-lists">
          <section class="hx-plate">
            <h3 class="hx-head">Recent races</h3>
            {!me ? <div class="hx-empty">Loading…</div> : history.length === 0 ? <div class="hx-empty">No races yet.</div> : (
              <table class="hx-table">
                <tbody>
                  {history.map((r, i) => (
                    <tr key={i}>
                      <td class="hx-pos" data-p={r.dnf ? 'dnf' : r.position}>{place(r)}</td>
                      <td class="hx-strong">{r.track}{(r.personal_best === 1 || r.personal_best === true) && <span class="hx-tag">PB</span>}</td>
                      <td class="hx-dim">Class {cls(r.car_class)}</td>
                      <td class="hx-num">{lap(r.best_lap)}</td>
                      <td class="hx-num">+{n(r.points_earned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section class="hx-plate">
            <h3 class="hx-head">Your tracks</h3>
            {!me ? <div class="hx-empty">Loading…</div> : tracks.length === 0 ? <div class="hx-empty">No tracks yet.</div> : (
              <table class="hx-table">
                <thead><tr><th>Track</th><th>Races</th><th>Wins</th><th>Best lap</th></tr></thead>
                <tbody>
                  {tracks.map(t => (
                    <tr key={t.track}>
                      <td class="hx-strong">{t.track}</td>
                      <td class="hx-num">{n(t.races)}</td>
                      <td class="hx-num">{n(t.wins)}</td>
                      <td class="hx-num">{lap(t.best_lap_ms)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

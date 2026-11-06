// Hub › Profile, native (it used to be the leaderboard tablet's "me" tab).
// Data: the same callback the tablet used — lbFetch { tab: 'me' } on spz-races
// (stats, recent history, per-track totals).
import { useEffect, useState } from 'preact/hooks'
import { post, inGame } from '../core/nui'
import { ownerOf } from '../core/apps'
import type { HubProfile } from './Hub'
import { Tile } from './Tile'
import { RankBadge } from './RankBadge'

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

  // Bento: one grid, tiles of different sizes (identity and iRating large,
  // the counts small, the two lists wide).
  return (
    <div class="hx-page hx-col">
      <div class="hx-scroll">
        <div class="bento">
          <div class="hx-tile b-id">
            <div class="b-id-top">
              {profile.avatar ? <img class="b-avatar" src={profile.avatar} alt="" /> : <div class="b-avatar" />}
              <RankBadge rank={s.rank || profile.rank} size={128} />
            </div>
            <div class="b-name">{profile.name || 'Driver'}</div>
            <div class="hx-tile-k">{[s.rank || profile.rank, profile.crew].filter(Boolean).join(' · ') || 'Racer'}</div>
          </div>
          <div class="hx-tile b-ir">
            <div class="hx-tile-k">iRating</div>
            <div class="b-big">{n(s.iRating ?? profile.rating)}</div>
            <div class="hx-tile-s">Skill rating from every race you finish</div>
          </div>
          <Tile k="Safety" v={s.sr != null ? s.sr.toFixed(2) : '—'} />
          <Tile k="Level" v={n(s.level ?? profile.level)} s={`${n(s.total_xp)} XP`} />
          <Tile k="Races" v={n(s.total_races)} s={`${pct(s.dnf_rate)} DNF`} />
          <Tile k="Wins" v={n(s.wins)} s={`${pct(s.win_rate)} win rate`} />
          <Tile k="Podiums" v={n(s.podiums)} s={`Avg finish ${s.avg_position ? s.avg_position.toFixed(1) : '—'}`} />
          <Tile k="Credits" v={n(profile.credits)} />

          <div class="hx-tile b-races">
            <div class="hx-tile-k">Recent races</div>
            {!me ? <div class="hx-empty">Loading…</div> : history.length === 0 ? <div class="hx-empty">No races yet.</div> : (
              <div class="b-list">
                {history.map((r, i) => (
                  <div key={i} class="b-row">
                    <span class="b-pos" data-p={r.dnf ? 'dnf' : r.position}>{place(r)}</span>
                    <span class="b-track">{r.track}{(r.personal_best === 1 || r.personal_best === true) && <span class="hx-tag">PB</span>}</span>
                    <span class="b-dim">Class {cls(r.car_class)}</span>
                    <span class="b-num">{lap(r.best_lap)}</span>
                    <span class="b-num">+{n(r.points_earned)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div class="hx-tile b-tracks">
            <div class="hx-tile-k">Your tracks</div>
            {!me ? <div class="hx-empty">Loading…</div> : tracks.length === 0 ? <div class="hx-empty">No tracks yet.</div> : (
              <div class="b-list">
                {tracks.map(t => (
                  <div key={t.track} class="b-row">
                    <span class="b-track">{t.track}</span>
                    <span class="b-dim">{n(t.races)} races</span>
                    <span class="b-num">{lap(t.best_lap_ms)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

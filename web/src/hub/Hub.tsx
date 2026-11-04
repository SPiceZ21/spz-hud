// The SPiceZ hub (TAB): one full-screen place for profile, standings, rivals,
// replays, speed records, crew and achievements.
//
// Layers, bottom to top:
//   backdrop (z 900)  hides the game and every other UI layer
//   the section's app (z 1000: it holds focus, so the app host raises it)
//   chrome (z 1500)   top bar, section tabs (Q / E), sub-tabs, key strip
//
// A section is an existing screen opened through its own command (client/hub.lua)
// and laid into the content area by its hub-mode design rules; achievements are
// drawn here. Q / E change section, TAB or ESC close: caught in this page and
// inside the open app's window, so the keys work whichever has focus.
import { useEffect, useRef, useState } from 'preact/hooks'
import { post, inGame } from '../core/nui'
import { appWindow, reloadApp, setHubMode, toApp } from '../core/apps'
import { Achievements } from './Achievements'
import './hub.css'

type AppRes = 'spz-leaderboard' | 'spz-crew' | 'spz-speedcam'

interface Section {
  id: string
  label: string
  app?: AppRes
  cmd?: string                       // the resource's own open command
  tab?: string                       // leaderboard tab
  tabs?: [string, string][]          // leaderboard sub-tabs [tab, label]
}

const SECTIONS: Section[] = [
  { id: 'profile', label: 'Profile', app: 'spz-leaderboard', cmd: 'leaderboard', tab: 'me' },
  { id: 'standings', label: 'Standings', app: 'spz-leaderboard', cmd: 'leaderboard',
    tabs: [['standings', 'Global'], ['classes', 'Classes'], ['records', 'Track records']] },
  { id: 'rivals', label: 'Rivals', app: 'spz-leaderboard', cmd: 'leaderboard',
    tabs: [['rivals', 'Rivals'], ['duels', 'Duels'], ['activity', 'Activity']] },
  { id: 'replays', label: 'Replays', app: 'spz-leaderboard', cmd: 'leaderboard', tab: 'races' },
  { id: 'speed', label: 'Speed records', app: 'spz-speedcam', cmd: 'speedrecords' },
  { id: 'crew', label: 'Crew', app: 'spz-crew', cmd: 'crew' },
  { id: 'achievements', label: 'Achievements' },
]
const HUB_APPS: AppRes[] = ['spz-leaderboard', 'spz-crew', 'spz-speedcam']

// Browser preview only: speed records as spz-speedcam's Lua would send them.
const SAMPLE_CAMS = [
  { id: 'speedcam_vespucci_bvd', name: 'Vespucci Blvd' }, { id: 'speedcam_richman', name: 'Richman' },
  { id: 'speedcam_route68', name: 'Route 68' }, { id: 'speedcam_del_perro', name: 'Del Perro Fwy' },
]
const SAMPLE_RECORDS = [
  { camera_id: 'speedcam_vespucci_bvd', speed_kmh: 168, updated_at: '2026-11-02' },
  { camera_id: 'speedcam_richman', speed_kmh: 201, updated_at: '2026-11-01' },
  { camera_id: 'speedcam_route68', speed_kmh: 243, updated_at: '2026-10-30' },
]

export interface HubProfile {
  name?: string; avatar?: string; rank?: string; level?: number
  credits?: number; crew?: string; rating?: number
}

const fmt = (n?: number) => (n == null ? '—' : Math.round(n).toLocaleString('en-US'))

/** Close a section's app through its own close callback (releases its focus). */
function closeApp(res: AppRes) {
  setHubMode(res, false)
  if (res === 'spz-leaderboard') { toApp(res, { action: 'close' }); if (inGame) post('lbClose', {}, res) }
  if (res === 'spz-crew') { toApp(res, { action: 'hide' }); if (inGame) post('close', {}, res) }
  if (res === 'spz-speedcam') { toApp(res, { type: 'closeRecords' }); if (inGame) post('closeRecords', {}, res) }
}

export function Hub({ open, profile }: { open: boolean; profile: HubProfile }) {
  const [idx, setIdx] = useState(0)
  const [sub, setSub] = useState(0)
  const current = useRef<AppRes | null>(null)
  const mocked = useRef<Set<string>>(new Set())
  const idxRef = useRef(idx)
  idxRef.current = idx
  const section = SECTIONS[idx]

  const close = () => {
    if (current.current) closeApp(current.current)
    current.current = null
    if (inGame) post('hubClose')
    else window.postMessage({ type: 'hub', on: false }, '*')
  }

  // Open the section's app (or nothing, for achievements) and lay it in.
  useEffect(() => {
    if (!open) return
    const s = SECTIONS[idx]
    const prev = current.current
    if (prev && prev !== s.app) closeApp(prev)
    current.current = s.app ?? null
    if (!s.app) return

    const res = s.app
    const tab = s.tabs ? s.tabs[sub]?.[0] : s.tab
    const fresh = prev !== res
    const show = () => {
      setHubMode(res, true, !!s.tabs)
      if (res === 'spz-leaderboard' && tab) toApp(res, { action: 'open', tab, player: profile.name })
      // Browser preview: no Lua to answer the records request.
      if (res === 'spz-speedcam' && !inGame) {
        toApp(res, { type: 'openRecords' })
        toApp(res, { type: 'records', records: SAMPLE_RECORDS, cameraList: SAMPLE_CAMS })
      }
    }
    let wait: ReturnType<typeof setTimeout>
    if (inGame) {
      if (fresh) post('hubCommand', { cmd: s.cmd })
      wait = setTimeout(show, fresh ? 200 : 0)
    } else {
      // Browser preview: the apps' own mock modes stand in for their Lua.
      if (!mocked.current.has(res)) { mocked.current.add(res); reloadApp(res, true) }
      window.postMessage({ type: 'focus', owner: res }, '*')
      wait = setTimeout(show, fresh ? 1200 : 0)
    }
    // A page that reloads drops data-hub; keep it on while this section is up.
    const keep = setInterval(() => setHubMode(res, true, !!s.tabs), 500)
    // Switching on before the open has landed must cancel it, or the old
    // section's open arrives after the new one and wins.
    return () => { clearTimeout(wait); clearInterval(keep) }
  }, [open, idx, sub])

  // Closing from Lua (TAB pressed while the game had the keys) or from here.
  useEffect(() => {
    if (open) return
    if (current.current) { closeApp(current.current); current.current = null }
    if (!inGame) window.postMessage({ type: 'focus', owner: null }, '*')
  }, [open])

  useEffect(() => { setSub(0) }, [idx])

  // Keys, in this page and inside every hub app's window.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (e.key === 'Tab' || e.key === 'Escape') {
        e.preventDefault(); e.stopPropagation(); close(); return
      }
      if (typing) return
      if (e.key === 'q' || e.key === 'Q') { e.preventDefault(); setIdx(i => (i + SECTIONS.length - 1) % SECTIONS.length) }
      if (e.key === 'e' || e.key === 'E') { e.preventDefault(); setIdx(i => (i + 1) % SECTIONS.length) }
    }
    const wins: Window[] = [window]
    window.addEventListener('keydown', onKey, true)
    const attach = () => {
      for (const res of HUB_APPS) {
        const w = appWindow(res)
        if (w && !wins.includes(w)) { w.addEventListener('keydown', onKey, true); wins.push(w) }
      }
    }
    attach()
    const re = setInterval(attach, 600)                 // app pages that (re)load later
    return () => {
      clearInterval(re)
      for (const w of wins) { try { w.removeEventListener('keydown', onKey, true) } catch { /* gone */ } }
    }
  }, [open])

  if (!open) return null
  return (
    <>
      <div class="hub-backdrop" />
      <div class="hub-chrome">
        <header class="hub-top">
          <img class="hub-logo" src="./apps/spz-spawn/logo.png" alt="SPiceZ" />
          <div class="hub-me">
            {profile.avatar && <img class="hub-avatar" src={profile.avatar} alt="" onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />}
            <div class="hub-me-text">
              <span class="hub-name">{profile.name || 'Driver'}</span>
              <span class="hub-sub">{[profile.rank, profile.level != null ? `Level ${profile.level}` : null, profile.crew].filter(Boolean).join(' · ')}</span>
            </div>
            <div class="hub-stat"><b>{fmt(profile.rating)}</b><span>iRating</span></div>
            <div class="hub-stat"><b>{fmt(profile.credits)}</b><span>Credits</span></div>
          </div>
        </header>

        <nav class="hub-nav">
          <button class="hub-qe" onClick={() => setIdx(i => (i + SECTIONS.length - 1) % SECTIONS.length)}><kbd>Q</kbd></button>
          {SECTIONS.map((s, i) => (
            <button key={s.id} class="hub-item" data-on={i === idx} onClick={() => setIdx(i)}>{s.label}</button>
          ))}
          <button class="hub-qe" onClick={() => setIdx(i => (i + 1) % SECTIONS.length)}><kbd>E</kbd></button>
        </nav>

        {section.tabs && (
          <div class="hub-subtabs">
            {section.tabs.map(([, label], i) => (
              <button key={label} data-on={i === sub} onClick={() => setSub(i)}>{label}</button>
            ))}
          </div>
        )}

        {!section.app && (
          <main class="hub-content" data-sub={!!section.tabs}>
            <Achievements profile={profile} />
          </main>
        )}

        <footer class="hub-keys">
          <span><kbd>TAB</kbd><kbd>ESC</kbd> Close</span>
        </footer>
      </div>
    </>
  )
}

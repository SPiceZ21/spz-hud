import { useState, useEffect, useRef } from 'preact/hooks'
import { Clock, MapPin } from 'lucide-preact'
import { CharacterCreation } from './CharacterCreation'
import { Cover, COVER_EXIT_MS } from './Cover'
import { Cursor } from './components/Cursor'
import './styles/spawn.css'

interface SpawnPoint {
  label: string
}

interface PlayerData {
  name?: string
  avatar?: string
  licenseClass?: string
  crew?: string
  playtime?: number
  stateText?: string
}

function formatPlaytime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${String(hrs).padStart(2, '0')} HRS ${String(mins).padStart(2, '0')} MINS`
}

// Base theme (server.cfg spz_theme_* convars, pushed from spz-core) mapped
// onto this page's own CSS variable names (theme.css). Unknown/missing keys
// are a no-op since the stylesheet's own defaults still apply.
const THEME_VARS: Record<string, string> = {
  accent: '--color-primary',
  accent2: '--color-secondary',
  bg: '--bg-app',
  bg2: '--bg-card',
}
// rgba(...) glows/tints reference the accent as raw components so they can
// carry their own alpha — keep those in sync too.
const THEME_RGB_VARS: Record<string, string> = { accent: '--color-primary-rgb' }
function hexToRgbTriplet(hex?: string): string | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || '')
  return m ? `${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}` : null
}
function applyTheme(theme?: Record<string, string>) {
  if (!theme) return
  for (const key in THEME_VARS) {
    if (theme[key]) document.documentElement.style.setProperty(THEME_VARS[key], theme[key])
  }
  for (const key in THEME_RGB_VARS) {
    const rgb = theme[key] && hexToRgbTriplet(theme[key])
    if (rgb) document.documentElement.style.setProperty(THEME_RGB_VARS[key], rgb)
  }
}

export function App() {
  const [view, setView] = useState<'none' | 'spawn' | 'creation'>('none')
  // The spawn view is two screens: a welcome, then the showcase where the
  // destination is picked. Enter (or a click) moves on; Backspace goes back.
  const [stage, setStage] = useState<'welcome' | 'showcase'>('welcome')
  const [player, setPlayer] = useState<PlayerData>({})
  const [spawns, setSpawns] = useState<SpawnPoint[]>([])
  const [selected, setSelected] = useState(0)
  const [creationError, setCreationError] = useState<string | null>(null)
  const [cover, setCover] = useState(false)
  const [coverFading, setCoverFading] = useState(false)
  // Set the moment Spawn is pressed and cleared when the menu is next shown, so
  // a second press cannot fire a second spawn while the fade is running.
  const [committing, setCommitting] = useState(false)

  // The cover's unmount is a timer, so it has to be cancellable: a `showCover`
  // arriving while one is pending would otherwise be torn down mid-life by the
  // previous exit finishing, and the screen it was put up to hide would be on
  // display. Held in a ref rather than state — nothing renders from it.
  const coverExit = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data.type === 'show') {
        setPlayer(e.data.playerData || {})
        setSpawns(e.data.spawns || [])
        setSelected(0)
        setCommitting(false)
        setStage('welcome')
        setView('spawn')
      } else if (e.data.type === 'showCharacterCreation') {
        setCreationError(null)
        setView('creation')
      } else if (e.data.type === 'characterCreationError') {
        setCreationError(e.data.message || 'An error occurred.')
      } else if (e.data.type === 'hide') {
        setView('none')
      } else if (e.data.type === 'showCover') {
        if (coverExit.current) {
          clearTimeout(coverExit.current)
          coverExit.current = null
        }
        setCoverFading(false)
        setCover(true)
      } else if (e.data.type === 'hideCover') {
        // Run the sliced sweep, then unmount so the menu underneath is
        // revealed. COVER_EXIT_MS is owned by Cover.tsx — the panel stagger
        // decides how long this takes, so unmounting on a number typed in here
        // would cut the last panel off mid-sweep the first time anyone retimed
        // the animation.
        setCoverFading(true)
        if (coverExit.current) clearTimeout(coverExit.current)
        coverExit.current = setTimeout(() => {
          coverExit.current = null
          setCover(false)
        }, COVER_EXIT_MS)
      } else if (e.data.type === 'theme') {
        applyTheme(e.data.theme)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const move = (delta: number) => {
    const len = Math.max(1, spawns.length)
    setSelected(i => (i + delta + len) % len)
  }

  useEffect(() => {
    if (view !== 'spawn') return

    const onKey = (e: KeyboardEvent) => {
      if (stage === 'welcome') {
        if (e.key === 'Enter' || e.key === ' ') setStage('showcase')
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'd') move(1)
      else if (e.key === 'ArrowLeft' || e.key === 'a') move(-1)
      else if (e.key === 'Enter') doStart()
      else if (e.key === 'Backspace' && !committing) setStage('welcome')
    }

    // Wheel cycles the destination on the showcase. On `window`: the root is
    // pointer-events: none so the shot stays visible and un-grabbed, and such an
    // element gets no wheel events. Rate-limited: a trackpad flick is dozens of
    // events and would otherwise spin through the whole list.
    let lastWheel = 0
    const onWheel = (e: WheelEvent) => {
      if (stage !== 'showcase') return
      const now = performance.now()
      if (now - lastWheel < 180) return
      lastWheel = now
      move(e.deltaY > 0 || e.deltaX > 0 ? 1 : -1)
    }

    window.addEventListener('keydown', onKey)
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('wheel', onWheel)
    }
  }, [view, stage, spawns, selected, committing])

  /*
   * Commit, but do NOT tear the menu down here.
   *
   * Hiding it on click dropped the player straight onto the raw camera shot for
   * the half second before the screen faded — menu gone, world visible, then
   * black. Lua fades out FIRST and sends `hide` on the other side of it, so the
   * menu is only ever removed behind a black screen. All this does is stop the
   * button being pressed twice while that plays out.
   */
  const doStart = () => {
    if (committing) return
    setCommitting(true)
    fetch(`https://${GetParentResourceName()}/startSpawn`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ index: selected + 1 }),
    }).catch(() => {})
  }

  const licenseClass = player.licenseClass || 'D'
  const name = player.name || 'Racer'

  return (
    <>
      {cover && <Cover fading={coverFading} />}

      {/* Mounted for both menus, not just the spawn screen. The two are one
          flow — creation hands straight over to spawn — and a pointer that
          changes identity halfway through it reads as two different products.
          It is suppressed while the cover is up and not yet leaving, where
          there is nothing to point at. */}
      <Cursor active={view !== 'none' && (!cover || coverFading)} />

      {view === 'creation' && (
        <CharacterCreation serverError={creationError} onClearError={() => setCreationError(null)} />
      )}

      {view === 'spawn' && (
        <div class="sp-root" data-stage={stage}>
          <div class="sp-shade" />

          {/* ── 1. Welcome ── */}
          <div class="sp-welcome" onClick={() => setStage('showcase')} data-cursor-label="Continue">
            <img class="sp-logo" src="logo.png" alt="" />
            <div class="sp-hello">Hello, <span>{name}</span></div>
            <div class="sp-prompt">Press <kbd>Enter</kbd> to continue</div>
          </div>

          {/* ── 2. Showcase ──
              Driver bottom-left, the locations as a numbered list of buttons on
              the right (index, name, a thin bar each: the old spawn menu's
              track), Spawn bottom-right. The look is the TAB hub's: italic
              uppercase, hairlines, a white plate for the action. */}
          <div class="sp-show sx">
            <div class="sx-driver">
              {player.avatar && <img class="sx-avatar" src={player.avatar} alt="" />}
              <div class="sx-driver-text">
                <div class="sx-state"><i />{player.stateText || 'Idle'}<span>·</span><Clock size={11} />{formatPlaytime(player.playtime || 0)}</div>
                <div class="sx-name">{name}</div>
                <div class="sx-chips">
                  <span>{licenseClass} Class</span>
                  {player.crew && <span>{player.crew}</span>}
                </div>
              </div>
            </div>

            <nav class="sx-list" aria-label="Spawn location">
              <div class="sx-list-head">Deployment zone<span>{String(selected + 1).padStart(2, '0')} / {String(Math.max(spawns.length, 1)).padStart(2, '0')}</span></div>
              {spawns.map((s, i) => (
                <button
                  key={i}
                  class="sx-loc"
                  data-on={i === selected}
                  onClick={() => (i === selected ? doStart() : setSelected(i))}
                  data-cursor-label={i === selected ? 'Deploy' : s.label}
                >
                  <span class="sx-idx">{String(i + 1).padStart(2, '0')}</span>
                  <span class="sx-loc-name">{s.label}</span>
                  <i class="sx-bar" />
                </button>
              ))}
            </nav>

            <div class="sx-commit">
              <div class="sx-keys"><kbd>A</kbd><kbd>D</kbd> Location <kbd>Enter</kbd> Spawn <kbd>Bksp</kbd> Back</div>
              <button class="sx-go" onClick={doStart} disabled={committing} data-cursor-label={committing ? '' : 'Deploy'}>
                {committing ? 'Spawning' : 'Spawn'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

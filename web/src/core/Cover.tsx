// The SPiceZ transition cover: one full-screen wipe for every hand-off —
// loading → spawn, spawn → world, joining a race, the grid reset before the
// lights, leaving a race, and any teleport through spz-core's FadeOut / FadeIn.
//
// It is the spawn screen's cover (eight textured slices, logo, status, shuttle
// bar), with the close added: the slices slide in from alternating sides, then
// sweep apart the same way to open. Driven by:
//   { type: 'cover', on: true,  status?: 'Joining the grid' }   close
//   { type: 'cover', on: false }                                  open
// and by the spawn and race pages' own cover messages (App.tsx), whose built-in
// covers are switched off in their design rules.
import { useEffect, useRef, useState } from 'preact/hooks'
import './cover.css'

const SLICES = 8
export const COVER_CLOSE_MS = 520 + (SLICES - 1) * 40   // keep in step with cover.css
const OPEN_MS = 880 + (SLICES - 1) * 55

type Phase = 'off' | 'closing' | 'closed' | 'opening'

export function Cover({ on, status }: { on: boolean; status?: string }) {
  const [phase, setPhase] = useState<Phase>('off')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clear = () => { if (timer.current) clearTimeout(timer.current); timer.current = null }

  useEffect(() => {
    clear()
    if (on) {
      if (phase === 'closed' || phase === 'closing') return
      // Two frames at the open position so the slide-in actually transitions.
      setPhase('closing')
      timer.current = setTimeout(() => setPhase('closed'), COVER_CLOSE_MS)
    } else {
      if (phase === 'off' || phase === 'opening') return
      setPhase('opening')
      timer.current = setTimeout(() => setPhase('off'), OPEN_MS + 60)
    }
    return clear
  }, [on])

  if (phase === 'off') return null
  return (
    <div class="cover" data-phase={phase}>
      <div class="cover-stage">
        {Array.from({ length: SLICES }, (_, i) => (
          <div
            key={i}
            class="cover-slice"
            style={{
              '--i': i,
              '--bgy': `calc(${-i} * (100vh / ${SLICES}))`,
              '--dir': i % 2 === 0 ? -1 : 1,
              '--in': `${i * 40}ms`,
              '--out': `${i * 55}ms`,
            } as any}
          />
        ))}
        <div class="cover-aurora" />
        <div class="cover-grain" />
        <div class="cover-vign" />
      </div>
      <div class="cover-content">
        <div class="cover-frame" aria-hidden="true"><i class="tl" /><i class="tr" /><i class="bl" /><i class="br" /></div>
        <div class="cover-center">
          <img class="cover-logo" src="./apps/spz-spawn/logo.png" alt="SPiceZ" />
          <div class="cover-rule" />
          <div class="cover-status"><span class="cover-pip" />{status || 'Loading'}</div>
          <div class="cover-bar"><span /></div>
        </div>
        <div class="cover-foot"><span class="cover-foot-mark">SPiceZ-Core</span><span class="cover-foot-dot" /><span>Open-Source Racing Core</span></div>
      </div>
    </div>
  )
}

/** The cover's closed surface on its own (texture, glow, grain, vignette, corner
 *  frame): the spawn screen's backdrop, reused behind the hub. */
export function CoverSurface() {
  return (
    <div class="cover-surface" aria-hidden="true">
      <div class="cover-slice" style={{ '--i': 0, '--bgy': '0px', top: 0, height: '100%' } as any} />
      <div class="cover-aurora" />
      <div class="cover-grain" />
      <div class="cover-vign" />
      <div class="cover-frame"><i class="tl" /><i class="tr" /><i class="bl" /><i class="br" /></div>
    </div>
  )
}

import { useEffect, useState } from 'preact/hooks'
import './styles/cover.css'

/*
 * The screen between the loading screen and the spawn menu.
 *
 * It exists because there is a window — world streaming, the ped model swap,
 * the outfit round-trip, the camera being built — where the game is showing
 * something real but not something anybody should see. spz-spawn puts this up
 * before any of that starts (`showCover`) and takes it down on the other side
 * (`hideCover`), so the player goes loading screen → brand → menu with nothing
 * raw in between.
 *
 * WHY IT IS BUILT THE WAY IT IS
 *
 * The backdrop is a MESH GRADIENT under a HALFTONE SCREEN. The mesh is five
 * overlapping radial fields in the theme accent over a near-black base — no
 * blur filter anywhere, because a full-screen `filter: blur()` in CEF
 * re-rasterises the whole surface and this page is on screen exactly when the
 * client has the least to spare. The softness is in the gradient stops instead.
 *
 * The halftone is two dot grids composited with `overlay` and `soft-light`
 * blend modes rather than drawn as their own layers. Blended that way the dots
 * take their strength FROM the mesh underneath: bright where the mesh blooms,
 * gone where it falls to black. That is the halftone response — dot weight
 * tracking luminance — for the cost of two extra background layers on an
 * element that was already being painted.
 *
 * THE EXIT IS THE POINT
 *
 * The old cover cross-faded to nothing, which is the one transition that makes
 * a loading hand-off look like a loading hand-off: for 700ms the brand and the
 * world are both half-there.
 *
 * This one is SLICED. The backdrop is split into vertical panels that sweep off
 * the sides — outermost first, working inward, so every panel travels over
 * screen that the panel before it has already vacated and nothing is ever seen
 * sliding across anything else. The content goes first and fast; the panels
 * follow as a curtain opening from both edges onto the menu underneath.
 *
 * The slices are not separate copies of the artwork. Each one carries the same
 * background stack sized to the VIEWPORT and offset by its own position
 * (`--bgy`), so the mesh and the dot grid run continuously across all eight
 * seams while the browser still only paints each slice's own area — the whole
 * stage costs about one screen, not eight.
 */

const SLICES = 8

/** Total ms from `hideCover` to the last panel clearing the frame. app.tsx
 *  unmounts on this, so the two must not drift apart. */
export const COVER_EXIT_MS = 1320

export function Cover({ fading }: { fading: boolean }) {
  // Staged so the brand is gone before the panels start moving. Sweeping the
  // artwork out from under type that is still fully opaque reads as a glitch.
  const [sweeping, setSweeping] = useState(false)
  useEffect(() => {
    if (!fading) { setSweeping(false); return }
    const t = setTimeout(() => setSweeping(true), 180)
    return () => clearTimeout(t)
  }, [fading])

  return (
    <div class={`cv-root${fading ? ' is-out' : ''}`}>
      <div class={`cv-stage${sweeping ? ' is-sweeping' : ''}`}>
        {Array.from({ length: SLICES }, (_, i) => {
          // Horizontal strips, alternating: even rows slide out left, odd rows
          // right, staggered top to bottom so the frame unzips down the screen.
          const dir = i % 2 === 0 ? -1 : 1
          return (
            <div
              key={i}
              class="cv-slice"
              style={{
                '--i': i,
                '--bgy': `calc(${-i} * (100vh / ${SLICES}))`,
                '--dir': dir,
                '--delay': `${i * 55}ms`,
              }}
            />
          )
        })}

        {/* Layers that are NOT sliced: they are full-frame, so they have to be
            gone before the panels open or they would hang over the gaps. They
            fade on the same cue as the content, well before the first seam. */}
        <div class="cv-aurora" />
        <div class="cv-grain" />
        <div class="cv-vign" />
      </div>

      <div class="cv-content">
        <div class="cv-frame" aria-hidden="true">
          <i class="tl" /><i class="tr" /><i class="bl" /><i class="br" />
        </div>

        <div class="cv-center">
          <img class="cv-logo" src="logo.png" alt="SPiceZ" />

          <div class="cv-rule" />

          <div class="cv-status">
            <span class="cv-pip" />
            Preparing your session
          </div>

          {/* Indeterminate on purpose. There is no honest percentage to show —
              the wait is collision streaming and a server round-trip, neither
              of which reports progress — and a fake bar that stalls at 90% is
              worse than one that never claimed to be counting. */}
          <div class="cv-bar"><span /></div>
        </div>

        <div class="cv-foot">
          <span class="cv-foot-mark">SPiceZ-Core</span>
          <span class="cv-foot-dot" />
          <span>Open-Source Racing Core</span>
        </div>
      </div>
    </div>
  )
}

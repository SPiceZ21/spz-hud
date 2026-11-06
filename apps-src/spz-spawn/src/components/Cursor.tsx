import { useEffect, useRef, useState } from 'preact/hooks'
import '../styles/cursor.css'

/*
 * The pointer for this resource's menus.
 *
 * SetNuiFocus(true, true) hands the page the OS arrow, which is the one piece
 * of chrome on a full-screen cinematic menu that is not ours and does not
 * belong to the game either — and, being a 32px system bitmap, it gives no
 * feedback at all about what under it can be clicked. On a screen whose
 * navigation IS clicking, that is the interaction doing nothing to tell you it
 * is there.
 *
 * So: a reticle drawn in the page, in the server's accent colour, that reacts.
 *
 *   idle     a dot and a loose ring trailing it
 *   hover    the ring tightens onto the target and four ticks close in
 *   press    it snaps down
 *   text     over an input it collapses to a caret, because a reticle over a
 *            text field is worse than the arrow it replaced
 *   off      over a disabled control it goes grey and crossed — a Spawn button
 *            mid-commit should look unclickable, not merely unresponsive
 *
 * WHAT MAKES IT SAFE
 *
 * The native cursor is only hidden once this component has actually seen a
 * mousemove (`is-live`). If the page is up on a client where something here
 * never runs, the failure is the ordinary arrow rather than NO pointer at all
 * on a menu that cannot be dismissed with a key.
 *
 * The dot tracks the mouse EXACTLY and the ring is eased toward it. Easing both
 * looks lovely and feels broken — there has to be something under the hand that
 * is where the hand is.
 */

/*
 * What counts as a target. Real buttons and links are picked up for free; a
 * clickable <div> has to say so, and `role="button"` is the right way for it to
 * say so — it is what a screen reader needs to hear anyway.
 *
 * NOT `[data-cursor]`: CharacterCreation already uses that attribute for the
 * nation list's own keyboard cursor, and an attribute selector matches whether
 * the value is "true" or "false", so the reticle would have locked onto every
 * row in that list at once.
 */
const HOVER_SEL = 'button, a, [role="button"], [data-cursor-hit]'
const TEXT_SEL = 'input, textarea, [contenteditable="true"]'

type Mode = 'idle' | 'hover' | 'text' | 'off'

export function Cursor({ active }: { active: boolean }) {
  const [live, setLive] = useState(false)
  const [mode, setMode] = useState<Mode>('idle')
  const [down, setDown] = useState(false)
  const [label, setLabel] = useState('')
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) {
      setLive(false)
      setMode('idle')
      setDown(false)
      setLabel('')
      return
    }

    const to = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const at = { ...to }
    let seen = false
    let frame = 0

    const paint = () => {
      at.x += (to.x - at.x) * 0.2
      at.y += (to.y - at.y) * 0.2
      if (dotRef.current) dotRef.current.style.transform = `translate3d(${to.x}px, ${to.y}px, 0)`
      if (ringRef.current) ringRef.current.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`
      frame = requestAnimationFrame(paint)
    }
    frame = requestAnimationFrame(paint)

    const resolve = (el: EventTarget | null) => {
      const node = el instanceof Element ? el : null
      let next: Mode = 'idle'
      let text = ''

      if (node?.closest(TEXT_SEL)) {
        next = 'text'
      } else {
        const hit = node?.closest(HOVER_SEL) as HTMLElement | null
        if (hit) {
          const disabled =
            hit.hasAttribute('disabled') || hit.getAttribute('aria-disabled') === 'true'
          next = disabled ? 'off' : 'hover'
          text = (!disabled && hit.dataset.cursorLabel) || ''
        }
      }

      setMode(m => (m === next ? m : next))
      setLabel(l => (l === text ? l : text))
    }

    const onMove = (e: MouseEvent) => {
      to.x = e.clientX
      to.y = e.clientY
      if (!seen) {
        seen = true
        // First real movement: only now is it safe to take the arrow away.
        at.x = e.clientX
        at.y = e.clientY
        setLive(true)
      }
      resolve(e.target)
    }

    // The pointer can end up over a different element without moving — a button
    // becoming disabled under it, a panel animating in beneath it — so the mode
    // is re-resolved on those too, not on movement alone.
    const onOver = (e: MouseEvent) => resolve(e.target)
    const onDown = () => setDown(true)
    const onUp = () => setDown(false)
    const onLeave = () => { setLive(false); seen = false }
    const onEnter = () => { if (seen) setLive(true) }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseover', onOver)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('mouseup', onUp)
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseover', onOver)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
    }
  }, [active])

  // Hiding the arrow is a document-level concern, and it has to be undone on
  // unmount: leaving `cursor: none` on <html> after the menu closes would take
  // the pointer away from whatever this resource hands over to.
  useEffect(() => {
    const on = active && live
    document.documentElement.classList.toggle('spz-cursor-live', on)
    return () => document.documentElement.classList.remove('spz-cursor-live')
  }, [active, live])

  if (!active) return null

  return (
    <div class={`cur${live ? ' is-live' : ''}${down ? ' is-down' : ''}`} data-mode={mode}>
      <div class="cur-ring" ref={ringRef}>
        <i class="tl" /><i class="tr" /><i class="bl" /><i class="br" />
      </div>
      <div class="cur-dot" ref={dotRef}>
        {label && <span class="cur-label">{label}</span>}
      </div>
    </div>
  )
}

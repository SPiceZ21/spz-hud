// The other resources' UIs, each in its own full-screen layer.
//
// Every app is the resource's own page, copied to apps/<resource>/ by
// tools/sync-apps.mjs and loaded unchanged in an iframe. Lua messages for it
// arrive here as { type: 'app', app, msg } and are posted into its frame, so
// the app's own `window.addEventListener('message')` sees exactly what it saw
// before. Its NUI callbacks go straight to its resource (the copied index.html
// knows its resource name), not through here.
//
// Work is done imperatively on the iframes: an app message never re-renders
// the HUD.
import { useEffect, useRef, useState } from 'preact/hooks'

interface AppEntry { res: string; z: number }

interface Slot {
  frame: HTMLIFrameElement | null
  ready: boolean
  queue: unknown[]
}

const slots = new Map<string, Slot>()
const slot = (res: string) => {
  let s = slots.get(res)
  if (!s) slots.set(res, (s = { frame: null, ready: false, queue: [] }))
  return s
}

/** Called from the page's message handler. */
export function toApp(res: string, msg: unknown) {
  const s = slot(res)
  if (s.ready && s.frame?.contentWindow) s.frame.contentWindow.postMessage(msg, '*')
  else s.queue.push(msg)
}

let reloadHook: (res: string) => void = () => {}
export const reloadApp = (res: string) => reloadHook(res)

// Frames finish `load` before a Preact/React app has run its effects (where
// the message listener is added), so queued messages wait a moment longer.
const SETTLE_MS = 150

export function AppHost({ focus }: { focus: string | null }) {
  const [apps, setApps] = useState<AppEntry[]>([])
  const [gen, setGen] = useState<Record<string, number>>({})
  const focusRef = useRef(focus)

  useEffect(() => {
    fetch('./apps/apps.json')
      .then(r => r.json())
      .then((list: AppEntry[]) => setApps(list))
      .catch(() => setApps([]))
    reloadHook = res => {
      const s = slot(res)
      s.ready = false
      s.queue = []
      setGen(g => ({ ...g, [res]: (g[res] || 0) + 1 }))
    }
  }, [])

  // The focused app gets the keyboard; give it back to nobody on release so
  // a key press doesn't land in a frame that no longer has focus.
  useEffect(() => {
    focusRef.current = focus
    const f = focus ? slots.get(focus)?.frame : null
    if (f) { f.focus(); f.contentWindow?.focus() }
    else if (document.activeElement instanceof HTMLIFrameElement) document.activeElement.blur()
  }, [focus])

  const onLoad = (res: string) => {
    const s = slot(res)
    setTimeout(() => {
      s.ready = true
      const w = s.frame?.contentWindow
      if (w) for (const m of s.queue) w.postMessage(m, '*')
      s.queue = []
      if (focusRef.current === res) { s.frame?.focus(); w?.focus() }
    }, SETTLE_MS)
  }

  return (
    <>
      {apps.map(a => (
        <iframe
          key={`${a.res}:${gen[a.res] || 0}`}
          class="app"
          data-app={a.res}
          data-focus={focus === a.res}
          style={{ zIndex: focus === a.res ? 1000 : a.z }}
          src={`./apps/${a.res}/index.html`}
          ref={el => { slot(a.res).frame = el }}
          onLoad={() => onLoad(a.res)}
          allow="autoplay"
          tabIndex={-1}
        />
      ))}
    </>
  )
}

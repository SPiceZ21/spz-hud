// Browser preview control panel (npm run dev in web/). Never rendered in game.
//
// Everything it does goes through window.postMessage in the same shape the Lua
// side sends ({ type: 'app' | 'focus' | 'state' | 'edit' | 'data', … }), so the
// page under it runs exactly the code paths it runs in game.
import { useEffect, useMemo, useState } from 'preact/hooks'
import { clearLog, getLog, getStubs, log, onLog, setStub, type LogEntry } from './devlog'
import { BOOT, CLEAR, EVENTS, SCENARIOS, type Msg } from './scenarios'
import { DEMOS } from './demos'
import './dev.css'

interface AppEntry { res: string; z: number }
interface Preset { label: string; msg: Record<string, unknown> }

const BACKDROPS: Record<string, string> = {
  dark:    'radial-gradient(ellipse at 30% 20%, #2a3340 0%, #0d1117 70%)',
  city:    'linear-gradient(180deg, #4a6d8c 0%, #c99a6b 55%, #3b3f45 56%, #22252a 100%)',
  checker: 'repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 50% / 32px 32px',
  green:   '#00b140',
}

const send = (m: unknown) => window.postMessage(m, '*')

// What client/main.lua sends as the registry (Config.Widgets in config.lua).
const DEV_WIDGETS = [
  { id: 'speedo_digital', label: 'Speedometer (digital)', x: 98.4, y: 95.5, anchor: 'br', scale: 1,
    states: { freeroam: true, race: true, minigame: true } },
  { id: 'keybar', label: 'Key hints', x: 76, y: 97, anchor: 'br', scale: 1, states: { freeroam: true, race: true } },
]
const sendRegistry = (speedo: string) =>
  send({ type: 'registry', widgets: DEV_WIDGETS, layout: {}, settings: { speedo }, snap: 0.5 })
const sendMsg = (m: Msg) => send({ type: 'app', app: m.app, msg: m.msg })

// The running scenario's live loop (speedometer); one at a time.
let tickTimer: ReturnType<typeof setInterval> | null = null
function runScenario(id: string | null) {
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
  BOOT.forEach(sendMsg)
  CLEAR.forEach(sendMsg)
  const sc = SCENARIOS.find(x => x.id === id)
  if (!sc) { send({ type: 'state', state: 'freeroam' }); return }
  send({ type: 'state', state: sc.state })
  // After the CLEAR has landed, so a hide doesn't follow the show.
  setTimeout(() => {
    sc.msgs.forEach(sendMsg)
    if (sc.tick) {
      let t = 0
      const step = () => { t += 0.05; sc.tick!(t).forEach(sendMsg) }
      step()
      tickTimer = setInterval(step, 50)
    }
  }, 30)
}

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem('spz-hud:dev:' + k) ?? d } catch { return d } },
  set: (k: string, v: string) => { try { localStorage.setItem('spz-hud:dev:' + k, v) } catch { /* ignore */ } },
}

function useLog() {
  const [, tick] = useState(0)
  useEffect(() => onLog(() => tick(n => n + 1)), [])
  return getLog()
}

const time = (t: number) => new Date(t).toLocaleTimeString([], { hour12: false })

export function DevPanel() {
  const [open, setOpen] = useState(
    new URLSearchParams(location.search).get('panel') !== '0' && store.get('open', '1') === '1')
  const [apps, setApps] = useState<AppEntry[]>([])
  const [presets, setPresets] = useState<Record<string, Preset[]>>({})
  const [app, setApp] = useState(store.get('app', 'spz-poll'))
  const [text, setText] = useState('{\n  "action": ""\n}')
  const [err, setErr] = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  const [state, setState] = useState<string>('freeroam')
  // ?scenario=race in the URL wins (links, screenshots), then the last one used.
  const [scenario, setScenario] = useState<string | null>(
    new URLSearchParams(location.search).get('scenario') ?? (store.get('scenario', 'freeroam') || null))
  const [editing, setEditing] = useState(false)
  const [backdrop, setBackdrop] = useState(store.get('backdrop', 'dark'))
  const [bgUrl, setBgUrl] = useState(store.get('bgUrl', ''))
  const [stubKey, setStubKey] = useState('')
  const [stubText, setStubText] = useState('')
  const [tab, setTab] = useState<'send' | 'log' | 'stubs'>('send')
  const entries = useLog()

  useEffect(() => {
    fetch('./apps/apps.json').then(r => r.json()).then(setApps).catch(() => {})
    fetch('./apps/presets.json').then(r => r.json()).then(setPresets).catch(() => {})
  }, [])

  // Mirror what the page is told, so the panel shows the real current state
  // (edit mode also ends from the page's own Save / Cancel buttons).
  useEffect(() => {
    const on = (e: MessageEvent) => {
      const m = e.data
      if (!m || typeof m.type !== 'string') return
      if (m.type === 'focus') setFocus(m.owner ?? null)
      if (m.type === 'state') setState(m.state)
      if (m.type === 'edit') setEditing(!!m.on)
    }
    window.addEventListener('message', on)
    return () => window.removeEventListener('message', on)
  }, [])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === '`') { setOpen(o => { store.set('open', o ? '0' : '1'); return !o }) } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  useEffect(() => {
    document.body.style.background = backdrop === 'url' && bgUrl
      ? `#000 url("${bgUrl}") center / cover no-repeat`
      : BACKDROPS[backdrop] ?? BACKDROPS.dark
    store.set('backdrop', backdrop)
    store.set('bgUrl', bgUrl)
  }, [backdrop, bgUrl])

  useEffect(() => { store.set('app', app) }, [app])

  // The HUD's own widgets and settings, as Lua would push them.
  const [speedo, setSpeedo] = useState(store.get('speedo', 'analogue'))
  useEffect(() => { sendRegistry(speedo); store.set('speedo', speedo) }, [speedo])

  // Run the remembered scenario once the apps have had time to load.
  useEffect(() => {
    const t = setTimeout(() => {
      runScenario(scenario)
      // ?edit=1: open layout edit mode on top (handles over every movable element).
      if (new URLSearchParams(location.search).get('edit') === '1') setTimeout(() => send({ type: 'edit', on: true }), 600)
    }, 900)
    return () => clearTimeout(t)
  }, [])
  const pickScenario = (id: string | null) => {
    setScenario(id)
    store.set('scenario', id ?? '')
    runScenario(id)
  }

  // Filled-in samples (from the scenarios) first, then every message the
  // resource's Lua sends, with its runtime values left as null.
  const appPresets: Preset[] = useMemo(() => {
    const samples: Preset[] = []
    const seen = new Set<string>()
    for (const sc of SCENARIOS) for (const m of sc.msgs) {
      if (m.app !== app) continue
      const k = JSON.stringify(m.msg)
      if (seen.has(k)) continue
      seen.add(k)
      const msg = m.msg as Record<string, unknown>
      samples.push({ label: `★ ${String(msg.action ?? msg.type ?? msg.hud ?? '?')} — ${sc.label}`, msg })
    }
    return [...samples, ...(presets[app] ?? [])]
  }, [app, presets])

  const pickPreset = (i: number) => {
    const p = appPresets[i]
    if (p) { setText(JSON.stringify(p.msg, null, 2)); setErr('') }
  }

  const sendApp = () => {
    try {
      const msg = JSON.parse(text)
      send({ type: 'app', app, msg })
      log('out', app, String(msg.action ?? msg.type ?? '?'), msg)
      setErr('')
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  const toggleFocus = (res: string) => send({ type: 'focus', owner: focus === res ? null : res })

  // Click an app: show it with sample data (its own mock mode, or its open
  // messages), giving a menu the mouse and keyboard. Click again to close it.
  const [shown, setShown] = useState<Record<string, boolean>>({})
  const toggleDemo = (res: string) => {
    setApp(res)
    const d = DEMOS[res]
    if (!d) return
    const on = !shown[res]
    setShown(x => ({ ...x, [res]: on }))
    if (on) {
      if (d.mock) {
        send({ type: 'appReload', app: res, mock: true })
        // Pages gated on the loading screen (raceUI, chat) start hidden again.
        BOOT.filter(b => b.app === res).forEach(sendMsg)
      }
      else { BOOT.forEach(sendMsg); (d.open ?? []).forEach(msg => { send({ type: 'app', app: res, msg }); log('out', res, 'open', msg) }) }
      if (d.focus) send({ type: 'focus', owner: res })
    } else {
      if (d.mock) send({ type: 'appReload', app: res, mock: false })
      else (d.close ?? []).forEach(msg => send({ type: 'app', app: res, msg }))
      if (focus === res) send({ type: 'focus', owner: null })
    }
  }

  const saveStub = () => {
    if (!stubKey.trim()) return
    if (!stubText.trim()) { setStub(stubKey.trim(), undefined); setStubText(''); return }
    try { setStub(stubKey.trim(), JSON.parse(stubText)); setErr('') } catch (e) { setErr((e as Error).message) }
  }

  const callbacks = useMemo(() => {
    const seen = new Set<string>()
    for (const e of entries) if (e.dir === 'in') seen.add(`${e.res}/${e.name}`)
    return [...seen].sort()
  }, [entries.length])

  if (!open) return <button class="dev-fab" onClick={() => { setOpen(true); store.set('open', '1') }} title="Dev panel (`)">DEV</button>

  return (
    <div class="dev">
      <header class="dev-head">
        <strong>spz-hud · dev</strong>
        <span class="dev-muted">` to hide</span>
        <button class="dev-x" onClick={() => { setOpen(false); store.set('open', '0') }}>×</button>
      </header>

      <section class="dev-row">
        <label>State</label>
        <div class="dev-seg">
          {SCENARIOS.map(sc => (
            <button data-on={scenario === sc.id} title={`state: ${sc.state}`} onClick={() => pickScenario(sc.id)}>{sc.label}</button>
          ))}
          <button data-on={scenario === null} onClick={() => pickScenario(null)}>clear</button>
        </div>
      </section>

      <section class="dev-row">
        <label>Events</label>
        <div class="dev-seg">
          {EVENTS.map(ev => (
            <button class="dev-ev" onClick={() => { BOOT.forEach(sendMsg); ev.msgs.forEach(m => { sendMsg(m); log('out', m.app, String((m.msg as any).action ?? (m.msg as any).type ?? (m.msg as any).hud), m.msg) }) }}>{ev.label}</button>
          ))}
        </div>
      </section>

      <section class="dev-row">
        <label>HUD</label>
        <div class="dev-seg">
          <button data-on={editing} onClick={() => send({ type: 'edit', on: !editing })}>layout edit</button>
          <button data-on={speedo === 'analogue'} onClick={() => setSpeedo('analogue')}>analogue</button>
          <button data-on={speedo === 'digital'} onClick={() => setSpeedo('digital')}>digital</button>
          <button onClick={() => send({ type: 'hidden', hidden: true })}>hide</button>
          <button onClick={() => send({ type: 'hidden', hidden: false })}>show</button>
        </div>
      </section>

      <section class="dev-row">
        <label>Backdrop</label>
        <div class="dev-seg">
          {[...Object.keys(BACKDROPS), 'url'].map(b => (
            <button data-on={backdrop === b} onClick={() => setBackdrop(b)}>{b}</button>
          ))}
        </div>
      </section>
      {backdrop === 'url' && (
        <input class="dev-input" placeholder="Screenshot URL" value={bgUrl} onInput={e => setBgUrl((e.target as HTMLInputElement).value)} />
      )}

      <section class="dev-apps">
        <label>Apps <span class="dev-muted">— click to show / hide with sample data · ○ focus (mouse + keys)</span></label>
        <div class="dev-applist">
          {apps.map(a => (
            <div class="dev-app" data-sel={app === a.res} data-focus={focus === a.res} data-shown={!!shown[a.res]}>
              <button class="dev-app-name" title="Show / hide with sample data" onClick={() => toggleDemo(a.res)}>{a.res.replace(/^spz-/, '')}</button>
              <button class="dev-app-focus" title="Give focus" onClick={() => toggleFocus(a.res)}>{focus === a.res ? '◉' : '○'}</button>
            </div>
          ))}
        </div>
      </section>

      <nav class="dev-tabs">
        <button data-on={tab === 'send'} onClick={() => setTab('send')}>Send</button>
        <button data-on={tab === 'log'} onClick={() => setTab('log')}>Log ({entries.length})</button>
        <button data-on={tab === 'stubs'} onClick={() => setTab('stubs')}>Callback answers</button>
      </nav>

      {tab === 'send' && (
        <section class="dev-send">
          <select class="dev-input" onChange={e => pickPreset(Number((e.target as HTMLSelectElement).value))} value="">
            <option value="">{appPresets.length ? `${appPresets.length} messages (★ = filled sample)…` : 'no presets — write one below'}</option>
            {appPresets.map((p, i) => <option value={i}>{p.label} {Object.keys(p.msg).length > 1 ? `(${Object.keys(p.msg).filter(k => k !== 'action' && k !== 'type').join(', ')})` : ''}</option>)}
          </select>
          <textarea class="dev-code" spellcheck={false} value={text}
            onInput={e => setText((e.target as HTMLTextAreaElement).value)}
            onKeyDown={e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendApp() }} />
          {err && <div class="dev-err">{err}</div>}
          <div class="dev-seg">
            <button class="dev-primary" onClick={sendApp}>Send to {app.replace(/^spz-/, '')} (Ctrl+Enter)</button>
            <button onClick={() => send({ type: 'appReload', app })}>Reload app</button>
          </div>
          <p class="dev-muted">★ messages are filled with sample data. In the others, null values are Lua expressions the preset could not read — fill them in.</p>
        </section>
      )}

      {tab === 'log' && (
        <section class="dev-log">
          <div class="dev-seg"><button onClick={clearLog}>Clear</button></div>
          <div class="dev-log-list">
            {[...entries].reverse().map((e: LogEntry) => (
              <details class="dev-log-row" data-dir={e.dir}>
                <summary>
                  <span class="dev-muted">{time(e.at)}</span>
                  <span class="dev-dir">{e.dir === 'in' ? '← cb' : '→ msg'}</span>
                  <span>{e.res.replace(/^spz-/, '')}</span>
                  <b>{e.name}</b>
                </summary>
                <pre>{JSON.stringify(e.data, null, 2)}</pre>
              </details>
            ))}
          </div>
        </section>
      )}

      {tab === 'stubs' && (
        <section class="dev-send">
          <p class="dev-muted">What a NUI callback answers in the browser (default {'{}'}). Empty answer = remove.</p>
          <select class="dev-input" value={stubKey} onChange={e => {
            const k = (e.target as HTMLSelectElement).value
            setStubKey(k)
            const v = getStubs()[k]
            setStubText(v === undefined ? '' : JSON.stringify(v, null, 2))
          }}>
            <option value="">{callbacks.length ? 'Callbacks seen so far…' : 'No callbacks yet — use an app first'}</option>
            {callbacks.map(k => <option value={k}>{k}{getStubs()[k] !== undefined ? '  ✓' : ''}</option>)}
          </select>
          <input class="dev-input" placeholder="resource/callback" value={stubKey} onInput={e => setStubKey((e.target as HTMLInputElement).value)} />
          <textarea class="dev-code" spellcheck={false} value={stubText} placeholder='{ "ok": true }'
            onInput={e => setStubText((e.target as HTMLTextAreaElement).value)} />
          <div class="dev-seg"><button class="dev-primary" onClick={saveStub}>Save answer</button></div>
        </section>
      )}
    </div>
  )
}

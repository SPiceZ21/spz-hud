// Browser preview control panel (npm run dev in web/). Never rendered in game.
//
// Everything it does goes through window.postMessage in the same shape the Lua
// side sends ({ type: 'app' | 'focus' | 'state' | 'edit' | 'data', … }), so the
// page under it runs exactly the code paths it runs in game.
import { useEffect, useMemo, useState } from 'preact/hooks'
import { clearLog, getLog, getStubs, log, onLog, setStub, type LogEntry } from './devlog'
import './dev.css'

interface AppEntry { res: string; z: number }
interface Preset { label: string; msg: Record<string, unknown> }

const STATES = ['freeroam', 'race', 'minigame', 'spectate'] as const
const BACKDROPS: Record<string, string> = {
  dark:    'radial-gradient(ellipse at 30% 20%, #2a3340 0%, #0d1117 70%)',
  city:    'linear-gradient(180deg, #4a6d8c 0%, #c99a6b 55%, #3b3f45 56%, #22252a 100%)',
  checker: 'repeating-conic-gradient(#3a3a3a 0% 25%, #2a2a2a 0% 50%) 50% / 32px 32px',
  green:   '#00b140',
}

const send = (m: unknown) => window.postMessage(m, '*')

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
  const [open, setOpen] = useState(store.get('open', '1') === '1')
  const [apps, setApps] = useState<AppEntry[]>([])
  const [presets, setPresets] = useState<Record<string, Preset[]>>({})
  const [app, setApp] = useState(store.get('app', 'spz-poll'))
  const [text, setText] = useState('{\n  "action": ""\n}')
  const [err, setErr] = useState('')
  const [focus, setFocus] = useState<string | null>(null)
  const [state, setState] = useState<string>('freeroam')
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

  const appPresets = presets[app] ?? []

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
          {STATES.map(s => (
            <button data-on={state === s} onClick={() => send({ type: 'state', state: s })}>{s}</button>
          ))}
        </div>
      </section>

      <section class="dev-row">
        <label>HUD</label>
        <div class="dev-seg">
          <button data-on={editing} onClick={() => send({ type: 'edit', on: !editing })}>layout edit</button>
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
        <label>Apps <span class="dev-muted">— click to select · ◉ gives it focus (mouse + keys)</span></label>
        <div class="dev-applist">
          {apps.map(a => (
            <div class="dev-app" data-sel={app === a.res} data-focus={focus === a.res}>
              <button class="dev-app-name" onClick={() => setApp(a.res)}>{a.res.replace(/^spz-/, '')}</button>
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
            <option value="">{appPresets.length ? `${appPresets.length} messages from ${app}'s Lua…` : 'no presets — write one below'}</option>
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
          <p class="dev-muted">null values are Lua expressions the preset could not read — fill them in.</p>
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

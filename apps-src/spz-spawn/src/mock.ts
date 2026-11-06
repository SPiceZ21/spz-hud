/*
 * Dev harness. DEV-only — `import.meta.env.DEV` is a compile-time constant, so
 * none of this survives `vite build` into the bundle the resource ships.
 *
 * It drives the same message sequence the Lua client does, because every
 * interesting thing on these screens is a TRANSITION — the cover's sliced
 * sweep, the letterbox sliding in, the readout cutting between destinations —
 * and none of them can be looked at by opening a page that mounts already
 * finished. `spz.cover()` replays the hand-off on demand.
 */

const PLAYER = {
  name: 'SPiceZ',
  avatar: 'https://i.imgur.com/8NzA8m8.png',
  licenseClass: 'A-1',
  crew: '[SPZ]',
  playtime: 12500,
  stateText: 'IDLE',
}

const SPAWNS = [
  { label: 'Legion Square' },
  { label: 'Paleto Bay' },
  { label: 'Sandy Shores' },
  { label: 'LSIA Terminal' },
  { label: 'Vinewood Hills' },
  { label: 'Del Perro Pier' },
]

const send = (data: unknown) =>
  window.dispatchEvent(new MessageEvent('message', { data }))

export const initMockEnv = () => {
  if (!import.meta.env.DEV) return

  const spawnMenu = () => {
    send({ type: 'show', playerData: PLAYER, spawns: SPAWNS })
  }

  // The real boot: cover up, menu mounts behind it, cover sweeps away.
  const boot = () => {
    send({ type: 'showCover' })
    setTimeout(spawnMenu, 400)
    setTimeout(() => send({ type: 'hideCover' }), 2200)
  }

  const creation = () => {
    send({ type: 'showCover' })
    send({ type: 'showCharacterCreation' })
    setTimeout(() => send({ type: 'hideCover' }), 1800)
  }

  ;(window as any).spz = { boot, cover: boot, spawn: spawnMenu, creation, send }
  console.log('[mock] spz.boot() · spz.spawn() · spz.creation() · spz.send({...})')

  boot()

  // GetParentResourceName only exists inside CEF, and every callback on this
  // page builds its URL from it — so it has to be stubbed BEFORE anything is
  // clicked, not just have its fetch intercepted.
  if (typeof (window as any).GetParentResourceName !== 'function') {
    ;(window as any).GetParentResourceName = () => 'spz-spawn'
  }

  // Answer every callback to that host. Matching the endpoint names instead
  // would mean a new one silently hanging on a DNS lookup the first time
  // somebody added a button.
  const realFetch = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.startsWith('https://spz-spawn/')) {
      console.log('[mock] NUI callback', url, init?.body)
      return new Response(JSON.stringify({ status: 'ok' }))
    }
    return realFetch(input, init)
  }
}

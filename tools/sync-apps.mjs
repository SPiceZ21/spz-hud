// tools/sync-apps.mjs — copy every hosted UI into web/public/apps/<resource>/.
//
// NOTE: the resources' ui/ folders have been removed; web/public/apps is the
// only copy of the hosted UIs and is edited directly (it is tracked in git).
// Running this still refreshes the shared fonts, the design layer, apps.json
// and presets.json, and copies any app whose ui/ source is brought back.
//
//   node tools/sync-apps.mjs              all apps
//   node tools/sync-apps.mjs spz-poll     just these
//
// The UIs are still developed in their own resources (spz-poll/ui, …). This
// copies what each one ships into spz-hud and adjusts two things:
//   1. index.html learns which resource it belongs to, so its NUI callbacks
//      (https://<resource>/...) still reach that resource's Lua.
//   2. links into another resource's ui folder (https://cfx-nui-spz-x/ui/...)
//      point at that app's copy here.
// Fonts that several apps ship identically are kept once, in
// web/public/shared/fonts, and each app's CSS points there.
// Then it writes apps/apps.json, the list the HUD page loads.
//
// `npm run build` in web/ copies web/public into ui/ with the page.
//
// Built (Vite) UIs must be built first: npm run build in their ui folder.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, join, relative, resolve, sep } from 'node:path'
import { createHash } from 'node:crypto'
import { LAYOUT } from './hud-layout.mjs'
import { fileURLToPath } from 'node:url'

const HUD = join(dirname(fileURLToPath(import.meta.url)), '..')
const ROOT = join(HUD, '..')
const PUBLIC = join(HUD, 'web', 'public')
const OUT = join(PUBLIC, 'apps')
const SHARED = join(PUBLIC, 'shared', 'fonts')
const DESIGN_SRC = join(HUD, 'design')
const DESIGN_OUT = join(PUBLIC, 'shared', 'design')

// z: stacking order when nothing has focus (the focused app always goes on top).
// HUD overlays sit low, menus high, the spawn screen above everything.
// owner: the resource whose Lua drives the page, when it is not the app's own
// name (the app was merged into it). Its NUI callbacks post there.
// What players can move in /hudedit, per app, is in tools/hud-layout.mjs.
export const APPS = [
  { res: 'spz-nametag',      z: 10 },
  { res: 'spz-speedometer',  z: 20 },
  { res: 'spz-speedcam',     z: 25 },
  { res: 'spz-raceUI',       z: 30, owner: 'spz-races' },
  { res: 'spz-spectate',     z: 30 },
  { res: 'spz-rocketleague', z: 35 },
  { res: 'spz-minigames',    z: 40 },
  { res: 'spz-poll',         z: 60, owner: 'spz-races' },
  { res: 'spz-chat',         z: 70 },
  { res: 'spz-radio',        z: 75 },
  { res: 'spz-carspawner',   z: 80, owner: 'spz-vehicles' },
  { res: 'spz-tunners',      z: 80, owner: 'spz-vehicles' },
  { res: 'spz-emotes',       z: 80 },
  { res: 'spz-crew',         z: 80 },
  { res: 'spz-leaderboard',  z: 80, owner: 'spz-races' },
  { res: 'spz-replay',       z: 80 },
  { res: 'spz-pausemenu',    z: 85 },
  { res: 'spz-tutorial',     z: 90 },
  { res: 'spz-spawn',        z: 95 },
]

// Source-only files: never shipped by the resources, so never copied.
const SKIP = new Set(['node_modules', 'src', 'dist', 'package.json', 'package-lock.json',
  'tsconfig.json', 'tsconfig.app.json', 'tsconfig.node.json', 'vite.config.ts', 'vite.config.js',
  'README.md', '.gitignore', 'index.dev.html'])

function walk(dir, fn) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, fn)
    else fn(p)
  }
}

function sourceOf(res) {
  const ui = join(ROOT, res, 'ui')
  const dist = join(ui, 'dist')
  if (existsSync(join(ui, 'package.json'))) {
    if (!existsSync(join(dist, 'index.html'))) throw new Error(`${res}: ui/dist missing — run npm run build in ${res}/ui`)
    return { dir: dist, built: true }
  }
  return { dir: ui, built: false }
}

// n: the app (dev preview, layers); o: the resource its callbacks post to.
const NAME_SHIM = (res, owner = res) =>
  `<script>(function(){var n=${JSON.stringify(res)},o=${JSON.stringify(owner)};` +
  // ?spzmock=1 (browser preview only, from the dev panel): leave the page
  // looking like a plain browser so the app runs its OWN mock mode.
  `var mock=/[?&]spzmock=1/.test(location.search);` +
  `if(!mock){try{Object.defineProperty(window,"GetParentResourceName",{value:function(){return o},configurable:true})}` +
  `catch(e){window.GetParentResourceName=function(){return o}}` +
  // FiveM gives invokeNative to the top page only. Apps that test it to tell
  // game from browser (spz-spectate) would think they are in a browser here.
  `try{if(!window.invokeNative&&parent!==window&&parent.invokeNative)` +
  `window.invokeNative=function(){return parent.invokeNative.apply(parent,arguments)}}catch(e){}}` +
  // Browser preview only: the HUD page defines __spzDev to catch this app's
  // NUI callbacks before any of its scripts run. Undefined in game.
  `try{if(parent!==window&&parent.__spzDev)parent.__spzDev(n,window)}catch(e){}})();</script>`

// https://cfx-nui-spz-x/ui/dist/a  or  nui://spz-x/ui/a   →   ../spz-x/a
const CROSS = /(?:https:\/\/cfx-nui-|nui:\/\/)(spz-[\w-]+)\/ui\/(?:dist\/)?/g

// An app kept in place (no ui/ source) still gets the current name shim.
const OLD_SHIM = /<script>\(function\(\)\{var n="[^"]+"[^<]*<\/script>/

function refreshShim({ res, owner }) {
  const p = join(OUT, res, 'index.html')
  const text = readFileSync(p, 'utf8')
  if (!OLD_SHIM.test(text)) throw new Error(`${res}: no name shim in index.html`)
  const next = text.replace(OLD_SHIM, NAME_SHIM(res, owner))
  if (next !== text) writeFileSync(p, next)
}

function syncOne({ res, owner }) {
  // The resources' own ui/ folders were removed: spz-hud's copy in
  // web/public/apps is now the only one, edited in place. An app with no
  // source left is kept as it is.
  if (!existsSync(join(ROOT, res, 'ui'))) {
    if (existsSync(join(OUT, res, 'index.html'))) { refreshShim({ res, owner }); console.log(`  ${res.padEnd(18)} kept (edited in spz-hud)`); return }
    throw new Error(`${res}: no ui/ source and no copy in web/public/apps`)
  }
  const { dir, built } = sourceOf(res)
  const out = join(OUT, res)
  rmSync(out, { recursive: true, force: true })
  mkdirSync(out, { recursive: true })
  cpSync(dir, out, {
    recursive: true,
    filter: src => built || src === dir || !SKIP.has(relative(dir, src).split(/[\\/]/)[0]),
  })

  // Vite copies ui/public into dist at build time; a dist built before an
  // asset was added to public/ would be missing it. Fill any gaps from public.
  const pub = join(ROOT, res, 'ui', 'public')
  let filled = 0
  if (built && existsSync(pub)) {
    walk(pub, src => {
      const dst = join(out, relative(pub, src))
      if (!existsSync(dst)) { mkdirSync(dirname(dst), { recursive: true }); cpSync(src, dst); filled++ }
    })
  }

  let rewrites = 0
  walk(out, p => {
    if (!/\.(html|css|js|json)$/.test(p)) return
    const text = readFileSync(p, 'utf8')
    let next = text.replace(CROSS, (_, other) => { rewrites++; return `../${other}/` })
    if (p === join(out, 'index.html')) {
      next = next.replace(/<head[^>]*>/i, m => `${m}\n    ${NAME_SHIM(res, owner)}`)
      // The shared look goes LAST in <head>, after the app's own stylesheets,
      // so it wins (design/spz-ui.css, then design/apps/<resource>.css).
      const perApp = existsSync(join(DESIGN_SRC, 'apps', `${res}.css`))
        ? `\n    <link rel="stylesheet" href="../../shared/design/apps/${res}.css">` : ''
      next = next.replace(/<\/head>/i, `    <link rel="stylesheet" href="../../shared/design/spz-ui.css">${perApp}\n  </head>`)
    }
    if (next !== text) writeFileSync(p, next)
  })
  console.log(`  ${res.padEnd(18)} ${built ? 'dist ' : 'ui   '} ${rewrites ? `(${rewrites} cross-links) ` : ''}${filled ? `(${filled} public files added)` : ''}`)
}

// ── Shared fonts ─────────────────────────────────────────────────────────────
// Every font file that appears (byte-identical) in two or more apps moves to
// shared/fonts once; url(...) references in the apps' CSS and HTML are
// rewritten to it. Fonts are only referenced from CSS here (checked: no JS
// loads them), so nothing is left pointing at a removed copy.
const FONT = new Set(['.ttf', '.otf', '.woff', '.woff2'])

function dedupeFonts() {
  // Fonts already shared (from an earlier full sync) count as a copy, so a
  // partial sync (one app) folds that app's fonts back into them.
  const byHash = new Map()
  const shared = new Map()         // hash -> existing shared file
  if (existsSync(SHARED)) walk(SHARED, p => shared.set(createHash('md5').update(readFileSync(p)).digest('hex'), p))
  walk(OUT, p => {
    if (!FONT.has(extname(p).toLowerCase())) return
    const h = createHash('md5').update(readFileSync(p)).digest('hex')
    if (!byHash.has(h)) byHash.set(h, [])
    byHash.get(h).push(p)
  })

  const moved = new Map()          // absolute app copy -> absolute shared file
  const usedNames = new Map()      // shared name -> hash
  let saved = 0
  for (const [h, copies] of byHash) {
    if (shared.has(h)) {
      for (const c of copies) moved.set(resolve(c), shared.get(h))
      saved += statSync(shared.get(h)).size * copies.length
      continue
    }
    if (copies.length < 2) continue
    let name = basename(copies[0])
    if (usedNames.has(name) && usedNames.get(name) !== h) name = `${basename(name, extname(name))}-${h.slice(0, 8)}${extname(name)}`
    usedNames.set(name, h)
    const dst = join(SHARED, name)
    mkdirSync(SHARED, { recursive: true })
    cpSync(copies[0], dst)
    for (const c of copies) moved.set(resolve(c), dst)
    saved += statSync(dst).size * (copies.length - 1)
  }

  let refs = 0
  walk(OUT, p => {
    if (!/\.(css|html)$/.test(p)) return
    const app = relative(OUT, p).split(sep)[0]
    const text = readFileSync(p, 'utf8')
    const next = text.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (all, q, ref) => {
      if (/^(data:|https?:|#)/.test(ref)) return all
      const clean = ref.split(/[?#]/)[0]
      // "/x" meant the app's own root before it moved in here.
      const abs = clean.startsWith('/') ? resolve(OUT, app, '.' + clean) : resolve(dirname(p), clean)
      // A font the app never shipped (nametag's /fonts/* weights were always
      // missing) gets the shared copy of the same name, if there is one.
      let target = moved.get(abs)
      if (!target && FONT.has(extname(abs).toLowerCase()) && !existsSync(abs) && existsSync(join(SHARED, basename(abs)))) {
        target = join(SHARED, basename(abs))
      }
      if (!target) return all
      refs++
      return `url(${q}${relative(dirname(p), target).split(sep).join('/')}${q})`
    })
    if (next !== text) writeFileSync(p, next)
  })
  for (const c of moved.keys()) rmSync(c, { force: true })
  console.log(`shared fonts: ${new Set(moved.values()).size} file(s), ${refs} reference(s) rewritten, ${(saved / 1e6).toFixed(1)} MB saved`)
}

// design/ → web/public/shared/design (the look every app links last).
function copyDesign() {
  rmSync(DESIGN_OUT, { recursive: true, force: true })
  cpSync(DESIGN_SRC, DESIGN_OUT, { recursive: true })
  console.log('copied design/ to shared/design')
}

if (process.argv.includes('--design')) { copyDesign(); process.exit(0) }

const only = process.argv.slice(2)
const list = only.length ? APPS.filter(a => only.includes(a.res)) : APPS
mkdirSync(OUT, { recursive: true })
console.log(`syncing ${list.length} app(s) into apps/`)
for (const a of list) syncOne(a)

dedupeFonts()
copyDesign()

writeFileSync(join(OUT, 'apps.json'), JSON.stringify(APPS.map(a => ({ res: a.res, z: a.z, ...(a.owner ? { owner: a.owner } : {}), ...(LAYOUT[a.res] || {}) })), null, 2))
console.log('wrote apps/apps.json')

// ── Dev presets ──────────────────────────────────────────────────────────────
// For the browser preview's control panel: every message each resource sends
// its UI, read from its Lua. The `action` / `type` and any plain values written
// inline are kept (`{ action = "rankUp", isPromotion = true }`); values that are
// Lua expressions become null, to be filled in by hand in the panel.
const SCALAR = /^(?:"([^"]*)"|'([^']*)'|(true|false)|(-?\d+(?:\.\d+)?))$/

function presetsFor(res) {
  const out = new Map()
  const client = join(ROOT, res, 'client')
  if (!existsSync(client)) return []
  walk(client, p => {
    if (!p.endsWith('.lua')) return
    const src = readFileSync(p, 'utf8')
    for (const m of src.matchAll(/SendNUIMessage\(\s*\{/g)) {
      // The table literal up to its matching brace (nested tables skipped).
      let i = m.index + m[0].length, depth = 1, body = ''
      while (i < src.length && depth > 0) {
        const c = src[i++]
        if (c === '{') depth++
        else if (c === '}') depth--
        if (depth === 1 && c !== '}') body += c
        else if (depth === 2 && c === '{') body += '{}'
      }
      const msg = {}
      for (const part of body.split(/,(?![^(]*\))/)) {
        const kv = part.match(/^\s*([A-Za-z_]\w*)\s*=\s*([\s\S]*?)\s*$/)
        if (!kv) continue
        const v = kv[2].replace(/--.*$/gm, '').trim()
        const s = v.match(SCALAR)
        msg[kv[1]] = s ? (s[1] ?? s[2] ?? (s[3] ? s[3] === 'true' : Number(s[4]))) : (v === '{}' ? {} : null)
      }
      const name = msg.action ?? msg.type
      if (typeof name !== 'string') continue
      const key = JSON.stringify(msg)
      if (!out.has(key)) out.set(key, { label: name, msg })
    }
  })
  return [...out.values()].sort((a, b) => a.label.localeCompare(b.label))
}

const presets = {}
// A resource no longer in this folder (archived, deleted locally) keeps the
// presets read from it last time.
let previous = {}
try { previous = JSON.parse(readFileSync(join(OUT, 'presets.json'), 'utf8')) } catch { previous = {} }
for (const a of APPS) {
  presets[a.res] = existsSync(join(ROOT, a.res, 'client')) ? presetsFor(a.res) : (previous[a.res] || [])
}
writeFileSync(join(OUT, 'presets.json'), JSON.stringify(presets, null, 2))
console.log(`wrote apps/presets.json (${Object.values(presets).reduce((n, l) => n + l.length, 0)} messages)`)

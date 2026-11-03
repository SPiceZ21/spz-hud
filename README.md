# spz-hud

One NUI page for every always-on HUD widget. Players can move and resize the widgets, and widgets show only in the game states they belong to.

It also hosts every other SPiceZ UI. Each resource keeps its Lua and its NUI callbacks, but its page is drawn here, in its own layer of this one NUI page. That gives one place for focus and stacking, and one copy of the shared fonts.

## What it gives you

- **Layout editor:** `/hudedit`. Drag a widget to move it, scroll to resize it (50–200%), and use *hide* to switch one off. Then Save, Reset or Cancel (Esc cancels too). The layout is stored per player in client KVP.
- **Game states:** `freeroam`, `race`, `minigame` and `spectate`, worked out from the player's statebags. Each widget lists the states it shows in. The whole HUD hides behind the pause menu and fades.
- **Focus manager:** one owner for NUI focus, kept as a stack. A UI that closes hands focus back to whatever is underneath, and a resource that stops can't leave the cursor stuck.
- **Fast updates:** each widget re-renders only when its own data changes.

## Hosted apps

19 resources' UIs live in `web/public/apps/<resource>/`: carspawner, chat, crew, emotes, leaderboard, minigames, nametag, pausemenu, poll, raceUI, radio, replay, rocketleague, spawn, spectate, speedcam, speedometer, tunners, tutorial. spz-loading stays separate because FiveM loading screens can't be hosted.

How a hosted resource is wired:

- In its `fxmanifest.lua`, `'@spz-hud/shim.lua'` is the first client script, `spz-hud` is a dependency, and its own `ui_page` is commented out.
- The shim redirects that resource's `SendNUIMessage`, `SetNuiFocus` and `SetNuiFocusKeepInput` to spz-hud. The resource's code is unchanged.
- The copied `index.html` is told its resource name, so its `fetch('https://<resource>/…')` callbacks still reach that resource's `RegisterNUICallback`.
- Focus is a stack. The app that holds it is raised above the others and gets the mouse and keyboard; every other layer ignores input.
- When a hosted resource restarts, its layer reloads.

**Roll back one resource:** uncomment its `ui_page`, remove the shim line, and restart it.

### Editing a hosted UI

Edit the UI in its own resource as before (for example `spz-poll/ui`, then `npm run build` there). Then sync and rebuild here:

```
node tools/sync-apps.mjs            # every app (or: node tools/sync-apps.mjs spz-poll)
cd web && npm run build             # writes ../ui
```

`sync-apps` also:

- moves fonts that two or more apps ship identically to `web/public/shared/fonts`, and rewrites the CSS to use them (this saves 5 MB);
- rewrites links into another resource's UI (`https://cfx-nui-spz-x/ui/...`) to that app's copy here;
- fills in any `public/` asset missing from an old `dist`.

## The shared look (design/)

One design layer is linked as the last stylesheet of every hosted app, so all 19 UIs share one look without changing their own CSS:

- `design/spz-ui.css` holds the tokens and global rules. The tokens are type (Panchang display, Inter body), surface, lines, text, status colours and radii (4/6/8). Every app's own variable names (`--font-disp`, `--r-md`, `--bg-card`, `--island`, …) point at these tokens. The global rules are no glass blur and quiet scrollbars.
- `design/apps/<resource>.css` holds the per-app fixes for what tokens can't reach: accent stripes, gradient washes, glows, and boxes inside boxes.

The rules:

- **One surface.** A panel has a background; what sits inside it does not. Rows, chips and cells separate with a hairline or spacing.
- **No accent bars, no gradient washes, no glow halos.** The accent colour marks text, numbers and the one control that matters.
- **Small radii, hairlines, compact.**
- **One accent:** the theme's primary colour, pushed from spz-core at runtime. Purple appears only for "fastest" (sector or lap), a racing convention.

Edit `design/`, then run `node tools/sync-apps.mjs --design` and `npm run build` in web/.

## Browser preview and dev panel

```
node tools/sync-apps.mjs      # once, and after changing a hosted UI
cd web && npm run dev         # http://localhost:5173
```

The whole HUD runs in the browser with all 19 apps loaded. A control panel sits on the right; press `` ` `` to hide or show it.

- **State:** each button puts the HUD in a game state and sends that state's HUDs, filled with sample data and a live speedometer: Freeroam, Race · warmup, Race · live, Minigame, Spectate, Lobby · queued, Race · intro card, Race · countdown, Race · last lap, Race · results, Time trial and Wanted (cops), plus *clear*. The data is in `web/src/dev/scenarios.ts`, built from the apps' own mocks and in the same message format their Lua sends. `?scenario=race` in the URL picks one, and `?panel=0` hides the panel (useful for screenshots), and `?edit=1` opens layout edit mode.
- **Events:** fire one-off moments on top of the current state: fastest lap (mine or a rival's), split ahead or behind, overtake, lost place, new PB, victory, credits, finish countdown, wanted level, car alongside, countdown GO, rank-up animation, speed camera, chat messages, radio track, minigame 3-2-1 and round result.
- **HUD:** open layout edit mode, and hide or show the HUD.
- **Backdrop:** dark, city, checker or green screen, or a screenshot URL so you can judge the UI over the game.
- **Apps:** click an app's name to show it with sample data, and click again to hide it. A menu also gets the mouse and keyboard. Click ○ to toggle focus on its own.
  - Twelve apps have a browser mock mode of their own. Their layer is reloaded as a plain page (`?spzmock=1`), so they run that mock mode.
  - The rest (speedometer, chat, emotes, tuner, replay, tutorial, poll, spawn) get their open messages filled with sample data, from `web/src/dev/demos.ts`.
- **Send:** filled samples (★, from the scenarios), then a ready-made list of every message the selected resource's Lua sends, read from its `SendNUIMessage` calls by sync-apps and saved as `apps/presets.json`. Pick one, fill in the `null`s, and press Ctrl+Enter. Reload app restarts that layer.
- **Log:** every message sent, and every NUI callback an app made, with its body.
- **Callback answers:** choose what a callback returns (`{}` by default), for example `{ "ok": true, "list": [...] }` for a menu that waits for data. Answers are saved in the browser.

Every action goes through `window.postMessage` in exactly the shape the Lua side sends, so the preview runs the same code paths as the game. The panel is its own chunk and is never loaded in game.

## Using it from another resource

```lua
-- declare a widget (or add it to Config.Widgets)
exports['spz-hud']:Register('lapTimer', {
    label = 'Lap timer', x = 50, y = 4, anchor = 'tc', scale = 1.0,
    states = { race = true },
})

exports['spz-hud']:Push('lapTimer', { ms = 61234 })   -- data for the widget
exports['spz-hud']:Push('lapTimer', false)            -- nothing to show
exports['spz-hud']:SetVisible('lapTimer', false)      -- force it off

-- focus
exports['spz-hud']:RequestFocus('leaderboard', { cursor = true, keyboard = true })
exports['spz-hud']:ReleaseFocus('leaderboard')
```

The widget also needs a component in `ui/src/widgets/index.ts`. Lua can register a widget before the UI ships its component; until then nothing is drawn for it.

### Exports

| Export | Purpose |
|---|---|
| `Register(id, def)` | Add a widget at runtime |
| `Push(id, data)` | Send data to one widget |
| `SetVisible(id, bool)` | Force a widget off or back on |
| `GetState()` | `freeroam` / `race` / `minigame` / `spectate` |
| `IsEditing()` | True while `/hudedit` is open |
| `RequestFocus(owner, opts)` / `ReleaseFocus(owner)` / `FocusOwner()` | Focus stack |

Event: `spz-hud:state` (client) fires with the new state.

## HUD settings (/hudedit)

The edit toolbar also holds the player's HUD settings. They are saved with the layout in client KVP, and cleaned against a list of allowed values in `client/main.lua` (`SETTINGS`).

- **Speedometer: Analogue / Digital.**
  - **Analogue** is spz-speedometer's own gauge.
  - **Digital** is a spz-hud widget (`speedo_digital`, `web/src/widgets/SpeedoDigital.tsx`): speed, gear, a 16-segment rev bar with the last three segments as the redline, and limiter/launch/TCS tags when they're active.
  - Both read the same `update` messages from spz-speedometer, which spz-hud relays, so no Lua changes are needed.
  - Exactly one shows at a time, and each one is placed separately.

Reset also returns the settings to their defaults.

## Moving app UIs (/hudedit)

Every on-screen HUD element of the hosted apps can be moved, resized and hidden in `/hudedit`. That's 23 elements: speedometer; race standings, sectors, key hints, lap/timer, radar, warmup, finish countdown, lobby, wanted, freeroam profile, fastest lap, flourish; your nametag; minigame status, keys and board; spectate bar and race board; speed camera; Rocket League score; chat; radio now playing.

- The list is in `tools/hud-layout.mjs`: per app, each element's selector, label and scale origin.
- Each element is saved as `app:<resource>:<id>`, with an offset and scale per player.
- Placement is applied with the CSS `translate` / `scale` properties, injected into the app's page. These add to an element's own `transform`, so its animations keep working, and the app's code is untouched.
- If some of an app's elements aren't on screen while you place them (on foot, not in a race), its `demo` messages show them with sample data, and its `off` messages take them down afterwards.
- Left out on purpose: things that follow the world (checkpoint marker, other players' nametags) and full-screen moments (countdown, intro, results).

## Layout and build

```
web/            source (Preact + Vite)
web/public/     apps/ and shared/ (generated by sync-apps) plus any static files
ui/             BUILD OUTPUT: what the server loads (ui_page 'ui/index.html')
tools/          sync-apps.mjs
shim.lua        loaded by the hosted resources
```

```
node tools/sync-apps.mjs
cd web
npm install
npm run build
```

On the server, spz-hud needs `fxmanifest.lua`, `config.lua`, `shim.lua`, `client/` and `ui/`. It doesn't need `web/` or `tools/`. Outside the game (`npm run dev` in web/), the page runs on a fake speedometer so you can design in a browser.

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

## Browser preview and dev panel

```
node tools/sync-apps.mjs      # once, and after changing a hosted UI
cd web && npm run dev         # http://localhost:5173
```

The whole HUD runs in the browser with all 19 apps loaded. A control panel sits on the right; press `` ` `` to hide or show it.

- **State:** switch between freeroam, race, minigame and spectate.
- **HUD:** open layout edit mode, and hide or show the HUD.
- **Backdrop:** dark, city, checker or green screen, or a screenshot URL so you can judge the UI over the game.
- **Apps:** click an app to select it. Click ○ to give it focus, which raises it and sends it the mouse and keyboard, the same as SetNuiFocus.
- **Send:** a ready-made list of every message the selected resource's Lua sends, read from its `SendNUIMessage` calls by sync-apps and saved as `apps/presets.json`. Pick one, fill in the `null`s, and press Ctrl+Enter. Reload app restarts that layer.
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

## Test widget

`speedo` is off by default, so it doesn't double up with spz-speedometer. To try the host, add this to server.cfg:

```
setr spz_hud_speedo 1
```

or set `enabled = true` in `config.lua`.

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

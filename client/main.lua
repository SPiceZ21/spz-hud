-- client/main.lua — the HUD host.
--
-- One NUI page draws every always-on widget. Each widget has an id, a default
-- spot (Config.Widgets or Register), and the game states it shows in. The
-- player can move and resize widgets with /hudedit; their layout is stored in
-- client KVP, so it follows them across servers restarts but not machines.
--
-- Other resources feed widgets through exports:
--   exports['spz-hud']:Register('lapTimer', { label = 'Lap timer', x = 50, y = 4, anchor = 'tc', states = { race = true } })
--   exports['spz-hud']:Push('lapTimer', { ms = 61234 })     -- data for that widget
--   exports['spz-hud']:SetVisible('lapTimer', false)        -- hide regardless of state

local KVP_LAYOUT = 'spz-hud:layout'

local widgets = {}        -- [id] = def (copy of config + runtime fields)
local hidden  = {}        -- [id] = true while a resource forced it off
local ready   = false     -- page loaded and listening
local queue   = {}        -- messages sent before the page was ready
local state   = 'freeroam'
local editing = false

local function send(msg)
    if ready then SendNUIMessage(msg) else queue[#queue + 1] = msg end
end
HudSend = send            -- focus.lua / apps.lua

-- ── Layout ──────────────────────────────────────────────────────────────────

local function readStore()
    local raw = GetResourceKvpString(KVP_LAYOUT)
    if not raw or raw == '' then return {} end
    local ok, data = pcall(json.decode, raw)
    if not ok or type(data) ~= 'table' or data.v ~= Config.LayoutVersion then return {} end
    return data
end

local function loadLayout()
    local w = readStore().w
    return type(w) == 'table' and w or {}
end

--- HUD settings (the switches in /hudedit), stored with the layout.
local function loadSettings()
    local s = readStore().s
    return type(s) == 'table' and s or {}
end

local function saveLayout(layout, settings)
    SetResourceKvp(KVP_LAYOUT, json.encode({ v = Config.LayoutVersion, w = layout, s = settings }))
end

--- Known settings and their allowed values; anything else from the page is dropped.
local SETTINGS = {
    speedo = { analogue = true, digital = true },
}

local function cleanSettings(s)
    local out = {}
    for k, allowed in pairs(SETTINGS) do
        local v = type(s) == 'table' and s[k] or nil
        if type(v) == 'string' and allowed[v] then out[k] = v end
    end
    return out
end

local function clamp(n, lo, hi)
    n = tonumber(n) or lo
    if n < lo then return lo elseif n > hi then return hi end
    return n
end

--- Only known widgets, only sane numbers: the layout comes back from the page.
local function cleanLayout(layout)
    local out = {}
    for id, p in pairs(type(layout) == 'table' and layout or {}) do
        if type(p) ~= 'table' then
            -- skip
        elseif widgets[id] then
            out[id] = {
                x = clamp(p.x, 0, 100), y = clamp(p.y, 0, 100),
                scale = clamp(p.scale or 1, 0.5, 2),
                hidden = p.hidden == true or nil,
            }
        elseif type(id) == 'string' and id:match('^app:spz%-[%w_%-]+:[%w_%-]+$') then
            -- A hosted app's element (app:<resource>:<id>): x / y are an
            -- OFFSET from where the app draws it, in % of the screen.
            out[id] = {
                x = clamp(p.x, -100, 100), y = clamp(p.y, -100, 100),
                scale = clamp(p.scale or 1, 0.5, 2),
                hidden = p.hidden == true or nil,
            }
        end
    end
    return out
end

-- ── Registry ────────────────────────────────────────────────────────────────

local function publicDef(id, d)
    return {
        id = id, label = d.label or id,
        x = d.x or 50, y = d.y or 50, anchor = d.anchor or 'tl',
        scale = d.scale or 1.0, states = d.states or { freeroam = true },
    }
end

local function pushRegistry()
    local list = {}
    for id, d in pairs(widgets) do
        if d.enabled ~= false then list[#list + 1] = publicDef(id, d) end
    end
    send({ type = 'registry', widgets = list, layout = loadLayout(), settings = loadSettings(), snap = Config.Snap })
end

local function register(id, def)
    if type(id) ~= 'string' or type(def) ~= 'table' then return false end
    widgets[id] = def
    pushRegistry()
    return true
end

for id, def in pairs(Config.Widgets) do widgets[id] = def end


-- ── Game state ──────────────────────────────────────────────────────────────
-- One state at a time decides which widgets show. Race beats minigame beats
-- freeroam; spectating beats everything (you are not driving).

local function currentState()
    local st = LocalPlayer.state
    if st.spectating then return 'spectate' end
    if st.inRace or st.inTimeTrial then return 'race' end
    if st.inMinigame or st.inPursuit then return 'minigame' end
    return 'freeroam'
end

local function refreshState()
    local s = currentState()
    if s ~= state then
        state = s
        send({ type = 'state', state = state })
        TriggerEvent('spz-hud:state', state)
    end
end

for _, key in ipairs({ 'inRace', 'inTimeTrial', 'inMinigame', 'inPursuit', 'spectating' }) do
    AddStateBagChangeHandler(key, ('player:%d'):format(GetPlayerServerId(PlayerId())), function()
        SetTimeout(0, refreshState)
    end)
end

-- Pause menu / loading screens hide the whole HUD.
CreateThread(function()
    local wasHidden = nil
    while true do
        local h = IsPauseMenuActive() or IsScreenFadedOut() or IsHudHidden()
        if h ~= wasHidden then
            wasHidden = h
            send({ type = 'hidden', hidden = h })
        end
        Wait(250)
    end
end)

-- ── NUI handshake ───────────────────────────────────────────────────────────

-- The page retries 'ready' until it is answered, and this pings it until then:
-- a single lost 'ready' (the page posting before this callback existed, as on a
-- resource restart) used to leave every message queued forever, and the
-- player with a cursor and nothing on screen.
CreateThread(function()
    while not ready do
        SendNUIMessage({ type = 'ping' })   -- direct: the queue is what is stuck
        Wait(1000)
    end
end)

RegisterNUICallback('ready', function(_, cb)
    ready = true
    pushRegistry()
    send({ type = 'state', state = currentState() })
    for id in pairs(hidden) do send({ type = 'visible', id = id, visible = false }) end
    for _, m in ipairs(queue) do SendNUIMessage(m) end
    queue = {}
    cb(true)
end)

-- ── Edit mode ───────────────────────────────────────────────────────────────

local function stopEdit()
    if not editing then return end
    editing = false
    Focus.Release('hud-edit')
    send({ type = 'edit', on = false })
end

RegisterCommand(Config.EditCommand, function()
    if editing then stopEdit(); return end
    editing = true
    Focus.Request('hud-edit', { cursor = true, keyboard = true })
    send({ type = 'edit', on = true })
end, false)

RegisterNUICallback('saveLayout', function(data, cb)
    saveLayout(cleanLayout(data and data.layout), cleanSettings(data and data.settings))
    stopEdit()
    lib.notify({ description = 'HUD layout saved.', type = 'success' })
    cb(true)
end)

RegisterNUICallback('resetLayout', function(_, cb)
    DeleteResourceKvp(KVP_LAYOUT)
    pushRegistry()
    lib.notify({ description = 'HUD layout reset to default.', type = 'inform' })
    cb(true)
end)

RegisterNUICallback('cancelEdit', function(_, cb)
    pushRegistry()                -- throw away unsaved drags
    stopEdit()
    cb(true)
end)

-- ── Exports ─────────────────────────────────────────────────────────────────

exports('Register', register)

exports('Push', function(id, data)
    local d = widgets[id]
    if not d or d.enabled == false then return end
    send({ type = 'data', id = id, data = data })
end)

exports('SetVisible', function(id, on)
    hidden[id] = (on == false) or nil
    send({ type = 'visible', id = id, visible = on ~= false })
end)

exports('GetState', function() return state end)
exports('IsEditing', function() return editing end)

--- Feed loops for built-in widgets check this before doing any work.
function HudWidgetEnabled(id)
    local d = widgets[id]
    return d ~= nil and d.enabled ~= false
end


-- /hudstatus: what spz-hud thinks is going on (F8 console). For when the HUD
-- looks wrong in game: page handshake, queued messages, focus holders, state.
RegisterCommand('hudstatus', function()
    print(('^5[spz-hud]^7 page ready=%s  queued=%d  state=%s  hidden(native)=%s  editing=%s'):format(
        tostring(ready), #queue, tostring(state), tostring(IsPauseMenuActive() or IsScreenFadedOut() or IsHudHidden()), tostring(editing)))
    local st = Focus.Stack()
    print(('^5[spz-hud]^7 focus stack (%d): %s'):format(#st, #st > 0 and table.concat(st, ', ') or 'empty'))
    print(('^5[spz-hud]^7 IsNuiFocused=%s  IsNuiFocusKeepingInput=%s'):format(tostring(IsNuiFocused()), tostring(IsNuiFocusKeepingInput())))
end, false)

-- /hudunstick: drop every focus holder (emergency, if the cursor will not go away).
RegisterCommand('hudunstick', function()
    for _, e in ipairs(Focus.Stack()) do Focus.Release(e:match('^(.-)%(')) end
    SetNuiFocus(false, false)
    print('^5[spz-hud]^7 focus cleared')
end, false)

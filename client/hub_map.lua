-- client/hub_map.lua — the TAB hub's Map tab: Los Santos itself, seen from a
-- camera high over the city, with the pins drawn by the page on top.
--
-- Pins come from the resources that own them (each exports GetMapPins):
--   spz-races      race track starts, speed cameras
--   spz-minigames  the minigame NPCs
--   spz-core       spawn points / garages
-- plus players, read here. Each frame every pin's world position is projected
-- to the screen (GetScreenCoordFromWorldCoord) and the page draws it there, so
-- the pins stay on their spot as the camera pans and zooms.
--
-- Page → Lua: hubMap {on}, hubMapPan {dx, dy}, hubMapZoom {d}, hubMapFocus {id},
-- hubMapWaypoint {id}.   Lua → page: hubMapPins (once), hubMap (positions).

local PITCH_MIN, PITCH_MAX = -80.0, -30.0   -- right-drag tilts between these
local PIN_PX     = 28                 -- pin size on a 1080p screen
local KIND_CELL  = { track = 2, speedcam = 3, minigame = 4, garage = 5, player = 6, me = 7 }
local H_MIN, H_MAX = 220.0, 1700.0    -- camera height (higher only adds haze)
local HOME       = { x = -380.0, y = -620.0, h = 1350.0 }   -- the city, framed
local SEND_MS    = 100                -- positions to the page (for clicks only), 10 per second

local cam, active = nil, false
local cur  = { x = HOME.x, y = HOME.y, h = HOME.h, yaw = 0.0, pitch = -62.0 }
local goal = { x = HOME.x, y = HOME.y, h = HOME.h, yaw = 0.0, pitch = -62.0 }
local pins, byId = {}, {}
local livePins = {}                     -- players, from the server (we are alone in our bucket)
local selected, shownKinds = nil, nil   -- from the page

-- Pins are drawn by the game every frame from a DUI texture (dui/map/pins.html):
-- as smooth as the camera, where the page could only be repositioned 20x a second.
local TXD, TEX = 'spz_hubmap', 'pins'
local dui = nil
local function ensureDui()
    if dui then return end
    dui = CreateDui('nui://spz-hud/dui/map/pins.html', 1024, 128)
    CreateRuntimeTextureFromDuiHandle(CreateRuntimeTxd(TXD), TEX, GetDuiHandle(dui))
end

local function hexRgb(hex)
    hex = tostring(hex or ''):gsub('#', '')
    if not hex:match('^%x%x%x%x%x%x$') then return nil end
    return tonumber(hex:sub(1, 2), 16), tonumber(hex:sub(3, 4), 16), tonumber(hex:sub(5, 6), 16)
end
local function accentRgb()
    local ok, t = pcall(function() return exports['spz-core']:GetTheme() end)
    local r, g, b = hexRgb(ok and t and t.accent)
    return r or 255, g or 98, b or 0
end
local function kindRgb(p)
    if p.accent then local r, g, b = hexRgb(p.accent); if r then return r, g, b end end
    if p.kind == 'track' or p.kind == 'me' then return accentRgb() end
    if p.kind == 'player' then return 96, 165, 250 end
    return 244, 244, 245
end

-- Drawn after SetDrawOrigin(world point): x, y are offsets from that point.
-- ── Track layout ─────────────────────────────────────────────────────────────
-- Selecting a race track draws its route over the city: a ribbon through the
-- gate centres (real world geometry, so it renders with the scene and never
-- lags), wider as the camera climbs so it stays readable, plus a marker per
-- gate and a white one at the start.
local layout = nil   -- { points = { {x,y,z}... }, loop = bool, id = pin id }

local function loadLayout(pinId)
    layout = nil
    local key = tostring(pinId or ''):match('^track:(.+)$')
    if not key then return end
    CreateThread(function()
        local ok, l = pcall(function() return lib.callback.await('spz-races:mapTrackLayout', false, key) end)
        if ok and l and l.points and #l.points > 1 and selected == pinId then
            l.id = pinId
            layout = l
        end
    end)
end

local function ribbon(a, b, half, r, g, bl, al)
    local dx, dy = b.x - a.x, b.y - a.y
    local len = math.sqrt(dx * dx + dy * dy)
    if len < 0.01 then return end
    local nx, ny = -dy / len * half, dx / len * half
    local za, zb = a.z + 1.5, b.z + 1.5
    local a1x, a1y, a2x, a2y = a.x + nx, a.y + ny, a.x - nx, a.y - ny
    local b1x, b1y, b2x, b2y = b.x + nx, b.y + ny, b.x - nx, b.y - ny
    -- both windings: a poly is only drawn from its front
    DrawPoly(a1x, a1y, za, b1x, b1y, zb, b2x, b2y, zb, r, g, bl, al)
    DrawPoly(b2x, b2y, zb, b1x, b1y, zb, a1x, a1y, za, r, g, bl, al)
    DrawPoly(a1x, a1y, za, b2x, b2y, zb, a2x, a2y, za, r, g, bl, al)
    DrawPoly(a2x, a2y, za, b2x, b2y, zb, a1x, a1y, za, r, g, bl, al)
end

local function drawLayout()
    if not layout or layout.id ~= selected then return end
    local pts = layout.points
    local r, g, b = accentRgb()
    local half = math.max(3.0, cur.h * 0.006)         -- metres either side, grows with height
    for i = 1, #pts - 1 do ribbon(pts[i], pts[i + 1], half, r, g, b, 210) end
    if layout.loop then ribbon(pts[#pts], pts[1], half, r, g, b, 210) end
    local ms = half * 2.2
    for i, p in ipairs(pts) do
        if i == 1 then
            DrawMarker(1, p.x, p.y, p.z, 0, 0, 0, 0, 0, 0, ms * 1.6, ms * 1.6, half * 4, 255, 255, 255, 220, false, false, 2, false, nil, nil, false)
        else
            DrawMarker(1, p.x, p.y, p.z, 0, 0, 0, 0, 0, 0, ms, ms, half * 2, r, g, b, 160, false, false, 2, false, nil, nil, false)
        end
    end
end

local function cell(i, x, y, w, h, r, g, b, a)
    DrawSpriteUv(TXD, TEX, x, y, w, h, i / 8, 0.0, (i + 1) / 8, 1.0, 0.0, r, g, b, a)
end

local function label(text, x, y)
    SetTextFont(4); SetTextScale(0.0, 0.32); SetTextColour(244, 244, 245, 255)
    SetTextOutline(); SetTextCentre(false)
    BeginTextCommandDisplayText('STRING'); AddTextComponentSubstringPlayerName(text); EndTextCommandDisplayText(x, y)
end

local function drawPin(p, sx, sy, w, h)
    local r, g, b = kindRgb(p)
    if p.kind == 'me' then
        cell(7, sx, sy, w, h, r, g, b, 255)
        return
    end
    if p.id == selected then
        cell(0, sx, sy, w * 1.18, h * 1.18, r, g, b, 255)
        cell(KIND_CELL[p.kind] or 6, sx, sy, w * 0.75, h * 0.75, 10, 11, 13, 255)
    else
        cell(0, sx, sy, w, h, 8, 9, 11, 225)
        cell(1, sx, sy, w, h, r, g, b, 255)
        cell(KIND_CELL[p.kind] or 6, sx, sy, w * 0.62, h * 0.62, r, g, b, 255)
    end
end

-- From the server: inside the map's private bucket nobody else is streamed.
local function playersFromServer()
    local ok, list = pcall(function() return lib.callback.await('spz-hud:mapPlayers', false) end)
    if not ok or type(list) ~= 'table' then return nil end
    local out, me = {}, GetPlayerServerId(PlayerId())
    for _, pl in ipairs(list) do
        local id = 'player:' .. pl.id
        local p = { id = id, kind = pl.id == me and 'me' or 'player', label = pl.name, sub = pl.id == me and 'You' or 'Driver', x = pl.x, y = pl.y, z = pl.z }
        out[#out + 1] = p
        byId[id] = p
    end
    return out
end

local function collect()
    pins, byId = {}, {}
    for _, res in ipairs({ 'spz-races', 'spz-minigames', 'spz-core' }) do
        if GetResourceState(res) == 'started' then
            local ok, list = pcall(function() return exports[res]:GetMapPins() end)
            if ok and type(list) == 'table' then
                for _, p in ipairs(list) do
                    if p.id and p.x and p.y then pins[#pins + 1] = p; byId[p.id] = p end
                end
            end
        end
    end
end

-- Players move: refreshed on their own, not part of the static pin list.
local function players()
    local out, me = {}, PlayerId()
    for _, pl in ipairs(GetActivePlayers()) do
        local ped = GetPlayerPed(pl)
        if DoesEntityExist(ped) then
            local c = GetEntityCoords(ped)
            local id = 'player:' .. GetPlayerServerId(pl)
            local p = { id = id, kind = pl == me and 'me' or 'player', label = GetPlayerName(pl), sub = pl == me and 'You' or 'Driver', x = c.x, y = c.y, z = c.z }
            out[#out + 1] = p
            byId[id] = p
        end
    end
    return out
end

local function place()
    -- Camera behind and above the target (along -yaw), looking down at pitch.
    local back = cur.h / math.tan(math.rad(-cur.pitch))
    local yr = math.rad(cur.yaw)
    SetCamCoord(cam, cur.x + math.sin(yr) * back, cur.y - math.cos(yr) * back, cur.h)
    SetCamRot(cam, cur.pitch, 0.0, cur.yaw, 2)
    SetFocusPosAndVel(cur.x, cur.y, 0.0, 0.0, 0.0, 0.0)   -- stream the city under the camera
end

local function stop()
    if not active then return end
    active = false
    RenderScriptCams(false, true, 450, true, false)
    if cam then DestroyCam(cam, false) cam = nil end
    ClearFocus()
    DisplayRadar(true)
    TriggerServerEvent('spz-hud:mapBucket', false)
    TriggerEvent('spz:sceneWeather', nil)
    TriggerEvent('spz:sceneTime', nil)
    selected, livePins, layout = nil, {}, nil
end

local function start()
    if active then return end
    active = true
    collect()
    ensureDui()
    HudSend({ type = 'hubMapPins', pins = pins })
    -- A clean view: alone in a population-free bucket (freeroam only), clear
    -- sky at midday. All put back in stop().
    TriggerServerEvent('spz-hud:mapBucket', true)
    TriggerEvent('spz:sceneWeather', 'EXTRASUNNY')
    TriggerEvent('spz:sceneTime', 13)
    CreateThread(function()
        while active do
            livePins = playersFromServer() or livePins
            Wait(1000)
        end
    end)
    local c = GetEntityCoords(PlayerPedId())
    cur = { x = c.x, y = c.y, h = 900.0, yaw = 0.0, pitch = -62.0 }           -- start over the player...
    goal = { x = HOME.x, y = HOME.y, h = HOME.h, yaw = 0.0, pitch = -62.0 }   -- ...and settle on the city
    cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamFov(cam, 50.0)
    place()
    RenderScriptCams(true, true, 650, true, false)
    DisplayRadar(false)

    CreateThread(function()
        local lastSend = 0
        while active do
            -- ease toward the goal
            cur.x = cur.x + (goal.x - cur.x) * 0.12
            cur.y = cur.y + (goal.y - cur.y) * 0.12
            cur.h = cur.h + (goal.h - cur.h) * 0.12
            cur.yaw = cur.yaw + (goal.yaw - cur.yaw) * 0.12
            cur.pitch = cur.pitch + (goal.pitch - cur.pitch) * 0.12
            place()

            -- Every pin, every frame, drawn by the game: in step with the camera.
            local rx, ry = GetActiveScreenResolution()
            local h = PIN_PX / 1080
            local w = h * (ry / rx)                              -- square on any aspect
            local labels = cur.h < 1100
            local out = {}
            -- The draw is anchored to the pin's world point (SetDrawOrigin), so
            -- the engine places it with THIS frame's camera: no lag, no jiggle.
            -- The projection below is only for the page's click targets.
            local sendNow = GetGameTimer() - lastSend >= SEND_MS
            local function draw(p)
                if shownKinds and not shownKinds[p.kind] and p.kind ~= 'me' then return end
                local z = (p.z or 30.0) + 2.0
                SetDrawOrigin(p.x, p.y, z, 0)
                drawPin(p, 0.0, 0.0, w, h)
                if labels or p.id == selected or p.kind == 'me' then label(p.label or '', w * 0.75, -h * 0.32) end
                ClearDrawOrigin()
                if sendNow then
                    local on, sx, sy = GetScreenCoordFromWorldCoord(p.x, p.y, z)
                    if on then out[#out + 1] = { id = p.id, x = sx, y = sy } end
                end
            end
            drawLayout()
            for _, p in ipairs(pins) do draw(p) end
            for _, p in ipairs(livePins) do draw(p) end

            -- The page only needs positions for clicking: a few times a second.
            if sendNow then
                lastSend = GetGameTimer()
                HudSend({ type = 'hubMap', pins = out, live = livePins, h = cur.h })
            end
            -- Keep the city sharp from up here: draw detail further out than
            -- the game normally would at this height (less of the distant haze).
            OverrideLodscaleThisFrame(1.8)
            Wait(0)
        end
    end)
end

-- hub.lua closes the map with the hub.
function HubMapStop() stop() end

RegisterNUICallback('hubMap', function(d, cb)
    if d and d.on then start() else stop() end
    cb(true)
end)

RegisterNUICallback('hubMapPan', function(d, cb)
    if active and d then
        local k = goal.h * 0.0016                        -- world metres per screen pixel, roughly
        local dx, dy = (tonumber(d.dx) or 0) * k, (tonumber(d.dy) or 0) * k
        local yr = math.rad(goal.yaw)
        goal.x = goal.x - (dx * math.cos(yr) + dy * math.sin(yr))
        goal.y = goal.y + (dy * math.cos(yr) - dx * math.sin(yr))
        goal.x = math.max(-4200.0, math.min(4600.0, goal.x))
        goal.y = math.max(-4200.0, math.min(8200.0, goal.y))
    end
    cb(true)
end)

RegisterNUICallback('hubMapZoom', function(d, cb)
    if active and d then
        goal.h = math.max(H_MIN, math.min(H_MAX, goal.h * (1 + (tonumber(d.d) or 0) * 0.14)))
    end
    cb(true)
end)

RegisterNUICallback('hubMapRotate', function(d, cb)
    if active and d then
        goal.yaw = goal.yaw - (tonumber(d.dx) or 0) * 0.25
        goal.pitch = math.max(PITCH_MIN, math.min(PITCH_MAX, goal.pitch - (tonumber(d.dy) or 0) * 0.15))
    end
    cb(true)
end)

RegisterNUICallback('hubMapFilter', function(d, cb)
    shownKinds = nil
    if d and type(d.kinds) == 'table' then
        shownKinds = {}
        for _, k in ipairs(d.kinds) do shownKinds[k] = true end
    end
    cb(true)
end)

RegisterNUICallback('hubMapFocus', function(d, cb)
    selected = d and d.id or nil
    loadLayout(selected)
    local p = active and d and byId[d.id]
    if p then
        goal.x, goal.y = p.x, p.y
        goal.h = p.kind == 'track' and math.max(math.min(goal.h, 1100.0), 800.0) or math.min(goal.h, 700.0)
    end
    cb(true)
end)

-- Track card: straight into a time trial on that track (closes the hub). The
-- car you are in is used; on foot the trial gives you its default.
RegisterNUICallback('hubMapTimeTrial', function(d, cb)
    local p = d and byId[d.id]
    local key = p and p.kind == 'track' and tostring(p.id):gsub('^track:', '')
    if not key then return cb(false) end
    local veh = GetVehiclePedIsIn(PlayerPedId(), false)
    local model = veh ~= 0 and GetEntityArchetypeName(veh) or nil
    if model == '' then model = nil end
    ExecuteCommand('spzhub')   -- close the hub (and the map) first
    SetTimeout(500, function() TriggerServerEvent('SPZ:tt:SelectTrack', key, model) end)
    cb(true)
end)

RegisterNUICallback('hubMapWaypoint', function(d, cb)
    local p = d and byId[d.id]
    if p then
        SetNewWaypoint(p.x, p.y)
        PlaySoundFrontend(-1, 'WAYPOINT_SET', 'HUD_FRONTEND_DEFAULT_SOUNDSET', false)
    end
    cb(p ~= nil)
end)

AddEventHandler('onResourceStop', function(res)
    if res == GetCurrentResourceName() then stop() end
end)

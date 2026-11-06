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

local PITCH      = -62.0              -- degrees down from the horizon
local H_MIN, H_MAX = 260.0, 2600.0    -- camera height
local HOME       = { x = -380.0, y = -620.0, h = 1700.0 }   -- the city, framed
local SEND_MS    = 50                 -- positions to the page, 20 per second

local cam, active = nil, false
local cur, goal = { x = HOME.x, y = HOME.y, h = HOME.h }, { x = HOME.x, y = HOME.y, h = HOME.h }
local pins, byId = {}, {}

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
    -- Camera behind and above the target, looking down at PITCH.
    local back = cur.h / math.tan(math.rad(-PITCH))
    SetCamCoord(cam, cur.x, cur.y - back, cur.h)
    SetCamRot(cam, PITCH, 0.0, 0.0, 2)
    SetFocusPosAndVel(cur.x, cur.y, 0.0, 0.0, 0.0, 0.0)   -- stream the city under the camera
end

local function stop()
    if not active then return end
    active = false
    RenderScriptCams(false, true, 450, true, false)
    if cam then DestroyCam(cam, false) cam = nil end
    ClearFocus()
    DisplayRadar(true)
end

local function start()
    if active then return end
    active = true
    collect()
    HudSend({ type = 'hubMapPins', pins = pins })
    local c = GetEntityCoords(PlayerPedId())
    cur = { x = c.x, y = c.y, h = 900.0 }                      -- start over the player...
    goal = { x = HOME.x, y = HOME.y, h = HOME.h }              -- ...and settle on the city
    cam = CreateCam('DEFAULT_SCRIPTED_CAMERA', true)
    SetCamFov(cam, 50.0)
    place()
    RenderScriptCams(true, true, 650, true, false)
    DisplayRadar(false)

    CreateThread(function()
        local lastSend, live = 0, {}
        while active do
            -- ease toward the goal
            cur.x = cur.x + (goal.x - cur.x) * 0.12
            cur.y = cur.y + (goal.y - cur.y) * 0.12
            cur.h = cur.h + (goal.h - cur.h) * 0.12
            place()

            local now = GetGameTimer()
            if now - lastSend >= SEND_MS then
                lastSend = now
                local out = {}
                local function project(p)
                    local on, sx, sy = GetScreenCoordFromWorldCoord(p.x, p.y, (p.z or 30.0) + 2.0)
                    if on then out[#out + 1] = { id = p.id, x = sx, y = sy } end
                end
                for _, p in ipairs(pins) do project(p) end
                live = players()
                for _, p in ipairs(live) do project(p) end
                HudSend({ type = 'hubMap', pins = out, live = live, h = cur.h })
            end
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
        goal.x = goal.x - (tonumber(d.dx) or 0) * k
        goal.y = goal.y + (tonumber(d.dy) or 0) * k
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

RegisterNUICallback('hubMapFocus', function(d, cb)
    local p = active and d and byId[d.id]
    if p then
        goal.x, goal.y = p.x, p.y
        goal.h = math.min(goal.h, 700.0)
    end
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

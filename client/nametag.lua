-- client/nametag.lua — nametags (yours and other players').
-- Moved from spz-nametag/client/main.lua when it was merged into spz-hud.
-- Its page is still the "spz-nametag" app; these locals send to that page only.
local SendNUIMessage, SetNuiFocus, SetNuiFocusKeepInput, RegisterNUICallback = SpzHudApp('spz-nametag')
local Config = Config.Nametag

-- client/main.lua

-- Base theme (server.cfg spz_theme_* convars via spz-core).
local function pushNametagTheme(theme)
    if theme and next(theme) then
        SendNUIMessage({ action = 'theme', theme = theme })
    end
end
CreateThread(function()
    local ok, theme = pcall(function() return exports['spz-core']:GetTheme() end)
    if ok then pushNametagTheme(theme) end
end)
AddEventHandler('SPZ:themeUpdated', function(theme) pushNametagTheme(theme) end)

local ShowNametags = true
local MyId = GetPlayerServerId(PlayerId())

local PlayerDataCache = {}

local function GetPlayerData(serverId)
    if PlayerDataCache[serverId] and (GetGameTimer() - PlayerDataCache[serverId].lastUpdate < Config.DataRefreshInterval) then
        return PlayerDataCache[serverId].data
    end

    local p = Player(serverId).state

    -- Client-side GetPlayerName() takes a LOCAL player index, not a server id —
    -- passing the server id returns another player's name or "**INVALID**".
    local localIdx = GetPlayerFromServerId(serverId)
    local fallback = (localIdx ~= -1) and GetPlayerName(localIdx) or nil
    if fallback == "**INVALID**" or fallback == "" then fallback = nil end

    local stateName = p['spz:name'] or p['username']
    if stateName == "" or stateName == "**INVALID**" then stateName = nil end

    local finalName = stateName or fallback or ("Driver " .. tostring(serverId))

    local data = {
        name = finalName,
        crew = p['spz:crew'],
        license = p['spz:license'] or p['rank'],
        licenseClass = p['spz:licenseClass'] or (p['rank'] and string.sub(p['rank'], 1, 1)) or "D",
        avatar = p['spz:avatar'] or p['avatarUrl'],
        banner = p['spz:banner'],
        nation = p['spz:nation'],
        raceNumber = p['spz:raceNumber'],
        records = p['spz:records'] or 0,   -- track records held → crown
        isRacing = p['spz:is_racing'] or false
    }

    -- Cache once valid state data or fallback name exists
    if stateName or fallback then
        PlayerDataCache[serverId] = { data = data, lastUpdate = GetGameTimer() }
    end

    return data
end

-- Toggle command
RegisterCommand(Config.Keybind.command, function()
    ShowNametags = not ShowNametags
    if not ShowNametags then
        SendNUIMessage({ action = "clear" })
    end
    lib.notify({ description = string.format("Nametags: %s", ShowNametags and "ENABLED" or "DISABLED"), type = ShowNametags and "info" or "warning" })
end)

if Config.Keybind.enabled then
    RegisterKeyMapping(Config.Keybind.command, Config.Keybind.description, "keyboard", Config.Keybind.key)
end

-- Performance Cache & Throttling
local PlayerVisibilityCache = {}

local function GetPlayerVisibility(serverId, ped, myPed, dist)
    if dist <= 5.0 then return true end

    local now = GetGameTimer()
    local cached = PlayerVisibilityCache[serverId]
    if cached and (now - cached.lastCheck < (Config.RaycastThrottle or 200)) then
        return cached.visible
    end

    local isVisible = HasEntityClearLosToEntity(myPed, ped, 17)
    PlayerVisibilityCache[serverId] = {
        visible = isVisible,
        lastCheck = now
    }
    return isVisible
end

local function GetVehicleName(ped)
    local veh = GetVehiclePedIsIn(ped, false)
    if veh == 0 then return nil end
    local model = GetEntityModel(veh)
    local modelName = GetDisplayNameFromVehicleModel(model)
    local label = GetLabelText(modelName)
    if label == "NULL" then
        return modelName
    else
        return label
    end
end

-- Main Render Loop
CreateThread(function()
    while true do
        local wait = 500
        if ShowNametags then
            wait = Config.UpdateInterval
            
            local myPed = PlayerPedId()
            local myPos = GetEntityCoords(myPed)
            local players = GetActivePlayers()
            local payload = {}

            for _, player in ipairs(players) do
                local serverId = GetPlayerServerId(player)
                
                if serverId ~= MyId then
                    local ped = GetPlayerPed(player)
                    local pos = GetEntityCoords(ped)
                    local dist = #(myPos - pos)

                    if dist < Config.RenderDistance then
                        local data = GetPlayerData(serverId)
                        
                        if data then
                            -- Optimized Raycast check with throttling
                            local isVisible = GetPlayerVisibility(serverId, ped, myPed, dist)

                            if isVisible then
                                -- Project world to screen
                                local offset = IsPedInAnyVehicle(ped, false) and 1.2 or 1.0
                                local onScreen, x, y = GetScreenCoordFromWorldCoord(pos.x, pos.y, pos.z + offset)

                                if onScreen then
                                    local scale = math.max(Config.ScaleMin, Config.ScaleMax - (dist / Config.RenderDistance) * (Config.ScaleMax - Config.ScaleMin))
                                    local opacity = 1.0
                                    if dist > Config.FadeDistance then
                                        opacity = 1.0 - ((dist - Config.FadeDistance) / (Config.RenderDistance - Config.FadeDistance))
                                    end

                                    local isTalking = MumbleIsPlayerTalking(player)

                                    -- Fetch vehicle details if driving
                                    local vehicleName = nil
                                    if Config.ShowVehicleName and IsPedInAnyVehicle(ped, false) then
                                        vehicleName = GetVehicleName(ped)
                                    end

                                    -- Flatten `data` into the tag so the NUI can
                                    -- read tag.name directly — same shape as the
                                    -- self tag. Previously nested under .data,
                                    -- so world tags read tag.name = nil → "Driver".
                                    table.insert(payload, {
                                        id = serverId,
                                        x = x * 100,
                                        y = y * 100,
                                        scale = scale,
                                        opacity = opacity,
                                        isTalking = isTalking,
                                        distance = Config.ShowDistance and math.floor(dist) or nil,
                                        vehicleName = vehicleName,
                                        name = data.name,
                                        crew = data.crew,
                                        license = data.license,
                                        licenseClass = data.licenseClass,
                                        avatar = data.avatar,
                                        banner = data.banner,
                                        nation = data.nation,
                                        raceNumber = data.raceNumber,
                                        records = data.records,
                                        isRacing = data.isRacing,
                                    })
                                end
                            end
                        end
                    end
                end
            end

            -- Self nametag preview removed — never show our own plate. (No per-frame
            -- updateSelf message: the UI already clears it and nothing sets it.)
            SendNUIMessage({
                action = "update",
                nametags = payload
            })
        end
        Wait(wait)
    end
end)


-- State Bag Listeners for real-time updates
AddStateBagChangeHandler(nil, nil, function(bagName, key, value)
    if key == 'spz:name' or key == 'username' or key == 'spz:license' or key == 'rank' or key == 'spz:crew' or key == 'crewTag' or key == 'spz:records' or key == 'spz:nation' or key == 'spz:raceNumber' then
        if bagName and bagName:find('player:') then
            local srcStr = bagName:match('player:(%d+)')
            local src = srcStr and tonumber(srcStr)
            if src and PlayerDataCache[src] then
                PlayerDataCache[src].lastUpdate = 0
            end
        end
    end
end)


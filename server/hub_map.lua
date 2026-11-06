-- server/hub_map.lua — the TAB hub map's private world and its player pins.
--
-- While the map is open the player is moved into a routing bucket of their
-- own with no population: no other players, no NPCs, no traffic, so the view
-- over the city is clean. Only from freeroam (bucket 0, not racing / in a
-- minigame / spectating): moving someone out of a race bucket would break it.
-- They go back to bucket 0 when the map closes, or if they drop.
--
-- Players are not visible from inside that bucket, so their pins come from
-- here (spz-hud:mapPlayers), read server-side for everyone.

local moved = {}   -- [src] = bucket id

local function free(src)
    local b = moved[src]
    if not b then return end
    moved[src] = nil
    pcall(function() exports['spz-core']:AssignPlayerToBucket(src, 0) end)
    pcall(function() exports['spz-core']:DeleteBucket(b) end)
end

RegisterNetEvent('spz-hud:mapBucket', function(on)
    local src = source
    if not on then return free(src) end
    if moved[src] then return end
    local st = Player(src).state
    if GetPlayerRoutingBucket(src) ~= 0 or st.inRace or st.inQueue or st.inTimeTrial
    or st.inMinigame or st.inPursuit or st.spectating then
        return
    end
    local ok, b = pcall(function() return exports['spz-core']:CreateBucket('hubmap:' .. src, false) end)
    if not ok or not b then return end
    moved[src] = b
    pcall(function() exports['spz-core']:AssignPlayerToBucket(src, b) end)
end)

AddEventHandler('playerDropped', function() free(source) end)
AddEventHandler('onResourceStop', function(res)
    if res ~= GetCurrentResourceName() then return end
    for src in pairs(moved) do free(src) end
end)

lib.callback.register('spz-hud:mapPlayers', function(src)
    local out = {}
    for _, id in ipairs(GetPlayers()) do
        local ped = GetPlayerPed(id)
        if ped and ped ~= 0 then
            local c = GetEntityCoords(ped)
            out[#out + 1] = { id = tonumber(id), name = GetPlayerName(id), x = c.x, y = c.y, z = c.z }
        end
    end
    return out
end)

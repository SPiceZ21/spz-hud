-- client/keybar.lua — the key-hint strip (widget `keybar`).
--
-- Which keys matter depends on what the player is doing, so the list is built
-- here per state and pushed to the page when it changes. Keys are read through
-- spz-core's KeyFor, so a rebound key (or a controller) shows what the player
-- actually presses, with the resource's default as the fallback.
--
-- Minigames and spectate draw their own key bars; nothing is shown there.

local function key(cmd, default)
    if GetResourceState('spz-core') ~= 'started' then return default end
    local ok, k = pcall(function() return exports['spz-core']:KeyFor(cmd, default) end)
    return (ok and k) or default
end

local function control(id, default)
    if GetResourceState('spz-core') ~= 'started' then return default end
    local ok, k = pcall(function() return exports['spz-core']:KeyForControl(id, default) end)
    return (ok and k) or default
end

local function started(res) return GetResourceState(res) == 'started' end

local function hints()
    local st = LocalPlayer.state
    local out = {}
    local function add(k, label) if k and k ~= '' then out[#out + 1] = { key = k, label = label } end end

    if st.spectating or st.inMinigame or st.inPursuit then return out end

    if st.inRace or st.inTimeTrial then
        add(key('standingstoggle', 'N'), 'Standings')
        add(key('spz_respawn_cp', 'F4'), 'Last CP')
        add(key('spz_flip_car', 'K'), 'Flip')
        if st.inTimeTrial then
            add(key('tt_restart', 'BKSP'), 'Restart')
        else
            add(key('+spz_rewind', 'B'), 'Rewind')
        end
        if started('spz-leaderboard') then add(key('leaderboard', 'F6'), 'Results') end
        return out
    end

    local ped = PlayerPedId()
    local inCar = GetVehiclePedIsIn(ped, false) ~= 0
    if started('spz-carspawner') then add(key('car', 'F5'), 'Garage') end
    if not inCar and started('spz-emotes') then add(key('+emote_menu', 'O'), 'Emotes') end
    if started('spz-leaderboard') then add(key('leaderboard', 'F6'), 'Results') end
    if started('spz-raceUI') then add(key('spz_freeroamhud', 'PAGEDOWN'), 'Profile') end
    if inCar then add(control(75, 'F'), 'Exit') end
    return out
end

CreateThread(function()
    local last = nil
    while true do
        local list = hints()
        local enc = json.encode(list)
        if enc ~= last then
            last = enc
            HudSend({ type = 'data', id = 'keybar', data = #list > 0 and list or false })
        end
        Wait(500)
    end
end)

-- client/keybar.lua — the key-hint strip (widget `keybar`).
--
-- Which keys matter depends on what the player is doing, so the list is built
-- here per state and pushed to the page when it changes. Keys are read through
-- spz-core's KeyFor every pass, so the strip follows the player's settings: a
-- rebind in Settings > Key Bindings > FiveM shows within about a second (KeyFor
-- caches for 1 s), and picking up a controller switches every key to its pad
-- button at once. Keys with no controller binding are left out on a pad.
--
-- Minigames and spectate draw their own key bars; nothing is shown there.

local function core() return GetResourceState('spz-core') == 'started' end
local function usingPad() return not IsUsingKeyboard(0) end

-- pad: the command's PAD_DIGITALBUTTON binding (nil = it has none, so the
-- hint is dropped while the player is on a controller).
local function key(cmd, default, pad)
    if usingPad() and not pad then return nil end
    if not core() then return default end
    local ok, k = pcall(function() return exports['spz-core']:KeyFor(cmd, default, pad) end)
    return (ok and k) or default
end

local function control(id, default, pad)
    if not core() then return default end
    local ok, k = pcall(function() return exports['spz-core']:KeyForControl(id, default, pad) end)
    return (ok and k) or default
end

local function started(res) return GetResourceState(res) == 'started' end

local function hints()
    local st = LocalPlayer.state
    local out = {}
    local function add(k, label) if k and k ~= '' then out[#out + 1] = { key = k, label = label } end end

    if st.spectating or st.inMinigame or st.inPursuit then return out end

    -- The radial menu (ox_lib keybind, default Z) is there in every state.
    local function radial() add(key('+ox_lib-radial', 'Z'), 'Menu') end

    if st.inRace or st.inTimeTrial then
        add(key('standingstoggle', 'N', 'LDOWN_INDEX'), 'Standings')
        add(key('spz_respawn_cp', 'F4', 'LLEFT_INDEX'), 'Last CP')
        add(key('spz_flip_car', 'K', 'RLEFT_INDEX'), 'Flip')
        if st.inTimeTrial then
            add(key('tt_restart', 'BKSP', 'LUP_INDEX'), 'Restart')
        else
            add(key('+spz_rewind', 'B', 'L1_INDEX'), 'Rewind')
        end
        if started('spz-leaderboard') then add(key('leaderboard', 'F6', 'SELECT_INDEX'), 'Results') end
        radial()
        return out
    end

    local ped = PlayerPedId()
    local inCar = GetVehiclePedIsIn(ped, false) ~= 0
    if started('spz-carspawner') then add(key('car', 'F5'), 'Garage') end
    if not inCar and started('spz-emotes') then add(key('+emote_menu', 'O'), 'Emotes') end
    if started('spz-leaderboard') then add(key('leaderboard', 'F6', 'SELECT_INDEX'), 'Results') end
    if started('spz-raceUI') then add(key('spz_freeroamhud', 'PAGEDOWN'), 'Profile') end   -- the card's show / hide
    if inCar then add(control(75, 'F', 'RUP_INDEX'), 'Exit') end
    radial()
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
        Wait(250)
    end
end)

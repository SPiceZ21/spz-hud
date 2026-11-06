-- server/nametag.lua — nametag state bags.
-- Moved from spz-nametag/server/main.lua when it was merged into spz-hud.
local Config = Config.Nametag

-- server/main.lua

-- Sync player data to state bags for efficient client access
local function SyncPlayerToState(source)
    source = tonumber(source)
    if not source or source <= 0 then return end

    local playerState = Player(source).state
    if not playerState then return end

    local profile = exports["spz-identity"]:GetProfile(source)

    local name = profile and profile.username
    if not name or name == "" or name == "**INVALID**" then
        local gtaName = GetPlayerName(source)
        if gtaName and gtaName ~= "" and gtaName ~= "**INVALID**" then
            name = gtaName
        end
    end
    if not name or name == "" or name == "**INVALID**" then
        name = "Driver " .. tostring(source)
    end

    playerState:set('spz:name', name, true)
    -- crew_tag comes pre-bracketed from identity, e.g. "[NR]" (nil if crewless)
    playerState:set('spz:crew', profile and profile.crew_tag or nil, true)
    playerState:set('spz:license', (profile and profile.rank) or "D-5", true) -- rank is like D-5, C-1 etc
    playerState:set('spz:licenseClass', string.sub((profile and profile.rank) or "D", 1, 1), true)
    playerState:set('spz:nation', profile and profile.nation, true)          -- ISO alpha-2 (lowercase)
    playerState:set('spz:raceNumber', profile and profile.race_number, true) -- 1-99, F1 style
    
    -- Profile picture and banner (URL based)
    playerState:set('spz:avatar', (profile and profile.avatar_url) or Config.DefaultAvatar, true)
    playerState:set('spz:banner', (profile and profile.banner_url) or Config.DefaultBanner, true)
    
    -- Race status (optional, can be updated by race modules)
    if playerState.spz_is_racing == nil then
        playerState:set('spz:is_racing', false, true)
    end
end

-- Listen for identity readiness
AddEventHandler("SPZ:playerReady", function(source, profile)
    SyncPlayerToState(source)
end)

-- Listen for manual updates (e.g. crew change, license promotion)
AddEventHandler("SPZ:syncProfile", function(source, changes)
    SyncPlayerToState(source)
end)

-- Initial sync for players already online (resource restart)
CreateThread(function()
    Wait(500)
    local players = GetPlayers()
    for _, src in ipairs(players) do
        SyncPlayerToState(tonumber(src))
    end
end)

-- Command to manually sync if needed (debug)
RegisterCommand("syncnametags", function(source, args)
    if source == 0 or IsPlayerAceAllowed(source, "command.syncnametags") then
        local target = tonumber(args[1]) or source
        if target > 0 then
            SyncPlayerToState(target)
            print("[spz-nametag] Synced state bags for " .. target)
        end
    end
end, true)

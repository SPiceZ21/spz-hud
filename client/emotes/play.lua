-- client/emotes/play.lua — emotes (play).
-- Moved from spz-emotes/client/play.lua when it was merged into spz-hud.
local Config = Config.Emotes

-- client/play.lua — playing, stopping and remembering emotes.

Emote = { current = nil }   -- the playing entry, or nil

local function notify(msg, t) lib.notify({ title = "Emotes", description = msg, type = t or "inform" }) end
Emote.notify = notify

-- Where emotes are off: racing, minigames, dead, in a car (full-body clips).
function Emote.blocked(e)
    local st, ped = LocalPlayer.state, PlayerPedId()
    if st.inRace or st.inMinigame then return "Not during a race or minigame" end
    if IsEntityDead(ped) or IsPedRagdoll(ped) then return "Not right now" end
    if e and not e.clipset and not e.mood and IsPedInAnyVehicle(ped, false) then return "Get out of the car first" end
    return nil
end

local function loadDict(dict)
    if HasAnimDictLoaded(dict) then return true end
    if not DoesAnimDictExist(dict) then return false end
    RequestAnimDict(dict)
    local dl = GetGameTimer() + 3000
    while not HasAnimDictLoaded(dict) and GetGameTimer() < dl do Wait(0) end
    return HasAnimDictLoaded(dict)
end
Emote.loadDict = loadDict

-- Anim flags: 1 loop, 16 upper body only, 32 allow movement (with 16).
local function flags(e)
    local f = 0
    if e.loop ~= false then f = f + 1 end
    if e.upper then f = f + 16 + 32 end
    return f
end

function Emote.stop(quiet)
    local ped = PlayerPedId()
    if Emote.current then
        if Emote.current.scenario then ClearPedTasks(ped) else ClearPedSecondaryTask(ped); StopAnimTask(ped, Emote.current.dict, Emote.current.anim, 2.0) end
        if not Emote.current.upper and not Emote.current.scenario then ClearPedTasks(ped) end
    end
    Emote.current = nil
    if not quiet then TriggerEvent("spz-emotes:stopped") end
end

-- Plays a clip on a ped (used by the shared emotes too).
function Emote.playClip(ped, dict, anim, flag)
    if not loadDict(dict) then return false end
    TaskPlayAnim(ped, dict, anim, 4.0, -4.0, -1, flag or 0, 0.0, false, false, false)
    RemoveAnimDict(dict)
    return true
end

local function setWalk(clipset)
    local ped = PlayerPedId()
    if not clipset then
        ResetPedMovementClipset(ped, 0.25)
        DeleteResourceKvp("spz_emotes:walk")
        return true
    end
    RequestAnimSet(clipset)
    local dl = GetGameTimer() + 3000
    while not HasAnimSetLoaded(clipset) and GetGameTimer() < dl do Wait(0) end
    if not HasAnimSetLoaded(clipset) then return false end
    SetPedMovementClipset(ped, clipset, 0.25)
    SetResourceKvp("spz_emotes:walk", clipset)
    return true
end

local function setMood(m)
    local ped = PlayerPedId()
    if not m then
        ClearFacialIdleAnimOverride(ped)
        DeleteResourceKvp("spz_emotes:mood")
    else
        SetFacialIdleAnimOverride(ped, m, 0)
        SetResourceKvp("spz_emotes:mood", m)
    end
    return true
end

--- Play an emote by key. Returns true on success.
function Emote.play(key)
    local e = Emotes[key]
    if not e then notify(("No emote called '%s'"):format(tostring(key)), "error") return false end
    local why = Emote.blocked(e)
    if why then notify(why, "error") return false end

    if e.clipset ~= nil then return setWalk(e.clipset) end
    if e.mood ~= nil then return setMood(e.mood) end
    if e.shared then return SharedEmote.request(key) end

    local ped = PlayerPedId()
    Emote.stop(true)
    if e.scenario then
        TaskStartScenarioInPlace(ped, e.scenario, 0, true)
    elseif not Emote.playClip(ped, e.dict, e.anim, flags(e)) then
        notify("That animation isn't available", "error")
        return false
    end
    Emote.current = e
    return true
end

-- /e <name>   ·   /e (no name) stops
RegisterCommand("e", function(_, args)
    if not args[1] then return Emote.stop() end
    Emote.play(args[1]:lower())
end, false)
TriggerEvent("chat:addSuggestion", "/e", "Play an emote", { { name = "name", help = "e.g. dance, wave, sit (empty = stop)" } })

RegisterCommand("+emote_cancel", function() if Emote.current then Emote.stop() end end, false)
RegisterCommand("-emote_cancel", function() end, false)
RegisterKeyMapping("+emote_cancel", "Emotes: stop emote", "keyboard", Config.CancelKey)

-- A one-shot clip ended on its own, or something else took over the ped.
CreateThread(function()
    while true do
        Wait(500)
        local e = Emote.current
        if e and not e.scenario and e.loop == false then
            if not IsEntityPlayingAnim(PlayerPedId(), e.dict, e.anim, 3) then Emote.current = nil end
        end
        -- Racing / minigame started mid-emote: drop it.
        if e and (LocalPlayer.state.inRace or LocalPlayer.state.inMinigame) then Emote.stop(true) end
    end
end)

-- Walk style and mood survive respawns and reconnects.
local function restore()
    local walk = GetResourceKvpString("spz_emotes:walk")
    if walk and walk ~= "" then setWalk(walk) end
    local m = GetResourceKvpString("spz_emotes:mood")
    if m and m ~= "" then setMood(m) end
end
AddEventHandler("playerSpawned", function() SetTimeout(1500, restore) end)
CreateThread(function() Wait(3000) restore() end)

AddEventHandler("onResourceStop", function(res)
    if res == GetCurrentResourceName() and Emote.current then Emote.stop(true) end
end)

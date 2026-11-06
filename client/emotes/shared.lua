-- client/emotes/shared.lua — emotes (shared).
-- Moved from spz-emotes/client/shared.lua when it was merged into spz-hud.
local Config = Config.Emotes

-- client/shared.lua — two-player emotes: ask the closest player, they accept,
-- both play their half facing each other.
--
-- The one who ACCEPTS (role "b") is moved to stand in front of the one who
-- asked (role "a"); each client only ever moves its own ped.

SharedEmote = {}

local function closestPlayer()
    local me = PlayerPedId()
    local myPos = GetEntityCoords(me)
    local best, bestD = nil, Config.SharedRange
    for _, pl in ipairs(GetActivePlayers()) do
        local ped = GetPlayerPed(pl)
        if ped ~= me then
            local d = #(GetEntityCoords(ped) - myPos)
            if d < bestD then best, bestD = pl, d end
        end
    end
    return best
end

function SharedEmote.request(key)
    local pl = closestPlayer()
    if not pl then Emote.notify(("Nobody within %dm"):format(math.floor(Config.SharedRange)), "error") return false end
    TriggerServerEvent("spz-emotes:sharedRequest", GetPlayerServerId(pl), key)
    Emote.notify(("Asked %s — waiting for them to accept"):format(GetPlayerName(pl)))
    return true
end

-- Someone asked us.
RegisterNetEvent("spz-emotes:sharedAsk", function(from, name, key)
    local e = Emotes[key]
    if not e or not e.shared then return end
    if Emote.blocked(e) then return TriggerServerEvent("spz-emotes:sharedAnswer", from, key, false) end
    local ok = lib.alertDialog({
        header   = e.label,
        content  = ("%s wants to %s with you."):format(name, e.label:lower()),
        centered = true, cancel = true,
        labels   = { confirm = "Accept", cancel = "Decline" },
    })
    TriggerServerEvent("spz-emotes:sharedAnswer", from, key, ok == "confirm")
end)

RegisterNetEvent("spz-emotes:sharedDeclined", function(name)
    Emote.notify(("%s declined"):format(name), "error")
end)

-- Both sides: play our half. `other` is the other player's server id.
RegisterNetEvent("spz-emotes:sharedPlay", function(key, role, other)
    local e = Emotes[key]
    if not e or not e.shared then return end
    local pl = GetPlayerFromServerId(other)
    if pl == -1 then return end
    local me, them = PlayerPedId(), GetPlayerPed(pl)

    Emote.stop(true)
    if role == "b" then
        local spot = GetOffsetFromEntityInWorldCoords(them, 0.0, 1.0, 0.0)
        SetEntityCoordsNoOffset(me, spot.x, spot.y, spot.z, false, false, false)
        SetEntityHeading(me, (GetEntityHeading(them) + 180.0) % 360.0)
    else
        TaskTurnPedToFaceEntity(me, them, 600)
        Wait(600)
    end
    Emote.playClip(me, e.shared.dict, role == "a" and e.shared.a or e.shared.b, 0)
end)

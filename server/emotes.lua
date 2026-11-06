-- server/emotes.lua — shared emotes (server).
-- Moved from spz-emotes/server/main.lua when it was merged into spz-hud.
local Config = Config.Emotes

-- server/main.lua — shared-emote routing.

-- ── Shared emotes ────────────────────────────────────────────────────────────
-- pending[target][from] = { key, at } so an answer can only accept a request
-- that was really made.
local pending = {}

local function nameOf(src) return GetPlayerName(src) or ("Player %d"):format(src) end

local function near(a, b)
    local pa, pb = GetPlayerPed(a), GetPlayerPed(b)
    if pa == 0 or pb == 0 then return false end
    return #(GetEntityCoords(pa) - GetEntityCoords(pb)) <= (Config.SharedRange + 2.0)
        and GetPlayerRoutingBucket(a) == GetPlayerRoutingBucket(b)
end

RegisterNetEvent("spz-emotes:sharedRequest", function(target, key)
    local src = source
    target = tonumber(target)
    local e = Emotes[key]
    if not target or target == src or not GetPlayerName(target) or not e or not e.shared then return end
    if not near(src, target) then return end
    pending[target] = pending[target] or {}
    pending[target][src] = { key = key, at = os.time() }
    TriggerClientEvent("spz-emotes:sharedAsk", target, src, nameOf(src), key)
end)

RegisterNetEvent("spz-emotes:sharedAnswer", function(from, key, accepted)
    local src = source
    from = tonumber(from)
    local req = from and pending[src] and pending[src][from]
    if not req or req.key ~= key then return end
    pending[src][from] = nil
    if os.time() - req.at > Config.SharedTimeout then accepted = false end
    if not accepted or not GetPlayerName(from) or not near(src, from) then
        if GetPlayerName(from) then TriggerClientEvent("spz-emotes:sharedDeclined", from, nameOf(src)) end
        return
    end
    TriggerClientEvent("spz-emotes:sharedPlay", from, key, "a", src)
    TriggerClientEvent("spz-emotes:sharedPlay", src, key, "b", from)
end)

AddEventHandler("playerDropped", function()
    pending[source] = nil
end)

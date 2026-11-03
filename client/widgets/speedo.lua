-- client/widgets/speedo.lua — test widget: speed, gear, revs.
-- Only runs when the widget is enabled (Config.Widgets.speedo / spz_hud_speedo).

CreateThread(function()
    Wait(500)
    if not HudWidgetEnabled('speedo') then return end

    local hud = exports['spz-hud']
    local last = nil
    while true do
        local ped = PlayerPedId()
        local veh = GetVehiclePedIsIn(ped, false)
        if veh ~= 0 and GetPedInVehicleSeat(veh, -1) == ped then
            local gear = GetVehicleCurrentGear(veh)
            local d = {
                kmh  = math.floor(GetEntitySpeed(veh) * 3.6 + 0.5),
                gear = gear == 0 and 'R' or gear,
                rpm  = math.floor(GetVehicleCurrentRpm(veh) * 100 + 0.5),
            }
            -- Only send what changed: NUI messages are not free.
            if not last or d.kmh ~= last.kmh or d.gear ~= last.gear or d.rpm ~= last.rpm then
                hud:Push('speedo', d)
                last = d
            end
            Wait(50)
        else
            if last then hud:Push('speedo', false); last = nil end
            Wait(400)
        end
    end
end)

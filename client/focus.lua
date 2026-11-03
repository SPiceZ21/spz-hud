-- client/focus.lua — one owner for NUI focus.
--
-- Every UI used to call SetNuiFocus itself, so two open at once fought over the
-- cursor and whichever closed last could leave the player with no mouse or no
-- controls. Here focus is a stack: each UI asks for it by name, the top of the
-- stack decides, and releasing hands it back to whatever is underneath.
--
--   exports['spz-hud']:RequestFocus('leaderboard', { cursor = true, keyboard = true })
--   exports['spz-hud']:ReleaseFocus('leaderboard')
--
-- Opt-in: resources that still call SetNuiFocus themselves keep working.

Focus = {}

local stack = {}          -- { { owner, cursor, keyboard, invoker } ... } top = last

local function apply()
    local top = stack[#stack]
    if top then
        SetNuiFocus(top.keyboard, top.cursor)
        SetNuiFocusKeepInput(top.keepInput == true)
    else
        SetNuiFocus(false, false)
        SetNuiFocusKeepInput(false)
    end
end

local function indexOf(owner)
    for i = #stack, 1, -1 do
        if stack[i].owner == owner then return i end
    end
end

function Focus.Request(owner, opts, invoker)
    if type(owner) ~= 'string' then return false end
    opts = opts or {}
    local i = indexOf(owner)
    if i then table.remove(stack, i) end
    stack[#stack + 1] = {
        owner     = owner,
        cursor    = opts.cursor ~= false,
        keyboard  = opts.keyboard ~= false,
        keepInput = opts.keepInput,
        invoker   = invoker,
    }
    apply()
    return true
end

function Focus.Release(owner)
    local i = indexOf(owner)
    if not i then return false end
    table.remove(stack, i)
    apply()
    return true
end

function Focus.Top()
    local top = stack[#stack]
    return top and top.owner or nil
end

exports('RequestFocus', function(owner, opts) return Focus.Request(owner, opts, GetInvokingResource()) end)
exports('ReleaseFocus', function(owner) return Focus.Release(owner) end)
exports('FocusOwner', function() return Focus.Top() end)

-- A resource that stops while holding focus must not leave the cursor stuck.
AddEventHandler('onResourceStop', function(res)
    local changed = false
    for i = #stack, 1, -1 do
        if stack[i].invoker == res then table.remove(stack, i); changed = true end
    end
    if changed then apply() end
end)

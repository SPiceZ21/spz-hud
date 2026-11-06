-- shared/emotes.lua — emote list.
-- Moved from spz-emotes/shared/emotes.lua when it was merged into spz-hud.

-- shared/emotes.lua — the emote list. Base-game GTA V animations only.
--
-- Each entry is keyed by its command name (/e <name>):
--   label      shown in the menu
--   dict/anim  an animation clip, or
--   scenario   a world scenario (TaskStartScenarioInPlace)
--   loop       keep playing until cancelled (default true for clips)
--   upper      upper body only: you can still walk while it plays
--   shared     { dict, a = clip for the one who asks, b = clip for the other }
--   clipset    walk style (category "walks")
--   mood       facial mood (category "moods")
--
-- To add one: give it a unique key and a category from Categories below.

Emotes = {}

Categories = {
    { id = "fav",        label = "Favourites" },
    { id = "dances",     label = "Dances" },
    { id = "gestures",   label = "Gestures" },
    { id = "celebrate",  label = "Celebrate" },
    { id = "poses",      label = "Poses" },
    { id = "activities", label = "Activities" },
    { id = "shared",     label = "Shared" },
    { id = "walks",      label = "Walk styles" },
    { id = "moods",      label = "Moods" },
}

local function add(cat, key, e) e.cat = cat; Emotes[key] = e end

-- Celebration / interaction clips: "anim@mp_player_intcelebrationmale@<x>" plays clip "<x>".
local function celeb(cat, key, label, name, loop)
    add(cat, key, { label = label, dict = "anim@mp_player_intcelebrationmale@" .. name, anim = name, loop = loop ~= false })
end

-- ── Dances ──
add("dances", "dance",   { label = "Club dance",      dict = "anim@amb@nightclub@mini@dance@dance_solo@male@var_a@",   anim = "high_center" })
add("dances", "dance2",  { label = "Club dance 2",    dict = "anim@amb@nightclub@mini@dance@dance_solo@female@var_a@", anim = "high_center" })
add("dances", "dance3",  { label = "Low dance",       dict = "anim@amb@nightclub@mini@dance@dance_solo@male@var_b@",   anim = "high_center_down" })
add("dances", "dance4",  { label = "Shuffle",         dict = "missfbi3_sniping",                                       anim = "dance_m_default" })
add("dances", "clown",   { label = "Clown dance",     dict = "move_clown@p_m_two_idles@",                              anim = "fidget_short_dance" })
add("dances", "buttwag", { label = "Butt wag",        dict = "special_ped@mountain_dancer@monologue_3@monologue_3a",   anim = "mnt_dnc_buttwag" })
celeb("dances", "disco",   "Uncle disco",   "uncle_disco")
celeb("dances", "salsa",   "Salsa roll",    "salsa_roll")
celeb("dances", "woogie",  "The woogie",    "the_woogie")
celeb("dances", "tunes",   "Banging tunes", "banging_tunes")
celeb("dances", "cradle",  "Cat's cradle",  "cats_cradle")
celeb("dances", "fish",    "Find the fish", "find_the_fish")
celeb("dances", "heart",   "Heart pumping", "heart_pumping")
celeb("dances", "roof",    "Raise the roof","raise_the_roof")

-- ── Gestures (upper body, walk while doing them) ──
local function gesture(key, label, dict, anim)
    add("gestures", key, { label = label, dict = dict, anim = anim, loop = false, upper = true })
end
gesture("hello",    "Hello",        "gestures@m@standing@casual", "gesture_hello")
gesture("point",    "Point",        "gestures@f@standing@casual", "gesture_point")
gesture("come",     "Come here",    "gestures@m@standing@casual", "gesture_come_here_soft")
gesture("bringit",  "Bring it on",  "gestures@m@standing@casual", "gesture_bring_it_on")
gesture("shrug",    "Shrug",        "gestures@m@standing@casual", "gesture_shrug_hard")
gesture("noway",    "No way",       "gestures@m@standing@casual", "gesture_no_way")
gesture("damn",     "Damn",         "gestures@m@standing@casual", "gesture_damn")
celeb("gestures", "thumbsup", "Thumbs up",   "thumbs_up", false)
celeb("gestures", "facepalm", "Facepalm",    "face_palm", false)
celeb("gestures", "wave",     "Wave",        "wave", false)
celeb("gestures", "salute",   "Salute",      "salute", false)
celeb("gestures", "peace",    "Peace",       "peace", false)
celeb("gestures", "shush",    "Shush",       "shush", false)
celeb("gestures", "kiss",     "Blow a kiss", "blow_kiss", false)
celeb("gestures", "cutthroat","Cut throat",  "cut_throat", false)
celeb("gestures", "knuckles", "Crack knuckles", "knuckle_crunch", false)

-- ── Celebrate ──
celeb("celebrate", "airguitar", "Air guitar",     "air_guitar")
celeb("celebrate", "airsynth",  "Air synth",      "air_synth")
celeb("celebrate", "rock",      "Rock on",        "rock")
celeb("celebrate", "dj",        "DJ",             "dj")
celeb("celebrate", "jazz",      "Jazz hands",     "jazz_hands")
celeb("celebrate", "chicken",   "Chicken taunt",  "chicken_taunt")
celeb("celebrate", "freakout",  "Freak out",      "freakout")
celeb("celebrate", "ohsnap",    "Oh snap",        "oh_snap", false)
celeb("celebrate", "slowclap",  "Slow clap",      "slow_clap")
celeb("celebrate", "karate",    "Karate chops",   "karate_chops")
celeb("celebrate", "boxing",    "Shadow boxing",  "shadow_boxing")
celeb("celebrate", "photo",     "Photography",    "photography")
celeb("celebrate", "brolove",   "Bro love",       "bro_love", false)
celeb("celebrate", "invite",    "Crowd invite",   "crowd_invitation")
add("celebrate", "cheer", { label = "Cheer", scenario = "WORLD_HUMAN_CHEERING" })

-- ── Poses ──
add("poses", "crossarms", { label = "Arms crossed",   dict = "amb@world_human_hang_out_street@female_arms_crossed@base", anim = "base" })
add("poses", "bouncer",   { label = "Bouncer",        dict = "mini@strip_club@idles@bouncer@base",                        anim = "base" })
add("poses", "boss",      { label = "Boss",           dict = "anim@heists@heist_corona@single_team",                      anim = "single_team_loop_boss" })
add("poses", "handsup",   { label = "Hands up",       dict = "missminuteman_1ig_2",                                       anim = "handsup_base", upper = true })
add("poses", "kneel",     { label = "Kneel, hands on head", dict = "random@arrests@busted",                               anim = "idle_a" })
add("poses", "sitground", { label = "Sit on ground",  dict = "anim@heists@fleeca_bank@ig_7_jetski_owner",                 anim = "owner_idle" })
add("poses", "sleep",     { label = "Sleep",          dict = "amb@world_human_bum_slumped@male@laying_on_left_side@base", anim = "base" })
add("poses", "lean",      { label = "Lean",           scenario = "WORLD_HUMAN_LEANING" })
add("poses", "hangout",   { label = "Hang out",       scenario = "WORLD_HUMAN_HANG_OUT_STREET" })
add("poses", "guard",     { label = "Guard",          scenario = "WORLD_HUMAN_GUARD_STAND" })
add("poses", "impatient", { label = "Impatient",      scenario = "WORLD_HUMAN_STAND_IMPATIENT" })
add("poses", "statue",    { label = "Statue",         scenario = "WORLD_HUMAN_HUMAN_STATUE" })
add("poses", "flex",      { label = "Flex",           scenario = "WORLD_HUMAN_MUSCLE_FLEX" })
add("poses", "sunbathe",  { label = "Sunbathe",       scenario = "WORLD_HUMAN_SUNBATHE_BACK" })

-- ── Activities ──
add("activities", "smoke",     { label = "Smoke",        scenario = "WORLD_HUMAN_SMOKING" })
add("activities", "coffee",    { label = "Coffee",       scenario = "WORLD_HUMAN_AA_COFFEE" })
add("activities", "drink",     { label = "Drink",        scenario = "WORLD_HUMAN_DRINKING" })
add("activities", "phone",     { label = "Phone",        scenario = "WORLD_HUMAN_STAND_MOBILE" })
add("activities", "selfie",    { label = "Selfie",       scenario = "WORLD_HUMAN_TOURIST_MOBILE" })
add("activities", "map",       { label = "Read map",     scenario = "WORLD_HUMAN_TOURIST_MAP" })
add("activities", "camera",    { label = "Camera",       scenario = "WORLD_HUMAN_PAPARAZZI" })
add("activities", "binoculars",{ label = "Binoculars",   scenario = "WORLD_HUMAN_BINOCULARS" })
add("activities", "clipboard", { label = "Clipboard",    scenario = "WORLD_HUMAN_CLIPBOARD" })
add("activities", "guitar",    { label = "Guitar",       scenario = "WORLD_HUMAN_MUSICIAN" })
add("activities", "party",     { label = "Party",        scenario = "WORLD_HUMAN_PARTYING" })
add("activities", "pushups",   { label = "Push-ups",     scenario = "WORLD_HUMAN_PUSH_UPS" })
add("activities", "situps",    { label = "Sit-ups",      scenario = "WORLD_HUMAN_SIT_UPS" })
add("activities", "yoga",      { label = "Yoga",         scenario = "WORLD_HUMAN_YOGA" })
add("activities", "weights",   { label = "Weights",      scenario = "WORLD_HUMAN_MUSCLE_FREE_WEIGHTS" })
add("activities", "jog",       { label = "Jog on spot",  scenario = "WORLD_HUMAN_JOG_STANDING" })
add("activities", "hammer",    { label = "Hammer",       scenario = "WORLD_HUMAN_HAMMERING" })
add("activities", "weld",      { label = "Weld",         scenario = "WORLD_HUMAN_WELDING" })
add("activities", "mechanic",  { label = "Kneel / inspect", scenario = "CODE_HUMAN_MEDIC_KNEEL" })
add("activities", "drunk",     { label = "Stupor",       scenario = "WORLD_HUMAN_STUPOR" })

-- ── Shared (needs another player, who accepts) ──
add("shared", "handshake", { label = "Handshake", shared = { dict = "mp_ped_interaction", a = "handshake_guy_a", b = "handshake_guy_b" } })
add("shared", "hug",       { label = "Hug",       shared = { dict = "mp_ped_interaction", a = "hugs_guy_a",      b = "hugs_guy_b" } })
add("shared", "highfive",  { label = "High five", shared = { dict = "mp_ped_interaction", a = "highfive_guy_a",  b = "highfive_guy_b" } })
add("shared", "bro",       { label = "Bro hug",   shared = { dict = "mp_ped_interaction", a = "kisses_guy_a",    b = "kisses_guy_b" } })

-- ── Walk styles ──
local function walk(key, label, clipset) add("walks", key, { label = label, clipset = clipset }) end
walk("walkreset",     "Default",        false)
walk("walkconfident", "Confident",      "move_m@confident")
walk("walkgangster",  "Gangster",       "move_m@gangster@generic")
walk("walkhipster",   "Hipster",        "move_m@hipster@a")
walk("walkbusiness",  "Business",       "move_m@business@a")
walk("walkcasual",    "Casual",         "move_m@casual@d")
walk("walktough",     "Tough",          "move_m@tough_guy@")
walk("walkshady",     "Shady",          "move_m@shadyped@a")
walk("walkquick",     "Quick",          "move_m@quick")
walk("walkhurry",     "Hurry",          "move_m@hurry@a")
walk("walksad",       "Sad",            "move_m@sad@a")
walk("walkinjured",   "Injured",        "move_m@injured")
walk("walkdrunk",     "Drunk",          "move_m@drunk@verydrunk")
walk("walksexy",      "Sassy",          "move_f@sexy@a")
walk("walkheels",     "Heels",          "move_f@heels@c")

-- ── Moods ──
local function mood(key, label, m) add("moods", key, { label = label, mood = m }) end
mood("moodreset",    "Normal",    false)
mood("moodhappy",    "Happy",     "mood_happy_1")
mood("moodangry",    "Angry",     "mood_angry_1")
mood("moodsmug",     "Smug",      "mood_smug_1")
mood("moodstressed", "Stressed",  "mood_stressed_1")
mood("moodsleepy",   "Sleepy",    "mood_sleeping_1")
mood("moodinjured",  "Hurt",      "mood_injured_1")

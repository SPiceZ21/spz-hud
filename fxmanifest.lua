fx_version 'cerulean'
game 'gta5'
lua54 'yes'

description 'SPiceZ HUD host: one overlay page, player-placed widgets, shared focus'
author 'SPiceZ'
version '0.1.0'

ui_page 'ui/index.html'

files {
    'ui/**/*',
    'shim.lua',
}

shared_scripts {
    '@ox_lib/init.lua',
    'config.lua',
}

client_scripts {
    'client/focus.lua',
    'client/main.lua',
    'client/apps.lua',
    'client/keybar.lua',
}

dependencies {
    'ox_lib',
}

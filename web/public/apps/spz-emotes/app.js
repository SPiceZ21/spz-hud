// spz-emotes menu. Data comes from client/menu.lua on open.
const $ = (id) => document.getElementById(id)
const RES = 'spz-emotes'
const post = (name, body) =>
  fetch(`https://${RES}/${name}`, { method: 'POST', body: JSON.stringify(body || {}) }).catch(() => {})

let cats = [], emotes = [], favs = [], cat = 'dances', playing = null, sex = 'male'

function applyTheme(t) {
  if (t && t.accent) document.documentElement.style.setProperty('--accent', t.accent)
}

function setPlaying(label) {
  playing = label || null
  $('now').classList.toggle('on', !!playing)
  $('nowLabel').textContent = playing ? `Playing: ${playing}` : 'Nothing playing'
  for (const c of document.querySelectorAll('.card')) c.classList.toggle('playing', c.dataset.label === playing)
}

function renderCats() {
  $('cats').innerHTML = ''
  for (const c of cats) {
    const b = document.createElement('button')
    b.textContent = c.label
    b.className = c.id === cat ? 'on' : ''
    b.onclick = () => { cat = c.id; $('q').value = ''; renderCats(); renderGrid() }
    $('cats').appendChild(b)
  }
}

function card(e) {
  const el = document.createElement('div')
  el.className = 'card' + (e.label === playing ? ' playing' : '')
  el.dataset.label = e.label

  const thumb = document.createElement('div')
  thumb.className = 'thumb'
  thumb.innerHTML = `<span class="glyph">${e.label.charAt(0)}</span>`
  // Animated preview (ui/previews/<sex>/<key>.webp), the other sex's render if
  // this one has none, otherwise the letter stays.
  const other = sex === 'female' ? 'male' : 'female'
  const tryLoad = (list) => {
    if (!list.length) return
    const img = new Image()
    img.onload = () => { thumb.innerHTML = ''; thumb.appendChild(img) }
    img.onerror = () => tryLoad(list.slice(1))
    img.src = list[0]
  }
  tryLoad([`previews/${sex}/${e.key}.webp`, `previews/${other}/${e.key}.webp`])

  const meta = document.createElement('div')
  meta.className = 'meta'
  meta.innerHTML = `<div class="name"></div><div class="cmd"></div>`
  meta.querySelector('.name').textContent = e.label
  meta.querySelector('.cmd').textContent = `/e ${e.key}`

  const star = document.createElement('button')
  star.className = 'star' + (favs.includes(e.key) ? ' on' : '')
  star.textContent = favs.includes(e.key) ? '★' : '☆'
  star.onclick = (ev) => {
    ev.stopPropagation()
    favs = favs.includes(e.key) ? favs.filter((k) => k !== e.key) : favs.concat(e.key)
    post('favs', { favs })
    renderGrid()
  }

  el.append(thumb, meta, star)
  if (e.shared || e.upper) {
    const tag = document.createElement('span')
    tag.className = 'tag'
    tag.textContent = e.shared ? 'With a friend' : 'Walk & play'
    el.appendChild(tag)
  }
  el.onclick = () => post('play', { key: e.key })
  return el
}

function renderGrid() {
  const q = $('q').value.trim().toLowerCase()
  let shown
  if (q) shown = emotes.filter((e) => e.label.toLowerCase().includes(q) || e.key.includes(q))
  else if (cat === 'fav') shown = emotes.filter((e) => favs.includes(e.key))
  else shown = emotes.filter((e) => e.cat === cat)

  const grid = $('grid')
  grid.innerHTML = ''
  if (!shown.length) {
    const d = document.createElement('div')
    d.className = 'empty'
    d.textContent = cat === 'fav' && !q ? 'Star an emote to keep it here' : 'No emotes found'
    grid.appendChild(d)
    return
  }
  for (const e of shown) grid.appendChild(card(e))
}

function open(d) {
  cats = d.categories || []
  emotes = d.emotes || []
  favs = d.favs || []
  sex = d.sex === 'female' ? 'female' : 'male'
  if (!cats.find((c) => c.id === cat)) cat = 'dances'
  if (cat === 'fav' && !favs.length) cat = 'dances'
  applyTheme(d.theme)
  $('cancelKey').textContent = d.cancelKey || 'X'
  renderCats()
  renderGrid()
  setPlaying(d.playing)
  $('root').classList.remove('hidden')
  $('q').value = ''
}

function close() {
  $('root').classList.add('hidden')
}

window.addEventListener('message', (ev) => {
  const d = ev.data || {}
  if (d.action === 'open') open(d)
  else if (d.action === 'close') close()
  else if (d.action === 'playing') setPlaying(d.label)
  else if (d.action === 'theme') applyTheme(d.theme)
})

$('q').addEventListener('input', renderGrid)
$('close').onclick = () => post('close')
$('stop').onclick = () => post('stop')
document.addEventListener('keydown', (ev) => {
  if (ev.key === 'Escape') post('close')
})

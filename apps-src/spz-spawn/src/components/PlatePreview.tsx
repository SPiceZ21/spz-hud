import { useEffect, useRef } from 'preact/hooks'

/*
 * The number plate as it will look on the car: the game's own plate texture
 * (plate01, "Blue on White") with the text cut from the game's plate glyph
 * atlas. Same renderer as spz-speedcam's capture card (ui/script.js drawPlate),
 * so the preview and the speed-camera photo show the identical plate.
 *
 * Textures: ui/public/plates/{plate01,vehicle_generic_plate_font}.png, copied
 * from spz-speedcam/ui/plates.
 */

const BG = 'plates/plate01.png'
const ATLAS = 'plates/vehicle_generic_plate_font.png'
const INK = '#1d2b57'
const TEXT_BOX = { x: 30, y: 48, w: 196, h: 44 }   // in 256x128 texture space

const ATLAS_COLS = 16
const CELL_W = 16
const CELL_H = 32
const INSET_X = 2
const INSET_W = 12
const INSET_Y = 2
const INSET_H = 28

let bgImg: HTMLImageElement | null = null
let atlasImg: HTMLImageElement | null = null
let atlasMask: HTMLCanvasElement | null = null

function load(src: string) {
  const img = new Image()
  img.src = src
  return img
}

// The atlas is greyscale: a mid-grey block per cell with the glyph face stamped
// brighter on top. Isolate the face as a white alpha mask so it can be inked.
function buildMask(img: HTMLImageElement) {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  const data = ctx.getImageData(0, 0, c.width, c.height)
  const px = data.data
  const LO = 112, HI = 148
  for (let i = 0; i < px.length; i += 4) {
    const a = Math.max(0, Math.min(1, (px[i] - LO) / (HI - LO)))
    px[i] = px[i + 1] = px[i + 2] = 255
    px[i + 3] = Math.round(a * 255)
  }
  ctx.putImageData(data, 0, 0)
  return c
}

function cell(ch: string) {
  const code = ch.charCodeAt(0)
  let idx = -1
  if (code >= 48 && code <= 57) idx = code - 48
  else if (code >= 65 && code <= 90) idx = code - 65 + 10
  if (idx < 0) return null   // spaces (and anything else) leave a gap
  return { x: (idx % ATLAS_COLS) * CELL_W, y: Math.floor(idx / ATLAS_COLS) * CELL_H }
}

function draw(canvas: HTMLCanvasElement, text: string, dim: boolean) {
  if (!bgImg) bgImg = load(BG)
  if (!atlasImg) atlasImg = load(ATLAS)
  const bg = bgImg, atlas = atlasImg
  if (!(bg.complete && bg.naturalWidth && atlas.complete && atlas.naturalWidth)) {
    Promise.all([bg.decode(), atlas.decode()]).then(() => draw(canvas, text, dim)).catch(() => {})
    return
  }
  if (!atlasMask) atlasMask = buildMask(atlas)

  const ctx = canvas.getContext('2d')!
  const scale = canvas.width / 256
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bg, 0, 0, canvas.width, canvas.height)

  const chars = text.split('')
  if (!chars.length) return

  // Fixed advance for 8 characters, so the text does not reflow wider/narrower
  // as you type; the string is centred inside the plate's text box.
  const advance = Math.min(TEXT_BOX.w / Math.max(chars.length, 6), (TEXT_BOX.h / INSET_H) * INSET_W * 1.15)
  const glyphW = advance / 1.15
  const glyphH = glyphW * (INSET_H / INSET_W)
  const startX = TEXT_BOX.x + (TEXT_BOX.w - advance * chars.length) / 2 + (advance - glyphW) / 2
  const startY = TEXT_BOX.y + (TEXT_BOX.h - glyphH) / 2

  const layer = document.createElement('canvas')
  layer.width = canvas.width
  layer.height = canvas.height
  const lctx = layer.getContext('2d')!
  lctx.imageSmoothingQuality = 'high'
  chars.forEach((ch, i) => {
    const c = cell(ch)
    if (!c) return
    lctx.drawImage(atlasMask!, c.x + INSET_X, c.y + INSET_Y, INSET_W, INSET_H,
      (startX + advance * i) * scale, startY * scale, glyphW * scale, glyphH * scale)
  })
  lctx.globalCompositeOperation = 'source-in'
  lctx.fillStyle = INK
  lctx.fillRect(0, 0, layer.width, layer.height)

  ctx.globalAlpha = dim ? 0.35 : 1
  ctx.drawImage(layer, 0, 0)
  ctx.globalAlpha = 1
}

/** `text` empty → shows the placeholder dimmed. */
export function PlatePreview({ text, placeholder = 'SPZ 2026' }: { text: string; placeholder?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (ref.current) draw(ref.current, (text || placeholder).toUpperCase(), !text)
  }, [text, placeholder])
  return <canvas ref={ref} class="cc-plate-img" width={512} height={256} />
}

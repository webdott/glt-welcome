// Renders the share images and favicons into public/. Usage: pnpm social
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import satori from 'satori'
import sharp from 'sharp'

const INK = '#0e150c'
const PAPER = '#f7f5ef'
const GREEN = '#257f18'
const MUTED_ON_INK = 'rgba(247,245,239,0.66)'
const MUTED_ON_PAPER = 'rgba(14,21,12,0.64)'

const font = (pkg, file) => readFile(path.resolve('node_modules', pkg, 'files', file))
const fonts = [
  { name: 'Anton', data: await font('@fontsource/anton', 'anton-latin-400-normal.woff'), weight: 400, style: 'normal' },
  { name: 'Plex Mono', data: await font('@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-500-normal.woff'), weight: 500, style: 'normal' },
]

// Tiny element helper so the layouts read like markup.
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', boxSizing: 'border-box', ...style }, children: children.flat() } })
const mono = (text, style = {}) => h('div', { fontFamily: 'Plex Mono', fontSize: 20, letterSpacing: 1.2, textTransform: 'uppercase', ...style }, text)
const display = (lines, style) =>
  h('div', { flexDirection: 'column', fontFamily: 'Anton', lineHeight: 0.98, textTransform: 'uppercase', ...style }, ...lines.map((l) => h('div', {}, l)))
const square = (size, color) => h('div', { width: size, height: size, background: color, flexShrink: 0 })

const render = (tree, width, height) => satori(tree, { width, height, fonts })
const png = (svg, width, height) => sharp(Buffer.from(svg)).resize(width, height).png({ compressionLevel: 9 }).toBuffer()
// Photo cards go out as JPEG: WhatsApp tends to drop share images over ~300 KB.
const jpeg = (svg) => sharp(Buffer.from(svg)).jpeg({ quality: 84, mozjpeg: true }).toBuffer()

async function photo(file, width, height) {
  const buf = await sharp(path.resolve('public/gallery', file)).resize(width, height, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

const out = path.resolve('public')
await mkdir(path.join(out, 'og'), { recursive: true })

/* Share images, 1200 × 630 */

const homePhoto = await photo('2r6a0305-1280.webp', 470, 630)
const home = h(
  'div',
  { width: 1200, height: 630, background: INK, color: PAPER },
  h(
    'div',
    { flexDirection: 'column', justifyContent: 'space-between', width: 730, padding: '56px 56px 52px' },
    h('div', { justifyContent: 'space-between', borderTop: `1px solid rgba(247,245,239,0.2)`, paddingTop: 16 }, mono('God’s Love Tabernacle', { color: MUTED_ON_INK }), mono('Ile-Ife', { color: MUTED_ON_INK })),
    display(['Welcome home,', 'fresher.'], { fontSize: 112 }),
    h('div', { alignItems: 'center', gap: 16 }, square(16, GREEN), mono('Sun 8:00 & 10:00 · Wed 5:30pm · Ibadan Road', { fontSize: 19 })),
  ),
  { type: 'img', props: { src: homePhoto, width: 470, height: 630, style: { width: 470, height: 630, objectFit: 'cover' } } },
)

const study = h(
  'div',
  { flexDirection: 'column', justifyContent: 'space-between', width: 1200, height: 630, padding: '56px 64px 52px', background: PAPER, color: INK },
  h('div', { justifyContent: 'space-between', borderTop: `1px solid rgba(14,21,12,0.18)`, paddingTop: 16 }, mono('GLT Ile-Ife · Study space', { color: MUTED_ON_PAPER }), mono('Free for OAU students', { color: MUTED_ON_PAPER })),
  display(['Your semester,', 'organised.'], { fontSize: 136 }),
  h(
    'div',
    { alignItems: 'center', gap: 16, borderTop: `1px solid rgba(14,21,12,0.18)`, paddingTop: 20 },
    square(16, GREEN),
    mono('Timetable · CGPA · Focus timer · Study Buddy · Progress', { fontSize: 21 }),
  ),
)

await writeFile(path.join(out, 'og', 'home.jpg'), await jpeg(await render(home, 1200, 630)))
await writeFile(path.join(out, 'og', 'study.png'), await png(await render(study, 1200, 630), 1200, 630))

/* Icons: the GLT wordmark on ink */

const mark = (size, { padding = 0.12, transparentCorners = false } = {}) =>
  h(
    'div',
    {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
      background: INK,
      borderRadius: transparentCorners ? size * 0.18 : 0,
      padding: size * padding,
    },
    h('div', { fontFamily: 'Anton', fontSize: size * 0.5, lineHeight: 1, color: PAPER, letterSpacing: size * 0.005 }, 'GLT'),
  )

const svgIcon = await render(mark(64, { transparentCorners: true }), 64, 64)
await writeFile(path.join(out, 'favicon.svg'), svgIcon)

const icon = async (size, opts) => png(await render(mark(size, opts), size, size), size, size)
await writeFile(path.join(out, 'apple-touch-icon.png'), await icon(180))
await writeFile(path.join(out, 'icon-192.png'), await icon(192, { transparentCorners: true }))
await writeFile(path.join(out, 'icon-512.png'), await icon(512, { transparentCorners: true }))
// Maskable icons get cropped to a circle or squircle, so keep the mark inside the middle 80%.
await writeFile(path.join(out, 'icon-maskable-512.png'), await png(await render(mark(512, { padding: 0.22 }), 512, 512), 512, 512))

// favicon.ico holding 16, 32 and 48 px PNGs, for browsers and tools that only look for it.
const icoSizes = [16, 32, 48]
const images = await Promise.all(icoSizes.map((s) => icon(s, { transparentCorners: true })))
const header = Buffer.alloc(6 + icoSizes.length * 16)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(icoSizes.length, 4)
let offset = header.length
icoSizes.forEach((s, i) => {
  const at = 6 + i * 16
  header.writeUInt8(s, at)
  header.writeUInt8(s, at + 1)
  header.writeUInt16LE(1, at + 4)
  header.writeUInt16LE(32, at + 6)
  header.writeUInt32LE(images[i].length, at + 8)
  header.writeUInt32LE(offset, at + 12)
  offset += images[i].length
})
await writeFile(path.join(out, 'favicon.ico'), Buffer.concat([header, ...images]))

await writeFile(
  path.join(out, 'site.webmanifest'),
  `${JSON.stringify(
    {
      name: 'GLT Ile-Ife',
      short_name: 'GLT Ife',
      start_url: '/',
      display: 'standalone',
      background_color: PAPER,
      theme_color: INK,
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    null,
    2,
  )}\n`,
)

console.log('Share images → public/og, icons and manifest → public')

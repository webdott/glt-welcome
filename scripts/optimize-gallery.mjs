// Turns the photos listed in gallery-picks.json into web-sized WebP files
// plus a manifest the gallery reads. Usage: pnpm gallery <folder of originals>
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const HEIGHTS = [400, 640, 960, 1280]

const source = process.argv[2]
if (!source) {
  console.error('Usage: pnpm gallery <folder of .jpg photos>')
  process.exit(1)
}

const { rows, mobileFirst, features = [] } = JSON.parse(
  await readFile(new URL('./gallery-picks.json', import.meta.url), 'utf8'),
)
const outDir = path.resolve('public/gallery')
const manifestPath = path.resolve('src/gallery.json')

await rm(outDir, { recursive: true, force: true })
await mkdir(outDir, { recursive: true })

const slug = (file) => path.parse(file).name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
const done = new Map()
let bytes = 0

async function processPhoto(file) {
  if (done.has(file)) return done.get(file)
  const id = slug(file)
  const image = sharp(path.join(source, file)).autoOrient()
  const { width, height } = (await image.metadata()).autoOrient

  const sizes = await Promise.all(
    HEIGHTS.map(async (h) => {
      const info = await image
        .clone()
        .resize({ height: h, withoutEnlargement: true })
        .webp({ quality: 72, effort: 6, smartSubsample: true })
        .toFile(path.join(outDir, `${id}-${h}.webp`))
      bytes += info.size
      return { h, w: info.width }
    }),
  )

  // A 20px-tall preview, inlined so each frame has a soft image before the real one arrives.
  const lqip = await image.clone().resize({ height: 20 }).webp({ quality: 40 }).toBuffer()

  const photo = {
    id,
    ratio: Number((width / height).toFixed(4)),
    widths: Object.fromEntries(sizes.map(({ h, w }) => [h, w])),
    lqip: `data:image/webp;base64,${lqip.toString('base64')}`,
  }
  done.set(file, photo)
  console.log(`${id.padEnd(28)} ${width}×${height}`)
  return photo
}

const manifest = { heights: HEIGHTS, mobileFirst: mobileFirst && slug(mobileFirst), rows: [] }
for (const row of rows) {
  const out = []
  for (const file of row) out.push(await processPhoto(file))
  manifest.rows.push(out)
}

await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`\n${done.size} photos, ${(bytes / 1048576).toFixed(1)} MB across all sizes → public/gallery`)

// Single photos used elsewhere on the page, cropped to their slot: public/photos/<name>-<width>.webp
const photosDir = path.resolve('public/photos')
await mkdir(photosDir, { recursive: true })
for (const { file, name, aspect, top } of features) {
  const image = sharp(path.join(source, file)).autoOrient()
  const { width, height } = (await image.metadata()).autoOrient
  const cropped = image.extract({ left: 0, top: Math.round(height * top), width, height: Math.round(width / aspect) })
  for (const w of [800, 1200, 1600]) {
    await cropped
      .clone()
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 74, effort: 6, smartSubsample: true })
      .toFile(path.join(photosDir, `${name}-${w}.webp`))
  }
  console.log(`${name} ← ${file}`)
}

// Builds the "Ile-Ife Extension" lockup from brand/glt-ile-ife-logo.svg. The source logo is outlined,
// so the new bottom line reuses its glyphs and draws the missing ones (-, X, T) to the same metrics.
import { readFile } from 'node:fs/promises'
import path from 'node:path'

const TOP = 575.47
const BOTTOM = 596
const STEM = 4

// Glyph outlines from the source's "ILE IFE, OSUN" line, with their left edge and width.
const SOURCE_GLYPHS = {
  I: { start: 'M457.7,596V575.47h4.05V596Z', x: 457.7, w: 4.05, sides: 'ss' },
  L: { start: 'M469.06,596', x: 469.05, w: 13.15, sides: 'so' },
  E: { start: 'M487.89,596', x: 487.9, w: 12.85, sides: 'so' },
  F: { start: 'M528.49,596', x: 528.5, w: 13, sides: 'so' },
  O: { start: 'M597.6,575a', x: 587.05, w: 21.4, sides: 'rr' },
  S: { start: 'M624.43,581.47', x: 612.75, w: 15.55, sides: 'rr' },
  N: { start: 'M670.27,596', x: 656.95, w: 17.55, sides: 'ss' },
}

// Glyphs the source doesn't have, drawn at x = 0 to match the strokes above.
const HYPHEN_W = 7.2
const T_W = 15
const X_W = 16.5
const X_STROKE = 4.9

function xGlyph() {
  const h = BOTTOM - TOP
  const mid = TOP + h / 2
  const notch = ((X_W / 2 - X_STROKE) / (X_W - X_STROKE)) * h
  const c = X_W / 2
  const pts = [
    [0, TOP], [X_STROKE, TOP], [c, TOP + notch], [X_W - X_STROKE, TOP], [X_W, TOP],
    [c + X_STROKE / 2, mid],
    [X_W, BOTTOM], [X_W - X_STROKE, BOTTOM], [c, BOTTOM - notch], [X_STROKE, BOTTOM], [0, BOTTOM],
    [c - X_STROKE / 2, mid],
  ]
  return `M${pts.map(([x, y]) => `${+x.toFixed(2)},${+y.toFixed(2)}`).join('L')}Z`
}

const DRAWN_GLYPHS = {
  '-': { d: `M0,583.93h${HYPHEN_W}v3.57H0Z`, w: HYPHEN_W, sides: 'oo' },
  T: { d: `M0,${TOP}h${T_W}v3.77h-${(T_W - STEM) / 2}V${BOTTOM}h-${STEM}V${TOP + 3.77}H0Z`, w: T_W, sides: 'oo' },
  X: { d: xGlyph(), w: X_W, sides: 'dd' },
}

// Gaps between letters, read off the source: straight stems sit furthest apart, rounds closest.
const GAP = { ss: 7.3, sr: 5.7, rs: 5.7, rr: 4.3, os: 5.8, so: 5.8, or: 4.6, ro: 4.6, oo: 3.4, od: 3.6, do: 3.2, ds: 4, sd: 4 }
const SPACE = 10.5

export async function extensionLockup() {
  const source = await readFile(path.resolve('brand/glt-ile-ife-logo.svg'), 'utf8')
  const paths = [...source.matchAll(/<path class="cls-1" d="([^"]+)" transform="[^"]+"\/>/g)]
  const pathFor = (start) => paths.find((m) => m[1].startsWith(start))[1]

  let x = SOURCE_GLYPHS.I.x
  let prevSide = null
  const glyphs = []
  for (const ch of 'ILE-IFE EXTENSION') {
    if (ch === ' ') {
      x += SPACE
      continue
    }
    const src = SOURCE_GLYPHS[ch]
    const drawn = DRAWN_GLYPHS[ch]
    const g = src ?? drawn
    if (prevSide) x += GAP[prevSide + g.sides[0]]
    const offset = src ? x - src.x : x
    glyphs.push(`<path class="cls-1" d="${src ? pathFor(src.start) : drawn.d}" transform="translate(${(offset - 153.4).toFixed(2)} -430.18)"/>`)
    x += g.w
    prevSide = g.sides[1]
  }

  // Drop the old bottom line, then stretch the rule to the end of the new one if it runs longer.
  const oldLine = new Set(paths.filter((m) => /^M(4[5-9]\d|[5-6]\d\d)\.\d+,(5[7-9]\d|600)/.test(m[1]) && parseFloat(m[1].split(',')[1]) > 570).map((m) => m[0]))
  let svg = source
  for (const p of oldLine) svg = svg.replace(p, '')
  const textEnd = x - 153.4
  const lineEnd = Math.max(581.31, textEnd)
  svg = svg.replace('x2="581.31"', `x2="${lineEnd.toFixed(2)}"`)
  svg = svg.replace('<line ', `${glyphs.join('')}<line `)
  return svg
}

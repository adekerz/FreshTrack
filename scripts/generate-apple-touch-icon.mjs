#!/usr/bin/env node
/**
 * Export icon.svg embedded JPEG to public/apple-touch-icon.png (180×180).
 * Run: npm run generate-apple-touch-icon
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const svgPath = path.join(root, 'public', 'icons', 'icon.svg')
const outPath = path.join(root, 'public', 'apple-touch-icon.png')

const SIZE = 180

const svg = fs.readFileSync(svgPath, 'utf8')
const m = svg.match(/xlink:href="data:image\/jpeg;base64,([^"]+)"/)
if (!m) {
  console.error('[generate-apple-touch-icon] Could not find base64 JPEG in icon.svg')
  process.exit(1)
}

const buf = Buffer.from(m[1], 'base64')
await sharp(buf)
  .resize(SIZE, SIZE)
  .png()
  .toFile(outPath)

console.log(`[generate-apple-touch-icon] Wrote ${path.relative(root, outPath)} (${SIZE}×${SIZE})`)

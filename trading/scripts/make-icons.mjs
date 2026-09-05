/**
 * يولّد أيقونات PWA بصيغة PNG بلا أي اعتماد خارجي.
 * الرسم بسيط عمداً: ثلاثة أعمدة صاعدة على خط قاعدة — نفس لغة الدفتر.
 *
 *   node scripts/make-icons.mjs
 */
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')

const INK = [0x14, 0x16, 0x1a]
const GAIN = [0x3f, 0xa9, 0x6a]
const PROJ = [0xc9, 0xa2, 0x27]
const RULE = [0x3a, 0x3e, 0x46]

function crc32(buffer) {
  let crc = ~0
  for (const byte of buffer) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return ~crc >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePNG(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // عمق البت
  ihdr[9] = 2 // RGB بلا قناة شفافية
  const raw = Buffer.alloc(size * (size * 3 + 1))
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 3 + 1)] = 0 // نوع الترشيح: بلا
    for (let x = 0; x < size; x += 1) {
      const source = (y * size + x) * 3
      const target = y * (size * 3 + 1) + 1 + x * 3
      raw[target] = pixels[source]
      raw[target + 1] = pixels[source + 1]
      raw[target + 2] = pixels[source + 2]
    }
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

function render(size, padRatio) {
  const pixels = Buffer.alloc(size * size * 3)
  const fill = (x0, y0, x1, y1, color) => {
    for (let y = Math.max(0, Math.round(y0)); y < Math.min(size, Math.round(y1)); y += 1) {
      for (let x = Math.max(0, Math.round(x0)); x < Math.min(size, Math.round(x1)); x += 1) {
        const index = (y * size + x) * 3
        pixels[index] = color[0]
        pixels[index + 1] = color[1]
        pixels[index + 2] = color[2]
      }
    }
  }

  fill(0, 0, size, size, INK)

  const pad = size * padRatio
  const inner = size - pad * 2
  const baseline = pad + inner
  const barWidth = inner * 0.22
  const gap = (inner - barWidth * 3) / 2
  const heights = [0.42, 0.68, 1]
  const colors = [GAIN, GAIN, PROJ]

  // خط القاعدة — نفس «خط الدفتر» في الواجهة
  fill(pad, baseline, pad + inner, baseline + Math.max(2, size * 0.016), RULE)

  heights.forEach((ratio, index) => {
    const x = pad + index * (barWidth + gap)
    const height = inner * ratio
    fill(x, baseline - height, x + barWidth, baseline, colors[index])
  })

  return encodePNG(size, pixels)
}

mkdirSync(OUT, { recursive: true })
writeFileSync(join(OUT, 'icon-192.png'), render(192, 0.2))
writeFileSync(join(OUT, 'icon-512.png'), render(512, 0.2))
// maskable: هامش أوسع حتى لا يقصّ النظام الرسم عند تدوير الأيقونة
writeFileSync(join(OUT, 'icon-maskable-512.png'), render(512, 0.3))
console.log('كُتبت الأيقونات في public/')

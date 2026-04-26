/**
 * Generates icon-192.png and icon-512.png in /public.
 * Solid #3B0F0D (deep wine) square — no external dependencies needed.
 */
import { deflateSync } from 'zlib'
import { writeFileSync } from 'fs'

function crc32(buf) {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function makeChunk(type, data) {
  const t = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcVal = Buffer.alloc(4)
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])))
  return Buffer.concat([len, t, data, crcVal])
}

function solidPNG(size, r, g, b) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(size, 0)
  ihdrData.writeUInt32BE(size, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 2 // RGB colour type

  // Each row: 1 filter byte (None=0) + size×3 RGB bytes
  const row = Buffer.alloc(1 + size * 3)
  row[0] = 0
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r
    row[2 + x * 3] = g
    row[3 + x * 3] = b
  }
  const raw = Buffer.concat(Array.from({ length: size }, () => row))

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdrData),
    makeChunk('IDAT', deflateSync(raw)),
    makeChunk('IEND', Buffer.alloc(0)),
  ])
}

// Brand colour: #3B0F0D = rgb(59, 15, 13)
writeFileSync('public/icon-192.png', solidPNG(192, 59, 15, 13))
writeFileSync('public/icon-512.png', solidPNG(512, 59, 15, 13))
console.log('✓ public/icon-192.png and public/icon-512.png generated')

// Downloads static ffmpeg binaries for each target platform and drops them
// into electron/resources/ffmpeg/<platform>/. Run once before building the
// installer. Sizes ~80 MB per platform.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RESOURCES = path.resolve(__dirname, '..', 'resources', 'ffmpeg')

const TARGETS = {
  win:   { url: 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',     bin: 'ffmpeg.exe' },
  mac:   { url: 'https://evermeet.cx/ffmpeg/getrelease/zip',                                                              bin: 'ffmpeg' },
  linux: { url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz',                           bin: 'ffmpeg' },
}

async function download(url, dest) {
  console.log(`Downloading ${url}`)
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  await pipeline(Readable.fromWeb(res.body), fs.createWriteStream(dest))
}

async function main() {
  const platform = process.argv[2]
  const targets = platform ? { [platform]: TARGETS[platform] } : TARGETS
  for (const [name, cfg] of Object.entries(targets)) {
    if (!cfg) { console.error(`Unknown target: ${name}`); continue }
    const outDir = path.join(RESOURCES, name)
    fs.mkdirSync(outDir, { recursive: true })
    const ext = cfg.url.endsWith('.tar.xz') ? '.tar.xz' : '.zip'
    const archive = path.join(outDir, `ffmpeg${ext}`)
    await download(cfg.url, archive)
    console.log(`Saved archive to ${archive}`)
    console.log(`Extract manually (zip / tar -xJf) and place ${cfg.bin} at ${path.join(outDir, cfg.bin)}`)
  }
  console.log('\nNote: archive extraction is intentionally manual to avoid bundling tar/unzip deps.')
}

main().catch((e) => { console.error(e); process.exit(1) })

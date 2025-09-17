#!/usr/bin/env tsx
// Download face-api.js model weights into public/models
// Compatible with face-api.js v0.20.x (uses the public GitHub weights)

import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = path.join(process.cwd(), 'public', 'models');
const BASE = process.env.FACE_MODELS_CDN || 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
const MODELS = [
  'tiny_face_detector_model',
  'face_landmark_68_model',
  'face_recognition_model',
];

async function tryDownload(urls: string[], dest: string) {
  let lastErr: any;
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (!res.ok) { lastErr = new Error(`HTTP ${res.status} for ${url}`); continue; }
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      const buf = Buffer.from(await res.arrayBuffer());
      await fs.promises.writeFile(dest, buf);
      return;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error('All candidate URLs failed');
}

async function main() {
  await fs.promises.mkdir(OUT_DIR, { recursive: true });
  console.log(`Downloading models to ${OUT_DIR}`);

  for (const name of MODELS) {
    const manifestUrl = `${BASE}/${name}-weights_manifest.json`;
    const manifestPath = path.join(OUT_DIR, `${name}-weights_manifest.json`);
    console.log(`- ${name}: manifest`);
    const res = await fetch(manifestUrl);
    if (!res.ok) throw new Error(`Failed: ${manifestUrl} (${res.status})`);
    const txt = await res.text();
    await fs.promises.writeFile(manifestPath, txt);
    let manifest: any = {};
    try { manifest = JSON.parse(txt); } catch {}

    let paths: string[] = [];
    if (Array.isArray(manifest?.weightsManifest)) {
      for (const g of manifest.weightsManifest) if (Array.isArray(g?.paths)) paths.push(...g.paths);
    }
    // Fallback: extract shard names by regex from the JSON text
    if (!paths.length) {
      const m = Array.from(txt.matchAll(/"([^"]*?shard[^"]*?)"/g)).map(x => x[1]);
      paths.push(...m);
    }
    // Last resort fallbacks
    if (!paths.length) paths.push(`${name}-shard1`, `${name}-shard1.bin`);

    const unique = Array.from(new Set(paths));
    for (const p of unique) {
      const candidates = [p, p.endsWith('.bin') ? p.slice(0, -4) : `${p}.bin`].map(s => `${BASE}/${s}`);
      const dest = path.join(OUT_DIR, p.endsWith('.bin') ? p : `${p}.bin`);
      console.log(`  · shard ${p}`);
      await tryDownload(candidates, dest);
    }
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });

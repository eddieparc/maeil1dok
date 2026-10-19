import { readdir, readFile } from 'node:fs/promises';

export async function readAll(paths) {
  const out = new Map();
  for (const p of paths) {
    try { out.set(p, await readFile(new URL(p, import.meta.url), 'utf8')); }
    catch { out.set(p, ''); }
  }
  return out;
}

export async function collectDir(dirUrl) {
  const entries = await readdir(dirUrl, { withFileTypes: true });
  const sources = new Map();
  for (const e of entries) {
    if (e.isFile() && e.name.endsWith('.vue')) {
      sources.set(e.name, await readFile(new URL(e.name, dirUrl), 'utf8'));
    }
  }
  return sources;
}

export function styleOf(source) {
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)]
    .map((m) => m[1].replace(/\/\*[\s\S]*?\*\//g, ''))
    .join('\n');
}

export function rawHexes(source) {
  return [...new Set(styleOf(source).match(/#[0-9a-fA-F]{3,8}\b/g) ?? [])];
}

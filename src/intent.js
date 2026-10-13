import fs from 'node:fs';
import path from 'node:path';

const INTENT_FILES = [
  'README.md', 'README', 'docs/README.md', 'docs/architecture.md', 'ARCHITECTURE.md',
  'docs/design.md', 'DESIGN.md', 'SPEC.md'
];

export function readIntent(root, manifest = {}) {
  const explicit = clean(manifest.mission || manifest.intent || '');
  if (explicit) {
    return { text: explicit, source: '.buildmap/project.json', confidence: 'declared' };
  }

  for (const rel of INTENT_FILES) {
    const full = path.join(root, rel);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) continue;
    const raw = fs.readFileSync(full, 'utf8');
    const text = summarizeMarkdown(raw);
    if (text) return { text, source: rel, confidence: 'inferred' };
  }

  return {
    text: 'Project intent is not documented yet. BuildMap can still map the code, but an interview or a short README will make the “why” layer clearer.',
    source: null,
    confidence: 'unknown'
  };
}

export function summarizeMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const parts = [];
  let inFence = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) { inFence = !inFence; continue; }
    if (inFence || !trimmed) continue;
    if (/^#{1,6}\s/.test(trimmed)) { if (parts.length) break; continue; }
    if (/^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed)) {
      if (parts.length) break;
      continue;
    }
    if (trimmed.startsWith('![') || trimmed.startsWith('<')) continue;
    parts.push(trimmed.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1'));
    if (parts.join(' ').length >= 320) break;
  }
  return clean(parts.join(' ')).slice(0, 420);
}

function clean(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

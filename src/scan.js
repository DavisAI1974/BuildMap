import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readIntent } from './intent.js';

const CODE_EXT = new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx','.py','.go','.rs','.java','.kt','.kts','.rb','.php','.cs','.c','.cc','.cpp','.h','.hpp','.swift','.scala','.sh']);
const SPECIAL_CODE = new Set(['Dockerfile','Makefile']);
const IGNORE_DIRS = new Set(['.git','node_modules','dist','build','coverage','.next','.cache','.venv','venv','__pycache__','target','vendor']);
const STATES = ['planned','coded','connected','computing','verified','live'];

export function scanProject(root) {
  const manifest = readJson(path.join(root, '.buildmap', 'project.json')) || {};
  const evidence = readJson(path.join(root, '.buildmap', 'evidence.json')) || {};
  const files = walkCodeFiles(root);
  const fileSet = new Set(files.map(f => f.path));
  const importEdges = discoverImports(root, files, fileSet);
  const intent = readIntent(root, manifest);

  const components = Array.isArray(manifest.components) ? manifest.components : [];
  const assignedFiles = new Set();
  const nodes = [];

  for (const component of components) {
    const componentFiles = normalizeFiles(component.files || component.file || []);
    componentFiles.forEach(f => assignedFiles.add(f));
    const present = componentFiles.filter(f => fileSet.has(f));
    const connectedByCode = hasCodeConnection(componentFiles, importEdges);
    const connectedByPlan = Array.isArray(component.dependsOn) && component.dependsOn.length > 0;
    const id = component.id || slug(component.name || componentFiles[0] || 'component');
    const status = resolveStatus({
      base: present.length === componentFiles.length && componentFiles.length ? (connectedByCode || connectedByPlan ? 'connected' : 'coded') : 'planned',
      evidence: evidence.components?.[id]?.status || component.status
    });

    nodes.push({
      id,
      name: component.name || titleFromFile(componentFiles[0] || id),
      kind: 'component',
      group: component.group || inferGroup(componentFiles[0]),
      files: componentFiles,
      presentFiles: present,
      status,
      purpose: component.purpose || component.description || inferPurpose(componentFiles),
      contributes: component.contributes || component.goal || '',
      visual: normalizeVisual(component.visual, component),
      plannedDependencies: component.dependsOn || [],
      evidence: evidence.components?.[id] || null,
      source: 'manifest'
    });
  }

  for (const file of files) {
    if (assignedFiles.has(file.path)) continue;
    const connected = importEdges.some(e => e.from === file.path || e.to === file.path);
    const id = `file:${file.path}`;
    const status = resolveStatus({
      base: connected ? 'connected' : 'coded',
      evidence: evidence.files?.[file.path]?.status
    });
    nodes.push({
      id,
      name: titleFromFile(file.path),
      kind: 'file',
      group: inferGroup(file.path),
      files: [file.path],
      presentFiles: [file.path],
      status,
      purpose: inferFilePurpose(root, file.path),
      contributes: '',
      visual: inferVisual(file.path),
      plannedDependencies: [],
      evidence: evidence.files?.[file.path] || null,
      source: 'discovered'
    });
  }

  const edges = buildComponentEdges(nodes, importEdges);
  const missionId = '__mission__';
  nodes.push({
    id: missionId,
    name: manifest.name || path.basename(root) || 'Project mission',
    kind: 'mission',
    group: 'Mission',
    files: [],
    presentFiles: [],
    status: missionStatus(nodes),
    purpose: intent.text,
    contributes: '',
    visual: { kind: 'goal', label: 'Outcome' },
    plannedDependencies: [],
    evidence: null,
    source: intent.source || 'interview-needed'
  });

  for (const node of nodes) {
    if (node.id === missionId) continue;
    if (node.contributes) edges.push({ from: node.id, to: missionId, type: 'contributes' });
  }

  const codeCount = files.length;
  const missingPlanned = nodes.filter(n => n.kind === 'component' && n.status === 'planned').length;
  const mode = manifest.mode && manifest.mode !== 'auto'
    ? manifest.mode
    : (codeCount === 0 || missingPlanned > Math.max(1, Math.floor(nodes.length / 3)) ? 'greenfield' : 'brownfield');

  const counts = Object.fromEntries(STATES.map(s => [s, nodes.filter(n => n.kind !== 'mission' && n.status === s).length]));
  const progress = progressScore(nodes.filter(n => n.kind !== 'mission'));

  return {
    project: {
      name: manifest.name || path.basename(root) || 'BuildMap project',
      root,
      mode,
      intent,
      progress,
      counts,
      uncertainty: intent.confidence === 'unknown' ? ['Intent is unknown; interview recommended.'] : []
    },
    states: STATES,
    nodes,
    edges: uniqueEdges(edges),
    generatedAt: new Date().toISOString(),
    fingerprint: fingerprint({ nodes, edges, intent })
  };
}

export function resolveStatus({ base = 'planned', evidence }) {
  const baseIndex = Math.max(0, STATES.indexOf(base));
  const evidenceIndex = STATES.indexOf(evidence);
  return STATES[Math.max(baseIndex, evidenceIndex >= 0 ? evidenceIndex : 0)];
}

function walkCodeFiles(root) {
  const out = [];
  const stack = [''];
  while (stack.length) {
    const relDir = stack.pop();
    const fullDir = path.join(root, relDir);
    let entries;
    try { entries = fs.readdirSync(fullDir, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const rel = slash(path.join(relDir, entry.name));
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith('.') && entry.name !== '.buildmap') continue;
        stack.push(rel);
        continue;
      }
      if (!entry.isFile()) continue;
      if (rel.startsWith('.buildmap/')) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!CODE_EXT.has(ext) && !SPECIAL_CODE.has(entry.name)) continue;
      const stat = fs.statSync(path.join(root, rel));
      if (stat.size > 1_000_000) continue;
      out.push({ path: rel, size: stat.size });
    }
  }
  return out.sort((a,b) => a.path.localeCompare(b.path));
}

function discoverImports(root, files, fileSet) {
  const edges = [];
  for (const file of files) {
    let text = '';
    try { text = fs.readFileSync(path.join(root, file.path), 'utf8'); } catch { continue; }
    const specs = new Set();
    const ext = path.extname(file.path).toLowerCase();
    if (['.js','.mjs','.cjs','.jsx','.ts','.tsx'].includes(ext)) {
      for (const re of [
        /\bimport\s+(?:[^'\"]+?\s+from\s+)?['\"]([^'\"]+)['\"]/g,
        /\brequire\(\s*['\"]([^'\"]+)['\"]\s*\)/g,
        /\bimport\(\s*['\"]([^'\"]+)['\"]\s*\)/g
      ]) collectMatches(text, re, specs);
    } else if (ext === '.py') {
      collectMatches(text, /^\s*from\s+([\.\w]+)\s+import\s+/gm, specs);
      collectMatches(text, /^\s*import\s+([\.\w]+)/gm, specs);
    }
    for (const spec of specs) {
      const target = resolveImport(file.path, spec, fileSet, ext);
      if (target && target !== file.path) edges.push({ from: file.path, to: target, type: 'import' });
    }
  }
  return uniqueEdges(edges);
}

function resolveImport(fromFile, spec, fileSet, ext) {
  if (spec.startsWith('.')) {
    const base = slash(path.normalize(path.join(path.dirname(fromFile), spec)));
    const candidates = [base, ...[...CODE_EXT].map(e => base + e), ...[...CODE_EXT].map(e => `${base}/index${e}`)];
    return candidates.find(c => fileSet.has(c)) || null;
  }
  if (ext === '.py' && spec.startsWith('.')) return null;
  if (ext === '.py') {
    const modulePath = spec.replace(/^\.+/, '').replace(/\./g, '/');
    const candidates = [`${modulePath}.py`, `${modulePath}/__init__.py`];
    return candidates.find(c => fileSet.has(c)) || null;
  }
  return null;
}

function buildComponentEdges(nodes, importEdges) {
  const owner = new Map();
  for (const node of nodes) for (const f of node.files) owner.set(f, node.id);
  const edges = [];
  for (const e of importEdges) {
    const from = owner.get(e.from); const to = owner.get(e.to);
    if (from && to && from !== to) edges.push({ from, to, type: 'code' });
  }
  for (const node of nodes) {
    for (const dep of node.plannedDependencies || []) {
      if (nodes.some(n => n.id === dep)) edges.push({ from: dep, to: node.id, type: 'planned' });
    }
  }
  return uniqueEdges(edges);
}

function hasCodeConnection(componentFiles, edges) {
  const s = new Set(componentFiles);
  return edges.some(e => s.has(e.from) || s.has(e.to));
}

function inferFilePurpose(root, rel) {
  try {
    const text = fs.readFileSync(path.join(root, rel), 'utf8').slice(0, 5000);
    const doc = text.match(/^\s*(?:\/\*\*?\s*|\/\/\s*|#\s*|'''\s*|\"\"\"\s*)([^\n*]{12,180})/m)?.[1];
    if (doc) return doc.trim();
    const exported = [...text.matchAll(/\b(?:export\s+)?(?:async\s+)?function\s+(\w+)|\bexport\s+class\s+(\w+)/g)]
      .map(m => m[1] || m[2]).filter(Boolean).slice(0, 4);
    if (exported.length) return `Defines ${exported.join(', ')}.`;
  } catch {}
  return inferPurpose([rel]);
}

function inferPurpose(files) {
  if (!files.length) return 'Planned capability.';
  const rel = files[0].toLowerCase();
  if (rel.includes('scan')) return 'Discovers the project pieces and their code relationships.';
  if (rel.includes('server')) return 'Serves the living map and current project state.';
  if (rel.includes('cli')) return 'Turns BuildMap into a command you can point at a project.';
  if (rel.includes('test')) return 'Provides verification evidence for behavior.';
  if (rel.includes('intent') || rel.includes('readme')) return 'Recovers the project’s intended outcome from available documentation.';
  if (rel.includes('ui') || rel.includes('app') || rel.includes('public')) return 'Makes the system understandable through an interactive visual interface.';
  return `Implements ${titleFromFile(files[0])}.`;
}

function inferVisual(rel) {
  const p = rel.toLowerCase();
  if (p.includes('scan')) return { kind: 'scanner', label: 'Discover' };
  if (p.includes('server')) return { kind: 'flow', label: 'Serve' };
  if (p.includes('test')) return { kind: 'proof', label: 'Prove' };
  if (p.includes('intent') || p.includes('readme')) return { kind: 'lens', label: 'Understand' };
  if (p.includes('app') || p.includes('ui') || p.includes('public')) return { kind: 'graph', label: 'Visualize' };
  return { kind: 'flow', label: 'Transform' };
}

function normalizeVisual(visual, component) {
  if (typeof visual === 'string') return { kind: visual, label: component.action || visual };
  return { kind: visual?.kind || 'flow', label: visual?.label || component.action || 'Work' };
}

function normalizeFiles(value) {
  const arr = Array.isArray(value) ? value : [value];
  return arr.filter(Boolean).map(v => slash(String(v).replace(/^\.\//,'')));
}

function missionStatus(nodes) {
  const work = nodes.filter(n => n.kind !== 'mission');
  if (!work.length) return 'planned';
  const min = Math.min(...work.map(n => STATES.indexOf(n.status)));
  return STATES[Math.max(0, min)];
}

function progressScore(nodes) {
  if (!nodes.length) return 0;
  const weights = { planned: 0, coded: 20, connected: 45, computing: 65, verified: 85, live: 100 };
  return Math.round(nodes.reduce((sum,n) => sum + weights[n.status], 0) / nodes.length);
}

function inferGroup(rel = '') {
  const parts = slash(rel || '').split('/').filter(Boolean);
  if (!parts.length) return 'Core';
  if (parts[0] === 'src' && parts[1]) return title(parts[1].replace(/\.[^.]+$/,''));
  return title(parts[0].replace(/\.[^.]+$/,''));
}

function titleFromFile(rel) {
  const base = path.basename(rel || 'component').replace(/\.[^.]+$/,'');
  return title(base);
}

function title(value) {
  return String(value).replace(/[-_]+/g,' ').replace(/\b\w/g, c => c.toUpperCase());
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'component';
}

function collectMatches(text, re, out) {
  for (const match of text.matchAll(re)) if (match[1]) out.add(match[1]);
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; }
}

function uniqueEdges(edges) {
  const seen = new Set();
  return edges.filter(e => {
    const k = `${e.from}|${e.to}|${e.type}`;
    if (seen.has(k)) return false;
    seen.add(k); return true;
  });
}

function fingerprint(value) {
  return crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

function slash(value) { return value.split(path.sep).join('/'); }

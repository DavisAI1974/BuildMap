import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { readIntent } from './intent.js';
import { importSpecs, resolveImport } from './imports.js';

const CODE_EXT = new Set(['.js','.mjs','.cjs','.jsx','.ts','.tsx','.py','.go','.rs','.java','.kt','.kts','.rb','.php','.cs','.c','.cc','.cpp','.h','.hpp','.swift','.scala','.sh','.html','.htm','.css']);
const SPECIAL_CODE = new Set(['Dockerfile','Makefile']);
const IGNORE_DIRS = new Set(['.git','node_modules','dist','build','coverage','.next','.cache','.venv','venv','__pycache__','target','vendor']);
const STATES = ['planned','coded','connected','computing','verified','live'];
const WEIGHTS = { planned: 0, coded: 20, connected: 45, computing: 65, verified: 85, live: 100 };

export function scanProject(root) {
  root = path.resolve(root);
  const diagnostics = [];
  const manifest = readJson(root, '.buildmap/project.json', diagnostics);
  const evidence = readJson(root, '.buildmap/evidence.json', diagnostics);
  const components = validComponents(manifest.components, diagnostics);
  const files = walkFiles(root, diagnostics);
  const fileSet = new Set(files.map(f => f.path));
  // Declared implementation can include assets/configuration outside discovered
  // extensions. Never follow a manifest path or symlink out of the project.
  for (const component of components) {
    for (const rel of normalizeFiles(component.files || component.file || [])) {
      if (fileSet.has(rel)) continue;
      try {
        if (!safeFile(root, rel)) continue;
        const buffer = fs.readFileSync(path.join(root, rel));
        files.push({ path: rel, size: buffer.length, hash: hash(buffer) });
        fileSet.add(rel);
      } catch { /* Missing files remain planned. */ }
    }
  }
  files.sort((a,b) => a.path.localeCompare(b.path));
  const importEdges = discoverImports(root, files, fileSet, diagnostics);
  const fileHashes = new Map(files.map(f => [f.path, f.hash]));
  let intent;
  try { intent = readIntent(root, manifest); }
  catch (err) {
    diagnostics.push({ code: 'unreadable-intent', message: `Could not read intent documents: ${err.code || err.message}.` });
    intent = { text: 'Project intent could not be read. Check the documents and permissions.', source: null, confidence: 'unknown' };
  }
  const assignedFiles = new Map();
  const nodes = [];

  function makeNode(fields, receipt) {
    const present = fields.files.filter(f => fileSet.has(f));
    const complete = fields.files.length > 0 && present.length === fields.files.length;
    const wired = importEdges.some(e => present.includes(e.from) || present.includes(e.to));
    const base = complete ? (wired ? 'connected' : 'coded') : 'planned';
    const sourceHashes = Object.fromEntries(present.map(f => [f, fileHashes.get(f)]));
    const assessment = assessEvidence(receipt, complete, sourceHashes);
    return { ...fields, presentFiles: present, missingFiles: fields.files.filter(f => !fileSet.has(f)),
      implementation: complete ? 'complete' : present.length ? 'partial' : 'missing',
      baseStatus: base, status: resolveStatus({ base, evidence: assessment.accepted ? receipt.status : null }),
      evidence: receipt || null, evidenceAssessment: assessment, sourceHashes };
  }

  for (const component of components) {
    const componentFiles = normalizeFiles(component.files || component.file || []);
    const id = component.id || slug(component.name || componentFiles[0] || 'component');
    const owned = componentFiles.filter(f => {
      if (assignedFiles.has(f)) {
        diagnostics.push({ code: 'overlapping-file', nodeId: id, message: `${f} already belongs to ${assignedFiles.get(f)}; it is not assigned twice.` });
        return false;
      }
      assignedFiles.set(f, id); return true;
    });
    if (component.status) diagnostics.push({ code: 'manifest-status', nodeId: id, message: `Manifest status ${component.status} is descriptive only; proof requires an evidence record.` });
    nodes.push(makeNode({ id, name: component.name || titleFromFile(componentFiles[0] || id), kind: 'component',
      group: component.group || inferGroup(componentFiles[0]), files: owned,
      purpose: component.purpose || component.description || inferPurpose(componentFiles),
      contributes: component.contributes || component.goal || '', visual: normalizeVisual(component.visual, component),
      plannedDependencies: Array.isArray(component.dependsOn) ? component.dependsOn.filter(d => typeof d === 'string') : [], source: 'manifest'
    }, evidence.components?.[id]));
  }

  for (const file of files) {
    if (assignedFiles.has(file.path)) continue;
    nodes.push(makeNode({ id: `file:${file.path}`, name: titleFromFile(file.path), kind: 'file', group: inferGroup(file.path),
      files: [file.path], purpose: inferFilePurpose(root, file.path), contributes: '', visual: inferVisual(file.path),
      plannedDependencies: [], source: 'discovered'
    }, evidence.files?.[file.path]));
  }
  const edges = buildComponentEdges(nodes, importEdges);
  const counts = Object.fromEntries(STATES.map(s => [s, nodes.filter(n => n.status === s).length]));
  const progress = nodes.length ? Math.round(nodes.reduce((sum,n) => sum + WEIGHTS[n.status], 0) / nodes.length) : 0;
  const gaps = findGaps(nodes, edges, diagnostics, intent);
  const missingPlanned = nodes.filter(n => n.implementation !== 'complete').length;
  const mode = ['greenfield', 'brownfield'].includes(manifest.mode) ? manifest.mode
    : (!files.length || missingPlanned > Math.max(1, Math.floor(nodes.length / 3)) ? 'greenfield' : 'brownfield');
  // The mission is an intent target, not an independently tested runtime piece.
  nodes.push({ id: '__mission__', name: manifest.name || path.basename(root), kind: 'mission', group: 'Mission',
    files: [], presentFiles: [], missingFiles: [], status: 'planned', purpose: intent.text, contributes: '',
    visual: { kind: 'goal', label: 'Intended outcome' }, plannedDependencies: [], evidence: null, source: intent.source || 'interview-needed' });
  for (const node of nodes) if (node.contributes) edges.push({ from: node.id, to: '__mission__', type: 'contributes' });
  const result = { project: { name: manifest.name || path.basename(root), root, mode, intent, progress,
    progressLabel: 'Evidence index', counts, uncertainty: intent.confidence === 'unknown' ? ['Intent is unknown; interview recommended.'] : [] },
    states: STATES, nodes, edges: uniqueEdges(edges), gaps, diagnostics,
    scan: { fileCount: files.length, importCount: importEdges.length, dependencyLanguages: ['JavaScript', 'TypeScript', 'Python', 'HTML', 'CSS'], heuristic: true },
    generatedAt: new Date().toISOString() };
  result.fingerprint = fingerprint({ ...result, generatedAt: undefined, manifest, evidence });
  return result;
}

export function resolveStatus({ base = 'planned', evidence }) {
  const baseIndex = Math.max(0, STATES.indexOf(base));
  const evidenceIndex = STATES.indexOf(evidence);
  return STATES[Math.max(baseIndex, evidenceIndex >= 0 ? evidenceIndex : 0)];
}

function assessEvidence(receipt, complete, hashes) {
  if (!receipt) return { accepted: false, reason: 'No explicit evidence record.' };
  if (typeof receipt !== 'object' || Array.isArray(receipt) || !STATES.includes(receipt.status)) return { accepted: false, reason: 'Invalid evidence record or status.' };
  if (!complete) return { accepted: false, reason: 'Implementation is incomplete; this claim cannot describe the current piece.' };
  if (STATES.indexOf(receipt.status) >= 3 && !['note', 'command', 'proof'].some(k => typeof receipt[k] === 'string' && receipt[k].trim())) {
    return { accepted: false, reason: 'A status alone is not evidence; describe the observation or check.' };
  }
  if (receipt.sourceHashes !== undefined) {
    const binding = receipt.sourceHashes;
    if (!binding || typeof binding !== 'object' || Array.isArray(binding) ||
      Object.keys(hashes).some(f => binding[f] !== hashes[f]) || Object.keys(binding).some(f => !Object.hasOwn(hashes, f))) {
      return { accepted: false, binding: 'stale', reason: 'Source hashes no longer match all implementation files. Rerun the observation or check.' };
    }
    return { accepted: true, binding: 'current', reason: 'Recorded evidence matches the current implementation files; BuildMap does not execute or authenticate it.' };
  }
  return { accepted: true, binding: 'unbound', reason: 'User-recorded evidence; freshness is unknown because it has no source hashes.' };
}

function findGaps(nodes, edges, diagnostics, intent) {
  const gaps = [];
  const add = (kind, nodeId, message, priority = 'warning') => gaps.push({ id: `${kind}:${nodeId || 'project'}:${gaps.length}`, kind, nodeId, message, priority });
  if (intent.confidence === 'unknown') add('missing-intent', null, 'Add a mission or README to explain what the build should achieve.');
  for (const n of nodes) {
    if (n.implementation !== 'complete') add('missing-implementation', n.id, n.missingFiles.length ? `Missing implementation: ${n.missingFiles.join(', ')}.` : 'Declare implementation files for this planned piece.', 'blocker');
    if (n.evidence && !n.evidenceAssessment.accepted) add('unsupported-evidence', n.id, n.evidenceAssessment.reason, 'blocker');
    if (n.evidenceAssessment.accepted && n.evidenceAssessment.binding === 'unbound' && STATES.indexOf(n.status) >= 3) add('unbound-evidence', n.id, 'Evidence is recorded but its freshness is unknown. Bind it to the current source hashes.', 'info');
    if (n.implementation === 'complete' && !edges.some(e => e.type === 'code' && (e.from === n.id || e.to === n.id))) add('no-observed-connection', n.id, 'No cross-piece source connection found. This may be an entry point or use wiring the scanner cannot see.');
    if (n.implementation === 'complete' && STATES.indexOf(n.status) < 3) add('unproved', n.id, 'Observe useful work or record a behavior check before claiming computing or verified.');
    for (const dep of n.plannedDependencies) {
      if (!nodes.some(x => x.id === dep)) add('unknown-dependency', n.id, `Declared dependency ${dep} has no piece on the map.`, 'blocker');
      else if (!edges.some(e => e.type === 'code' && e.from === dep && e.to === n.id)) add('unobserved-dependency', n.id, `Declared dependency on ${dep} has no matching source connection. Confirm its wiring; discovery is heuristic.`);
    }
  }
  for (const d of diagnostics) add(d.code, d.nodeId || null, d.message, d.code === 'invalid-config' ? 'blocker' : 'warning');
  const order = { blocker: 0, warning: 1, info: 2 };
  return gaps.sort((a,b) => order[a.priority] - order[b.priority]);
}

function validComponents(value, diagnostics) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { diagnostics.push({ code: 'invalid-config', message: 'Manifest components must be an array.' }); return []; }
  const ids = new Set(['__mission__']);
  return value.filter(c => {
    if (!c || typeof c !== 'object' || Array.isArray(c)) { diagnostics.push({ code: 'invalid-config', message: 'Each component must be an object.' }); return false; }
    const stringFields = ['id', 'name', 'group', 'purpose', 'description', 'contributes', 'goal', 'action', 'status'];
    const listValue = c.files ?? c.file;
    const invalidStrings = stringFields.some(k => c[k] !== undefined && typeof c[k] !== 'string');
    const invalidFiles = listValue !== undefined && typeof listValue !== 'string' && (!Array.isArray(listValue) || listValue.some(f => typeof f !== 'string'));
    const invalidDependencies = c.dependsOn !== undefined && (!Array.isArray(c.dependsOn) || c.dependsOn.some(d => typeof d !== 'string'));
    const invalidVisual = c.visual !== undefined && typeof c.visual !== 'string' && (!c.visual || typeof c.visual !== 'object' || Array.isArray(c.visual) || ['kind', 'label'].some(k => c.visual[k] !== undefined && typeof c.visual[k] !== 'string'));
    if (invalidStrings || invalidFiles || invalidDependencies || invalidVisual) { diagnostics.push({ code: 'invalid-config', message: 'Invalid component fields: descriptions must be strings, files strings or arrays, dependencies an array of ids, and visuals strings or objects.' }); return false; }
    const id = c.id || slug(c.name || normalizeFiles(c.files || c.file || [])[0] || 'component');
    if (typeof id !== 'string' || id.startsWith('file:') || ids.has(id)) { diagnostics.push({ code: 'invalid-config', message: `Duplicate or reserved component id: ${id}.` }); return false; }
    ids.add(id); return true;
  });
}

function safeFile(root, rel) {
  if (!rel || path.isAbsolute(rel) || rel === '..' || rel.startsWith('../')) return false;
  const full = path.join(root, rel);
  const real = fs.realpathSync(full);
  const relative = path.relative(root, real);
  return !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative) && fs.statSync(full).isFile();
}

function walkFiles(root, diagnostics) {
  const out = [];
  const stack = [''];
  while (stack.length) {
    const relDir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(path.join(root, relDir), { withFileTypes: true }); }
    catch (err) { diagnostics.push({ code: 'unreadable-directory', message: `Could not scan ${relDir || '.'}: ${err.code}.` }); continue; }
    for (const entry of entries) {
      const rel = slash(path.join(relDir, entry.name));
      if (entry.isDirectory()) {
        if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        stack.push(rel); continue;
      }
      if (!entry.isFile() || (!CODE_EXT.has(path.extname(rel).toLowerCase()) && !SPECIAL_CODE.has(entry.name))) continue;
      try { const buffer = fs.readFileSync(path.join(root, rel)); out.push({ path: rel, size: buffer.length, hash: hash(buffer) }); }
      catch (err) { diagnostics.push({ code: 'unreadable-file', message: `Could not read ${rel}: ${err.code}.` }); }
    }
  }
  return out;
}

function discoverImports(root, files, fileSet, diagnostics) {
  const edges = [];
  for (const file of files) {
    if (file.size > 1_000_000) { diagnostics.push({ code: 'large-file', message: `${file.path} is present but import discovery is skipped above 1 MB.` }); continue; }
    try {
      const ext = path.extname(file.path).toLowerCase();
      for (const spec of importSpecs(fs.readFileSync(path.join(root, file.path), 'utf8'), ext)) {
        const target = resolveImport(file.path, spec, fileSet, ext);
        if (target && target !== file.path) edges.push({ from: file.path, to: target, type: 'import' });
        else if (!target && ext !== '.py' && spec.startsWith('.')) diagnostics.push({ code: 'unresolved-import', message: `${file.path} references ${spec}, but no supported local file resolves.` });
      }
    } catch (err) { diagnostics.push({ code: 'unreadable-file', message: `Import discovery failed for ${file.path}: ${err.code}.` }); }
  }
  return uniqueEdges(edges);
}

function buildComponentEdges(nodes, importEdges) {
  const owner = new Map();
  for (const node of nodes) for (const f of node.files) owner.set(f, node.id);
  const edges = [];
  for (const e of importEdges) {
    // Consistent arrow direction: dependency -> dependent. The original file
    // relationship stays available as evidence, never as a runtime-flow claim.
    const from = owner.get(e.to), to = owner.get(e.from);
    if (!from || !to || from === to) continue;
    let edge = edges.find(x => x.from === from && x.to === to && x.type === 'code');
    if (!edge) { edge = { from, to, type: 'code', observations: [] }; edges.push(edge); }
    edge.observations.push({ importer: e.from, imported: e.to });
  }
  for (const node of nodes) for (const dep of node.plannedDependencies) {
    if (nodes.some(n => n.id === dep)) edges.push({ from: dep, to: node.id, type: 'planned', observed: edges.some(e => e.from === dep && e.to === node.id && e.type === 'code') });
  }
  return edges;
}

function readJson(root, rel, diagnostics) {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected an object');
    return value;
  } catch (err) {
    if (err.code !== 'ENOENT') diagnostics.push({ code: 'invalid-config', message: `${rel}: ${err.message}` });
    return {};
  }
}
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
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
  return [...new Set(arr.filter(v => typeof v === 'string' && v.trim()).map(v => path.posix.normalize(v.replaceAll('\\', '/').replace(/^\.\//, ''))))];
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

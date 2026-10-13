import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scanProject, resolveStatus } from '../src/scan.js';

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-scan-'));
  fs.mkdirSync(path.join(root, '.buildmap'));
  fs.mkdirSync(path.join(root, 'src'));
  fs.writeFileSync(path.join(root, 'README.md'), '# Demo\n\nDemo turns input into output.');
  return root;
}

test('shows manifest pieces before their files exist', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, '.buildmap', 'project.json'), JSON.stringify({
    name: 'Demo', components: [{ id:'engine', name:'Engine', files:['src/engine.js'] }]
  }));
  const map = scanProject(root);
  const engine = map.nodes.find(n => n.id === 'engine');
  assert.equal(engine.status, 'planned');
  assert.deepEqual(engine.presentFiles, []);
});

test('lights files up from coded to connected when code wiring appears', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'src', 'a.js'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(root, 'src', 'b.js'), "import { a } from './a.js'; export const b = a + 1;\n");
  const map = scanProject(root);
  const a = map.nodes.find(n => n.files.includes('src/a.js'));
  const b = map.nodes.find(n => n.files.includes('src/b.js'));
  assert.equal(a.status, 'connected');
  assert.equal(b.status, 'connected');
  assert.ok(map.edges.some(e => e.from === a.id && e.to === b.id));
});

test('explicit evidence can advance but never downgrade a discovered state', () => {
  assert.equal(resolveStatus({ base:'connected', evidence:'verified' }), 'verified');
  assert.equal(resolveStatus({ base:'connected', evidence:'coded' }), 'connected');
});

test('README gives brownfield intent without requiring a manifest', () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, 'src', 'main.js'), 'export const main = true;\n');
  const map = scanProject(root);
  assert.equal(map.project.intent.source, 'README.md');
  assert.match(map.project.intent.text, /input into output/);
});

function write(root, rel, text) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), typeof text === 'string' ? text : JSON.stringify(text));
}
function planned(root, components) { write(root, '.buildmap/project.json', { components }); }
function node(map, id) { return map.nodes.find(n => n.id === id); }

test('planned dependencies are visible but cannot establish a code connection', () => {
  const root = fixture();
  write(root, 'src/a.js', 'export const a = 1;'); write(root, 'src/b.js', 'export const b = 1;');
  planned(root, [{ id: 'a', files: ['src/a.js'] }, { id: 'b', files: ['src/b.js'], dependsOn: ['a', 'missing'] }]);
  const map = scanProject(root);
  assert.equal(node(map, 'b').status, 'coded');
  assert.ok(map.edges.some(e => e.type === 'planned' && !e.observed));
  assert.ok(map.gaps.some(g => g.kind === 'unknown-dependency'));
  assert.ok(map.gaps.some(g => g.kind === 'unobserved-dependency'));
});

test('manifest status and status-only evidence cannot manufacture verification', () => {
  const root = fixture(); write(root, 'src/a.js', 'export const a = 1;');
  planned(root, [{ id: 'a', files: ['src/a.js'], status: 'live' }]);
  assert.equal(node(scanProject(root), 'a').status, 'coded');
  write(root, '.buildmap/evidence.json', { components: { a: { status: 'verified' } } });
  const map = scanProject(root);
  assert.equal(node(map, 'a').status, 'coded');
  assert.ok(map.gaps.some(g => g.kind === 'unsupported-evidence'));
});

test('partial implementation cannot be hidden by an explicit proof claim', () => {
  const root = fixture(); write(root, 'src/a.js', 'export const a = 1;');
  planned(root, [{ id: 'a', files: ['src/a.js', 'src/missing.js'] }]);
  write(root, '.buildmap/evidence.json', { components: { a: { status: 'live', note: 'Old deployment.' } } });
  const n = node(scanProject(root), 'a');
  assert.equal(n.status, 'planned'); assert.equal(n.implementation, 'partial');
  assert.deepEqual(n.missingFiles, ['src/missing.js']); assert.equal(n.evidenceAssessment.accepted, false);
});

test('source-bound receipts become stale on edits; content changes refresh the fingerprint', () => {
  const root = fixture(); write(root, 'src/a.js', 'export const a = 1;');
  planned(root, [{ id: 'a', files: ['src/a.js'] }]);
  const before = scanProject(root);
  write(root, '.buildmap/evidence.json', { components: { a: { status: 'verified', command: 'node --test', sourceHashes: node(before, 'a').sourceHashes } } });
  const proved = scanProject(root); assert.equal(node(proved, 'a').status, 'verified');
  assert.equal(node(proved, 'a').evidenceAssessment.binding, 'current');
  assert.equal(node(proved, '__mission__').status, 'planned');
  write(root, 'src/a.js', 'export const a = 2;');
  const after = scanProject(root); assert.notEqual(after.fingerprint, proved.fingerprint);
  assert.equal(node(after, 'a').status, 'coded'); assert.equal(node(after, 'a').evidenceAssessment.binding, 'stale');
});

test('unbound explicit receipts remain supported and disclose unknown freshness', () => {
  const root = fixture(); write(root, 'src/a.js', 'export const a = 1;');
  write(root, '.buildmap/evidence.json', { files: { 'src/a.js': { status: 'verified', note: 'Behavior check passed.' } } });
  const n = node(scanProject(root), 'file:src/a.js');
  assert.equal(n.status, 'verified'); assert.equal(n.evidenceAssessment.binding, 'unbound');
});

test('HTML, CSS, and explicitly declared config files count as implementation', () => {
  const root = fixture();
  write(root, 'public/index.html', '<script src="./app.js"></script><link rel="stylesheet" href="./styles.css">');
  write(root, 'public/app.js', 'export const app = 1;'); write(root, 'public/styles.css', 'body {}'); write(root, 'config.json', '{}');
  planned(root, [{ id: 'ui', files: ['public/index.html', 'public/app.js', 'public/styles.css', './config.json', 'config.json'] }]);
  const n = node(scanProject(root), 'ui');
  assert.equal(n.implementation, 'complete'); assert.equal(n.status, 'connected'); assert.equal(n.files.length, 4);
});

test('ignores JS import examples in comments/strings and discovers re-exports and TS emitted filenames', () => {
  const root = fixture(); write(root, 'src/a.ts', 'export const a = 1;');
  write(root, 'src/unused.js', 'export const unused = 1;');
  write(root, 'src/b.ts', `// import './unused.js';\nconst text = "import './unused.js'";\nexport { default as a } from './a.js';`);
  const map = scanProject(root);
  assert.equal(node(map, 'file:src/unused.js').status, 'coded');
  const edge = map.edges.find(e => e.type === 'code');
  assert.equal(edge.from, 'file:src/a.ts'); assert.equal(edge.to, 'file:src/b.ts');
  assert.deepEqual(edge.observations, [{ importer: 'src/b.ts', imported: 'src/a.ts' }]);
});

test('Python relative modules, sibling imports, parent imports, and packages resolve locally', () => {
  const root = fixture();
  write(root, 'pkg/__init__.py', ''); write(root, 'pkg/a.py', 'a = 1'); write(root, 'pkg/sub/b.py', 'b = 1');
  write(root, 'pkg/sub/main.py', 'from ..a import a\nfrom . import b\nimport pkg');
  const map = scanProject(root);
  for (const rel of ['pkg/a.py', 'pkg/sub/b.py', 'pkg/__init__.py']) assert.ok(map.edges.some(e => e.from === `file:${rel}` && e.to === 'file:pkg/sub/main.py'));
});

test('malformed configuration and duplicate ids are diagnosed without killing the map', () => {
  const root = fixture(); write(root, '.buildmap/project.json', '{ broken');
  assert.ok(scanProject(root).diagnostics.some(d => d.code === 'invalid-config'));
  planned(root, [{ id: 'same', files: [] }, { id: 'same', files: [] }, { id: '__mission__' }]);
  const map = scanProject(root); assert.equal(map.nodes.filter(n => n.id === 'same').length, 1);
  assert.equal(map.diagnostics.length, 2);
});

test('unresolved relative imports and large source files remain visible as scan gaps', () => {
  const root = fixture(); write(root, 'src/a.js', "import './gone.js';"); write(root, 'src/large.js', ' '.repeat(1_000_001));
  const map = scanProject(root);
  assert.ok(node(map, 'file:src/large.js'));
  assert.ok(map.gaps.some(g => g.kind === 'large-file'));
  assert.ok(map.gaps.some(g => g.kind === 'unresolved-import'));
});

test('manifest file paths cannot establish implementation outside the mapped root', () => {
  const root = fixture();
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-outside-'));
  write(outside, 'secret.js', 'export const secret = 1;');
  fs.symlinkSync(path.join(outside, 'secret.js'), path.join(root, 'linked.js'));
  planned(root, [{ id: 'outside', files: [path.join(outside, 'secret.js'), 'linked.js'] }]);
  assert.deepEqual(node(scanProject(root), 'outside').presentFiles, []);
});

test('invalid component field types are diagnosed rather than reaching the UI', () => {
  const root = fixture();
  planned(root, [{ id: 'bad', name: {} }, { id: 'bad2', dependsOn: 'engine' }, { id: 'bad3', visual: { kind: [] } }, { id: 'good', files: [] }]);
  const map = scanProject(root);
  assert.deepEqual(map.nodes.filter(n => n.kind === 'component').map(n => n.id), ['good']);
  assert.equal(map.diagnostics.length, 3);
  assert.equal(new Set(map.gaps.map(g => g.id)).size, map.gaps.length);
});

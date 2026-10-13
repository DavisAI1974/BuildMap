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

test('observed dependencies outside an explicit plan become drift gaps without changing proof states', () => {
  const root = fixture();
  write(root, 'src/feed.js', 'export const feed = 1;'); write(root, 'src/extra.js', 'export const extra = 1;');
  write(root, 'src/engine.js', "import './feed.js'; import './extra.js';");
  planned(root, [{ id: 'feed', files: ['src/feed.js'] }, { id: 'extra', files: ['src/extra.js'] }, { id: 'engine', files: ['src/engine.js'], dependsOn: ['feed'] }]);
  write(root, '.buildmap/evidence.json', { components: { engine: { status: 'verified', note: 'Behavior check passed.' } } });
  const map = scanProject(root);
  assert.equal(node(map, 'engine').status, 'verified');
  assert.equal(map.edges.find(e => e.type === 'code' && e.from === 'feed').planStatus, 'matched');
  assert.equal(map.edges.find(e => e.type === 'code' && e.from === 'extra').planStatus, 'undeclared');
  const drift = map.gaps.filter(g => g.kind === 'unexpected-dependency'); assert.equal(drift.length, 1);
  assert.equal(drift[0].nodeId, 'engine'); assert.equal(drift[0].dependencyId, 'extra');
  assert.deepEqual(drift[0].observations, [{ importer: 'src/engine.js', imported: 'src/extra.js' }]);
});

test('omitted dependency intent remains unspecified; explicit empty intent detects extra wiring', () => {
  const root = fixture(); write(root, 'src/a.js', 'export const a = 1;'); write(root, 'src/b.js', "import './a.js';");
  const components = [{ id: 'a', files: ['src/a.js'] }, { id: 'b', files: ['src/b.js'] }];
  planned(root, components); const unspecified = scanProject(root);
  assert.equal(node(unspecified, 'b').dependencyIntent, 'unspecified');
  assert.equal(unspecified.gaps.some(g => g.kind === 'unexpected-dependency'), false);
  components[1].dependsOn = []; planned(root, components); const explicit = scanProject(root);
  assert.equal(node(explicit, 'b').dependencyIntent, 'declared');
  assert.equal(explicit.gaps.filter(g => g.kind === 'unexpected-dependency').length, 1);
  assert.equal(node(explicit, 'b').status, node(unspecified, 'b').status);
});

test('unmapped evidence targets remain visible with their recorded claims', () => {
  const root = fixture();
  const receipt = { status: 'live', note: 'Prior deployment claim.' };
  write(root, '.buildmap/evidence.json', { components: { typo: receipt }, files: { 'src/deleted.js': receipt } });
  const map = scanProject(root); const gaps = map.gaps.filter(g => g.kind === 'unmapped-evidence');
  assert.equal(gaps.length, 2);
  for (const gap of gaps) { assert.equal(gap.priority, 'blocker'); assert.equal(gap.nodeId, null); assert.deepEqual(gap.evidence, receipt); }
  assert.equal(map.project.counts.live, 0);
});

test('file-only evidence is inspected without granting proof to its containing component', () => {
  const root = fixture(); write(root, 'src/a.js', 'export const a = 1;'); write(root, 'src/b.js', 'export const b = 1;');
  planned(root, [{ id: 'bundle', files: ['src/a.js', 'src/b.js'] }]);
  const receipt = { status: 'verified', note: 'Only file a was checked.' };
  write(root, '.buildmap/evidence.json', { files: { 'src/a.js': receipt } });
  const map = scanProject(root); const bundle = node(map, 'bundle');
  assert.equal(bundle.status, 'coded'); assert.equal(bundle.fileEvidence[0].assessment.accepted, true);
  assert.deepEqual(bundle.fileEvidence[0].evidence, receipt);
  assert.equal(map.gaps.find(g => g.kind === 'file-evidence-in-component').nodeId, 'bundle');
});

test('malformed evidence collections and falsy mapped receipts cannot disappear or promote state', () => {
  const root = fixture(); write(root, 'src/a.js', 'export const a = 1;');
  planned(root, [{ id: '0', files: ['src/a.js'] }]);
  write(root, '.buildmap/evidence.json', { components: [{ status: 'live', note: 'Bad collection.' }] });
  let map = scanProject(root); assert.equal(node(map, '0').status, 'coded');
  assert.ok(map.gaps.some(g => g.kind === 'invalid-config'));
  write(root, '.buildmap/evidence.json', { components: { 0: null } });
  map = scanProject(root); assert.equal(node(map, '0').status, 'coded');
  assert.ok(map.gaps.some(g => g.kind === 'invalid-evidence-record' && g.nodeId === '0'));
});

test('ordinary object prototype names are not mistaken for evidence records', () => {
  const root = fixture(); write(root, 'src/a.js', 'export const a = 1;');
  planned(root, [{ id: 'constructor', files: ['src/a.js'] }]);
  write(root, '.buildmap/evidence.json', { components: {} });
  const map = scanProject(root);
  assert.equal(node(map, 'constructor').evidence, null);
  assert.equal(map.gaps.some(g => g.kind === 'unsupported-evidence'), false);
});

test('clone provenance reports the selected revision without granting evidence states', () => {
  const root = fixture(); write(root, 'src/a.js', 'export const a = 1;');
  const source = { kind: 'github', repoName: 'DemoRepo', url: 'https://github.com/owner/DemoRepo', ref: 'feature/map', revision: 'a'.repeat(40), snapshot: true };
  const map = scanProject(root, { source });
  assert.equal(map.project.name, 'DemoRepo'); assert.deepEqual(map.project.source, source);
  assert.equal(map.nodes.find(n => n.kind === 'file').status, 'coded');
  assert.equal(scanProject(root).project.source.kind, 'local');
});

test('overlapping declarations retain full proof scope and never choose an arbitrary wiring/evidence owner', t => {
  const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'src/shared.js', 'export const shared = 1;');
  write(root, 'src/own.js', 'export const own = 1;');
  write(root, 'src/use.js', "import './shared.js'; import './own.js';");
  const components = [{ id: 'first', files: ['src/shared.js'] },
    { id: 'second', files: ['src/shared.js', 'src/own.js'] }, { id: 'consumer', files: ['src/use.js'] }];
  planned(root, components);
  const initial = scanProject(root);
  const receipts = Object.fromEntries(['first', 'second'].map(id => [id,
    { status: 'verified', note: 'Recorded check.', sourceHashes: node(initial, id).sourceHashes }]));
  const fileReceipt = { status: 'live', note: 'Recorded file use.' };
  write(root, '.buildmap/evidence.json', { components: receipts, files: { 'src/shared.js': fileReceipt } });
  for (const order of [components, [...components].reverse()]) {
    planned(root, order); const map = scanProject(root);
    for (const id of ['first', 'second']) {
      assert.equal(node(map, id).implementation, 'complete');
      assert.deepEqual(node(map, id).conflictingFiles, ['src/shared.js']);
      assert.equal(node(map, id).evidenceAssessment.accepted, false);
      assert.notEqual(node(map, id).status, 'verified');
      assert.ok(map.gaps.some(g => g.kind === 'overlapping-file' && g.nodeId === id && g.priority === 'blocker'));
    }
    assert.deepEqual(node(map, 'second').files, ['src/shared.js', 'src/own.js']);
    assert.deepEqual(Object.keys(node(map, 'second').sourceHashes), ['src/shared.js', 'src/own.js']);
    const observations = map.edges.filter(e => e.type === 'code').flatMap(e => e.observations);
    assert.deepEqual(observations, [{ importer: 'src/use.js', imported: 'src/own.js' }]);
    assert.deepEqual(map.gaps.find(g => g.kind === 'ambiguous-evidence-target').evidence, fileReceipt);
  }
  // The old reduced-scope receipt is also blocked while the declaration overlaps.
  receipts.second.sourceHashes = { 'src/own.js': node(initial, 'second').sourceHashes['src/own.js'] };
  write(root, '.buildmap/evidence.json', { components: receipts });
  assert.equal(node(scanProject(root), 'second').evidenceAssessment.accepted, false);
  // Removing the overlap restores the full-scope claim and routes file evidence correctly.
  planned(root, [components[0], components[2]]);
  write(root, '.buildmap/evidence.json', { components: { first: receipts.first }, files: { 'src/shared.js': fileReceipt } });
  const resolved = scanProject(root);
  assert.equal(node(resolved, 'first').status, 'verified');
  assert.equal(node(resolved, 'first').fileEvidence[0].assessment.accepted, true);
  assert.ok(resolved.edges.some(e => e.type === 'code' && e.from === 'first' && e.to === 'consumer'));
});

test('computed JS import arguments cannot invent connections to a literal prefix', t => {
  const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'src/prefix.js', 'export const prefix = 1;');
  write(root, 'src/direct.js', 'export const direct = 1;');
  write(root, 'src/options.json', '{}');
  write(root, 'src/main.js', `require('./prefix.js' + suffix); import('./prefix.js' + suffix);
    require('./prefix.js'.replace('prefix', 'other'));
    require('./direct.js'); import('./options.json', { with: { type: 'json' } });`);
  planned(root, [{ id: 'options', files: ['src/options.json'] }]);
  const map = scanProject(root);
  assert.equal(node(map, 'file:src/prefix.js').status, 'coded');
  const imported = map.edges.filter(e => e.type === 'code').flatMap(e => e.observations.map(o => o.imported));
  assert.deepEqual(imported.sort(), ['src/direct.js', 'src/options.json']);
});

test('root-relative HTML/CSS assets resolve with query strings and fragments', t => {
  const root = fixture(); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'public/index.html', '<script src="/public/app.js?v=2#module"></script><link href="/public/styles.css?v=2" rel="stylesheet">');
  write(root, 'public/app.js', 'export const app = 1;');
  write(root, 'public/styles.css', '@import url("/public/theme.css?v=2#theme");');
  write(root, 'public/theme.css', 'body {}');
  const map = scanProject(root);
  for (const [importer, imported] of [['public/index.html', 'public/app.js'], ['public/index.html', 'public/styles.css'], ['public/styles.css', 'public/theme.css']]) {
    assert.ok(map.edges.some(e => e.type === 'code' && e.observations.some(o => o.importer === importer && o.imported === imported)));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { scanProject } from '../src/scan.js';
import { pythonGuides } from '../src/workflow.js';
import { startServer } from '../src/server.js';
import { snapshotHtml } from '../src/export.js';

const example = fs.readFileSync(new URL('./fixtures/frankie-workflow.py', import.meta.url), 'utf8');
function fixture(t, source = example) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-workflow-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'workflow.py'), source);
  return root;
}
const hash = source => crypto.createHash('sha256').update(source).digest('hex');

test('Frankie-like source yields source-bound calculations, possible shared products and cautious risks without execution', t => {
  const root = fixture(t), map = scanProject(root), w = map.workflow;
  assert.equal(w.files[0].status, 'parsed');
  assert.equal(w.basis, 'static-source-syntax');
  const prepare = w.calculations.find(c => c.name === 'prepare'), search = w.calculations.find(c => c.name === 'search');
  assert.deepEqual(search.inputs, ['cells', 'transforms', 'series']);
  assert.equal(prepare.source.sourceHash, hash(example));
  assert.equal(prepare.source.line, 8); assert.equal(prepare.outputs[0].summary, 'table');
  assert.equal(prepare.transformations[0].summary, "table = pd.read_csv('raw.csv')");
  assert.equal(prepare.transformations[0].source.line, 9);
  const shared = w.dataProducts.find(p => p.pathExpression === 'prepared.parquet');
  assert.equal(shared.producers[0].calculationId, prepare.id);
  assert.equal(w.calculations.find(c => c.id === shared.consumers[0].calculationId).name, 'saved_preparation');
  assert.equal(shared.compatibility, 'unknown');
  const reads = w.findings.find(f => f.type === 'potential-repeated-read');
  assert.equal(reads.confidence, 'Needs runtime evidence'); assert.equal(reads.sources.length, 2);
  assert.match(reads.impact, /Actual bytes.*unknown/);
  assert.ok(reads.reuseCues.some(c => c.expression.includes('CouplingJobs')));
  assert.ok(reads.reuseCues.some(c => c.expression.includes('CellJobSubset')));
  assert.ok(reads.reuseCues.some(c => c.expression.includes('partner_fft_cache')));
  assert.ok(reads.reuseCues.some(c => c.expression.includes('exact_pair_reuse')));
  assert.ok(reads.reuseCues.some(c => c.expression.includes('load_restart_receipt')));
  assert.ok(w.calculations.find(c => c.name === 'saved_preparation').reuseCues.some(c => c.expression.includes('lru_cache')));
  for (const finding of w.findings) {
    assert.ok(finding.sources.every(s => s.path === 'workflow.py' && s.sourceHash === hash(example) && s.line > 0));
    assert.ok(finding.requiredVerification.length && finding.correctnessTradeoff && finding.suggestedAction);
  }
  assert.equal(map.project.counts.verified, 0); assert.equal(map.project.counts.live, 0);
  assert.deepEqual(fs.readdirSync(root), ['workflow.py']); // Top-level raising fixture was never run; no writes.
});

test('fan-out separates symbolic dimensions and literal potential iterations from jobs and directional pairs', t => {
  const w = scanProject(fixture(t)).workflow;
  const search = w.findings.find(f => f.type === 'nested-loop-fanout' && f.title.startsWith('search:'));
  assert.equal(search.workload.symbolic, 'cells × transforms × series');
  assert.equal(search.workload.potentialIterations, null);
  const literal = w.findings.find(f => f.title.startsWith('literal_dimensions:'));
  assert.equal(literal.workload.potentialIterations, '594');
  assert.equal(w.findings.filter(f => f.type === 'nested-loop-fanout').length, 2);
  for (const f of [search, literal]) {
    assert.equal(f.workload.actualJobs, null); assert.equal(f.workload.pairComparisons, null); assert.equal(f.workload.remainingJobs, null);
    assert.match(f.correctnessTradeoff, /AB\/BA/);
  }
  const ab = w.calculations.find(c => c.name === 'directional_ab');
  const ba = w.calculations.find(c => c.name === 'directional_ba');
  assert.notEqual(ab.id, ba.id); assert.deepEqual(ab.calls[0].arguments, ['a', 'b']); assert.deepEqual(ba.calls[0].arguments, ['b', 'a']);
  assert.equal(w.dataProducts.find(p => p.pathExpression === 'saved-checkpoint.json').compatibility, 'unknown');
});

test('comments, strings, dynamic reads, shadowed imports and excluded scopes do not invent read findings', t => {
  const root = fixture(t, `import pandas as pd
# pd.read_csv('fake.csv')
text = "pd.read_csv('fake.csv')"
def read(path):
    return pd.read_csv(path)
def shadow(pd):
    pd.read_csv('shadow.csv')
    pd.read_csv('shadow.csv')
def outer():
    def inner():
        open('nested.csv')
        open('nested.csv')
class Reader:
    def read(self):
        open('method.csv')
        open('method.csv')
`);
  const w = scanProject(root).workflow;
  assert.deepEqual(w.dataProducts, []); assert.deepEqual(w.findings, []);
  assert.ok(w.calculations.some(c => c.name === 'read'));
  assert.equal(w.calculations.some(c => ['inner', 'Reader.read'].includes(c.name)), false);
  assert.match(w.limitations.join(' '), /Dynamic|dynamic/);
});

test('loop iterator reads and else suites do not become repeated inner-body work; guards are not execution proof', t => {
  const root = fixture(t, `def run():
    for row in open('once.csv'):
        pass
    else:
        for other in range(5):
            pass
    if False:
        open('branch.csv')
    else:
        open('branch.csv')
`);
  const w = scanProject(root).workflow;
  assert.equal(w.findings.some(f => f.type === 'nested-loop-fanout'), false);
  assert.equal(w.findings.some(f => f.title.includes('once.csv')), false);
  assert.equal(w.findings.find(f => f.title.includes('branch.csv')).confidence, 'Needs runtime evidence');
});

test('literal ranges handle descending, empty and huge counts without assuming runtime execution', t => {
  const root = fixture(t, `def loops():
    for i in range(5, 0, -2):
        for j in range(0):
            work()
def huge():
    for i in range(1000000000):
        for j in range(1000000000):
            work()
`);
  const findings = scanProject(root).workflow.findings;
  assert.equal(findings.find(f => f.title.startsWith('loops:')).workload.potentialIterations, '0');
  assert.equal(findings.find(f => f.title.startsWith('huge:')).workload.potentialIterations, '1000000000000000000');
});

test('unavailable parser, parse errors and source limits preserve the free inventory and disclose unreviewed scope', t => {
  const root = fixture(t, 'def broken(:\n');
  fs.writeFileSync(path.join(root, 'large.py'), '#' + 'x'.repeat(1_000_001));
  let map = scanProject(root);
  assert.equal(map.workflow.files.find(f => f.path === 'workflow.py').status, 'parse-error');
  assert.equal(map.workflow.files.find(f => f.path === 'large.py').status, 'size-limit');
  assert.equal(map.scan.fileCount, 2); assert.deepEqual(map.workflow.findings, []);
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `import {scanProject} from './src/scan.js'; console.log(JSON.stringify(scanProject(process.argv[1])))`, root], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, PATH: '/missing-buildmap-python' }, encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr); map = JSON.parse(result.stdout);
  assert.equal(map.workflow.files.find(f => f.path === 'workflow.py').status, 'analyzer-unavailable');
  assert.equal(map.scan.fileCount, 2);
  const sources = Array.from({ length: 65 }, (_, i) => ({ path: `${i}.py`, source: 'value = 1' }));
  const guides = new Map(sources.map(s => [s.path, { functions: [] }]));
  pythonGuides(sources, guides);
  assert.equal(guides.get('63.py').status, 'parsed'); assert.equal(guides.get('64.py').status, 'analysis-limit');
});

test('source edits invalidate calculation identities and old receipts without changing or blessing checkpoints', t => {
  const root = fixture(t);
  fs.mkdirSync(path.join(root, '.buildmap'));
  fs.writeFileSync(path.join(root, '.buildmap/evidence.json'), JSON.stringify({ files: { 'workflow.py': { status: 'verified', note: 'Recorded prior check', sourceHashes: { 'workflow.py': hash(example) } } } }));
  fs.writeFileSync(path.join(root, 'saved-checkpoint.json'), '{"source":"old","coverage":"partial"}');
  const before = scanProject(root);
  assert.equal(before.nodes.find(n => n.id === 'file:workflow.py').status, 'verified');
  fs.writeFileSync(path.join(root, 'workflow.py'), example.replace("'raw.csv'", "'new-raw.csv'"));
  const after = scanProject(root);
  assert.notEqual(after.fingerprint, before.fingerprint);
  assert.notEqual(after.workflow.calculations[0].source.sourceHash, before.workflow.calculations[0].source.sourceHash);
  assert.notEqual(after.nodes.find(n => n.id === 'file:workflow.py').status, 'verified');
  assert.equal(after.workflow.dataProducts.find(p => p.pathExpression === 'saved-checkpoint.json').compatibility, 'unknown');
  assert.equal(fs.readFileSync(path.join(root, 'saved-checkpoint.json'), 'utf8'), '{"source":"old","coverage":"partial"}');
});

test('live API, CLI JSON and self-contained exports carry the same risk records with read-only boundaries', async t => {
  const root = fixture(t), map = scanProject(root);
  const server = startServer({ root, port: 0 }); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const url = `http://127.0.0.1:${server.address().port}/api/map`;
  const live = await (await fetch(url)).json(); assert.deepEqual(live.workflow, map.workflow);
  assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  const result = spawnSync(process.execPath, ['src/cli.js', root, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); assert.deepEqual(JSON.parse(result.stdout).workflow, map.workflow);
  const html = snapshotHtml(map);
  assert.ok(html.includes('nested-loop-fanout')); assert.ok(html.includes('Before you run'));
  assert.equal((await fetch(url.replace('/api/map', '/workflow.py'))).status, 404);
});

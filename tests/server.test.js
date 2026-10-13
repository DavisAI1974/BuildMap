import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { once } from 'node:events';
import { startServer } from '../src/server.js';
import { parseArgs, prepareTarget } from '../src/cli.js';
import { spawnSync } from 'node:child_process';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-server-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('CLI consumes flag values independently of project position and rejects mistakes', () => {
  assert.deepEqual(parseArgs(['--port', '5000', '--host', 'localhost', '../demo', '--json']), { target: '../demo', port: 5000, host: 'localhost', json: true, html: null, ref: null, init: false, help: false });
  for (const args of [['--port'], ['--port', 'NaN'], ['--port', '65536'], ['--unknown'], ['a', 'b'], ['--html'], ['--html', 'out.html', '--json'], ['--ref'], ['--ref', 'main', '.'], ['https://github.com/owner/repo', '--ref', '-bad']]) assert.throws(() => parseArgs(args));
});

test('CLI JSON mode emits a parseable one-shot snapshot without starting the server', t => {
  const root = fixture(t);
  const result = spawnSync(process.execPath, ['src/cli.js', '--port', '0', root, '--json'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(result.status, 0, result.stderr);
  const map = JSON.parse(result.stdout);
  assert.equal(map.project.root, root); assert.ok(map.gaps.some(g => g.kind === 'missing-intent'));
});

test('server maps live edits, serves gaps/assets, and keeps repository files private', async t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'secret.txt'), 'private');
  const server = startServer({ root, port: 0 }); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const read = async route => { const r = await fetch(base + route); assert.equal(r.status, 200); return r.json(); };
  const before = await read('/api/map');
  fs.writeFileSync(path.join(root, 'main.js'), 'export const main = 1;');
  const after = await read('/api/map'); assert.notEqual(before.fingerprint, after.fingerprint);
  assert.equal(after.project.counts.coded, 1);
  const gaps = await read('/api/gaps'); assert.deepEqual(gaps.gaps, after.gaps);
  fs.mkdirSync(path.join(root, '.buildmap'));
  fs.writeFileSync(path.join(root, 'data.json'), '{}');
  fs.writeFileSync(path.join(root, '.buildmap/evidence.json'), JSON.stringify({ files: {
    'main.js': { status: 'verified', note: 'Recorded input check.',
      sourceHashes: after.nodes.find(n => n.id === 'file:main.js').sourceHashes,
      inputHashes: { 'data.json': crypto.createHash('sha256').update('{}').digest('hex') } }
  } }));
  const bound = await read('/api/map'); assert.equal(bound.project.counts.verified, 1);
  fs.writeFileSync(path.join(root, 'data.json'), '{"changed":true}');
  const stale = await read('/api/map'); assert.equal(stale.project.counts.verified, 0);
  assert.notEqual(stale.fingerprint, bound.fingerprint);
  const inputGaps = await read('/api/gaps');
  assert.ok(inputGaps.gaps.some(g => g.kind === 'unsupported-evidence' && g.message.includes('data.json')));
  assert.deepEqual(inputGaps.gaps, stale.gaps);
  const plan = { outcomes: [{ id: 'main-output', goal: 'Produce useful main output.', steps: [
    { id: 'main', nodeId: 'file:main.js', label: 'Run main', expected: 'Useful output.' }
  ] }] };
  fs.writeFileSync(path.join(root, '.buildmap/project.json'), JSON.stringify(plan));
  const outcomeMap = await read('/api/map');
  assert.equal(outcomeMap.outcomes[0].status, 'unproved');
  assert.ok((await read('/api/gaps')).gaps.some(g => g.outcomeId === 'main-output'));
  plan.outcomes[0].steps[0].expected = 'A revised output contract.';
  fs.writeFileSync(path.join(root, '.buildmap/project.json'), JSON.stringify(plan));
  const changedOutcome = await read('/api/map');
  assert.notEqual(changedOutcome.outcomes[0].definitionHash, outcomeMap.outcomes[0].definitionHash);
  assert.notEqual(changedOutcome.fingerprint, outcomeMap.fingerprint);
  for (const route of ['/', '/app.js', '/styles.css']) assert.equal((await fetch(base + route)).status, 200);
  for (const route of ['/secret.txt', '/src/scan.js', '/%2e%2e%2fpackage.json']) assert.equal((await fetch(base + route)).status, 404);
  assert.equal((await fetch(base + '/api/map', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/', { method: 'HEAD' })).status, 200);
});

test('GitHub refs parse independently; invalid refs and local ref selection fail before cloning or creating folders', t => {
  const parsed = parseArgs(['--ref', 'feat/living-map', 'https://github.com/owner/repo', '--json']);
  assert.equal(parsed.ref, 'feat/living-map'); assert.equal(parsed.target, 'https://github.com/owner/repo');
  const root = fixture(t); const absent = path.join(root, 'not-created');
  assert.throws(() => prepareTarget(absent, () => {}, 'main'), /For local mapping/);
  assert.equal(fs.existsSync(absent), false);
  const logs = [];
  assert.throws(() => prepareTarget('https://github.com/owner/repo', x => logs.push(x), 'bad..ref'), /Invalid branch\/tag/);
  assert.deepEqual(logs, []);
});

test('CLI maps selected branches/tags, reports the exact revision, and cleans up the clone', t => {
  const root = fixture(t); const origin = path.join(root, 'origin'); fs.mkdirSync(origin);
  const git = (...args) => {
    const r = spawnSync('git', ['-C', origin, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr); return r.stdout.trim();
  };
  git('init', '--quiet'); git('config', 'user.name', 'BuildMap fixture'); git('config', 'user.email', 'fixture@example.invalid');
  fs.writeFileSync(path.join(origin, 'main.js'), 'export const version = 1;');
  git('add', '.'); git('commit', '--quiet', '-m', 'first'); git('tag', 'v1'); const tagRevision = git('rev-parse', 'HEAD');
  git('checkout', '--quiet', '-b', 'feature/map');
  fs.writeFileSync(path.join(origin, 'main.js'), 'export const version = 2;');
  git('commit', '--quiet', '-am', 'second'); const branchRevision = git('rev-parse', 'HEAD');
  // Isolated Git URL rewriting avoids a network dependency in the test suite.
  const url = 'https://github.com/buildmap-fixture/Example';
  const env = { ...process.env, GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: `url.file://${origin}.insteadOf`, GIT_CONFIG_VALUE_0: url, TMPDIR: root };
  for (const [ref, revision] of [['feature/map', branchRevision], ['v1', tagRevision]]) {
    const r = spawnSync(process.execPath, ['src/cli.js', url, '--ref', ref, '--json'], { encoding: 'utf8', env, timeout: 5000 });
    assert.equal(r.status, 0, r.stderr);
    const map = JSON.parse(r.stdout);
    assert.equal(map.project.source.ref, ref); assert.equal(map.project.source.revision, revision);
    assert.equal(map.project.source.snapshot, true); assert.equal(map.project.name, 'Example');
    assert.ok(map.nodes.some(n => n.files.includes('main.js')));
    assert.equal(map.project.counts.verified, 0); assert.equal(fs.existsSync(map.project.root), false);
  }
  const failed = spawnSync(process.execPath, ['src/cli.js', url, '--ref', 'missing-ref', '--json'], { encoding: 'utf8', env, timeout: 5000 });
  assert.equal(failed.status, 1); assert.match(failed.stderr, /branch\/tag missing-ref/);
  assert.equal(fs.readdirSync(root).some(f => f.startsWith('buildmap-')), false);
});

test('guided local setup creates a declared destination while preserving existing source and evidence', t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'main.js'), 'export const main = 7;');
  fs.mkdirSync(path.join(root, '.buildmap'));
  const evidence = '{"files":{"main.js":{"status":"computing","note":"Earlier observation."}}}\n';
  fs.writeFileSync(path.join(root, '.buildmap/evidence.json'), evidence);
  const init = spawnSync(process.execPath, ['src/cli.js', root, '--init'], { encoding: 'utf8', timeout: 5000,
    input: 'Our project\nHelp our customers track appointments.\nA simple appointment calendar.\nShow appointments and booking status.\n' });
  assert.equal(init.status, 0, init.stderr);
  assert.match(init.stdout, /What should someone see or experience/);
  assert.match(init.stdout, /No implementation or proof was created/);
  assert.match(init.stdout, /Next, open the map/);
  const plan = JSON.parse(fs.readFileSync(path.join(root, '.buildmap/project.json'), 'utf8'));
  assert.deepEqual(plan.components, []); assert.equal(plan.outcomes, undefined);
  assert.equal(plan.finishedProduct.experience, 'A simple appointment calendar.');
  assert.equal(plan.finishedProduct.behavior, 'Show appointments and booking status.');
  assert.equal(fs.readFileSync(path.join(root, 'main.js'), 'utf8'), 'export const main = 7;');
  assert.equal(fs.readFileSync(path.join(root, '.buildmap/evidence.json'), 'utf8'), evidence);
  const mapped = spawnSync(process.execPath, ['src/cli.js', root, '--json'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(mapped.status, 0, mapped.stderr);
  const map = JSON.parse(mapped.stdout);
  assert.equal(map.project.finishedProduct.confidence, 'declared');
  assert.equal(map.project.intent.text, plan.mission);
  assert.equal(map.project.counts.computing, 1); assert.equal(map.project.counts.verified, 0); assert.equal(map.project.counts.live, 0);
  const prior = fs.readFileSync(path.join(root, '.buildmap/project.json'), 'utf8');
  const again = spawnSync(process.execPath, ['src/cli.js', root, '--init'], { encoding: 'utf8', input: 'Replace it\n', timeout: 5000 });
  assert.equal(again.status, 1); assert.match(again.stderr, /will not overwrite/);
  assert.equal(fs.readFileSync(path.join(root, '.buildmap/project.json'), 'utf8'), prior);
});

test('guided setup handles defaults, unfinished answers, and incompatible targets without making proof or changing plans', t => {
  const root = fixture(t);
  const invoke = (target, input, flags = []) => spawnSync(process.execPath, ['src/cli.js', target, '--init', ...flags], { encoding: 'utf8', input, timeout: 5000 });
  const fresh = path.join(root, 'fresh');
  const result = invoke(fresh, '\nBuild a useful tool.\n\n\n');
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(fs.readFileSync(path.join(fresh, '.buildmap/project.json'), 'utf8'));
  assert.equal(plan.name, 'fresh'); assert.equal(plan.finishedProduct.experience, undefined);
  assert.equal(plan.finishedProduct.behavior, plan.mission);
  assert.equal(fs.existsSync(path.join(fresh, '.buildmap/evidence.json')), false);
  for (const [suffix, input] of [['stopped', 'Name\nGoal\n'], ['empty-goal', 'Name\n\n']]) {
    const target = path.join(root, suffix), r = invoke(target, input);
    assert.equal(r.status, 1); assert.match(r.stderr, /No project description was written/);
    assert.equal(fs.existsSync(target), false);
  }
  for (const flags of [['--json'], ['--html', path.join(root, 'out.html')]]) {
    const target = path.join(root, 'invalid-mode');
    const invalid = invoke(target, '', flags);
    assert.equal(invalid.status, 1); assert.match(invalid.stderr, /local setup only/);
    assert.equal(fs.existsSync(target), false);
  }
  const remote = invoke('https://github.com/owner/repo', '');
  assert.equal(remote.status, 1); assert.match(remote.stderr, /local setup only/);
  const outside = path.join(root, 'outside'), linked = path.join(root, 'linked');
  fs.mkdirSync(outside); fs.mkdirSync(linked); fs.symlinkSync(outside, path.join(linked, '.buildmap'));
  const unsafe = invoke(linked, 'Name\nGoal\nScreen\nBehavior\n');
  assert.equal(unsafe.status, 1); assert.match(unsafe.stderr, /regular .buildmap directory/);
  assert.deepEqual(fs.readdirSync(outside), []);
});

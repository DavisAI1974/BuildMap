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
import { Readable } from 'node:stream';
import { createWalkthrough, createPiece } from '../src/setup.js';
import { scanProject } from '../src/scan.js';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-server-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('CLI consumes flag values independently of project position and rejects mistakes', () => {
  assert.deepEqual(parseArgs(['--port', '5000', '--host', 'localhost', '../demo', '--json']), { target: '../demo', port: 5000, host: 'localhost', json: true, html: null, ref: null, init: false, walkthrough: false, piece: false, extendPiece: false, help: false });
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

test('guided walkthrough CLI appends reviewed steps and support while preserving plans, source, evidence and piece states', t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, '.buildmap'));
  fs.writeFileSync(path.join(root, 'main.js'), 'export const result = 7;');
  fs.writeFileSync(path.join(root, 'checks.js'), 'export const check = true;');
  const prior = { name: 'Our build', mission: 'Understand our build.', custom: { keep: true },
    finishedProduct: { behavior: 'Show the build.' }, components: [
      { id: 'main', name: 'Read the build', files: ['main.js'] },
      { id: 'planned', name: 'Show the build', files: ['viewer.js'] }
    ], outcomes: [{ id: 'review-build', goal: 'Existing goal.', steps: [{ id: 'old', nodeId: 'main', label: 'Old step', expected: 'Existing result.' }] }] };
  const planPath = path.join(root, '.buildmap/project.json'); fs.writeFileSync(planPath, JSON.stringify(prior));
  const evidence = JSON.stringify({ components: { main: { status: 'verified', note: 'Recorded check.' } }, outcomes: {
    'review-build-2': { status: 'verified', note: 'Unmapped claim must stay unmapped.' }
  } });
  fs.writeFileSync(path.join(root, '.buildmap/evidence.json'), evidence);
  const before = scanProject(root);
  const result = spawnSync(process.execPath, ['src/cli.js', root, '--walkthrough'], { encoding: 'utf8', timeout: 5000,
    input: 'Review build\nUnderstand what works.\n1\nRead the files\nA build snapshot.\nKeeps the goal in view.\n2\n\nA useful viewer.\n\n1\nSummarize the build\nA useful summary.\n\n\n3,3\nyes\n' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Review before saving/); assert.match(result.stdout, /walkthrough starts unproved/);
  const saved = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  assert.deepEqual({ ...saved, outcomes: prior.outcomes }, prior);
  assert.deepEqual(saved.outcomes[0], prior.outcomes[0]);
  const added = saved.outcomes[1]; assert.equal(added.id, 'review-build-3');
  assert.deepEqual(added.steps.map(s => s.nodeId), ['main', 'planned', 'main']);
  assert.equal(added.steps[0].explanation, 'Keeps the goal in view.');
  assert.equal(added.steps[1].label, 'Show the build'); assert.deepEqual(added.supports, ['file:checks.js']);
  assert.equal(fs.readFileSync(path.join(root, '.buildmap/evidence.json'), 'utf8'), evidence);
  assert.equal(fs.readFileSync(path.join(root, 'main.js'), 'utf8'), 'export const result = 7;');
  assert.equal(fs.existsSync(path.join(root, 'viewer.js')), false);
  const after = scanProject(root), journey = after.outcomes.find(o => o.id === added.id);
  assert.equal(journey.status, 'unproved'); assert.equal(journey.hasEvidence, false);
  assert.deepEqual(journey.steps.map(s => s.state), ['unobserved', 'missing-implementation', 'unobserved']);
  assert.deepEqual(after.edges, before.edges);
  assert.deepEqual(after.nodes.map(n => [n.id, n.status]), before.nodes.map(n => [n.id, n.status]));
  assert.ok(after.gaps.some(g => g.kind === 'unmapped-outcome-evidence'));
  const mapping = spawnSync(process.execPath, ['src/cli.js', root, '--json'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(mapping.status, 0, mapping.stderr); assert.equal(JSON.parse(mapping.stdout).outcomes.length, 2);
  assert.equal(fs.readFileSync(planPath, 'utf8'), JSON.stringify(saved, null, 2) + '\n');
});

test('walkthrough CLI cancellation, unfinished input, invalid targets and linked plans never change the plan', t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, '.buildmap'));
  fs.writeFileSync(path.join(root, 'main.js'), 'export const main = 1;');
  const planPath = path.join(root, '.buildmap/project.json'), original = '{"mission":"Useful software.","components":[]}\n';
  fs.writeFileSync(planPath, original);
  const invoke = (target = root, input = '', flags = []) => spawnSync(process.execPath, ['src/cli.js', target, '--walkthrough', ...flags], { encoding: 'utf8', input, timeout: 5000 });
  const cancel = invoke(root, 'Review\nHelp our users.\n0\n1\n\n\nUseful result.\n\n\nwrong\n\nno\n');
  assert.equal(cancel.status, 0, cancel.stderr); assert.match(cancel.stdout, /Choose a mapped piece/);
  assert.match(cancel.stdout, /Please describe/); assert.match(cancel.stdout, /Use mapped piece numbers/);
  assert.match(cancel.stdout, /Cancelled/); assert.equal(fs.readFileSync(planPath, 'utf8'), original);
  const stopped = invoke(root, 'Review\nHelp our users.\n');
  assert.equal(stopped.status, 1); assert.match(stopped.stderr, /stopped before all answers/);
  for (const flags of [['--init'], ['--json'], ['--html', path.join(root, 'export.html')]]) {
    assert.equal(invoke(root, '', flags).status, 1); assert.equal(fs.readFileSync(planPath, 'utf8'), original);
  }
  assert.equal(invoke('https://github.com/owner/repo').status, 1);
  const absent = path.join(root, 'absent'); assert.equal(invoke(absent).status, 1); assert.equal(fs.existsSync(absent), false);
  const empty = path.join(root, 'empty'); fs.mkdirSync(path.join(empty, '.buildmap'), { recursive: true });
  fs.writeFileSync(path.join(empty, '.buildmap/project.json'), original);
  const noPieces = invoke(empty); assert.equal(noPieces.status, 1); assert.match(noPieces.stderr, /No pieces are mapped/);
  assert.equal(fs.readFileSync(path.join(empty, '.buildmap/project.json'), 'utf8'), original);
  for (const raw of ['not JSON', 'null', '{"outcomes":{}}', '{"outcomes":[{"id":"bad"}]}']) {
    fs.writeFileSync(planPath, raw); assert.equal(invoke().status, 1); assert.equal(fs.readFileSync(planPath, 'utf8'), raw);
  }
  fs.writeFileSync(planPath, original);
  fs.unlinkSync(planPath); const outside = path.join(root, 'outside.json'); fs.writeFileSync(outside, original); fs.symlinkSync(outside, planPath);
  assert.equal(invoke().status, 1); assert.equal(fs.readFileSync(outside, 'utf8'), original);
  fs.unlinkSync(planPath); fs.linkSync(outside, planPath); assert.equal(invoke().status, 1);
  fs.unlinkSync(planPath); fs.rmSync(path.join(root, '.buildmap'), { recursive: true });
  const folder = path.join(root, 'outside'); fs.mkdirSync(folder); fs.writeFileSync(path.join(folder, 'project.json'), original);
  fs.symlinkSync(folder, path.join(root, '.buildmap')); assert.equal(invoke().status, 1);
  assert.equal(fs.readFileSync(path.join(folder, 'project.json'), 'utf8'), original);
});

test('walkthrough authoring refuses concurrent plan edits and newly colliding evidence rather than replacing them', async t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, '.buildmap')); fs.writeFileSync(path.join(root, 'main.js'), 'export const x = 1;');
  const planPath = path.join(root, '.buildmap/project.json'), original = '{"mission":"Original goal."}';
  const answers = 'Review\nUseful result.\n1\n\nUseful output.\n\n\n\nyes\n';
  for (const change of ['plan', 'evidence']) {
    fs.writeFileSync(planPath, original);
    const evidencePath = path.join(root, '.buildmap/evidence.json'); fs.rmSync(evidencePath, { force: true });
    const concurrent = '{"mission":"Newer goal."}';
    const claim = '{"outcomes":{"review":{"status":"verified","note":"New claim."}}}';
    const output = { write(text) {
      if (text.startsWith('Save this walkthrough?')) fs.writeFileSync(change === 'plan' ? planPath : evidencePath, change === 'plan' ? concurrent : claim);
    } };
    await assert.rejects(createWalkthrough(root, { input: Readable.from([answers]), output }), change === 'plan' ? /plan changed during setup/ : /evidence claim now uses/);
    assert.equal(fs.readFileSync(planPath, 'utf8'), change === 'plan' ? concurrent : original);
    if (change === 'evidence') assert.equal(fs.readFileSync(evidencePath, 'utf8'), claim);
    assert.deepEqual(fs.readdirSync(path.dirname(planPath)).filter(f => f.endsWith('.tmp')), []);
  }
});

test('piece CLI groups exact files and plans missing implementation without promoting file-only or orphan claims', t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, '.buildmap'));
  fs.writeFileSync(path.join(root, 'a.js'), 'export const a = 1;'); fs.writeFileSync(path.join(root, 'b.js'), 'export const b = 2;');
  fs.writeFileSync(path.join(root, 'owned.js'), 'export const existing = true;');
  const manifest = { mission: 'Help our users.', custom: { preserve: true }, components: [{ id: 'existing', files: ['owned.js'], purpose: 'Original piece.' }],
    outcomes: [{ id: 'old', goal: 'Keep the original goal.', steps: [{ id: 'step', nodeId: 'existing', label: 'Original', expected: 'Original result.' }] }] };
  const planPath = path.join(root, '.buildmap/project.json'); fs.writeFileSync(planPath, JSON.stringify(manifest));
  const evidence = JSON.stringify({ components: { bundle: { status: 'verified', note: 'Orphan claim.' } }, files: { 'a.js': { status: 'verified', note: 'Only this file was checked.' } } });
  fs.writeFileSync(path.join(root, '.buildmap/evidence.json'), evidence);
  const run = (input, flags = []) => spawnSync(process.execPath, ['src/cli.js', root, '--piece', ...flags], { input, encoding: 'utf8', timeout: 5000 });
  const result = run('Bundle\nServe useful output.\nSupports the goal.\n1,2,1\nsrc/future.js\n\nyes\n');
  assert.equal(result.status, 0, result.stderr); assert.match(result.stdout, /Review before saving/); assert.match(result.stdout, /File-only receipts stay file-only/);
  const saved = JSON.parse(fs.readFileSync(planPath, 'utf8'));
  assert.deepEqual({ ...saved, components: manifest.components }, manifest);
  assert.deepEqual(saved.components[1], { id: 'bundle-2', name: 'Bundle', purpose: 'Serve useful output.', contributes: 'Supports the goal.', files: ['a.js', 'b.js', 'src/future.js'] });
  const map = scanProject(root), n = map.nodes.find(n => n.id === 'bundle-2');
  assert.equal(n.status, 'planned'); assert.deepEqual(n.presentFiles, ['a.js', 'b.js']); assert.deepEqual(n.missingFiles, ['src/future.js']);
  assert.equal(n.fileEvidence[0].assessment.accepted, true); assert.equal(n.evidence, null);
  assert.ok(map.gaps.some(g => g.kind === 'unmapped-evidence' && g.message.includes('bundle')));
  assert.equal(fs.readFileSync(path.join(root, '.buildmap/evidence.json'), 'utf8'), evidence);
  assert.equal(fs.readFileSync(path.join(root, 'a.js'), 'utf8'), 'export const a = 1;'); assert.equal(fs.existsSync(path.join(root, 'src')), false);
  const empty = run('Future piece\nDo a future job.\n\n\n\nyes\n'); assert.equal(empty.status, 0, empty.stderr);
  const planned = scanProject(root).nodes.find(n => n.id === 'future-piece'); assert.deepEqual(planned.files, []); assert.equal(planned.status, 'planned');
  assert.equal(run('Interrupted\n').status, 1);
});

test('piece setup refuses ownership and goal-reference changes, invalid modes and unsafe paths, with cancellable review', t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, '.buildmap'));
  fs.writeFileSync(path.join(root, 'used.js'), 'export const used = true;'); fs.writeFileSync(path.join(root, 'owned.js'), 'export const owned = true;');
  const planPath = path.join(root, '.buildmap/project.json'), original = JSON.stringify({ components: [{ id: 'owner', files: ['owned.js'] }],
    outcomes: [{ id: 'goal', goal: 'Use this file.', steps: [{ id: 'step', nodeId: 'file:used.js', label: 'Use it', expected: 'Useful result.' }] }] });
  fs.writeFileSync(planPath, original);
  const outside = path.join(root, 'outside'); fs.mkdirSync(outside); fs.symlinkSync(outside, path.join(root, 'linked'));
  const invoke = (input = '', flags = [], target = root) => spawnSync(process.execPath, ['src/cli.js', target, '--piece', ...flags], { input, encoding: 'utf8', timeout: 5000 });
  const result = invoke('New piece\nA useful job.\n\n1\n\nowned.js\n../escape.js\n/a.js\nC:/a.js\nlinked/new.js\nused.js\nsrc/*.js\n\nno\n');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /used by an existing walkthrough/); assert.match(result.stdout, /already belongs/);
  assert.match(result.stdout, /project-relative file path/); assert.match(result.stdout, /linked files\/directories/); assert.match(result.stdout, /Cancelled/);
  assert.equal(fs.readFileSync(planPath, 'utf8'), original); assert.deepEqual(fs.readdirSync(outside), []);
  for (const flags of [['--init'], ['--walkthrough'], ['--json'], ['--html', path.join(root, 'preview.html')]]) {
    assert.equal(invoke('', flags).status, 1); assert.equal(fs.readFileSync(planPath, 'utf8'), original);
  }
  assert.equal(invoke('', [], 'https://github.com/owner/repo').status, 1);
  assert.equal(invoke('Stop here\n').status, 1); assert.equal(fs.readFileSync(planPath, 'utf8'), original);
});

test('piece setup preserves edits and new receipt collisions made during its interview', async t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, '.buildmap'));
  const planPath = path.join(root, '.buildmap/project.json'), evidencePath = path.join(root, '.buildmap/evidence.json');
  const answers = 'New piece\nDo a useful job.\n\n\nfuture.js\n\nyes\n';
  for (const change of ['plan', 'evidence']) {
    fs.writeFileSync(planPath, '{}'); fs.rmSync(evidencePath, { force: true });
    const newer = '{"mission":"A newer goal."}', claim = '{"components":{"new-piece":{"status":"verified","note":"New claim."}}}';
    const output = { write(text) { if (text.startsWith('Save this piece?')) fs.writeFileSync(change === 'plan' ? planPath : evidencePath, change === 'plan' ? newer : claim); } };
    await assert.rejects(createPiece(root, { input: Readable.from([answers]), output }), change === 'plan' ? /plan changed/ : /evidence claim now uses/);
    assert.equal(fs.readFileSync(planPath, 'utf8'), change === 'plan' ? newer : '{}');
    if (change === 'evidence') assert.equal(fs.readFileSync(evidencePath, 'utf8'), claim);
    assert.equal(fs.existsSync(path.join(root, 'future.js')), false);
  }
});

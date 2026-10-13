import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { startServer } from '../src/server.js';
import { parseArgs } from '../src/cli.js';
import { spawnSync } from 'node:child_process';

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-server-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test('CLI consumes flag values independently of project position and rejects mistakes', () => {
  assert.deepEqual(parseArgs(['--port', '5000', '--host', 'localhost', '../demo', '--json']), { target: '../demo', port: 5000, host: 'localhost', json: true, help: false });
  for (const args of [['--port'], ['--port', 'NaN'], ['--port', '65536'], ['--unknown'], ['a', 'b']]) assert.throws(() => parseArgs(args));
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
  for (const route of ['/', '/app.js', '/styles.css']) assert.equal((await fetch(base + route)).status, 200);
  for (const route of ['/secret.txt', '/src/scan.js', '/%2e%2e%2fpackage.json']) assert.equal((await fetch(base + route)).status, 404);
  assert.equal((await fetch(base + '/api/map', { method: 'POST' })).status, 405);
  assert.equal((await fetch(base + '/', { method: 'HEAD' })).status, 200);
});

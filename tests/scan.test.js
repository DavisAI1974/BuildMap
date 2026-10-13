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
  assert.ok(map.edges.some(e => e.from === b.id && e.to === a.id));
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

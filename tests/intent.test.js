import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readIntent, summarizeMarkdown } from '../src/intent.js';

test('summarizes the first useful README prose', () => {
  const text = summarizeMarkdown('# Thing\n\nThing turns raw events into a useful signal.\n\n## Install\nDo stuff.');
  assert.equal(text, 'Thing turns raw events into a useful signal.');
});

test('prefers explicit BuildMap mission over README inference', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-intent-'));
  fs.writeFileSync(path.join(root, 'README.md'), '# Repo\n\nREADME mission.');
  const intent = readIntent(root, { mission: 'Declared mission.' });
  assert.equal(intent.text, 'Declared mission.');
  assert.equal(intent.confidence, 'declared');
});

test('does not block when intent is missing', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-empty-'));
  const intent = readIntent(root, {});
  assert.equal(intent.confidence, 'unknown');
  assert.match(intent.text, /interview/i);
});

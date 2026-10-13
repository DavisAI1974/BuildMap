#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startServer } from './server.js';

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(`BuildMap v0.1\n\nUsage:\n  buildmap [project-path-or-github-url] [--port 4173] [--host 127.0.0.1]\n\nExamples:\n  buildmap .\n  buildmap ../my-new-project\n  buildmap https://github.com/owner/repo\n`);
  process.exit(0);
}

const target = args.find(a => !a.startsWith('-')) || '.';
const port = Number(valueOf('--port') || 4173);
const host = valueOf('--host') || '127.0.0.1';
const root = prepareTarget(target);
startServer({ root, host, port });

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : null;
}

function prepareTarget(target) {
  if (/^https?:\/\/github\.com\//i.test(target)) {
    const clean = target.replace(/\.git\/?$/, '').replace(/\/$/, '');
    const name = clean.split('/').slice(-2).join('-');
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), `buildmap-${name}-`));
    console.log(`Cloning ${clean} for read-only mapping…`);
    const result = spawnSync('git', ['clone', '--depth', '1', clean, dest], { stdio: 'inherit' });
    if (result.status !== 0) {
      console.error('Could not clone the repository. For private repositories, clone it yourself and pass the local path.');
      process.exit(result.status || 1);
    }
    return dest;
  }

  const full = path.resolve(target);
  if (!fs.existsSync(full)) {
    fs.mkdirSync(full, { recursive: true });
    console.log(`Created empty project folder: ${full}`);
  }
  if (!fs.statSync(full).isDirectory()) {
    console.error(`Not a directory: ${full}`);
    process.exit(1);
  }
  return full;
}

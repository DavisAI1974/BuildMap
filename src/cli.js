#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { startServer } from './server.js';
import { scanProject } from './scan.js';
import { snapshotHtml } from './export.js';
import { initializeProject } from './setup.js';

export function parseArgs(args) {
  const options = { target: '.', port: 4173, host: '127.0.0.1', json: false, html: null, ref: null, init: false, help: false };
  let targetSeen = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--init') options.init = true;
    else if (arg === '--json') options.json = true;
    else if (arg === '--port' || arg === '--host' || arg === '--html' || arg === '--ref') {
      const value = args[++i];
      if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}.`);
      options[arg.slice(2)] = arg === '--port' ? Number(value) : value;
    } else if (arg.startsWith('-')) throw new Error(`Unknown option: ${arg}.`);
    else if (targetSeen) throw new Error('Pass one project path or GitHub URL.');
    else { options.target = arg; targetSeen = true; }
  }
  if (options.ref && !options.help && !/^https:\/\/github\.com\//i.test(options.target)) throw new Error('--ref applies to GitHub URL input. For local mapping, check out the branch yourself.');
  if (options.ref?.startsWith('-')) throw new Error('--ref must name a branch or tag.');
  if (options.json && options.html) throw new Error('Choose --json or --html, not both.');
  if (options.init && !options.help && (options.json || options.html || options.ref || /^https?:\/\//i.test(options.target))) throw new Error('--init is local setup only. Run mapping or exports separately after setup.');
  if (!Number.isInteger(options.port) || options.port < 0 || options.port > 65535) throw new Error('--port must be an integer from 0 to 65535.');
  return options;
}

export function prepareTarget(target, log = console.log, ref = null) {
  if (ref && !/^https:\/\/github\.com\//i.test(target)) throw new Error('--ref applies to GitHub URL input. For local mapping, check out the branch yourself.');
  if (/^https?:\/\//i.test(target)) {
    if (!/^https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/?$/i.test(target)) throw new Error('Use a repository URL like https://github.com/owner/repo, or a local path.');
    const clean = target.replace(/\/$/, '').replace(/\.git$/, '');
    if (ref) {
      const check = spawnSync('git', ['check-ref-format', '--allow-onelevel', ref], { encoding: 'utf8' });
      if (ref.startsWith('-') || check.status !== 0) throw new Error('Invalid branch/tag name, or Git is unavailable.');
    }
    const dest = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-'));
    log(`Cloning ${clean}${ref ? ` at ${ref}` : ''} for read-only mapping…`);
    const result = spawnSync('git', ['clone', '--depth', '1', ...(ref ? ['--branch', ref, '--single-branch'] : []), '--', clean, dest], { stdio: ['ignore', 'ignore', 'inherit'] });
    if (result.status !== 0) {
      fs.rmSync(dest, { recursive: true, force: true });
      throw new Error(`Could not clone the repository${ref ? ` at branch/tag ${ref}` : ''}. Check its visibility and branch/tag name. For private repositories, clone it yourself and pass the local path.`);
    }
    const revision = spawnSync('git', ['-C', dest, 'rev-parse', '--verify', 'HEAD'], { encoding: 'utf8' });
    const branch = spawnSync('git', ['-C', dest, 'symbolic-ref', '--quiet', '--short', 'HEAD'], { encoding: 'utf8' });
    const source = { kind: 'github', url: clean, repoName: clean.split('/').at(-1), requestedRef: ref, ref: ref || (branch.status === 0 ? branch.stdout.trim() : null), revision: revision.status === 0 ? revision.stdout.trim() : null, snapshot: true };
    return { root: dest, source, cleanup: () => fs.rmSync(dest, { recursive: true, force: true }) };
  }
  const full = path.resolve(target);
  if (!fs.existsSync(full)) { fs.mkdirSync(full, { recursive: true }); log(`Created empty project folder: ${full}`); }
  if (!fs.statSync(full).isDirectory()) throw new Error(`Not a directory: ${full}`);
  return { root: full, cleanup: () => {} };
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(`BuildMap v0.1\n\nUsage:\n  buildmap [project-path-or-github-url] [--port 4173] [--host 127.0.0.1] [--ref branch-or-tag] [--json | --html output.html]\n  buildmap [local-project-path] --init\n\n--init asks four plain-English questions and saves an initial project description, then exits. Existing plans are never overwritten; code and evidence are untouched.\n--json prints one map snapshot, including gaps and source hashes, then exits.\n--html writes a self-contained interactive snapshot to a new file, then exits.\n--ref selects a branch or tag for GitHub URL input; omitted uses the default branch.\n\nExamples:\n  buildmap ../my-project --init\n  buildmap .\n  buildmap --port 5000 ../my-project\n  buildmap https://github.com/owner/repo\n  buildmap https://github.com/owner/repo --ref feature/map\n  buildmap . --json\n  buildmap . --html ../buildmap.html\n`);
      return;
    }
    if (options.init) {
      const { root } = await initializeProject(options.target);
      const quotedRoot = "'" + root.replaceAll("'", "'\\''") + "'";
      console.log(`Next, open the map: node src/cli.js ${quotedRoot}`);
      return;
    }
    const { root, cleanup, source } = prepareTarget(options.target, options.json ? console.error : console.log, options.ref);
    process.once('exit', cleanup);
    if (options.json) { console.log(JSON.stringify(scanProject(root, { source }), null, 2)); return; }
    if (options.html) {
      const output = path.resolve(options.html);
      fs.writeFileSync(output, snapshotHtml(scanProject(root, { source })), { flag: 'wx' });
      console.log(`Snapshot saved: ${output}`);
      return;
    }
    const server = startServer({ root, source, host: options.host, port: options.port });
    server.once('error', err => { console.error(`BuildMap could not start: ${err.message}`); process.exitCode = 1; });
    for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
  } catch (err) { console.error(`BuildMap: ${err.message}`); process.exitCode = 1; }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import crypto from 'node:crypto';
import { scanProject } from './scan.js';

// Explicit local setup is separate from read-only mapping. Describe the goal,
// never invent components, connections, evidence, or a walkthrough plan.
export async function initializeProject(target, { input = process.stdin, output = process.stdout } = {}) {
  if (/^https?:\/\//i.test(target)) throw new Error('--init needs a local project folder. Clone a remote repository locally first.');
  const root = path.resolve(target);
  const folder = path.join(root, '.buildmap');
  const destination = path.join(folder, 'project.json');
  if (fs.existsSync(root) && !fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  if (fs.existsSync(destination)) throw new Error('This project already has .buildmap/project.json. Keep its plan and edit it directly; setup will not overwrite it.');
  try {
    if (!fs.lstatSync(folder).isDirectory() || fs.lstatSync(folder).isSymbolicLink()) throw new Error('Setup needs a regular .buildmap directory inside the project.');
  } catch (err) { if (err.code !== 'ENOENT') throw err; }
  output.write('Describe what you want to build. Setup saves only your project description; existing source and evidence stay intact.\n');
  const reader = readline.createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY) });
  const lines = reader[Symbol.asyncIterator]();
  const ask = async prompt => {
    output.write(prompt);
    const next = await lines.next();
    if (next.done) throw new Error('Setup stopped before all answers were received. No project description was written.');
    return next.value.trim();
  };
  let manifest;
  try {
    const defaultName = path.basename(root) || 'My project';
    const name = await ask(`Project name [${defaultName}]: `) || defaultName;
    const mission = await ask('What should this project help someone accomplish? ');
    if (!mission) throw new Error('A goal is needed to start the description. No project description was written.');
    const experience = await ask('What should someone see or experience when it is finished? [optional] ');
    const behavior = await ask('What should the finished product do? [Enter to use your goal] ') || mission;
    manifest = { name, mission, finishedProduct: { ...(experience ? { experience } : {}), behavior }, components: [] };
  } finally { reader.close(); }
  fs.mkdirSync(folder, { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  output.write(`Saved the intended goal and finished product to ${destination}.\nNo implementation or proof was created. Map the folder to discover existing source; add planned pieces when their jobs are clear.\n`);
  return { root, manifest, path: destination };
}

// Append an owner-described journey using the existing map. Ordering is a plan,
// not discovered wiring, an observed handoff, or a receipt.
export async function createWalkthrough(target, { input = process.stdin, output = process.stdout } = {}) {
  if (/^https?:\/\//i.test(target)) throw new Error('--walkthrough needs a local project folder. Clone a remote repository locally first.');
  const root = path.resolve(target);
  const folder = path.join(root, '.buildmap');
  const destination = path.join(folder, 'project.json');
  const regular = (file, directory = false) => {
    let stat;
    try { stat = fs.lstatSync(file); } catch (err) {
      if (err.code === 'ENOENT') throw new Error('Create a project description first with --init, then add a walkthrough.');
      throw err;
    }
    if (stat.isSymbolicLink() || !(directory ? stat.isDirectory() : stat.isFile() && stat.nlink === 1))
      throw new Error('Walkthrough setup needs a regular .buildmap directory and an unlinked project.json file inside it.');
    return stat;
  };
  const folderStat = regular(folder, true), originalStat = regular(destination);
  const original = fs.readFileSync(destination, 'utf8');
  let manifest;
  try { manifest = JSON.parse(original); } catch { throw new Error('Fix the invalid project.json before adding a walkthrough. No plan was changed.'); }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('project.json must contain a project object. No plan was changed.');
  const map = scanProject(root);
  if (map.diagnostics.some(d => ['invalid-config', 'invalid-outcome'].includes(d.code)))
    throw new Error('Review the invalid project plan findings before adding a walkthrough. No plan was changed.');
  const pieces = map.nodes.filter(n => n.kind !== 'mission');
  if (!pieces.length) throw new Error('No pieces are mapped yet. Add source or declare planned pieces first; walkthrough setup does not invent them.');
  // Avoid adopting an orphan receipt merely by generating an id that matches it.
  const reserved = new Set((manifest.outcomes || []).map(o => o.id));
  const evidencePath = path.join(folder, 'evidence.json');
  let evidence;
  if (fs.existsSync(evidencePath)) {
    try { evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8')); } catch {
      throw new Error('Review the unreadable evidence.json before adding a walkthrough. No plan was changed.');
    }
    for (const id of Object.keys(evidence?.outcomes || {})) reserved.add(id);
  }
  output.write('Describe one result and the pieces that should build toward it. This saves a plan, not evidence that it works.\n');
  output.write(`Current project goal: ${map.project.intent.text}\n\nMapped pieces (numbers are only for selection):\n`);
  pieces.forEach((n, i) => output.write(`${i + 1}. ${n.name} [${n.id}] — ${n.implementation}; ${n.files.join(', ') || 'no files assigned'}\n`));
  const reader = readline.createInterface({ input, output, terminal: Boolean(input.isTTY && output.isTTY) });
  const lines = reader[Symbol.asyncIterator]();
  const ask = async prompt => {
    output.write(prompt);
    const next = await lines.next();
    if (next.done) throw new Error('Walkthrough setup stopped before all answers were received. No plan was changed.');
    return next.value.trim();
  };
  const required = async prompt => {
    for (;;) { const answer = await ask(prompt); if (answer) return answer; output.write('Please describe this in your own words.\n'); }
  };
  const choose = value => /^\d+$/.test(value) && Number(value) >= 1 && Number(value) <= pieces.length ? pieces[Number(value) - 1] : null;
  let outcome;
  try {
    const name = await required('Name this walkthrough: ');
    const goal = await required('What should someone accomplish by the end? ');
    const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'walkthrough';
    let id = baseId;
    for (let suffix = 2; reserved.has(id); suffix++) id = `${baseId}-${suffix}`;
    const steps = [];
    for (;;) {
      const selection = await ask(`Piece for step ${steps.length + 1} [number, or Enter to finish]: `);
      if (!selection) { if (steps.length) break; output.write('A walkthrough needs at least one step.\n'); continue; }
      const piece = choose(selection);
      if (!piece) { output.write('Choose a mapped piece number from the list.\n'); continue; }
      const label = await ask(`What happens in this step? [${piece.name}] `) || piece.name;
      const expected = await required('What result should this step produce? ');
      const explanation = await ask('Explain how this step helps the goal [optional]: ');
      steps.push({ id: `step-${steps.length + 1}`, nodeId: piece.id, label, expected, ...(explanation ? { explanation } : {}) });
    }
    let supports;
    for (;;) {
      const answer = await ask('Supporting pieces, such as tests [numbers separated by commas, or Enter for none]: ');
      const selections = answer ? answer.split(',').map(v => choose(v.trim())) : [];
      if (selections.every(Boolean)) { supports = [...new Set(selections.map(n => n.id))]; break; }
      output.write('Use mapped piece numbers separated by commas.\n');
    }
    outcome = { id, name, goal, steps, supports };
    output.write(`\nReview before saving: ${name}\nGoal: ${goal}\n`);
    steps.forEach((s, i) => output.write(`${i + 1}. ${s.label} [${s.nodeId}]\n   Expected: ${s.expected}\n${s.explanation ? `   Why: ${s.explanation}\n` : ''}`));
    output.write(`Supporting pieces: ${supports.join(', ') || 'none'}\n`);
    output.write('This is intended behavior. Existing evidence stays as recorded; this walkthrough starts unproved.\n');
    if ((await ask('Save this walkthrough? [yes/No] ')).toLowerCase() !== 'yes') {
      output.write('Cancelled. No plan was changed.\n'); return null;
    }
  } finally { reader.close(); }
  const currentFolder = regular(folder, true), currentFile = regular(destination);
  if (currentFolder.dev !== folderStat.dev || currentFolder.ino !== folderStat.ino ||
      currentFile.dev !== originalStat.dev || currentFile.ino !== originalStat.ino || fs.readFileSync(destination, 'utf8') !== original)
    throw new Error('The project plan changed during setup. Start again from the current plan; no plan was changed by this command.');
  // A new receipt during the interview must not be adopted by this new plan.
  if (fs.existsSync(evidencePath)) {
    let latest;
    try { latest = JSON.parse(fs.readFileSync(evidencePath, 'utf8')); } catch { throw new Error('Evidence changed or became unreadable during setup. No plan was changed.'); }
    if (Object.hasOwn(latest?.outcomes || {}, outcome.id)) throw new Error('An evidence claim now uses this walkthrough id. Start again; no plan was changed.');
  }
  const temp = path.join(folder, `.project-${process.pid}-${crypto.randomUUID()}.tmp`);
  try {
    fs.writeFileSync(temp, JSON.stringify({ ...manifest, outcomes: [...(manifest.outcomes || []), outcome] }, null, 2) + '\n', { flag: 'wx', mode: originalStat.mode & 0o777 });
    fs.renameSync(temp, destination);
  } finally { fs.rmSync(temp, { force: true }); }
  output.write(`Saved walkthrough "${outcome.name}" (${outcome.id}). Select it under Your goals in the free map or open Walkthrough · Free to review its steps.\nNo code, connections, or proof was created.\n`);
  return { root, outcome, path: destination };
}

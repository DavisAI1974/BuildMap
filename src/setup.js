import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

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

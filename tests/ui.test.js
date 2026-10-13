import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { scanProject } from '../src/scan.js';

// Executes the real client against a small DOM double. This covers rendering
// logic and interactions, not CSS layout or browser integration.
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.dataset = {}; this.style = { cssText: '' };
    this.attributes = {}; this.listeners = {}; this.clientWidth = 800; this.clientHeight = 600;
    this.classes = new Set(); this.textContent = ''; this.hidden = false; this._html = '';
    this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c),
      contains: c => this.classes.has(c),
      toggle: (c, on) => on ? this.classes.add(c) : this.classes.delete(c) };
  }
  set innerHTML(value) { this._html = value; this.children = []; }
  get innerHTML() { return this._html; }
  set className(value) { this.classes = new Set(value.split(' ')); }
  get className() { return [...this.classes].join(' '); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  appendChild(el) { this.children.push(el); }
  setAttribute(key, value) { this.attributes[key] = value; }
  scrollTo(options) { this.lastScroll = options; }
  scrollIntoView(options) { this.revealOptions = options; }
  focus(options) { this.focusOptions = options; this.document.activeElement = this; }
  click() { this.listeners.click?.(); }
}
function piece(id, overrides = {}) {
  return { id, name: id, kind: 'component', status: 'coded', baseStatus: 'coded', implementation: 'complete',
    purpose: 'Does useful work.', files: [`${id}.js`], presentFiles: [`${id}.js`], sourceHashes: {}, group: 'Core', source: 'manifest',
    evidenceAssessment: { accepted: false, reason: 'No explicit evidence record.' }, ...overrides };
}
function model(fingerprint, nodes = [piece('a'), piece('__mission__', { kind: 'mission' })]) {
  return { fingerprint, project: { name: 'Fixture', mode: 'brownfield', intent: { text: 'Build useful software', confidence: 'declared' }, progress: 20, counts: { coded: 1 } },
    states: ['planned', 'coded', 'connected', 'computing', 'verified', 'live'], nodes, edges: [], gaps: [] };
}
async function client(initial, offline = false) {
  const elements = new Map(); let current = initial; let failed = false;
  const document = { activeElement: null };
  const create = tag => { const el = new Element(tag); el.document = document; return el; };
  const get = id => { if (id === 'buildmapSnapshot') return offline ? { textContent: JSON.stringify(initial) } : null; if (!elements.has(id)) elements.set(id, create('div')); return elements.get(id); };
  let requests = 0, polls = 0;
  Object.assign(document, { getElementById: get, createElement: create, createElementNS: (_,tag) => create(tag),
    querySelectorAll: () => get('nodeLayer').children.filter(e => e.classes.has('node')) });
  const context = vm.createContext({ document,
    fetch: async () => { requests++; return { ok: !failed, status: failed ? 500 : 200, json: async () => current }; },
    ResizeObserver: class { observe() {} }, setInterval: () => { polls++; }, console: { error() {} } });
  const source = fs.readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  const api = await vm.runInContext(`(async () => { ${source}\nreturn { refresh }; })()`, context);
  return { get, context, counts: () => ({ requests, polls }), setModel: m => { current = m; }, fail: value => { failed = value; },
    refresh: () => api.refresh() };
}

test('client renders escaped claims and separate source/declared connection provenance', async () => {
  const input = model('one', [piece('a', { name: '<img onerror=evil()>', evidence: { status: 'verified', note: '<script>evil</script>' }, evidenceAssessment: { accepted: false, reason: 'Claim rejected.' } }), piece('b')]);
  input.edges = [{ from: 'a', to: 'b', type: 'code', observations: [{ importer: 'b.js', imported: 'a.js' }] }, { from: 'a', to: 'b', type: 'planned', observed: true }];
  input.gaps = [{ nodeId: 'a', priority: 'blocker', kind: 'unsupported-evidence', message: 'Claim rejected.' }];
  const ui = await client(input);
  const card = ui.get('nodeLayer').children.find(e => e.dataset.id === 'a');
  assert.match(card.innerHTML, /&lt;img/); assert.ok(card.classes.has('has-gap'));
  ui.get('gaps').children[0].click();
  assert.match(ui.get('detail').innerHTML, /Recorded claim: verified · rejected/);
  assert.match(ui.get('detail').innerHTML, /&lt;script&gt;/);
  assert.match(ui.get('detail').innerHTML, /b.js references a.js/);
  assert.match(ui.get('detail').innerHTML, /Declared · also observed/);
  assert.equal(ui.get('edgeLayer').children.length, 1);
});

test('refresh preserves selection, reports failures, recovers, and clears a removed piece', async () => {
  const ui = await client(model('one'));
  ui.get('nodeLayer').children.find(e => e.dataset.id === 'a').click();
  ui.setModel(model('two', [piece('a', { purpose: 'Updated behavior.' })])); await ui.refresh();
  assert.match(ui.get('detail').innerHTML, /Updated behavior/);
  assert.ok(ui.get('nodeLayer').children.find(e => e.dataset.id === 'a').classes.has('selected'));
  ui.fail(true); await ui.refresh(); assert.match(ui.get('refreshStatus').textContent, /showing last snapshot/);
  ui.fail(false); await ui.refresh(); assert.equal(ui.get('refreshStatus').textContent, 'Updated just now');
  ui.setModel(model('three', [])); await ui.refresh(); assert.match(ui.get('detail').innerHTML, /Piece removed/);
});

test('fit actually scales the map and search can find evidence states', async () => {
  const ui = await client(model('one', [piece('a', { status: 'verified' }), piece('b')]));
  ui.get('fitButton').click(); assert.notEqual(ui.get('mapCanvas').style.transform, 'scale(1)');
  ui.get('sizeButton').click(); assert.equal(ui.get('mapCanvas').style.transform, 'scale(1)');
  ui.get('search').listeners.input({ target: { value: 'verified' } });
  assert.equal(ui.get('nodeLayer').children.find(e => e.dataset.id === 'a').classes.has('filtered'), false);
  assert.equal(ui.get('nodeLayer').children.find(e => e.dataset.id === 'b').classes.has('filtered'), true);
});

test('offline snapshot renders the same client without HTTP requests or polling', async () => {
  const input = model('captured'); input.generatedAt = '2026-10-13T10:00:00Z';
  const ui = await client(input, true);
  assert.deepEqual(ui.counts(), { requests: 0, polls: 0 });
  assert.match(ui.get('refreshStatus').textContent, /^Snapshot · /);
  assert.match(ui.get('mode').textContent, /snapshot/);
  assert.ok(ui.get('nodeLayer').children.find(e => e.dataset.id === 'a'));
});

test('inspector labels architecture drift and shows file claims without granting component proof', async () => {
  const input = model('drift', [piece('a'), piece('b', { fileEvidence: [{ file: 'b.js', evidence: { status: 'verified', note: 'Only one file was checked.' }, assessment: { accepted: true, reason: 'Freshness unknown.' } }] })]);
  input.edges = [{ from: 'a', to: 'b', type: 'code', planStatus: 'undeclared', observations: [{ importer: 'b.js', imported: 'a.js' }] }];
  input.gaps = [{ kind: 'unexpected-dependency', nodeId: 'b', priority: 'warning', message: 'Outside declared plan.' }];
  const ui = await client(input); ui.get('gaps').children[0].click();
  assert.match(ui.get('detail').innerHTML, /Observed · outside declared plan/);
  assert.match(ui.get('detail').innerHTML, /File-only claim: b.js/);
  assert.match(ui.get('detail').innerHTML, /does not grant the component a higher state/);
  assert.match(ui.get('detail').innerHTML, /File claim: verified · accepted/);
});

test('project evidence findings open the mission inspector with safely escaped raw claims', async () => {
  const input = model('orphan');
  input.gaps = [{ kind: 'unmapped-evidence', nodeId: null, priority: 'blocker', message: 'Unknown evidence target.', evidence: { status: 'live', note: '<img src=x onerror=evil()>' } }];
  const ui = await client(input); ui.get('gaps').children[0].click();
  assert.match(ui.get('detail').innerHTML, /Unknown evidence target/);
  assert.match(ui.get('detail').innerHTML, /&lt;img src=x/);
  assert.doesNotMatch(ui.get('detail').innerHTML, /<img src=x/);
});

test('GitHub provenance shows ref/revision and makes clone snapshot behavior explicit', async () => {
  const input = model('github'); input.project.source = { kind: 'github', url: 'https://github.com/owner/repo', ref: 'feature/map', revision: 'a'.repeat(40), snapshot: true };
  const ui = await client(input);
  assert.match(ui.get('projectSource').textContent, /GitHub snapshot/);
  assert.match(ui.get('projectSource').textContent, /feature\/map/);
  assert.match(ui.get('projectSource').textContent, /aaaaaaaaaaaa/);
});

test('search removes filtered cards from keyboard navigation and gap selection reveals its piece', async () => {
  const input = model('search', [piece('a'), piece('b', { conflictingFiles: ['b.js'] })]);
  input.gaps = [{ nodeId: 'b', kind: 'overlapping-file', priority: 'blocker', message: 'Ownership conflict.' }];
  const ui = await client(input);
  ui.get('search').listeners.input({ target: { value: 'a.js' } });
  const card = id => ui.get('nodeLayer').children.find(e => e.dataset.id === id);
  assert.equal(card('b').tabIndex, -1); assert.equal(card('b').attributes['aria-hidden'], 'true');
  ui.get('gaps').children[0].click();
  assert.equal(card('b').classes.has('filtered'), false);
  assert.equal(card('b').tabIndex, 0); assert.equal(card('b').attributes['aria-hidden'], 'false');
  assert.match(ui.get('detail').innerHTML, /b.js · ownership conflict/);
  card('a').click(); assert.equal(card('b').tabIndex, -1);
});

test('receipt inspector shows recorded/current inputs and safely labels their limited scope', async () => {
  const file = '<img src=x onerror=evil()>.json';
  const receipt = { status: 'verified', note: 'Check recorded.', inputHashes: { [file]: '0'.repeat(64) } };
  const assessment = { accepted: false, binding: 'stale', reason: 'Input changed.', inputs: {
    binding: 'stale', currentHashes: { [file]: 'a'.repeat(64), 'gone.json': null }, issues: [{ file, reason: '<script>changed</script>' }] } };
  const input = model('inputs', [piece('a', { evidence: receipt, evidenceAssessment: assessment,
    fileEvidence: [{ file: 'a.js', evidence: receipt, assessment }] })]);
  const ui = await client(input); ui.get('nodeLayer').children.find(e => e.dataset.id === 'a').click();
  const detail = ui.get('detail').innerHTML;
  assert.match(detail, /Selected input bindings · stale/);
  assert.match(detail, /Only explicitly listed inputs are covered/);
  assert.match(detail, /Recorded input hashes/); assert.match(detail, /Current input hashes/);
  assert.match(detail, /000000000000/); assert.match(detail, /aaaaaaaaaaaa/);
  assert.match(detail, /gone.json/); assert.match(detail, /Unavailable/);
  assert.match(detail, /&lt;img/); assert.match(detail, /&lt;script&gt;/);
  assert.doesNotMatch(detail, /<img|<script>/);
  assert.match(detail, /File claim: verified · rejected/);
});

test('inspector labels HTTP path matching as source evidence and escapes endpoint/location metadata', async () => {
  const input = model('http', [piece('server'), piece('client')]);
  input.edges = [{ from:'server', to:'client', type:'code', planStatus:'matched', observations:[{
    kind:'http-source', importer:'client.js', imported:'server.js', method:'GET', endpoint:'/<img onerror=evil()>',
    importerLocation:{line:12,column:4}, providerLocation:{line:8,column:'<script>evil</script>'}, providerMethod:null
  }] }];
  const ui = await client(input); ui.get('nodeLayer').children.find(e => e.dataset.id === 'client').click();
  const detail = ui.get('detail').innerHTML;
  assert.match(detail, /Observed HTTP path match · heuristic/); assert.match(detail, /client.js:12:4 requests GET/);
  assert.match(detail, /method unresolved/); assert.match(detail, /runtime origin\/execution unproved/);
  assert.match(detail, /&lt;img/); assert.match(detail, /&lt;script&gt;/); assert.doesNotMatch(detail, /<img|<script>/);
});

test('cards preview file inventory safely and inspector lists the full declared scope', async () => {
  const files = ['src/first.js', 'src/<img onerror=evil()>.js', 'src/third.js', 'src/planned.js'];
  const ui = await client(model('files', [piece('a', { status: 'planned', files, presentFiles: [files[0], files[2]] }),
    piece('empty', { files: [], presentFiles: [] }), piece('__mission__', { kind: 'mission', files: [], presentFiles: [] })]));
  const card = id => ui.get('nodeLayer').children.find(e => e.dataset.id === id);
  assert.match(card('a').innerHTML, /4 files · 2 present · 2 missing/);
  assert.match(card('a').innerHTML, /&lt;img onerror=evil\(\)&gt;.js · missing/);
  assert.doesNotMatch(card('a').innerHTML, /<img/);
  assert.match(card('a').innerHTML, /\+2 more · select to see all/);
  assert.match(card('a').attributes['aria-label'], /2 missing/);
  assert.doesNotMatch(card('__mission__').innerHTML, /node-files/);
  card('a').click();
  for (const file of ['src/first.js', 'src/third.js', 'src/planned.js · missing']) assert.ok(ui.get('detail').innerHTML.includes(file));
  card('empty').click();
  assert.match(ui.get('detail').innerHTML, /No implementation files assigned yet/);
  assert.doesNotMatch(ui.get('detail').innerHTML, /this is the mission/);
});

test('live scanned files appear separately, move into declared components, and remain visible when missing', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-ui-files-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.buildmap'));
  fs.mkdirSync(path.join(root, 'src'));
  const manifest = { mission: 'Track the build.', components: [{ id: 'engine', files: ['src/engine.js', 'src/planned.js'] }] };
  const saveManifest = () => fs.writeFileSync(path.join(root, '.buildmap/project.json'), JSON.stringify(manifest));
  saveManifest();
  const ui = await client(scanProject(root));
  const card = id => ui.get('nodeLayer').children.find(e => e.dataset.id === id);
  assert.match(card('engine').innerHTML, /2 files · 0 present · 2 missing/);
  fs.writeFileSync(path.join(root, 'src/engine.js'), 'export const engine = true;');
  fs.writeFileSync(path.join(root, 'src/helper.js'), 'export const helper = true;');
  ui.setModel(scanProject(root)); await ui.refresh();
  assert.match(card('engine').innerHTML, /2 files · 1 present · 1 missing/);
  card('file:src/helper.js').click();
  assert.match(ui.get('detail').innerHTML, /Discovered source file/);
  manifest.components[0].files.push('src/helper.js'); saveManifest();
  ui.setModel(scanProject(root)); await ui.refresh();
  assert.equal(card('file:src/helper.js'), undefined);
  card('engine').click();
  assert.match(ui.get('detail').innerHTML, /src\/helper.js/);
  fs.unlinkSync(path.join(root, 'src/engine.js'));
  ui.setModel(scanProject(root)); await ui.refresh();
  assert.match(card('engine').innerHTML, /3 files · 1 present · 2 missing/);
  assert.match(ui.get('detail').innerHTML, /src\/engine.js · missing/);
  assert.ok(card('engine').classes.has('planned'));
});

test('search locates a piece by any assigned file, safely renders results, and supports Enter/Escape', async () => {
  const file = 'src/<img onerror=evil()>.js';
  const ui = await client(model('search-files', [piece('engine', { name: '<script>Engine</script>',
    files: ['src/first.js', 'src/second.js', file], presentFiles: ['src/first.js', 'src/second.js', file] }), piece('other')]));
  const input = value => ui.get('search').listeners.input({ target: { value } });
  const key = key => { let prevented = false; ui.get('search').listeners.keydown({ key, preventDefault: () => { prevented = true; } }); return prevented; };
  assert.equal(ui.get('searchPanel').hidden, true);
  input('<img');
  assert.match(ui.get('searchStatus').textContent, /^1 match/);
  const result = ui.get('searchResults').children[0];
  assert.equal(result.children[0].textContent, '<script>Engine</script>');
  assert.equal(result.children[1].textContent, `coded · ${file}`);
  assert.equal(key('Enter'), true);
  const card = ui.get('nodeLayer').children.find(e => e.dataset.id === 'engine');
  assert.equal(card.attributes['aria-pressed'], 'true');
  assert.equal(ui.context.document.activeElement, card);
  assert.equal(card.focusOptions.preventScroll, true);
  assert.equal(card.revealOptions.block, 'nearest');
  assert.match(ui.get('detail').innerHTML, /&lt;img/);
  input('no-such-piece');
  assert.match(ui.get('searchStatus').textContent, /No matching pieces/);
  assert.equal(ui.get('searchResults').children.length, 0);
  assert.equal(key('Enter'), false);
  assert.equal(key('Escape'), true);
  assert.equal(ui.get('search').value, '');
  assert.equal(ui.get('searchPanel').hidden, true);
  assert.ok(ui.get('nodeLayer').children.filter(e => e.dataset.id).every(e => e.tabIndex === 0));
});

test('search results disclose all matches, follow edits, and behave the same offline', async () => {
  const nodes = Array.from({ length: 25 }, (_, i) => piece(`p${i}`, { files: [`src/p${i}.js`], presentFiles: [`src/p${i}.js`] }));
  for (const offline of [false, true]) {
    const ui = await client(model('many', nodes), offline);
    ui.get('search').listeners.input({ target: { value: 'src/' } });
    assert.match(ui.get('searchStatus').textContent, /^25 matches/);
    assert.equal(ui.get('searchResults').children.length, 12);
    assert.equal(ui.get('moreResults').hidden, false);
    ui.get('moreResults').click();
    assert.equal(ui.get('searchResults').children.length, 25);
    ui.get('searchResults').children[24].click();
    assert.match(ui.get('detail').innerHTML, /src\/p24.js/);
    assert.ok(ui.get('mapViewport').lastScroll.top > 1000);
    ui.get('fitButton').click();
    ui.get('searchResults').children[24].click();
    assert.equal(ui.get('mapViewport').lastScroll.top, 0); // Fit geometry is scaled.
    ui.get('sizeButton').click();
    if (!offline) {
      ui.setModel(model('edited', nodes.slice(0, 24))); await ui.refresh();
      assert.match(ui.get('searchStatus').textContent, /^24 matches/);
      assert.equal(ui.get('searchResults').children.length, 24);
      assert.match(ui.get('detail').innerHTML, /Piece removed/);
      assert.equal(ui.context.document.activeElement, ui.get('search'));
    } else assert.deepEqual(ui.counts(), { requests: 0, polls: 0 });
  }
});

test('gap navigation reaches a distant card and refresh retains keyboard focus without stealing it', async () => {
  const nodes = Array.from({ length: 30 }, (_, i) => piece(`p${String(i).padStart(2, '0')}`));
  const initial = model('navigation', nodes);
  initial.gaps = [{ nodeId: 'p29', priority: 'warning', kind: 'unproved', message: 'Record useful behavior.' }];
  const ui = await client(initial);
  ui.get('gaps').children[0].click();
  assert.ok(ui.get('mapViewport').lastScroll.top > 6000);
  let card = ui.get('nodeLayer').children.find(e => e.dataset.id === 'p29');
  assert.equal(ui.context.document.activeElement, card);
  ui.setModel(model('next', nodes)); await ui.refresh();
  card = ui.get('nodeLayer').children.find(e => e.dataset.id === 'p29');
  assert.equal(ui.context.document.activeElement, card);
  ui.get('search').focus();
  ui.get('search').listeners.input({ target: { value: 'p00' } });
  ui.setModel(model('third', nodes)); await ui.refresh();
  assert.equal(ui.context.document.activeElement, ui.get('search'));
  ui.get('searchResults').children[0].focus();
  ui.setModel(model('fourth', nodes)); await ui.refresh();
  assert.equal(ui.context.document.activeElement, ui.get('searchResults').children[0]);
  ui.setModel(model('fifth', nodes.slice(1))); await ui.refresh();
  assert.equal(ui.context.document.activeElement, ui.get('search'));
  assert.match(ui.get('searchStatus').textContent, /No matching pieces/);
});

test('scanned outcome walkthroughs show real sample data, navigate pieces, and stale when the goal changes', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'buildmap-ui-outcome-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, '.buildmap'));
  fs.writeFileSync(path.join(root, 'main.js'), 'export const main = 1;');
  fs.writeFileSync(path.join(root, 'extra.js'), 'export const extra = 1;');
  const plan = { outcomes: [{ id: 'demo', name: '<img onerror=evil()>', goal: 'Display a value.', steps: [
    { id: 'display', nodeId: 'file:main.js', label: 'Display', expected: 'An escaped value.' }
  ] }] };
  const save = () => fs.writeFileSync(path.join(root, '.buildmap/project.json'), JSON.stringify(plan));
  save(); const initial = scanProject(root); const outcome = initial.outcomes[0];
  const proof = { status: 'computing', note: 'Recorded a sample.', sourceHashes: outcome.sourceHashes, definitionHash: outcome.definitionHash,
    example: { name: 'Unsafe text displayed safely', input: 0, output: '<script>example</script>', steps: [
      { stepId: 'display', result: 'observed', input: 0, output: '<script>example</script>' }
    ] } };
  fs.writeFileSync(path.join(root, '.buildmap/evidence.json'), JSON.stringify({ outcomes: { demo: proof } }));
  const ui = await client(scanProject(root));
  assert.match(ui.get('outcomes').children[0].innerHTML, /&lt;img/);
  ui.get('search').listeners.input({ target: { value: 'extra.js' } });
  ui.get('outcomes').children[0].click();
  assert.match(ui.get('detail').innerHTML, /OUTCOME WALKTHROUGH/);
  assert.match(ui.get('detail').innerHTML, /Observed example/);
  const steps = ui.get('detail').children[0];
  assert.match(steps.children[0].innerHTML, /&lt;script&gt;example/);
  assert.doesNotMatch(steps.children[0].innerHTML, /<script>/);
  const card = id => ui.get('nodeLayer').children.find(n => n.dataset.id === id);
  assert.ok(card('file:main.js').classes.has('in-outcome'));
  assert.equal(card('file:main.js').tabIndex, 0); // The active outcome remains visible through search.
  assert.ok(card('file:extra.js').classes.has('outside-outcome'));
  steps.children[0].children[0].click();
  assert.match(ui.get('detail').innerHTML, /PIECE INSPECTOR/);
  ui.get('detail').children.at(-1).click();
  assert.match(ui.get('detail').innerHTML, /OUTCOME WALKTHROUGH/);
  plan.outcomes[0].goal = 'A changed goal.'; save(); ui.setModel(scanProject(root)); await ui.refresh();
  assert.match(ui.get('detail').innerHTML, /A changed goal/);
  assert.match(ui.get('detail').children[0].children[0].innerHTML, /Example out of date/);
  assert.equal(ui.context.document.activeElement, ui.get('outcomes').children[0]);
  plan.outcomes = []; save(); ui.setModel(scanProject(root)); await ui.refresh();
  assert.match(ui.get('detail').innerHTML, /Outcome removed/);
  assert.equal(ui.context.document.activeElement, ui.get('search'));
});

test('outcome gaps open the walkthrough and shared offline navigation makes no requests', async () => {
  const input = model('outcome', [piece('a'), piece('b')]);
  input.outcomes = [{ id: 'goal', name: 'Useful result', goal: 'Produce a useful result.', status: 'unproved', nodeIds: ['a'], supports: [],
    steps: [{ id: 'first', nodeId: 'a', label: 'Do work', expected: 'Useful output.', pieceName: 'a', pieceStatus: 'coded', state: 'unobserved', observation: null }],
    firstGap: { label: 'Do work', state: 'unobserved' }, evidence: null, evidenceAssessment: { accepted: false, reason: 'No recorded example.' }, sourceHashes: {}, definitionHash: 'a'.repeat(64) }];
  input.gaps = [{ kind: 'unproved-outcome', outcomeId: 'goal', nodeId: null, priority: 'info', message: 'Record an example.' }];
  for (const offline of [false, true]) {
    const ui = await client(input, offline); ui.get('gaps').children[0].click();
    assert.match(ui.get('detail').innerHTML, /OUTCOME WALKTHROUGH/);
    assert.match(ui.get('detail').innerHTML, /Do work · No observation recorded/);
    assert.equal(ui.get('clearOutcome').hidden, false);
    ui.get('clearOutcome').click();
    assert.equal(ui.get('clearOutcome').hidden, true);
    assert.ok(ui.get('nodeLayer').children.filter(n => n.dataset.id).every(n => !n.classes.has('outside-outcome')));
    if (offline) assert.deepEqual(ui.counts(), { requests: 0, polls: 0 });
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Executes the real client against a small DOM double. This covers rendering
// logic and interactions, not CSS layout or browser integration.
class Element {
  constructor(tag = 'div') {
    this.tag = tag; this.children = []; this.dataset = {}; this.style = { cssText: '' };
    this.attributes = {}; this.listeners = {}; this.clientWidth = 800; this.clientHeight = 600;
    this.classes = new Set(); this.textContent = ''; this.hidden = false; this._html = '';
    this.classList = { add: c => this.classes.add(c), remove: c => this.classes.delete(c),
      toggle: (c, on) => on ? this.classes.add(c) : this.classes.delete(c) };
  }
  set innerHTML(value) { this._html = value; this.children = []; }
  get innerHTML() { return this._html; }
  set className(value) { this.classes = new Set(value.split(' ')); }
  get className() { return [...this.classes].join(' '); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  appendChild(el) { this.children.push(el); }
  setAttribute(key, value) { this.attributes[key] = value; }
  scrollTo() {}
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
  const get = id => { if (id === 'buildmapSnapshot') return offline ? { textContent: JSON.stringify(initial) } : null; if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
  let requests = 0, polls = 0;
  const context = vm.createContext({ document: { getElementById: get, createElement: tag => new Element(tag), createElementNS: (_,tag) => new Element(tag),
    querySelectorAll: () => get('nodeLayer').children.filter(e => e.classes.has('node')) },
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

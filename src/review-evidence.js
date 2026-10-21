import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const identityKeys = ['sourceIdentity', 'calculationIdentity', 'schemaIdentity', 'axisIdentity', 'availabilityIdentity'];
const runtimeKeys = ['sourceIdentity', 'calculationIdentity', 'workloadIdentity', 'environmentIdentity', 'metricScopeIdentity'];
const counters = ['originalJobs', 'eligibleJobs', 'completedJobs', 'remainingJobs', 'pairComparisons', 'reads', 'bytesRead', 'cacheHits', 'cacheMisses'];
const metrics = ['elapsedSeconds', 'cpuUtilizationPercent', 'peakMemoryBytes', 'ioWaitSeconds'];
const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
const text = x => typeof x === 'string' && x.trim().length > 0;
const canonical = x => JSON.stringify(Array.isArray(x) ? x.map(v => JSON.parse(canonical(v))) : object(x)
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, JSON.parse(canonical(x[k]))])) : x);
const list = (x, max = 256) => { if (!Array.isArray(x) || x.length > max) throw Error(`Expected an array with at most ${max} entries.`); return x; };
const count = x => {
  if (typeof x === 'number' && Number.isSafeInteger(x) && x >= 0) return String(x);
  if (typeof x === 'string' && /^(0|[1-9][0-9]{0,99})$/.test(x)) return x;
  throw Error('Counters must be nonnegative safe integers or decimal strings (up to 100 digits).');
};
function interval(x) {
  if (!object(x) || !Number.isSafeInteger(x.start) || !Number.isSafeInteger(x.end) || x.start < 0 || x.end <= x.start) throw Error('Rows require nonnegative safe-integer half-open [start,end) bounds.');
  return { start: x.start, end: x.end };
}
function union(xs) {
  const out = [];
  for (const x of xs.slice().sort((a,b) => a.start - b.start || a.end - b.end)) {
    const last = out.at(-1);
    if (last && x.start <= last.end) last.end = Math.max(last.end, x.end);
    else out.push({ ...x });
  }
  return out;
}
function subtract(required, available) {
  const out = [];
  for (const r of required) {
    let start = r.start;
    for (const a of available) {
      if (a.end <= start) continue;
      if (a.start >= r.end) break;
      if (a.start > start) out.push({ start, end: Math.min(a.start, r.end) });
      start = Math.max(start, a.end);
      if (start >= r.end) break;
    }
    if (start < r.end) out.push({ start, end: r.end });
  }
  return out;
}
function columns(x) {
  const xs = list(x);
  if (!xs.length || xs.some(v => !text(v)) || new Set(xs).size !== xs.length) throw Error('Columns require unique nonempty names.');
  return xs;
}
function contract(x) {
  if (!object(x) || identityKeys.some(k => !text(x[k])) || !object(x.semantics) || !['independent','rolling','stateful'].includes(x.semantics.kind)) throw Error('A full source/calculation/schema/axis/availability identity and semantics contract is required.');
  if (x.semantics.kind === 'rolling' && (!Number.isSafeInteger(x.semantics.lookbackRows) || x.semantics.lookbackRows < 0 || !Number.isSafeInteger(x.semantics.originRow) || x.semantics.originRow < 0)) throw Error('Rolling semantics require nonnegative safe-integer lookbackRows and originRow.');
  return x;
}

// All reads remain inside the mapped repository. Receipt bindings are deliberately
// small; this feature must never hash a multi-terabyte scientific product.
function boundedFile(root, rel, limit) {
  if (!text(rel) || rel.includes('\\') || rel.includes('\0') || path.posix.isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || path.posix.normalize(rel) !== rel || rel === '..' || rel.startsWith('../')) throw Error('Use an exact project-relative file path.');
  const base = fs.realpathSync(root), full = fs.realpathSync(path.join(base, rel));
  const relative = path.relative(base, full);
  if (!relative || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) throw Error('File is outside the project.');
  const fd = fs.openSync(full, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > limit) throw Error(`Expected a regular file no larger than ${limit} bytes.`);
    const buffer = Buffer.alloc(limit + 1);
    let size = 0, read;
    do { read = fs.readSync(fd, buffer, size, buffer.length - size, null); size += read; } while (read && size < buffer.length);
    if (size > limit) throw Error('File grew beyond the read limit.');
    return buffer.subarray(0, size);
  } finally { fs.closeSync(fd); }
}

export function readAnalysis(root, calculations) {
  let bytes;
  try { bytes = boundedFile(root, '.buildmap/analysis.json', 1_000_000); }
  catch (error) {
    if (error.code === 'ENOENT') return evaluateAnalysis(null, calculations);
    return { ...evaluateAnalysis(null, calculations), status: 'invalid', diagnostics: [{ section: 'document', message: error.message }] };
  }
  const bindings = new Map(); let bindingBytes = 0;
  const checkBinding = (rel, expected) => {
    if (!/^[a-f0-9]{64}$/.test(expected)) return { current: false, reason: 'Expected a lowercase SHA-256.' };
    if (!bindings.has(rel)) {
      try {
        if (bindings.size >= 256 || bindingBytes > 4_000_000) throw Error('Receipt binding budget exceeded (256 files / 4 MB).');
        const value = boundedFile(root, rel, 1_000_000);
        bindingBytes += value.length;
        if (bindingBytes > 4_000_000) throw Error('Receipt binding budget exceeded (256 files / 4 MB).');
        bindings.set(rel, { hash: crypto.createHash('sha256').update(value).digest('hex') });
      } catch (e) { bindings.set(rel, { reason: e.message }); }
    }
    const observed = bindings.get(rel);
    return { current: observed.hash === expected, reason: observed.reason || (observed.hash === expected ? 'Current matching receipt bytes.' : 'Receipt hash differs.') };
  };
  try {
    return { ...evaluateAnalysis(JSON.parse(bytes.toString('utf8')), calculations, checkBinding), sourceHash: crypto.createHash('sha256').update(bytes).digest('hex') };
  } catch (e) { return { ...evaluateAnalysis(null, calculations), status: 'invalid', diagnostics: [{ section: 'document', message: e.message }] }; }
}

export function evaluateAnalysis(document, calculations = [], checkBinding = () => ({ current: false, reason: 'No local binding reader.' })) {
  const result = { version: 1, status: document === null ? 'not-supplied' : 'supplied', basis: 'user-supplied-contracts-and-observations',
    products: [], stages: [], observations: [], comparisons: [], diagnostics: [],
    limitations: ['Contracts and observations are supplied metadata, not authenticated execution evidence. Matching receipt bytes establish freshness of those bytes only.',
      'Coverage plans are conditional on exact supplied identities and half-open row coordinates. No product is read, changed, activated or certified safe to resume.',
      'Unknown counters stay unknown. Static iteration models, jobs and directional pair comparisons are separate quantities.'] };
  if (document === null) return result;
  if (!object(document) || document.version !== 1) throw Error('Analysis requires an object with version: 1.');
  const ids = new Map(); let work = 0;
  function entries(section, build) {
    for (const entry of list(document[section] ?? [], 100)) {
      const id = object(entry) && text(entry.id) ? entry.id : null;
      const key = `${section}:${id}`;
      if (!id || ids.has(key)) {
        // Duplicate IDs make references ambiguous; remove the earlier record too.
        if (id) { const collection = section === 'runtime' ? result.observations : result[section]; const i = collection.findIndex(x => x.id === id); if (i >= 0) collection.splice(i, 1); }
        result.diagnostics.push({ section, id, message: 'Missing or duplicate ID; ambiguous records excluded.' }); ids.set(key, false); continue;
      }
      ids.set(key, true);
      try { const value = build(entry); (section === 'runtime' ? result.observations : result[section]).push(value); }
      catch (error) { result.diagnostics.push({ section, id, message: error.message }); }
    }
  }
  function bindingStatus(bindings) {
    if (bindings === undefined) return { status: 'unbound', files: [] };
    if (!object(bindings) || !Object.keys(bindings).length || Object.keys(bindings).length > 64) throw Error('Bindings require 1–64 project-relative receipt paths and SHA-256 values.');
    const files = Object.entries(bindings).map(([file, expected]) => ({ path: file, ...checkBinding(file, expected) }));
    return { status: files.every(f => f.current) ? 'current' : 'stale-or-unavailable', files };
  }
  entries('products', p => {
    if (!object(p.required)) throw Error('Product requires a required contract, row ranges and columns.');
    const requiredContract = contract(p.required.contract), requiredRows = union(list(p.required.rows).map(interval));
    if (!requiredRows.length) throw Error('At least one required row interval is necessary.');
    const requiredColumns = columns(p.required.columns), supplied = list(p.available), compatible = [], excluded = [];
    for (const [i, a] of supplied.entries()) {
      try {
        if (!object(a)) throw Error('Available product must be an object.');
        const c = contract(a.contract), freshness = bindingStatus(a.bindings);
        const regions = list(a.regions).map(r => ({ rows: interval(r.rows), columns: columns(r.columns) }));
        if (!regions.length) throw Error('Available product requires coverage regions.');
        if (canonical(c) !== canonical(requiredContract)) throw Error('Contract mismatch; no overlap credited.');
        if (freshness.status === 'stale-or-unavailable') throw Error('Receipt binding stale or unavailable; no overlap credited.');
        compatible.push({ id: text(a.id) ? a.id : String(i), regions, freshness });
      } catch (e) { excluded.push({ id: a?.id ?? String(i), reason: e.message }); }
    }
    const missing = [], reusable = []; let requiredCells = 0n, missingCells = 0n;
    for (const column of requiredColumns) {
      const candidates = compatible.flatMap(a => a.regions);
      work += candidates.length + requiredRows.length;
      if (work > 100_000) throw Error('Coverage planning exceeds the 100,000 region/column budget.');
      const available = union(candidates.filter(r => r.columns.includes(column)).map(r => r.rows));
      const gaps = subtract(requiredRows, available), retained = subtract(requiredRows, gaps);
      for (const rows of gaps) { missing.push({ column, rows }); missingCells += BigInt(rows.end) - BigInt(rows.start); }
      for (const rows of retained) reusable.push({ column, rows });
      requiredCells += requiredRows.reduce((n, r) => n + BigInt(r.end) - BigInt(r.start), 0n);
    }
    const semantics = requiredContract.semantics;
    if (semantics.kind === 'rolling' && requiredRows.some(r => r.start < semantics.originRow)) throw Error('Required rows precede the declared rolling origin.');
    const extension = missing.map(m => ({ ...m, inputRows: semantics.kind === 'stateful' ? null
      : { start: semantics.kind === 'rolling' ? Math.max(semantics.originRow, m.rows.start - semantics.lookbackRows) : m.rows.start, end: m.rows.end } }));
    return { id: p.id, path: text(p.path) ? p.path : null, contract: requiredContract, verified: false,
      status: missingCells === 0n ? 'complete-under-supplied-contracts' : requiredCells === missingCells
        ? (excluded.length && !compatible.length ? 'incompatible-or-unavailable' : 'absent') : 'partial-under-supplied-contracts',
      requiredCells: String(requiredCells), reusableCells: String(requiredCells - missingCells), missingCells: String(missingCells),
      compatibleSources: compatible.map(({ id, freshness }) => ({ id, freshness })), excludedSources: excluded, reusable, missing, extension,
      extensionStatus: !missing.length ? 'no-extension-planned' : semantics.kind === 'stateful' ? 'blocked-needs-domain-boundary-state' : 'conditional-plan-needs-output-verification',
      verification: ['Verify identities, row coordinate/order, column meaning and actual product completeness.', 'Compare full recomputation with the extended output, including missing values, rolling overlap and boundary rows. No zero-fill or AB/BA symmetry is assumed.'] };
  });
  entries('stages', s => {
    const dependsOn = list(s.dependsOn ?? [], 100);
    if (dependsOn.some(d => !text(d)) || new Set(dependsOn).size !== dependsOn.length) throw Error('Stage dependencies require unique nonempty IDs.');
    const productRefs = key => { const xs = list(s[key] ?? [], 100); if (xs.some(x => !text(x))) throw Error('Stage products require nonempty IDs.'); return xs; };
    const candidates = object(s.calculation) ? calculations.filter(c => c.source.path === s.calculation.path && c.name === s.calculation.name) : [];
    return { id: s.id, name: text(s.name) ? s.name : s.id, dependsOn, inputs: productRefs('inputs'), outputs: productRefs('outputs'), checkpointProducts: productRefs('checkpointProducts'),
      calculationId: candidates.length === 1 ? candidates[0].id : null, execution: 'unobserved', basis: 'declared-stage-contract' };
  });
  const stages = new Map(result.stages.map(s => [s.id, s])), productIds = new Set(result.products.map(p => p.id));
  for (const s of result.stages) {
    for (const dep of s.dependsOn) if (!stages.has(dep)) result.diagnostics.push({ section: 'stages', id: s.id, message: `Declared dependency ${dep} has no unambiguous stage.` });
    for (const id of [...s.inputs, ...s.outputs, ...s.checkpointProducts]) if (!productIds.has(id)) result.diagnostics.push({ section: 'stages', id: s.id, message: `Product ${id} has no accepted coverage contract.` });
    const reachesSelf = (id, visited = new Set()) => {
      if (visited.has(id)) return false;
      visited.add(id);
      return (stages.get(id)?.dependsOn || []).some(dep => dep === s.id || reachesSelf(dep, visited));
    };
    if (reachesSelf(s.id)) result.diagnostics.push({ section: 'stages', id: s.id, message: 'Cycle in declared dependency graph; this does not prove a runtime deadlock.' });
    const predecessors = new Set();
    const visit = id => { for (const dep of stages.get(id)?.dependsOn || []) if (!predecessors.has(dep)) { predecessors.add(dep); visit(dep); } };
    visit(s.id);
    for (const id of s.inputs) {
      const producers = result.stages.filter(other => other.id !== s.id && other.outputs.includes(id));
      if (producers.length && !producers.some(other => predecessors.has(other.id))) result.diagnostics.push({ section: 'stages', id: s.id,
        message: `Input ${id} has declared producers outside this stage's predecessor set; review intended ordering. This is not observed missing runtime wiring.` });
    }
    for (const id of s.outputs) if (result.stages.some(other => other.id !== s.id && other.outputs.includes(id))) result.diagnostics.push({ section: 'stages', id: s.id, message: `Multiple declared producers of ${id}; review ownership and write sequencing.` });
  }
  entries('runtime', r => {
    if (!object(r.identity) || runtimeKeys.some(k => !text(r.identity[k]))) throw Error('Runtime observations require source/calculation/workload/environment/metric-scope identities.');
    if (r.counters !== undefined && !object(r.counters) || r.metrics !== undefined && !object(r.metrics)) throw Error('Counters and metrics must be objects.');
    if (r.accounting !== undefined && r.accounting !== 'eligible=completed+remaining') throw Error('Unsupported accounting declaration.');
    const parsedCounters = Object.fromEntries(counters.map(k => [k, r.counters?.[k] == null ? null : count(r.counters[k])]));
    const parsedMetrics = Object.fromEntries(metrics.map(k => {
      const v = r.metrics?.[k];
      if (v == null) return [k, null];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || (k === 'cpuUtilizationPercent' && v > 100)) throw Error('Metrics must be finite nonnegative numbers; CPU is normalized to 0–100%.');
      if (k === 'peakMemoryBytes' && !Number.isSafeInteger(v)) throw Error('peakMemoryBytes must be a safe integer.');
      return [k, v];
    }));
    if (r.accounting === 'eligible=completed+remaining') {
      const { eligibleJobs: e, completedJobs: c, remainingJobs: n } = parsedCounters;
      if ([e,c,n].some(v => v === null) || BigInt(e) !== BigInt(c) + BigInt(n)) throw Error('Declared eligible=completed+remaining accounting does not match the supplied counters.');
    }
    return { id: r.id, identity: r.identity, stageId: text(r.stageId) ? r.stageId : null, baselineId: text(r.baselineId) ? r.baselineId : null,
      counters: parsedCounters, metrics: parsedMetrics, freshness: bindingStatus(r.bindings), execution: 'reported-not-observed-by-buildmap' };
  });
  for (const r of result.observations) {
    if (r.stageId && !stages.has(r.stageId)) result.diagnostics.push({ section: 'runtime', id: r.id, message: 'Reported stage has no accepted declaration.' });
    if (!r.baselineId) continue;
    const baseline = result.observations.find(x => x.id === r.baselineId);
    const reason = !baseline || baseline === r ? 'Baseline missing, ambiguous or self-referencing.'
      : r.freshness.status !== 'current' || baseline.freshness.status !== 'current' ? 'Both observations need current bound receipts.'
      : canonical(r.identity) !== canonical(baseline.identity) || r.stageId !== baseline.stageId ? 'Source, calculation, workload, environment, metric scope or stage differ.' : null;
    result.comparisons.push({ observationId: r.id, baselineId: r.baselineId, status: reason ? 'refused' : 'comparable-reported-observations', reason,
      counterDifferences: reason ? null : Object.fromEntries(counters.map(k => [k, r.counters[k] === null || baseline.counters[k] === null ? null : String(BigInt(r.counters[k]) - BigInt(baseline.counters[k]))])),
      metricDifferences: reason ? null : Object.fromEntries(metrics.map(k => [k, r.metrics[k] === null || baseline.metrics[k] === null ? null : r.metrics[k] - baseline.metrics[k]])) });
  }
  if (result.diagnostics.length) result.status = 'needs-review';
  return result;
}

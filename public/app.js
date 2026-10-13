const stateColors = {
  planned: 'var(--planned)', coded: 'var(--coded)', connected: 'var(--connected)',
  computing: 'var(--computing)', verified: 'var(--verified)', live: 'var(--live)'
};
let model = null;
let selectedId = null;
let currentFingerprint = null;
let filter = '';
let mapSize = { width: 1000, height: 680 };
let fit = false;
let showAllGaps = false;
let refreshing = false;

const $ = id => document.getElementById(id);
const snapshotElement = $('buildmapSnapshot');
const snapshot = snapshotElement ? JSON.parse(snapshotElement.textContent) : null;
const nodeLayer = $('nodeLayer');
const edgeLayer = $('edgeLayer');
const viewport = $('mapViewport');
$('search').addEventListener('input', e => { filter = e.target.value.trim().toLowerCase(); applyFilter(); });
$('fitButton').addEventListener('click', () => { fit = true; scaleMap(); viewport.scrollTo({ left: 0, top: 0 }); });
$('sizeButton').addEventListener('click', () => { fit = false; scaleMap(); });
$('moreGaps').addEventListener('click', () => { showAllGaps = !showAllGaps; renderGaps(); });
new ResizeObserver(() => { if (fit) scaleMap(); }).observe(viewport);

await refresh();
if (!snapshot) setInterval(refresh, 1600);

async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
    let next = snapshot;
    if (!next) {
      const response = await fetch('/api/map', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Server returned ${response.status}`);
      next = await response.json();
    }
    $('refreshStatus').textContent = snapshot ? `Snapshot · ${new Date(snapshot.generatedAt).toLocaleString()}` : 'Updated just now';
    $('refreshStatus').classList.remove('stale');
    if (next.fingerprint === currentFingerprint) return;
    currentFingerprint = next.fingerprint;
    model = next;
    renderHeader();
    renderLegend();
    renderGaps();
    renderMap();
    if (selectedId) {
      if (model.nodes.some(n => n.id === selectedId)) renderDetail(selectedId);
      else { selectedId = null; $('detail').innerHTML = '<h2>Piece removed</h2><p>The selected piece is no longer in the current map.</p>'; }
    }
  } catch (err) {
    $('refreshStatus').textContent = model ? 'Refresh failed · showing last snapshot' : 'Could not load map · retrying';
    $('refreshStatus').classList.add('stale');
    console.error('BuildMap refresh failed', err);
  } finally { refreshing = false; }
}

function renderHeader() {
  $('projectName').textContent = model.project.name;
  const source = model.project.source;
  $('projectSource').textContent = source?.kind === 'github'
    ? `GitHub snapshot · ${source.url} · ${source.ref || 'default branch'} · ${source.revision?.slice(0, 12) || 'revision unknown'}`
    : 'Local project · follows source edits';
  if (snapshot && source?.kind !== 'github') $('projectSource').textContent = 'Captured local project · does not follow source edits';
  $('mode').textContent = `${model.project.mode}${snapshot ? ' snapshot' : ' mode'}`;
  $('mission').textContent = model.project.intent.text;
  $('intentSource').textContent = model.project.intent.source
    ? `Intent source: ${model.project.intent.source} · ${model.project.intent.confidence}`
    : 'Intent source: unknown · interview recommended';
  $('progressText').textContent = `${model.project.progress}%`;
  $('progressBar').style.width = `${model.project.progress}%`;
  $('stateCounts').innerHTML = model.states.map(s => `<span>${s}: ${model.project.counts[s] || 0}</span>`).join('');
}

function renderLegend() {
  $('legend').innerHTML = model.states.map(s => `
    <div class="legend-row" style="--state:${stateColors[s]}">
      <span class="dot"></span><span>${escapeHtml(title(s))}</span><span>${model.project.counts[s] || 0}</span>
    </div>`).join('');
}

function renderMap() {
  const work = model.nodes.filter(n => n.kind !== 'mission');
  $('emptyState').hidden = work.length > 0;
  nodeLayer.innerHTML = '';
  edgeLayer.innerHTML = '';

  const positions = layout(model.nodes, model.edges);
  const maxX = Math.max(1000, ...[...positions.values()].map(p => p.x + 250));
  const maxY = Math.max(680, ...[...positions.values()].map(p => p.y + 180));
  const canvas = $('mapCanvas');
  canvas.style.width = `${maxX}px`;
  canvas.style.height = `${maxY}px`;
  mapSize = { width: maxX, height: maxY };
  edgeLayer.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);
  edgeLayer.innerHTML = '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#71849b"/></marker></defs>';
  scaleMap();

  const depthGroups = new Map();
  for (const [id,p] of positions) {
    if (id === '__mission__') continue;
    if (!depthGroups.has(p.depth)) depthGroups.set(p.depth, p.x);
  }
  for (const [depth,x] of depthGroups) {
    const label = document.createElement('div');
    label.className = 'group-label';
    label.style.left = `${x}px`; label.style.top = '18px'; label.style.width = '194px';
    label.textContent = depth === 0 ? 'Source roots / standalone' : `Dependency layer ${depth + 1}`;
    nodeLayer.appendChild(label);
  }

  for (const edge of model.edges) {
    const a = positions.get(edge.from), b = positions.get(edge.to);
    if (!a || !b) continue;
    if (edge.type === 'planned' && edge.observed) continue;
    edgeLayer.appendChild(edgePath(a, b, edge.type));
  }

  for (const node of model.nodes) {
    const p = positions.get(node.id);
    if (!p) continue;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `node ${node.status} ${node.kind === 'mission' ? 'mission' : ''}`;
    el.dataset.id = node.id;
    el.classList.toggle('selected', node.id === selectedId);
    const findings = model.gaps.filter(g => g.nodeId === node.id);
    el.classList.toggle('has-gap', findings.some(g => g.priority !== 'info'));
    el.setAttribute('aria-label', `${node.name}, ${node.status}${findings.length ? `, ${findings.length} findings` : ''}`);
    el.style.cssText += `left:${p.x}px;top:${p.y}px;--state:${stateColors[node.status]}`;
    el.innerHTML = `
      <div class="node-top"><div class="node-title">${escapeHtml(node.name)}</div><div class="status-chip">${node.status}</div></div>
      <div class="node-purpose">${escapeHtml(node.purpose)}</div>
      ${node.kind === 'mission' ? '<div class="node-signal">Intent target · outcome unproved</div>' : findings.length ? `<div class="node-signal">${escapeHtml(signalText(findings[0]))}</div>` : '<div class="node-signal">No detected gaps</div>'}
      <div class="mini-viz">${miniViz(node.visual?.kind)}<span>${escapeHtml(node.visual?.label || 'work')}</span></div>`;
    el.addEventListener('click', () => selectPiece(node.id));
    nodeLayer.appendChild(el);
  }
  applyFilter();
}

function scaleMap() {
  const scale = fit ? Math.min(1, viewport.clientWidth / mapSize.width, viewport.clientHeight / mapSize.height) : 1;
  $('mapCanvas').style.transform = `scale(${scale})`;
  $('mapSizer').style.width = `${mapSize.width * scale}px`;
  $('mapSizer').style.height = `${mapSize.height * scale}px`;
}

function layout(nodes, edges) {
  const work = nodes.filter(n => n.kind !== 'mission');
  let depths = new Map(work.map(n => [n.id, 0]));
  // Bounded iterative layering tolerates cycles and long chains without recursive
  // stack growth. These are source dependency layers, not runtime stages.
  const links = edges.filter(e => e.type !== 'contributes');
  for (let pass = 0; pass < 5; pass++) {
    const next = new Map(depths);
    for (const e of links) if (depths.has(e.from) && depths.has(e.to)) next.set(e.to, Math.max(next.get(e.to), Math.min(5, depths.get(e.from) + 1)));
    depths = next;
  }
  const byDepth = new Map();
  for (const n of work) {
    const d = depths.get(n.id);
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(n);
  }
  const pos = new Map();
  const columns = [...byDepth.keys()].sort((a,b) => a-b);
  for (const [column,d] of columns.entries()) {
    const list = byDepth.get(d).sort((a,b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
    list.forEach((n,i) => pos.set(n.id, { x: 40 + column * 245, y: 62 + i * 168, depth: d, w: 194, h: 138 }));
  }
  pos.set('__mission__', { x: 40 + columns.length * 245, y: 62, depth: 99, w: 220, h: 138 });
  return pos;
}

function selectPiece(id) {
  selectedId = id;
  document.querySelectorAll('.node').forEach(n => n.classList.toggle('selected', n.dataset.id === id));
  applyFilter();
  renderDetail(id);
}
function signalText(gap) {
  return ({ 'missing-implementation': 'Implementation missing', 'unsupported-evidence': 'Evidence claim rejected',
    'unbound-evidence': 'Evidence freshness unknown', 'no-observed-connection': 'No source wiring observed',
    'unproved': 'Behavior unproved', 'unobserved-dependency': 'Declared wiring unobserved',
    'unexpected-dependency': 'Connection outside declared plan' })[gap.kind] || 'Review finding';
}
function renderGaps() {
  const gaps = model.gaps || [];
  $('gapHeading').textContent = `Next gaps (${gaps.length})`;
  $('gaps').innerHTML = gaps.length ? '' : '<p>No detected gaps within the scanner’s supported scope.</p>';
  for (const gap of (showAllGaps ? gaps : gaps.slice(0, 12))) {
    const el = document.createElement('button');
    el.className = `gap ${gap.priority}`;
    el.type = 'button';
    const name = model.nodes.find(n => n.id === gap.nodeId)?.name || 'Project';
    el.innerHTML = `<strong>${escapeHtml(name)}</strong><span>${escapeHtml(gap.message)}</span>`;
    el.addEventListener('click', () => selectPiece(gap.nodeId || '__mission__'));
    $('gaps').appendChild(el);
  }
  $('moreGaps').hidden = gaps.length <= 12;
  $('moreGaps').textContent = showAllGaps ? 'Show fewer gaps' : `Show all ${gaps.length} gaps`;
}

function edgePath(a,b,type) {
  const ns = 'http://www.w3.org/2000/svg';
  const path = document.createElementNS(ns, 'path');
  const x1 = a.x + a.w, y1 = a.y + 58, x2 = b.x, y2 = b.y + 58;
  const c = Math.max(45, (x2-x1)*.45);
  path.setAttribute('d', `M ${x1} ${y1} C ${x1+c} ${y1}, ${x2-c} ${y2}, ${x2} ${y2}`);
  path.setAttribute('class', `edge ${type}`);
  path.setAttribute('marker-end', 'url(#arrow)');
  return path;
}

function renderDetail(id) {
  const node = model.nodes.find(n => n.id === id);
  if (!node) return;
  $('detail').innerHTML = `
    <div class="eyebrow">PIECE INSPECTOR</div>
    <h2>${escapeHtml(node.name)}</h2>
    <div class="detail-status" style="--state:${stateColors[node.status]};color:${stateColors[node.status]}">${node.kind === 'mission' ? 'Intent target · outcome unproved' : node.status}</div>
    ${node.baseStatus ? `<p>Source state: ${escapeHtml(node.baseStatus)} · implementation ${escapeHtml(node.implementation)}<br>Purpose and mini-visual: ${node.source === 'discovered' ? 'inferred illustrations' : 'manifest descriptions or inferred illustrations'}</p>` : ''}
    <p>${escapeHtml(node.purpose)}</p>
    ${node.contributes ? `<div class="detail-section"><h3>Why it matters</h3><p>${escapeHtml(node.contributes)}</p></div>` : ''}
    <div class="detail-section"><h3>Files</h3>${fileList(node)}</div>
    <div class="detail-section"><h3>Source connections</h3>${connectionList(id)}</div>
    <div class="detail-section"><h3>Gaps to review</h3>${(model.gaps || []).filter(g => g.nodeId === id || (id === '__mission__' && !g.nodeId)).map(g => `<p>${escapeHtml(g.message)}</p>${Object.hasOwn(g, 'evidence') ? `<details><summary>Recorded claim</summary><pre>${escapeHtml(JSON.stringify(g.evidence, null, 2))}</pre></details>` : ''}`).join('') || '<p>No detected gaps.</p>'}</div>
    <div class="detail-section"><h3>Evidence</h3><div class="evidence-box">${evidenceText(node)}</div></div>
  `;
}

function connectionList(id) {
  const edges = model.edges.filter(e => e.type !== 'contributes' && (e.from === id || e.to === id));
  return edges.length ? edges.map(e => {
    const other = model.nodes.find(n => n.id === (e.from === id ? e.to : e.from));
    const label = e.type === 'code' ? (e.planStatus === 'undeclared' ? 'Observed · outside declared plan' : 'Observed source') : e.observed ? 'Declared · also observed' : 'Declared · unobserved';
    const direction = e.to === id ? 'Depends on' : 'Dependency of';
    return `<p><strong>${label}:</strong> ${direction} ${escapeHtml(other?.name || 'unknown')}${(e.observations || []).map(o => `<br><small>${escapeHtml(o.importer)} references ${escapeHtml(o.imported)}</small>`).join('')}</p>`;
  }).join('') : '<p>No cross-piece source connections discovered. Runtime wiring may exist outside scanner support.</p>';
}
function receiptText(receipt, assessment, label = 'Recorded claim') {
  if (!receipt || typeof receipt !== 'object') return `<p>${label}: ${escapeHtml(JSON.stringify(receipt))} · rejected</p>`;
  return `<p>${label}: ${escapeHtml(receipt.status || 'invalid')} · ${assessment?.accepted ? 'accepted' : 'rejected'}</p>${['note','command','proof'].filter(k => receipt[k]).map(k => `<p><strong>${k}:</strong> ${escapeHtml(receipt[k])}</p>`).join('')}`;
}
function evidenceText(node) {
  if (node.kind === 'mission') return 'This is the intended outcome. Piece states do not independently prove the mission.';
  const assessment = node.evidenceAssessment;
  const receipt = node.evidence;
  const claim = receipt ? receiptText(receipt, assessment) : '';
  const fileClaims = (node.fileEvidence || []).map(f => `<details><summary>File-only claim: ${escapeHtml(f.file)}</summary><p>This does not grant the component a higher state. ${escapeHtml(f.assessment.reason)}</p>${receiptText(f.evidence, f.assessment, 'File claim')}</details>`).join('');
  const hashes = Object.entries(node.sourceHashes || {});
  return `${escapeHtml(assessment?.reason || 'Source structure only; higher states require evidence.')}${claim}${fileClaims}${hashes.length ? `<details><summary>Current source hashes (SHA-256)</summary>${hashes.map(([f,h]) => `<p>${escapeHtml(f)}<br><code>${escapeHtml(h)}</code></p>`).join('')}</details>` : ''}`;
}

function fileList(node) {
  if (!node.files?.length) return '<p>No files — this is the mission/outcome node.</p>';
  return `<ul class="file-list">${node.files.map(f => `<li class="${node.presentFiles.includes(f) ? '' : 'missing'}">${escapeHtml(f)}${node.presentFiles.includes(f) ? '' : ' · missing'}${node.conflictingFiles?.includes(f) ? ' · ownership conflict' : ''}</li>`).join('')}</ul>`;
}

function applyFilter() {
  const q = filter;
  document.querySelectorAll('.node').forEach(el => {
    const n = model?.nodes.find(x => x.id === el.dataset.id);
    const hay = n ? `${n.name} ${n.purpose} ${n.files.join(' ')} ${n.group} ${n.status} ${(model.gaps || []).filter(g => g.nodeId === n.id).map(g => g.message).join(' ')}`.toLowerCase() : '';
    const filtered = Boolean(q && n?.id !== selectedId && !hay.includes(q));
    el.classList.toggle('filtered', filtered);
    el.tabIndex = filtered ? -1 : 0;
    el.setAttribute('aria-hidden', String(filtered));
  });
}

function miniViz(kind) {
  const open = '<svg viewBox="0 0 50 20" aria-hidden="true">', close = '</svg>';
  const shapes = {
    scanner: '<path class="stroke" d="M3 10h11m6 0h10m6 0h11"/><circle class="fill" cx="17" cy="10" r="3"/><circle class="fill" cx="33" cy="10" r="3"/>',
    graph: '<circle class="fill" cx="8" cy="10" r="3"/><circle class="fill" cx="25" cy="5" r="3"/><circle class="fill" cx="42" cy="12" r="3"/><path class="stroke" d="M11 9l11-3m6 0l11 5"/>',
    proof: '<path class="stroke" d="M4 10l8 7L28 2"/><path class="stroke" d="M31 5h15M31 11h12M31 17h9"/>',
    lens: '<circle class="stroke" cx="20" cy="9" r="7"/><path class="stroke" d="M25 14l8 5M3 9h8M37 9h10"/>',
    goal: '<circle class="stroke" cx="28" cy="10" r="8"/><circle class="stroke" cx="28" cy="10" r="4"/><path class="stroke" d="M3 10h18"/>',
    gate: '<path class="stroke" d="M4 4h15v12H4M31 4h15v12H31M19 10h12"/>',
    queue: '<rect class="stroke" x="3" y="5" width="8" height="10"/><rect class="stroke" x="16" y="5" width="8" height="10"/><rect class="stroke" x="29" y="5" width="8" height="10"/><path class="stroke" d="M39 10h8"/>'
  };
  return open + (shapes[kind] || '<path class="stroke" d="M3 10h36m-7-6l7 6-7 6"/>') + close;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}
function title(s) { return s[0].toUpperCase() + s.slice(1); }

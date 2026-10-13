const stateColors = {
  planned: 'var(--planned)', coded: 'var(--coded)', connected: 'var(--connected)',
  computing: 'var(--computing)', verified: 'var(--verified)', live: 'var(--live)'
};
let model = null;
let selectedId = null;
let currentFingerprint = null;
let filter = '';

const $ = id => document.getElementById(id);
const nodeLayer = $('nodeLayer');
const edgeLayer = $('edgeLayer');
const viewport = $('mapViewport');
$('search').addEventListener('input', e => { filter = e.target.value.trim().toLowerCase(); applyFilter(); });
$('fitButton').addEventListener('click', () => { viewport.scrollTo({ left: 0, top: 0, behavior: 'smooth' }); });

await refresh();
setInterval(refresh, 1600);

async function refresh() {
  try {
    const next = await fetch('/api/map', { cache: 'no-store' }).then(r => r.json());
    if (next.fingerprint === currentFingerprint) return;
    currentFingerprint = next.fingerprint;
    model = next;
    renderHeader();
    renderLegend();
    renderMap();
    if (selectedId && model.nodes.some(n => n.id === selectedId)) renderDetail(selectedId);
  } catch (err) {
    console.error('BuildMap refresh failed', err);
  }
}

function renderHeader() {
  $('projectName').textContent = model.project.name;
  $('mode').textContent = `${model.project.mode} mode`;
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
  edgeLayer.setAttribute('viewBox', `0 0 ${maxX} ${maxY}`);

  const depthGroups = new Map();
  for (const [id,p] of positions) {
    if (id === '__mission__') continue;
    if (!depthGroups.has(p.depth)) depthGroups.set(p.depth, p.x);
  }
  for (const [depth,x] of depthGroups) {
    const label = document.createElement('div');
    label.className = 'group-label';
    label.style.left = `${x}px`; label.style.top = '18px'; label.style.width = '194px';
    label.textContent = depth === 0 ? 'Foundations' : `Capability layer ${depth + 1}`;
    nodeLayer.appendChild(label);
  }

  for (const edge of model.edges) {
    const a = positions.get(edge.from), b = positions.get(edge.to);
    if (!a || !b) continue;
    edgeLayer.appendChild(edgePath(a, b, edge.type));
  }

  for (const node of model.nodes) {
    const p = positions.get(node.id);
    if (!p) continue;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = `node ${node.status} ${node.kind === 'mission' ? 'mission' : ''}`;
    el.dataset.id = node.id;
    el.style.cssText += `left:${p.x}px;top:${p.y}px;--state:${stateColors[node.status]}`;
    el.innerHTML = `
      <div class="node-top"><div class="node-title">${escapeHtml(node.name)}</div><div class="status-chip">${node.status}</div></div>
      <div class="node-purpose">${escapeHtml(node.purpose)}</div>
      <div class="mini-viz">${miniViz(node.visual?.kind)}<span>${escapeHtml(node.visual?.label || 'work')}</span></div>`;
    el.addEventListener('click', () => { selectedId = node.id; document.querySelectorAll('.node').forEach(n => n.classList.toggle('selected', n.dataset.id === selectedId)); renderDetail(node.id); });
    nodeLayer.appendChild(el);
  }
  applyFilter();
}

function layout(nodes, edges) {
  const ids = nodes.map(n => n.id);
  const incoming = new Map(ids.map(id => [id, []]));
  for (const e of edges) if (incoming.has(e.to) && incoming.has(e.from)) incoming.get(e.to).push(e.from);
  const memo = new Map();
  function depth(id, trail = new Set()) {
    if (id === '__mission__') return 99;
    if (memo.has(id)) return memo.get(id);
    if (trail.has(id)) return 0;
    trail.add(id);
    const parents = incoming.get(id) || [];
    const d = parents.length ? Math.min(5, 1 + Math.max(...parents.map(p => depth(p, new Set(trail))))) : 0;
    memo.set(id, d); return d;
  }
  const byDepth = new Map();
  for (const n of nodes) {
    const d = n.id === '__mission__' ? 6 : depth(n.id);
    if (!byDepth.has(d)) byDepth.set(d, []);
    byDepth.get(d).push(n);
  }
  const pos = new Map();
  for (const [d, list] of [...byDepth.entries()].sort((a,b) => a[0]-b[0])) {
    list.sort((a,b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
    const x = 40 + d * 245;
    list.forEach((n,i) => pos.set(n.id, { x, y: 62 + i * 152, depth: d, w: n.kind === 'mission' ? 220 : 194, h: 116 }));
  }
  return pos;
}

function edgePath(a,b,type) {
  const ns = 'http://www.w3.org/2000/svg';
  const path = document.createElementNS(ns, 'path');
  const x1 = a.x + a.w, y1 = a.y + 58, x2 = b.x, y2 = b.y + 58;
  const c = Math.max(45, (x2-x1)*.45);
  path.setAttribute('d', `M ${x1} ${y1} C ${x1+c} ${y1}, ${x2-c} ${y2}, ${x2} ${y2}`);
  path.setAttribute('class', `edge ${type}`);
  return path;
}

function renderDetail(id) {
  const node = model.nodes.find(n => n.id === id);
  if (!node) return;
  const inbound = model.edges.filter(e => e.to === id).map(e => model.nodes.find(n => n.id === e.from)?.name).filter(Boolean);
  const outbound = model.edges.filter(e => e.from === id).map(e => model.nodes.find(n => n.id === e.to)?.name).filter(Boolean);
  $('detail').innerHTML = `
    <div class="eyebrow">PIECE INSPECTOR</div>
    <h2>${escapeHtml(node.name)}</h2>
    <div class="detail-status" style="--state:${stateColors[node.status]};color:${stateColors[node.status]}">${node.status}</div>
    <p>${escapeHtml(node.purpose)}</p>
    ${node.contributes ? `<div class="detail-section"><h3>Why it matters</h3><p>${escapeHtml(node.contributes)}</p></div>` : ''}
    <div class="detail-section"><h3>Files</h3>${fileList(node)}</div>
    <div class="detail-section"><h3>Connections</h3><p><strong>Feeds from:</strong> ${escapeHtml(inbound.join(', ') || 'none discovered yet')}</p><p><strong>Feeds to:</strong> ${escapeHtml(outbound.join(', ') || 'none discovered yet')}</p></div>
    <div class="detail-section"><h3>Evidence</h3><div class="evidence-box">${evidenceText(node)}</div></div>
  `;
}

function evidenceText(node) {
  if (node.evidence) {
    const detail = node.evidence.note || node.evidence.command || node.evidence.proof || 'Explicit evidence recorded.';
    return `${escapeHtml(detail)}<br><small>Status claimed: ${escapeHtml(node.evidence.status || node.status)}</small>`;
  }
  if (['planned','coded','connected'].includes(node.status)) {
    return node.status === 'connected'
      ? 'Connection was discovered from code imports or declared dependencies. Higher states require explicit evidence.'
      : 'This state comes from repository structure. Higher states require explicit evidence.';
  }
  return 'No evidence note was provided.';
}

function fileList(node) {
  if (!node.files?.length) return '<p>No files — this is the mission/outcome node.</p>';
  return `<ul class="file-list">${node.files.map(f => `<li class="${node.presentFiles.includes(f) ? '' : 'missing'}">${escapeHtml(f)}${node.presentFiles.includes(f) ? '' : ' · planned'}</li>`).join('')}</ul>`;
}

function applyFilter() {
  const q = filter;
  document.querySelectorAll('.node').forEach(el => {
    const n = model?.nodes.find(x => x.id === el.dataset.id);
    const hay = n ? `${n.name} ${n.purpose} ${n.files.join(' ')} ${n.group}`.toLowerCase() : '';
    el.classList.toggle('filtered', Boolean(q && !hay.includes(q)));
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

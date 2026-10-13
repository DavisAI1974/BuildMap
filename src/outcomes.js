import crypto from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

// Outcome plans describe intended behavior. Source references and piece-level
// receipts never establish that the whole journey ran.
export function buildOutcomes(definitions, receipts, nodes, assessEvidence) {
  const diagnostics = [];
  const add = (code, message, detail = {}) => diagnostics.push({ code, message, ...detail });
  const plans = validPlans(definitions, add);
  const collection = receipts && typeof receipts === 'object' && !Array.isArray(receipts) ? receipts : {};
  if (receipts !== undefined && collection !== receipts) add('invalid-outcome-evidence', 'Evidence outcomes must be an object keyed by outcome id.', { priority: 'blocker', evidence: receipts });
  const byId = new Map(nodes.map(n => [n.id, n]));
  const outcomes = plans.map(plan => {
    const nodeIds = [...new Set([...plan.steps.map(s => s.nodeId), ...plan.supports])];
    const pieces = nodeIds.map(id => byId.get(id));
    const complete = pieces.every(n => n?.implementation === 'complete' && !n.conflictingFiles.length);
    const sourceHashes = Object.fromEntries(pieces.filter(Boolean).flatMap(n => Object.entries(n.sourceHashes)));
    const definitionHash = crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex');
    const receipt = Object.hasOwn(collection, plan.id) ? collection[plan.id] : null;
    const objectReceipt = receipt && typeof receipt === 'object' && !Array.isArray(receipt);
    let assessment = { accepted: false, reason: 'No walkthrough example recorded. Piece states do not prove this outcome.' };
    if (Object.hasOwn(collection, plan.id)) {
      if (!objectReceipt || !['computing', 'verified'].includes(receipt.status)) assessment = { accepted: false, reason: 'Outcome receipts require computing or verified status and a recorded walkthrough example.' };
      else if (receipt.definitionHash !== definitionHash) assessment = { accepted: false, binding: 'stale', reason: 'The outcome definition is unbound or has changed. Record a new example against this plan.' };
      else if (!receipt.sourceHashes) assessment = { accepted: false, binding: 'unbound', reason: 'Outcome examples require hashes for every participating and supporting implementation file.' };
      else assessment = assessEvidence(receipt, complete, sourceHashes);
    }
    const bound = assessment.accepted;
    const example = objectReceipt && receipt.example && typeof receipt.example === 'object' && !Array.isArray(receipt.example) ? receipt.example : null;
    const records = Array.isArray(example?.steps) ? example.steps : [];
    const shapeValid = example && typeof example.name === 'string' && example.name.trim() && Object.hasOwn(example, 'input') && Object.hasOwn(example, 'output') &&
      records.every(r => r && typeof r === 'object' && !Array.isArray(r) && typeof r.stepId === 'string' && plan.steps.some(s => s.id === r.stepId)) &&
      new Set(records.map(r => r.stepId)).size === records.length &&
      records.every((r, i) => i === 0 || plan.steps.findIndex(s => s.id === records[i - 1].stepId) < plan.steps.findIndex(s => s.id === r.stepId));
    const steps = plan.steps.map((step, i) => {
      const piece = byId.get(step.nodeId);
      const record = records.find(r => r?.stepId === step.id);
      const sampleValid = record && Object.hasOwn(record, 'input') && Object.hasOwn(record, 'output') && ['observed', 'failed'].includes(record.result);
      const handoffRecorded = i === 0 || (typeof record?.handoff === 'string' && Boolean(record.handoff.trim()));
      const state = !piece ? 'missing-piece' : piece.implementation !== 'complete' || piece.conflictingFiles.length ? 'missing-implementation'
        : !record ? 'unobserved' : !bound ? (assessment.binding === 'stale' ? 'stale-example' : 'unaccepted-example') : !shapeValid || !sampleValid ? 'invalid-example'
          : !handoffRecorded ? 'unobserved-handoff' : record.result;
      return { ...step, pieceName: piece?.name || step.nodeId, pieceStatus: piece?.status || null, state, observation: record || null };
    });
    let firstGap = steps.find(s => s.state !== 'observed');
    const missingSupport = plan.supports.find(id => !byId.get(id) || byId.get(id).implementation !== 'complete' || byId.get(id).conflictingFiles.length);
    if (!firstGap && missingSupport) firstGap = { nodeId: missingSupport, state: 'missing-support', label: `Supporting piece ${missingSupport}` };
    if (bound && !firstGap && (!isDeepStrictEqual(example?.input, records[0]?.input) || !isDeepStrictEqual(example?.output, records.at(-1)?.output))) firstGap = { state: 'inconsistent-example', label: 'Overall input/output' };
    if (bound && (!shapeValid || firstGap)) assessment = { ...assessment, accepted: false, reason: !shapeValid ? 'A named example must include overall input/output and unique, ordered records for known steps.' : `The walkthrough stops at ${firstGap.label}: ${firstGap.state}.` };
    if (receipt !== null || Object.hasOwn(collection, plan.id)) {
      if (!assessment.accepted) add('unproved-outcome', `${plan.name}: ${assessment.reason}`, { outcomeId: plan.id, priority: 'warning', evidence: receipt });
    } else add('unproved-outcome', `${plan.name}: record an example showing the outcome, including its handoffs.`, { outcomeId: plan.id, priority: 'info' });
    for (const id of nodeIds) if (!byId.has(id)) add('unknown-outcome-piece', `${plan.name} refers to unmapped piece ${id}.`, { outcomeId: plan.id, priority: 'blocker' });
    return { ...plan, nodeIds, steps, sourceHashes, definitionHash, hasEvidence: Object.hasOwn(collection, plan.id), evidence: receipt, evidenceAssessment: assessment,
      status: assessment.accepted ? receipt.status : 'unproved', firstGap: firstGap || null };
  });
  for (const [id, receipt] of Object.entries(collection)) if (!outcomes.some(o => o.id === id)) add('unmapped-outcome-evidence', `Evidence outcomes.${id} has no valid outcome plan.`, { priority: 'blocker', evidence: receipt });
  for (const node of nodes) {
    node.outcomeIds = outcomes.filter(o => o.nodeIds.includes(node.id)).map(o => o.id);
    if (outcomes.length && !node.outcomeIds.length) add('unassigned-outcome', `${node.name} is not assigned to an outcome. Review its purpose; it may be supporting work.`, { nodeId: node.id, priority: 'info' });
  }
  return { outcomes, diagnostics };
}

function validPlans(value, add) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) { add('invalid-outcome', 'Manifest outcomes must be an array.', { priority: 'blocker' }); return []; }
  const ids = new Set();
  const text = v => typeof v === 'string' && Boolean(v.trim());
  return value.flatMap(plan => {
    const valid = plan && typeof plan === 'object' && !Array.isArray(plan) && text(plan.id) && text(plan.goal) &&
      (plan.name === undefined || text(plan.name)) && Array.isArray(plan.steps) && plan.steps.length &&
      plan.steps.every(s => s && typeof s === 'object' && !Array.isArray(s) && ['id', 'nodeId', 'label', 'expected'].every(k => text(s[k])) && ['explanation', 'example'].every(k => s[k] === undefined || text(s[k]))) &&
      new Set(plan.steps.map(s => s.id)).size === plan.steps.length &&
      (plan.supports === undefined || (Array.isArray(plan.supports) && plan.supports.every(text)));
    if (!valid || ids.has(plan.id)) { add('invalid-outcome', 'Each outcome needs a unique id, a goal, and ordered steps with unique ids, nodeId, label, and expected result; optional explanation/example fields must be nonempty strings, and supports an array of piece ids.', { priority: 'blocker' }); return []; }
    ids.add(plan.id);
    return [{ id: plan.id, name: plan.name || plan.id, goal: plan.goal,
      steps: plan.steps.map(({ id, nodeId, label, expected, explanation, example }) => ({ id, nodeId, label, expected,
        ...(explanation ? { explanation } : {}), ...(example ? { example } : {}) })), supports: [...new Set(plan.supports || [])] }];
  });
}

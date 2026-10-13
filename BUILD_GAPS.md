# BuildMap stage and remaining gaps

**Current checkpoint: the free BuildMap source-build stage is implemented within the MVP scope below.** The user asked to finish this stage before returning to refinements. No additional core source feature is currently assigned. Browser acceptance remains blocked; this is not a release, deployment, or live-completion claim.

This record is maintained alongside the evidence-review pass based on `3f7ae7f`. Current validation: **89/89 tests pass on Node v20.20.2 and v24.19.0**, plus syntax/whitespace checks. Client interaction checks use a DOM double, not a real browser.

## Free BuildMap stage checklist

| Stage requirement | Status | Implementation and check boundary |
| --- | --- | --- |
| Describe a project and its intended finished experience/behavior | Implemented | Explicit local `--init`; attributed README/manifest intent; unknown intent and malformed descriptions stay visible. Both explanation views end with the destination. |
| Map the repository and every mapped piece/file | Implemented | Git/filesystem inventory, supported source discovery and exact declared paths. Full file inspectors, present/missing counts and planned pieces. This is not automatic inventory of every unsupported repository asset. |
| Organize files and describe planned pieces | Implemented | Reviewed local `--piece` appends groups or missing/empty pieces, preserving existing plans/source/evidence. Ownership and direct walkthrough references block unsafe regrouping. Existing-piece edits remain file-authored. |
| Separate implementation, source wiring and behavior claims | Implemented | Planned/coded/connected/computing/verified/live contract; declared dependencies cannot grant source connectivity. Missing/overlapping implementation and stale/rejected claims remain visible. |
| Follow goals through the build | Implemented | Free goals beside the graph and a wider free walkthrough; reviewed local `--walkthrough`; ordered steps, expected results, samples, handoffs, first unfinished point and supporting pieces. |
| Prepare one focused task for a coding agent | Implemented | Free finding guidance and basic copy briefs, including goal/first-step context. Relevant files, captured fingerprint, scope limits and manual copy fallback; BuildMap does not send or execute tasks. |
| Read evidence without confusing a claim with proof | Implemented | Plain-English piece/whole-example review, recorded descriptions, binding/coverage limits, observed/failed/unaccepted step counts and recording guidance. Original raw claims/assessments/hashes remain inspectable. Evidence authoring remains manual. |
| Navigate and follow local source changes | Implemented | Search across assigned paths, result/gap focus, selection highlights, fit/actual size, refresh/removal and refresh-failure feedback. Checked through shared-client DOM tests; real layout/accessibility is pending. |
| Use APIs and portable snapshots | Implemented | Read-only map/gaps/health, JSON and self-contained HTML export; GitHub branch/tag snapshot provenance and cleanup. Export shares the live client and does not poll. No preview artifact is generated unless requested. |
| Support the documented local runtime/startup | Checked | Node 20+ commands remain required; full tests on Node 20.20.2 and 24.19.0. Historical public clone/ref and Node 20 CLI/server/API/assets/exit smoke results remain documented. No no-code/browser onboarding claim. |
| Observe the real browser experience | Blocked | Live server and export, narrow/larger maps, clipboard, search/fit/scroll, keyboard/accessibility, edits and failure/recovery still need a permitted browser environment. |

The implemented source checkpoint can now be reviewed as one free BuildMap flow. Further source work should come from a concrete finding, user feedback, or the permitted browser observation rather than treating all future capabilities as unfinished MVP work.

## Current dogfood evidence

The manifest has five implemented components. Four backend/test pieces have current manually recorded, source-bound test receipts with selected dependency/test-input bindings. The visualizer is source-connected and behavior-unproved. There are no missing implementation files, unexpected declared-plan dependencies, or unmapped evidence claims in the dogfood map.

The literal `/api/map` fetch and supported Node HTTP handler match with source locations. This is source syntax, not proof of runtime origin, transport, execution, or browser behavior. A partial Node intent/scan/local-HTTP example records selected fields for three steps; its browser step and the whole “Understand the current build” outcome remain unproved. No piece is live.

Hash matches establish identity, not receipt authenticity, complete transitive input coverage, environment identity, or continuing liveness. Piece proof and outcome/mission proof remain independent.

## Remaining stage acceptance check

The available cloud browser could not reach workspace loopback, and its URL policy rejected local HTML navigation and prohibited workarounds. No workaround was used. Do not retry or bypass those restrictions; complete the browser checklist only in a permitted environment and record only what is observed.

PR #1 remains open. Merge, deployment, npm publication and paid launch are separate actions. Nothing is marked live.

## Refinements after this checkpoint

| Area | Current boundary | Later work when a concrete need justifies it |
| --- | --- | --- |
| Easier onboarding and plan editing | CLI setup and append-only piece/walkthrough interviews; existing edits, ownership moves and reference migration require file authoring. | Simplify installation, or add a narrowly scoped editor/migration flow from actual usage. |
| Evidence capture and independent provenance | Manual receipts and explicit selected inputs; recording guidance is implemented, not automatic capture. | Assisted entry or authenticated CI/runtime observations; retain scope, freshness and uncertainty. No command execution or upper states inferred from file/agent presence. |
| Broader wiring discovery | Parsed JavaScript and bounded HTTP source matching; TypeScript/JSX, Python/HTML/CSS have disclosed heuristic limits. | Concrete adapters for frameworks/wrappers, aliases, Python src layouts and other languages with provenance. |
| Larger repositories | Full scans/hashes and all-card rendering; no scale benchmark. | Measure realistic use, then improve caching/layout/navigation while preserving change detection. |
| Deeper intent and mechanisms | Attributed prose, declared descriptions and illustrative visuals. | Compare documented goals with implementation and explain mechanisms with inspectable source facts and uncertainty. |
| Remote/history/zoom extensions | GitHub inputs are fixed snapshots; conceptual multi-level navigation/history animation is deferred. | Add only from a real navigation or collaboration need. |

## Parked paid Guide work

The tested JavaScript code-reading preview is preserved on `guide/source-code-preview-20261013` at `327753325be5b1479ddfb36f76e85c85c88d3467`; it is not in this free branch or PR #1. Preserve it for later integration.

The strategy in `docs/BUILDMAP_COMPETITIVE_STRATEGY_HANDOFF_20261013.md` proposes deeper coaching with acceptance criteria, impact previews, post-agent review, guided verification and continuity. Pricing/billing remain undecided or unbuilt. The current complete map, walkthrough and basic task briefs stay free. No separate coding agent or broad orchestration platform is required for this checkpoint.

## Working rules

Fetch the current branch and preserve newer work. Keep this sheet tied to source/tests and observed evidence, and keep browser limitations explicit. Create or update user-facing HTML previews only when the user asks; retain the product export command. Defer refinements until feedback or an observed issue gives them a concrete purpose. Refresh receipts only after the relevant checks pass; do not manufacture proof to close a row.

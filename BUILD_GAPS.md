# BuildMap v0.1 remaining build gaps

Source checkpoint reviewed: PR #1 at `b43600a`, followed by the parser/HTTP-source pass documented in `REVIEW_NOTES.md`. Current checks: 74 tests pass on Node v20.20.2 and v24.19.0; the Node 20 CLI/server smoke passed; local HTTP, default GitHub clone, and branch-specific GitHub clone/JSON paths have been exercised. No browser or live deployment proof is claimed.

## What the current map actually reports

BuildMap's manifest has five implemented components: four have source-bound recorded test receipts with selected dependency/test-input bindings; the visualizer is source-connected. There are no missing implementation files, unexpected declared-plan dependencies, or unmapped evidence claims in the dogfood map.

Its release-confidence findings are the visualizer's `unproved` behavior and the separate unproved "Understand the current build" outcome. Backend receipt states cannot close its browser walkthrough step. Exercise the real UI in a permitted environment before recording that observation.

The parser-backed adapter now finds the literal `/api/map` fetch and its unique Node HTTP handler condition, with file/line provenance. That closes the previous no-observed-connection/unobserved-dependency findings within the supported source-matching scope. It does not establish runtime origin, transport, execution, or browser behavior, and grants no upper visualizer state.

## MVP scope

The existing CLI/server/map/export core is the original free MVP. The user confirmed that nothing from it should be removed or charged for as part of the walkthrough tier. A distinct paid Walkthrough view adds goals and journey evidence on top of the same engine; Map remains the default. File previews and present/missing counts are implemented in the shared live/export client; the full list stays in the inspector. New supported source files appear independently until explicitly grouped in the manifest. Clickable search results, match counts, Enter/Escape shortcuts, and card navigation from results/gaps are implemented in that same client. Refresh preserves focus on surviving cards/results. Navigation checks use the DOM double; browser behavior remains unobserved. Outcome walkthroughs now add declared goals, ordered steps and expected results, supporting-piece assignments, source/definition-bound recorded examples, and the first unresolved point. The inspector exposes samples and links back to participating pieces; unassigned pieces become informational scope-review findings. Outcome findings appear in the paid view, while the free view keeps the original source/evidence findings and complete map features. Both tiers are accessible in this review preview; billing/access enforcement is not built. These plans never manufacture source edges, piece proof, mission proof, or deployment claims. Further MVP work must carry into the product. The broader roadmap below can wait for concrete usage needs.

The product now focuses on beginner-to-intermediate builders, including people using coding agents without full-stack or architecture experience. Plain-English finding guidance and manually copied focused task briefs are implemented in the shared client. They suggest one bounded review, with goal/first-step context in the paid view, without removing free features or manufacturing proof. CLI setup and manifest/evidence authoring remain a usability gap for this audience; a guided start should be scoped before adding a larger editor or platform.

## Next release-confidence checks

| Priority | Remaining check | Done when |
| --- | --- | --- |
| 1 | Real browser end-to-end, including narrow screens and a larger sample map. | Open the live server and exported snapshot, exercise selection, gaps, filtering, fit/scroll, keyboard use, live edits, and refresh failure/recovery; fix findings and record only the behavior actually observed. |

The available cloud browser cannot reach this workspace's loopback server, and its URL policy rejects local HTML-file navigation. No workaround around that security rejection has been used. Browser verification needs a permitted browser environment. The Node 20 runtime check is now complete: the full suite and dogfood CLI JSON/server/API/assets/SIGTERM smoke passed on v20.20.2.

PR #1 remains open. Merging and public release are separate actions after review; this pass does not claim that the default branch already contains v0.1.

## Important product work for broader use

| Priority | Gap | Current boundary | Useful next implementation |
| --- | --- | --- | --- |
| 2 | Broader, more accurate wiring discovery. | Parsed JS plus bounded Node-HTTP/fetch source path matching; TypeScript/JSX and Python/HTML/CSS remain heuristic. HTTP wrappers/frameworks/origin routing, aliases, Python `src` layouts, and other languages are incomplete. | Expand adapters from concrete repository needs with source provenance, while preserving source/runtime/plan distinctions. |
| 3 | Broader proof freshness and independent provenance. | Manual claims; source hashes cover each piece, and optional input hashes cover only selected dependency/test/data/config files. Complete transitive input coverage, environments, CI authenticity, and continuing deployment liveness are not established. | Automatic inspectable input-set discovery when justified, plus independent CI/runtime receipts. Never run commands or infer upper states merely from their existence. |
| 4 | Large-repository performance and navigation. | Full synchronous rescan/hash per API request; all cards/edges are rendered; layering is bounded and cycles are tolerated without deeper layout semantics. No scale benchmark is claimed. | Measure a realistic large sample, reduce repeated work while preserving change detection, and add capability/subsystem drill-down or filtering. |
| 5 | Deeper intent and visual explanation. | First useful README prose or a declared mission; filename/comment/symbol heuristics and illustrative mini-visuals. No built-in interview or semantic contradiction analysis. | Preserve attribution/uncertainty while comparing documented goals with implementation and deriving inspectable mechanism descriptions. |

These are product improvements beyond the implemented v0.1 core, rather than a claim that six source modules are still missing. Each should be scoped from an actual use case before adding infrastructure.

Outcome authoring and example capture currently use the manifest/evidence files. Automatic runtime instrumentation, authenticated capture, semantic checking of expected results, branching journeys, and an in-app editor are deferred until usage justifies them. The implemented ordered walkthrough is a retained product model and interface.

## Deferred extensions

- Git arrival/history animation: current clone provenance identifies the selected commit but does not reconstruct when individual pieces arrived.
- Continuous remote GitHub refresh: current GitHub input is a clone snapshot; local mode follows source edits.
- Five-level navigation (`File → Mechanism → Capability → Subsystem → Mission`): later product direction, not a prerequisite for the current proof of concept.
- Automated publication/deployment: no deployment exists and no piece is marked live.

## Working rules for the next pass

Use the current PR head and preserve newer commits. Read the README, this gap report, source, and tests before expanding scope. Keep declared plans distinct from discovered wiring. Preserve file/component evidence scope and source-binding checks. Update receipts only after the relevant check succeeds, and retain the browser limitation until an actual permitted observation closes it.

# BuildMap v0.1 remaining build gaps

Source checkpoint reviewed: PR #1 through `705ff1f`, followed by the branch/tag targeting pass documented in `REVIEW_NOTES.md`. Current checks: 44 tests pass on Node v24.19.0; local HTTP, default GitHub clone, and branch-specific GitHub clone/JSON paths have been exercised. No browser or live deployment proof is claimed.

## What the current map actually reports

BuildMap's manifest has five implemented components: four have source-bound recorded test receipts; the visualizer is source-connected. There are no missing implementation files, unexpected declared-plan dependencies, or unmapped evidence claims in the dogfood map.

Its three findings all concern the visualizer:

| Map finding | What it means | Closure |
| --- | --- | --- |
| `unproved` | Browser behavior/layout has no observation receipt. | Exercise the real UI and record the supported behavior against its source. |
| `no-observed-connection` | No cross-component source edge links the visualizer to the server. Internal HTML/assets are discovered. | Add an explicit, evidence-backed HTTP relationship adapter or retain this documented discovery limit. |
| `unobserved-dependency` | The declared server dependency has no matching import/reference edge under current discovery. | Same HTTP discovery work as above. |

The HTTP path is implemented. The graph findings describe the scanner's visibility; they do not establish that the application is disconnected at runtime.

## Next release-confidence checks

| Priority | Remaining check | Done when |
| --- | --- | --- |
| 1 | Real browser end-to-end, including narrow screens and a larger sample map. | Open the live server and exported snapshot, exercise selection, gaps, filtering, fit/scroll, keyboard use, live edits, and refresh failure/recovery; fix findings and record only the behavior actually observed. |
| 2 | Minimum-runtime compatibility. | Run the existing suite and CLI/server smoke on Node 20. Current test evidence is from Node 24, even though source uses APIs intended to support Node 20+. |

The available cloud browser cannot reach this workspace's loopback server, and its URL policy rejects local HTML-file navigation. No workaround around that security rejection has been used. These checks need a permitted browser/runtime environment.

PR #1 remains open. Merging and public release are separate actions after review; this pass does not claim that the default branch already contains v0.1.

## Important product work for broader use

| Priority | Gap | Current boundary | Useful next implementation |
| --- | --- | --- | --- |
| 3 | Broader, more accurate wiring discovery. | Heuristic JS/TS/Python/HTML/CSS discovery; HTTP, aliases, Python `src` layouts, regular-expression/template corner cases, and other languages are incomplete. | Parser-backed adapters with source provenance; distinguish source references, runtime relationships, and planned wiring. |
| 4 | Stronger proof freshness and provenance. | Manual claims; source hashes bind only a piece's own implementation. Dependencies, test inputs, environments, CI authenticity, and continuing deployment liveness are not covered. | Optional dependency/test-input binding plus independent CI/runtime receipts. Never run commands or infer upper states merely from their existence. |
| 5 | Large-repository performance and navigation. | Full synchronous rescan/hash per API request; all cards/edges are rendered; layering is bounded and cycles are tolerated without deeper layout semantics. No scale benchmark is claimed. | Measure a realistic large sample, reduce repeated work while preserving change detection, and add capability/subsystem drill-down or filtering. |
| 6 | Deeper intent and visual explanation. | First useful README prose or a declared mission; filename/comment/symbol heuristics and illustrative mini-visuals. No built-in interview or semantic contradiction analysis. | Preserve attribution/uncertainty while comparing documented goals with implementation and deriving inspectable mechanism descriptions. |

These are product improvements beyond the implemented v0.1 core, rather than a claim that six source modules are still missing. Each should be scoped from an actual use case before adding infrastructure.

## Deferred extensions

- Git arrival/history animation: current clone provenance identifies the selected commit but does not reconstruct when individual pieces arrived.
- Continuous remote GitHub refresh: current GitHub input is a clone snapshot; local mode follows source edits.
- Five-level navigation (`File → Mechanism → Capability → Subsystem → Mission`): later product direction, not a prerequisite for the current proof of concept.
- Automated publication/deployment: no deployment exists and no piece is marked live.

## Working rules for the next pass

Use the current PR head and preserve newer commits. Read the README, this gap report, source, and tests before expanding scope. Keep declared plans distinct from discovered wiring. Preserve file/component evidence scope and source-binding checks. Update receipts only after the relevant check succeeds, and retain the browser limitation until an actual permitted observation closes it.

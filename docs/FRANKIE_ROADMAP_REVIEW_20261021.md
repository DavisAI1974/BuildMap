# Frankie-priority roadmap review — 2026-10-21

Source: supplied `BuildMap_Codex_Project_Roadmap_20261021.docx`. Reviewed app base: PR #1, `feat/buildmap-v1-living-map` at `3298e79ca0ff8f9d48eea064e463bb1ea6e31108`. Default `main` is the initial commit `5375ceb`; it is not the app baseline. All 106 existing Node tests pass on Node 24.19.0 before changes. Prior browser checks are historical, not rerun evidence.

Work is isolated in local-only branch `private/frankie-inspector-risk-20261021`, worktree `/workspace/BuildMap-frankie`. The upstream PR and other branches are preserved. This public repository cannot provide a private remote branch; this branch stays local. Unpushed edits in another session are not visible here and must be reconciled before integration.

## Inventory before implementation

Existing = the acceptance scope is met; Partial = useful related implementation exists but the requested scope is incomplete; Missing = no implementation of the requested capability. References below are repository paths at the reviewed base.

| ID | Feature | Baseline | Evidence and remaining scope | Frankie priority |
| --- | --- | --- | --- | --- |
| BM-01 | Calculation & Data Flow Inspector | Partial | `src/code-guide.js`, `src/javascript.js`, `nodes[].codeGuide`, `public/app.js`: JavaScript parameters, returns, calls and source identity. No Python calculations, file-product lineage or workflow tracing. | First slice |
| BM-02 | Pre-Run Architecture / Workload Risk Review | Missing | Existing `scan.js` gaps concern implementation/evidence/declared wiring; they do not review workload, reads, memory or checkpoint reuse. | First slice |
| BM-03 | Producer–Consumer & Reuse Map | Partial | `src/imports.js`/`scan.js` source imports and declared dependencies exist, explicitly not runtime data flow. Shared data-product producers/consumers/identity/coverage are absent. | Literal products first; semantic identity later |
| BM-04 | Workload Estimator / Combinatorial Explosion | Missing | No symbolic loop expansion, grounded job counts or separate pair counts. | Nested-loop syntax first; counts only with evidence |
| BM-05 | Duplicate Computation / Data Reads | Missing | No duplicate-read/computation detector or cache recognition. | Repeated literal reads with uncertainty and reuse cues |
| BM-06 | Checkpoint & Restart Paths | Missing | BuildMap's own evidence receipts are not an inspected project's checkpoint/restart map. | Next: identities, receipts, guarded recovery |
| BM-07 | Incremental Table Coverage / Extension | Missing | File inventory/missing source is not table row/column/range coverage. | Later: exact compatibility; never fill missing values |
| BM-08 | CPU / Memory / I/O / Parallelism | Missing | No inspected-project topology, utilization or streaming barrier analysis. | Later; measurements required for bottleneck claims |
| BM-09 | Intended vs Actual / Agent Drift | Partial | Explicit dependency-plan drift in `scan.js`; `public/guide-tasks.js` bounded scopes and later snapshot comparison. No semantic workflow/stage-contract comparison. | Retain bounded tasks; stage wiring later |
| BM-10 | Guided Walkthrough + Task Briefs | Partial | Free declared walkthroughs/basic briefs and Guide function reading/reviewed tasks exist. No automatic project-wide calculation tour or durable continuity. | Reuse existing inspector; no billing work |
| BM-11 | Runtime Overlay / Savings | Missing | User-recorded evidence with source/input hashes exists, but no metrics/log importer or comparable measured savings. | Defer; never infer savings from static syntax |
| BM-12 | Frankie Dogfood / Regressions | Missing | Existing tests exercise BuildMap, not Frankie workload/reuse semantics. No Frankie checkout/data is present. | Small synthetic regression pack now; real-source review pending |

## Bounded first slice

Extend the existing scanner and Guide panel, without introducing a competing mapper. Use an optional isolated Python standard-library AST parser; pass captured source bytes, never import or run target code. Keep missing Python, parse failures, size limits and changed source explicit. Extract top-level function, direct class method and module-body syntax, arguments/returns, loops, comprehension axes/filters, calls, and supported literal file I/O. Correlate exact path expressions only as possible products: a matching filename is not compatible saved state, a table schema, or verified reuse.

Pre-run findings cover repeated literal read sites and nested-loop fan-out. Each includes source hashes/locations, affected calculation, confidence, impact rationale, safe review action, correctness tradeoff and required runtime validation. No actual job/remaining-pair/elapsed-time/savings figures are invented. AB/BA directionality remains intact. Cache/decorator/lazy/restart names are reported as unverified cues, never proof that repetition is fixed or that a new cache is needed.

Keep the full free map/evidence/goal/basic-brief contract. The deeper inspector remains an accessible Guide development preview, with no invented paid enforcement. Current check records can replace superseded records once the new observation supports the same scope. Evidence history, lineage and comparison are not deliverables; only current source support and honest scope matter.

## Follow-up order

1. Inspect a user-provided current Frankie source checkout and entry points without running its workflow; distinguish already-solved optimizations from open questions.
2. Add exact call/argument/path resolution and checkpoint identity/guard analysis before suggesting reuse.
3. Support workload dimensions with actual original/eligible/completed/remaining job counters, separately from directional pair comparisons.
4. Add scientifically valid partial table coverage, then optional user-authorized runtime measurements.

The roadmap's October audit figures (161 GB, 99 layers, 32/6 GB indexes) are context, not current production measurements. No Frankie production command, dataset/checkpoint write, AWS access, deployment or remote merge is authorized by this implementation slice.

## Implemented first slice and current status

BM-01, BM-02, BM-03, BM-04, BM-05 and BM-12 are now **Partial**. BM-09/BM-10 remain **Partial**; BM-06/BM-07/BM-08/BM-11 remain **Missing**. No full roadmap item is claimed Existing yet. BM-12 has synthetic regression coverage, not a real current Frankie repository audit.

- `src/python-analyzer.py`: isolated standard-library Python AST reader for module bodies/top-level functions/direct class methods, parameters, calls, returns, assignments, supported literal I/O, nested loops and comprehensions. Syntax is not a business-purpose explanation or observed execution. Python AST columns use one-based UTF-8 byte offsets.
- `src/workflow.js` and `src/scan.js`: existing scan integration, bounded optional parser, source-linked calculations, possible data products, evidence-linked warnings and explicit unknowns. The `workflow` record is included in the existing JSON/API/export snapshot, separately from the free evidence/gap contract.
- `public/app.js`: per-piece calculation/product review and project-wide mission-card pre-run report; expandable findings, correctness/validation guidance and captured-source navigation. Existing Guide/free navigation, basic briefs and proof states stay intact.
- `tests/fixtures/frankie-workflow.py`, `tests/workflow.test.js`, `tests/ui.test.js`: small non-executing synthetic regression pack. Tests cover possible shared preparation, 99-layer expansion, symbolic dimensions, arbitrary-precision potential iteration counts, distinct AB/BA calls, optimization cues, unknown checkpoint compatibility, false-positive suppression, stale source, parser availability/coverage limits, CLI/API/export and shared-client navigation/refresh.
- `.buildmap/project.json`: new files belong to the existing scanner and verification pieces; no competing engine or new paid entitlement system.

Validation: **119/119 Node tests pass on Node 24.19.0** with Python 3.12.14. **Eight scoped Chromium 154.0.8037.57 browser checks pass**, including project-wide review, escaped products and source navigation, 390px width, return to the free inventory, self-contained export without API/assets/polling, live source refresh and visible parse failure. No page errors. The browser driver is `.buildmap/workflow-browser-check.mjs`; Playwright is separately provisioned, not a product dependency. Example rerun:

```bash
npm test
BUILDMAP_PLAYWRIGHT_MODULE=/absolute/path/to/playwright-core/index.mjs node .buildmap/workflow-browser-check.mjs
```

Node 20, the earlier full 30-case browser suite, physical devices, exhaustive accessibility and real Frankie source have not been revalidated in this slice. Current synthetic browser checks do not renew the old whole-MVP end-to-end scope claim. No user project, production dataset/checkpoint, remote branch, PR or deployment was changed.

Resume from `/workspace/BuildMap-frankie` on `private/frankie-inspector-risk-20261021`. Fetch/reconcile any newer audit work before integration; do not push this branch to the public repository if privacy is required. No evidence-history subsystem is needed. Next useful step is read-only analysis of the current Frankie source, then grounded workload counters and compatible checkpoint/reuse analysis.

Current `.buildmap/evidence.json` replaces the superseded component records with the actual 119-test checks and the scoped eight-case browser observation. Obsolete whole-outcome/completion claims are removed; that broader scope stays pending until observed again. No evidence archive or lineage record is added.

The current one-day Frankie audit is waiting for the recent source branch. October 6 and October 14 checkouts are not used as current-run evidence. Generic class-method/comprehension/scoped-review support is built and tested; no current Frankie findings or workflow verdict is issued from those older sources.

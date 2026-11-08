# Adaptive locality implementation status — isolated branch

Branch: `feat/adaptive-locality-engine-20261108`.
Intent: build in isolation; **do not connect to Frankie, AWS, BuildMap runtime, or production**. No merge or deployment authorized.

## Implemented in branch
- Typed event, feature and metric contracts; explicit exclusion of identifier-like metric columns; exact weighted Euclidean distance.
- Real Gaussian localization kernel; stable normalized soft weights; conservative family filtering.
- Finite Cauchy window and cross-window drift diagnostics (no infinite convergence claim).
- Historical-only bounded k-neighbor adaptive bandwidth and hysteresis; low-support abstention.
- Stable exclusion-radius center packing, proposal, retirement and constrained restoration; no scientific job suppression.
- Hash-linked in-memory decision ledger; exact-identity comparison eligibility checks and AB/BA distinction.
- Graph weighted flux residual and optional graph finite-volume explicit stepping with cell volumes and conservation checks; not proof of continuum Neumann correctness.
- No-clobber atomic local checkpoint publication and source/contract-bound verification.
- In-memory backpressured shadow ready-group queue, identity-aware idempotency and snapshot recovery.
- Comparable-scope workload counter structure and always-manual promotion verdict.
- Offline shadow-only JSON CLI and unsigned BuildMap-oriented export; explicit zero eliminated jobs.
- Opt-in standalone HTML scientific viewer and replay probes (`visualization.py`, `review_cli.py`) based on Slayer architectural patterns, no Slayer source code and no native BuildMap integration.
- Four standard-library test files and isolated GitHub Actions workflow for Python 3.11–3.13.

## Standalone extensions (November 8, 2026)
- `contracts.py`: explicit source/schema/version/unit calibration, historical-only reference and missingness refusal.
- `index.py`: deterministic grid with exact metric recheck and high-dimension fallback. `disk_index.py`: source-bound persistent streaming grid candidate lookup with exact verification and reversible retire/restore.
- `durable_queue.py`: local SQLite transactional shadow scheduler with capacity/backpressure, expiring and fenced lease tokens, retry and idempotent completion. No external execution or distributed effect safety.
- `result_cache.py`: immutable fully keyed offline research artifacts with torn/stale rejection; no automatic reuse to suppress science.
- `boundary_validation.py`: graph-domain stability bound, energy and conservation tests, not continuum Neumann applicability.
- `grouping.py`: chronological same-family, same-direction reversible display-only grouping and alias ledger. Does not average, flatten or remove observations.
- `outliers.py`: transactional full-original event and lineage retention, investigation statuses, hash-linked audit history. Outliers may be set aside **only from grouping**, never removed from scientific evidence or work. They are research subjects, not noise by default.
- `benchmark.py`: bounded reproducible synthetic-only exact-differential and CPU comparison harness, not real market evidence.
- New independent index/queue/recovery/numeric/outlier/benchmark tests in `tests/test_adaptive_locality_independent.py`, `tests/test_adaptive_locality_numeric_disk.py` and `tests/test_adaptive_locality_review_policy.py`.
- CI success at `d23b6bd8715982257369f4d9f2ef45e4702b8472`, Python 3.11, 3.12 and 3.13, following corrected display-alias-chain test. No production validation.
- Expanded truthful gate report: `docs/ADAPTIVE_LOCALITY_STANDALONE_ACCEPTANCE_20261108.md`.

## Not complete; keep isolated
- Production feature extraction from Frankie's actual 99-plane schema, immutable order/event lineage and frozen normalization.
- High-scale ANN, incremental center evolution and real center split/merge with scientific preservation.
- Full mathematical convergence guarantees: impossible to infer from finite samples without assumptions.
- Real geometric boundary normals, validated flux PDE model, discretization consistency and robust time-step stability.
- Real calculation exactness proof, side-effect checks, cache/FFT equivalence and permitted approximation policies.
- Local transactional SQLite shadow queue now exists; distributed side-effect fencing, multi-host recovery and cloud deployment do not.
- Optional native BuildMap import remains unimplemented. Existing offline viewer is a BuildMap-adjacent prototype, not wired to the app. Signed source-bound collector and production evidence review also remain pending.
- Real-day benchmark, performance/accuracy results, cost gates, randomized multi-day validation and rollout.
- Broader independent bounded differential and fault/reopen tests exist; exhaustive adversarial load, actual-market benchmark, signed evidence, external review and release acceptance remain unsupported.

## Next independent engineering steps
1. Expand deterministic property tests (metric/packing, chunk/replay, NaN/missing, long drift and adversarial identities).
2. Implement source-agnostic domain contracts, calibration and versioned evidence manifests; abstain on missing data.
3. Add safe deterministic incremental index and immutable group lineage/split/merge proposals.
4. Add durable on-disk queue with transactional leases, expiry/retry and fault-injection tests, still disconnected.
5. Add PDE benchmark harness, stability checks and error bounds.
6. Build mock adapter protocol and contract tests with no real imports or live service calls.
7. Add performance harness and reporting with synthetic *tests only*, never as market validation.
8. Verify all CI/test receipts and audit unsupported areas before any request for integration.

No change to Frankie, Search, AWS, production calculations, 30-day ingestion or BuildMap runtime. This document is a truthful status ledger, not a completion receipt.

## Cross-repository research pending
The user recalled a novel five-step coupling technique in `DavisAI1974/Basic_equations`. This is a research lead, not yet confirmed as a particular five-step contract. Review and independent comparison are required before borrowing a coupling method; do not import scientific findings or assume they prove Adaptive Locality equivalence.

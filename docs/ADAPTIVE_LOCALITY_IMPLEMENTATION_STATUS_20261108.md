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

## Not complete; keep isolated
- Production feature extraction from Frankie's actual 99-plane schema, immutable order/event lineage and frozen normalization.
- High-scale ANN, incremental center evolution and real center split/merge with scientific preservation.
- Full mathematical convergence guarantees: impossible to infer from finite samples without assumptions.
- Real geometric boundary normals, validated flux PDE model, discretization consistency and robust time-step stability.
- Real calculation exactness proof, side-effect checks, cache/FFT equivalence and permitted approximation policies.
- Persistent transactional scheduler, multi-host recovery, durable work queue, cloud deployment.
- Optional native BuildMap import remains unimplemented. Existing offline viewer is a BuildMap-adjacent prototype, not wired to the app. Signed source-bound collector and production evidence review also remain pending.
- Real-day benchmark, performance/accuracy results, cost gates, randomized multi-day validation and rollout.
- Thorough fuzz/property/stress tests, CI verification for latest commit, packaging and release acceptance.

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

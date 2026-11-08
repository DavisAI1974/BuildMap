# Adaptive locality engine — isolated research implementation

This directory implements a **deterministic, conservative Python standard-library research core** on a separate GitHub branch. It is not wired to Frankie, AWS, Search, BuildMap's signed collector, or a production scheduler.

## Available today
- Immutable event and source identities; explicit feature contracts; identifier exclusion from metric features.
- Exact weighted Euclidean distances and real Gaussian localization kernels.
- Finite-window Cauchy *diagnostics*, not a mathematical proof of convergence.
- Family-aware deterministic centers, bounded candidate retrieval, normalized soft memberships.
- Rejected stale/contradictory decisions and an in-memory hash-linked audit ledger.
- Strict exact-receipt scientific eligibility checks, preserving AB/BA directionality.
- Experimental graph weighted-flux residual (not a general Neumann boundary-condition solver).
- Offline shadow-only adapter, JSON CLI and BuildMap-oriented **unsigned** research export.
- Unit tests with no market-data dependencies.

## Run
```sh
python -m unittest discover -s tests -p test_adaptive_locality.py -v
python -m adaptive_locality.cli example.json --output proposals.json
```
The CLI refuses to overwrite an existing output file. It does not execute scientific jobs.

Example input:
```json
{
  "manifest":{"run_id":"test","day":"20231018","source_identity":"demo","planes":["example-plane"]},
  "metric":{"features":["imbalance","spread"],"scales":[1,1],"weights":[1,1],"version":"v1"},
  "config":{"radius":0.5,"bandwidth":0.25},
  "events":[
    {"event_id":"e1","family":"P","features":{"imbalance":0.1,"spread":1},"event_clock":1,"provenance":"demo"},
    {"event_id":"e2","family":"P","features":{"imbalance":0.2,"spread":1},"event_clock":2,"provenance":"demo"}
  ]
}
```

## Deliberately unfinished and blocked on Frankie source
1. Real 99-plane feature mapping, source hashes, frozen calibration and causal time admissibility.
2. High-cardinality ANN index, bounded memory streaming, stable center migration and adaptive density/bandwidth.
3. Real event/order-book conservation, family policy and directional equivalence proofs.
4. Durable atomic checkpoint, idempotent queue and multi-host scheduler.
5. Valid PDE domain geometry/flux stencil if Neumann conditions are scientifically applicable.
6. Source-bound signed BuildMap collector integration and real workload/cache/I/O counters.
7. Controlled real-day shadow comparison, accuracy/performance acceptance, rollback and production deployment.

**Do not use grouping similarity to eliminate any scientific calculations.** The shadow adapter reports exactly zero eliminated jobs. Read the architecture plan in docs/ADAPTIVE_LOCALITY_ARCHITECTURE_BUILD_PLAN_20261108.md.

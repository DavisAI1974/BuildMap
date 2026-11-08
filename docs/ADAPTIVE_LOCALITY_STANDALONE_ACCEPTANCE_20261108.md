# Adaptive Locality — standalone engineering and scientific acceptance ledger

Updated: November 8, 2026. Branch `feat/adaptive-locality-engine-20261108`.
**All components remain research-only and isolated. No Frankie, AWS, Search or BuildMap runtime wiring.**

## Non-negotiable preservation rules

1. Every admitted observation retains its exact original event ID, order ID, member ID, provenance, event/causal clock, direction, behavioral family and all input feature values. No averaging, smoothing, flattening, or representative substitution.
2. Outliers are **not discarded**. They can be set aside only from an experimental grouping proposal, with an explicit review reason and full original data durably retained. Review statuses: `AWAITING_REVIEW`, `UNDER_REVIEW`, `RETAIN_SEPARATE`, `RELEASE_SHADOW_GROUPING`. A review action does **not** delete evidence, or authorize job suppression or implicit scientific equivalence.
3. An outlier is a potential scientific finding, not statistical noise by default. Preserve exact values and clocks even if the observation is a short-lived or isolated excursion; compare its causal neighbors and direction rather than treating distance as a sufficient explanation.
4. No scientific calculation is eliminated by proximity, aliasing, cache identity, or review status. Job-elimination claims remain exactly zero in all shadow exports. Real science must continue on the preserved event stream after separately authorized integration.
5. Never silently cross family or AB/BA direction. The experimental grouping module defaults to strict family, direction, historical-clock compatibility; unresolved causal relationships require independent domain validation.

## Components added in isolated commits

| Module | Behavior | Limits |
| --- | --- | --- |
| `contracts.py` | Source/schema/version/frozen-unit calibration, historical cutoff, missing-feature abstention | Training and actual 99-plane mapping not implemented |
| `index.py` | Deterministic grid candidate pruning and exact metric recheck, high-dimensional scan fallback, center retirement/reversal | Memory-held centers; adversarial dense cells may still produce large scans |
| `disk_index.py` | SQLite streaming exact-verification query, bounded result count, persistent stable center identity, retire/restore, source contract | Disk may grow with all distinct centers; adversarial dense cells may still be slow |
| `durable_queue.py` | SQLite WAL transactional shadow lease, expiry/retry, idempotent submit, completion identity, multi-process SQLite locking | No distributed side-effect fencing; not a production scheduler or multi-host service |
| `result_cache.py` | Complete source/input/metric/policy/code/family/direction/type keyed no-clobber exact artifact store | Cache hits do not prove science equivalence; no scientific jobs suppressed |
| `boundary_validation.py` | Monotone explicit graph stability precondition, discrete mass balance and graph-energy diagnostics | No continuum Neumann geometry/normal or model validation |
| `grouping.py` | Reversible shadow labels and aliases with immutable per-event lineage and ledger; no grouping for set-aside outliers | State held in process memory; not a production calculation planner |
| `outliers.py` | Source-bound SQLite full-original event retention, reasoned review states, audit history, integrity verification | Not a replacement for a complete raw event archive; only explicitly flagged events are recorded |
| `benchmark.py` | Reproducible CPU synthetic differential benchmark against exact baseline | Numbers are host-specific; no market-scale performance conclusions |

## Verified and not verified

The first implementation commit `01d3256e550f` passed isolated GitHub Actions across Python 3.11/3.12/3.13. The later implementation commit `0eff85e37ccc` also passed isolated CI on all three versions. Additional commits require their own CI receipts.

The tests use synthetic, bounded examples only. Their success establishes local API behavior, not mathematical convergence over infinite sequences, real Neumann boundary applicability, exact equivalence of scientific jobs, 99-plane completeness, distributed execution, or real-market performance.

## Standalone acceptance gates

| Gate | Condition for acceptance | Current conclusion |
| --- | --- | --- |
| Source isolation | No Frankie/AWS/Search/BuildMap live changes | PASS, based on changed isolated paths |
| No silent evidence loss | Outlier original data, direction and IDs recoverable | PASS for tested local registry, not verified on actual science inputs |
| Numeric stability | Extreme values fail closed and finite metric distance is checked | Limited synthetic tests |
| Candidate completeness | Accelerated queries equal exact brute-force results | Limited synthetic differential tests |
| Recovery | Local SQLite queue lease expiry, retries and reopen | Limited synthetic tests |
| Scientific equivalence | Independently proved exact outcomes and no side effects | NOT VERIFIED; never eliminate jobs |
| PDE validity | Physical geometry, normals, consistency and boundary model | NOT VERIFIED; continuum Neumann disabled |
| Multi-host recovery | Distributed fencing/side-effect safety | NOT IMPLEMENTED |
| Real science | Native market data, 99-plane lineage, 30-day replay | NOT VERIFIED |
| Release | External scientific review and authorization | NOT AUTHORIZED |

## Usage

```sh
python -m unittest discover -s tests -p 'test_adaptive_locality*.py' -v
python -m compileall -q adaptive_locality
python -m adaptive_locality.benchmark
```

The offline benchmark is synthetic and deliberately bounded; outputs cannot be used to claim real search runtime gains. No new network services are required.

## Integration decision

Keep the branch in draft. Do not merge or deploy. Do not change BuildMap's native UI or Frankie source. An optional read-only BuildMap import and any integration require a separate explicit authorization after independent scientific review.

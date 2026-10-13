# BuildMap v0.1 review and improvement pass

Reviewed PR #1 from `1ee8314a130cc1b8db36399757c84400b286f1a9`, including `GPT6_REVIEW_HANDOFF.md`, the manifest/evidence, source, and tests. No framework or npm runtime dependency was introduced.

## Findings and changes

| Finding | Result |
| --- | --- |
| Planned dependencies granted `connected` without source wiring. | Declared and observed edges are separate; declarations no longer promote state. |
| Manifest status, status-only receipts, and receipts for missing code could hide unsupported claims. | Upper states require a descriptive evidence record and complete implementation. Rejected claims remain inspectable and become gaps. |
| Evidence had no freshness model; ordinary source edits could leave the fingerprint unchanged. | Optional full-piece SHA-256 binding rejects stale receipts. Content hashes refresh the snapshot even without graph changes. Unbound claims disclose unknown freshness. |
| HTML/CSS were excluded, making the dogfood visualizer appear missing beneath its computing claim. | Assets and explicit declared files count as implementation. HTML/CSS relationships are discovered within documented limits. The unsupported visualizer computing claim was removed. |
| Python relative imports were handled as JS paths; JS comments/string examples could create false edges. | Separate heuristic source discovery handles Python packages/relative imports, JS lexical exclusions/re-exports, and TypeScript emitted `.js` names. |
| Code and planned arrows used opposite directions and “feeds” language implied runtime flow. | All dependency arrows run dependency → dependent; observed edges retain importer/imported provenance. Runtime flow is not claimed. |
| Missing wiring and unsupported assumptions were buried in the graph. | Prioritized clickable gaps, piece warnings, declared/observed inspector sections, and `/api/gaps` expose them directly. |
| An arbitrary percentage was labeled “System proof,” and the mission inherited upper states. | It is now an explicitly documented evidence index; the mission remains an unproved intent target. |
| CLI flags before a path could turn a port into the target directory. | Strict option parsing, one-shot `--json`, temporary-clone cleanup, and runtime API tests. |
| Fit merely scrolled; refresh errors and removed selections were easy to miss. | Fit scales; actual-size restores; selection persists or clears; refresh errors display a stale-snapshot warning. |
| README described capabilities beyond the verified build. | Rewritten around current behavior, explicit limitations, trust/freshness semantics, and the still-unmerged quick start. |

## Validation

- Baseline: 7 tests passed; local HTTP map, health, HTML, and JS smoke passed before changes.
- First-pass suite: 25 tests, covering model semantics, discovery, CLI/API, live edits, and real client logic against a DOM double.
- JS syntax checks and `git diff --check` passed; package dry-run inspected.
- Public URL clone/JSON smoke succeeded with `octocat/Hello-World`, recovered `README` intent, and removed its temporary clone on exit. BuildMap's default branch was also cloned; it currently contains no app code.
- Dogfood manifest includes the new import-discovery module and all test files. Test receipts are bound to the corresponding final source hashes. No piece is marked live.

**Browser layout/integration remains unverified.** The installed Playwright package has no local browser executable, and the available cloud browser returned `ERR_CONNECTION_REFUSED` for the workspace's loopback server. The DOM harness checks rendering logic, escaping, provenance, selection, filtering, scaling intent, and refresh behavior; it cannot establish visual layout or actual browser/server integration. The visualizer therefore stays at its source-discovered state.

## Remaining product work

1. Exercise the UI in a browser against a real project, including narrow screens and a larger map. Only then record a source-bound visualizer observation.
2. Add parser-backed language resolution before treating missing source wiring as stronger than a review prompt. HTTP relationships, TypeScript aliases, Python `src` layouts, and other languages remain outside current support.
3. Add authenticated CI/runtime/deployment receipts. Current evidence is manually recorded; source identity is not proof authenticity or deployment liveness.
4. Add capability/subsystem navigation when real repository size justifies it. The current bounded dependency layering tolerates cycles but is not a full graph-layout engine.

The next useful dogfood gap remains the server-to-visualizer HTTP connection. It is intentionally shown as declared but unobserved rather than “fixed” by treating the declaration as code evidence.

## Continuation from c14340b

The next pass adds two practical capabilities while preserving the same state contract:

- **Portable HTML snapshots:** `--html OUTPUT` embeds the current map and real UI assets into one interactive file. It labels the capture time, makes no HTTP requests or polling calls, preserves all evidence states, safely encodes project descriptions, and refuses to overwrite an existing file. Exported metadata includes local paths and evidence notes, not full source.
- **Git-aware brownfield inventory:** Git ignore rules and negation apply to untracked files; tracked source remains visible even in normally excluded directories. Mapping a subtree excludes siblings and deleted tracked files. Explicit manifest files can override ignores. Git fsmonitor hooks are disabled, filesystem fallback is reported, and project-root symlink aliases retain containment.

Current validation: **32 tests pass on Node v24.19.0**. The new checks cover HTML safety/round-trip data, CLI export and overwrite refusal, request-free offline rendering, Git ignore behavior, tracked source, subtree boundaries, fsmonitor-hook avoidance, and root aliases. Syntax and whitespace checks pass. Dogfood receipts were refreshed only after the checks completed.

An attempted browser review of the exported file was rejected by the browser URL security policy, which permits only HTTP(S), while the cloud browser still cannot reach the workspace's loopback server. No alternate route around that rejection was attempted. Browser layout and actual browser/server integration therefore remain unverified, and the visualizer retains no upper evidence claim.

## Continuation from 3825faa

The map now detects both directions of declared-versus-observed architecture drift. A manifest piece with explicit `dependsOn` reports incoming source dependencies outside its plan, with file provenance; an omitted dependency list stays unspecified. An explicit empty list is a meaningful no-dependency plan. These findings do not alter proof states or mutate the manifest.

Evidence-target accounting now prevents silent losses. Unknown/deleted targets become project findings with their raw claims. File receipts inside a manifest component are retained and assessed in its inspector but never grant component-level proof. Invalid collection shapes and falsy receipts are visible, and ordinary object-prototype names cannot be mistaken for evidence records. Project findings open the mission inspector; raw records are escaped for display and snapshot export.

Current validation: **40 tests pass on Node v24.19.0**, including drift with preserved proof states, unspecified versus empty intent, unmapped claims, file-only scope, malformed/falsy records, prototype-named ids, and inspector rendering/escaping. Browser layout and integration remain pending under the already documented environment restrictions. No upper visualizer state was added.

## Continuation from 705ff1f

GitHub URL mode now accepts `--ref BRANCH_OR_TAG`. It validates ref syntax before creating a clone, rejects ref selection for local paths, and reports the requested/selected ref and exact cloned commit in `project.source`. The UI explicitly labels GitHub source as a snapshot. Repo names come from the URL when no manifest name exists. No new evidence state follows from clone provenance.

Validation: **44 tests pass on Node v24.19.0**. Branch and tag selection, exact revision identity, missing-ref cleanup, local-path refusal, provenance-only state behavior, and UI metadata are covered. A real public branch/JSON smoke mapped the five-component BuildMap PR branch at `705ff1f3a523297e7c96474252bebb3ffc6e0a3f` and removed its temporary clone. Syntax and whitespace checks pass.

The remaining work is recorded in [BUILD_GAPS.md](BUILD_GAPS.md). Browser verification and a run on the advertised minimum Node 20 runtime remain release-confidence checks. Broader parsers, receipt provenance/freshness, scale/navigation, and deeper intent/mechanism modeling remain product improvements. These categories have separate completion criteria.

## Continuation from a2330cc

The ownership audit found that a later overlapping component silently lost its shared implementation file. A receipt could then verify only the reduced set. Declarations and hashes now retain the full scope on both pieces; an ownership blocker rejects their component claims until the overlap is resolved. Ambiguous files cannot be arbitrarily assigned to cross-piece source edges or a file receipt. File claims remain inspectable as project findings. Unique-file wiring still works, and reversing component order does not choose an owner.

Two discovery corrections remove misleading source states: a computed JS import/require argument no longer resolves its initial string as a complete path, and root-relative HTML/CSS assets resolve with query/fragment suffixes. Discovery remains heuristic and does not claim that references execute.

Filtered cards now leave the tab sequence and accessibility tree. Selecting a gap reveals its piece while retaining the search, and the inspector marks ownership-conflicted files. These behaviors were checked through the existing DOM double; real browser layout/accessibility/integration remains unverified under the documented restrictions.

Validation: **48/48 tests pass on Node v20.20.2 and v24.19.0**. The four new regression tests cover full overlapping proof scope, ambiguous wiring/file receipts and resolution, computed import arguments, asset URL suffixes, and filtered-card navigation/selection. A separate Node 20 dogfood smoke exercised CLI JSON output, CLI server startup, map/gaps/health APIs, all three assets, and clean SIGTERM exit. Source syntax and whitespace checks pass. The minimum-runtime release check is complete for Node 20.20.2; browser checks remain pending. Relevant source-bound receipts were refreshed after the tests; the visualizer still has no upper-state receipt. PR #1 remains open, with no deployment/live claim.

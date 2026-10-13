# BuildMap v0.1 review and improvement pass

Reviewed PR #1 from `1ee8314a130cc1b8db36399757c84400b286f1a9`, including `GPT6_REVIEW_HANDOFF.md`, the manifest/evidence, source, and tests. The initial pass introduced no framework or npm runtime dependency; the later parser pass below adds Acorn.

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


## Continuation from 87692a1

Optional `inputHashes` extends recorded receipts to explicitly selected dependency, test, data, or configuration files. Previously, changes outside a piece's own implementation could leave its receipt accepted. Now changed or unavailable selected inputs reject the receipt, name the affected files, and change the snapshot fingerprint even if those inputs are outside source discovery. Hashing stays inside the mapped root, is cached per scan, and grants no source relationships or implementation state.

The inspector exposes recorded/current input hashes and limited coverage for both component and file-only claims. Malformed bindings cannot grant proof. Existing receipts retain their semantics; input-only bindings still disclose unknown implementation freshness. Source identity, explicit input identity, receipt authenticity, complete dependency coverage, and runtime/deployment liveness remain separate.

Validation: **53/53 tests pass on Node v20.20.2 and v24.19.0**. Five regression tests cover input edits/deletion/restoration, unchanged receipt compatibility, source-binding and descriptive-evidence requirements, malformed/unsafe/outside-root inputs, file-only scope, and escaped inspector output. The existing HTTP test now verifies input-only edits reaching `/api/map` and `/api/gaps`. A Node 20 CLI smoke against a temporary copy of BuildMap showed that one selected configuration edit invalidated all four receipts; the original checkout stayed unchanged. Syntax and whitespace checks pass. Dogfood receipts now bind selected dependencies/checks/configuration after successful tests; the visualizer still has no computing/verified/live claim. Browser restrictions remain in effect, and PR #1 stays open without deployment.


## Continuation from b43600a

JavaScript (`.js`, `.mjs`, `.cjs`) now uses Acorn syntax trees for import/re-export discovery. This excludes regex/comment/string examples, handles escaped literals and actual imports in template expressions, and reports parse failures rather than falling back to misleading source matches. TypeScript/JSX retain their lexical adapter. Acorn is pinned as the sole runtime dependency; `npm ci`, the lockfile, and installation documentation replace the former dependency-free setup.

The bounded HTTP adapter matches literal root-relative global fetch calls to a unique supported inline Node `http.createServer` response-related path condition. It retains endpoint/method and both source locations; mock factories, logging-only branches, negative comparisons, method mismatches, and ambiguous providers cannot grant a match. Dynamic routing, other frameworks, broad method guards, and deployed origin/port association remain outside support. These are explicitly labeled heuristic source path matches, not observations of execution.

BuildMap now finds its own `/api/map` server-to-visualizer match, so the no-observed-connection and unobserved-dependency prompts close within supported discovery. The visualizer's only finding remains behavior-unproved. No computing/verified/live receipt was added to it.

Validation: **58/58 tests pass on Node v20.20.2 and v24.19.0**. Five new regressions cover method/query/path/location provenance and source-only states, missing/ambiguous providers and input-bound freshness, syntax/regex/template/shadowed-call handling, unsupported/mock/logging/negative handler forms, and escaped HTTP inspector metadata. Clean locked installation, syntax/whitespace checks, and package dry-run pass. Refreshed dogfood receipts bind the complete scanner implementation plus selected dependency/check/package-lock inputs. Browser restrictions remain unchanged; PR #1 remains open and nothing is deployed/live.


## MVP file visibility from 14412b4

The shared product client now previews two implementation paths per card, reports present/missing and additional-file counts, and shows the full list in the inspector. Discovered-file inspection explains explicit grouping; an empty planned component is no longer mislabeled as a mission node. Card spacing is adjusted for the inventory preview. The live app and standalone export use the same code, so this is retained product work.

Validation: **60/60 tests pass on Node v20.20.2 and v24.19.0**. New checks cover escaped paths, partial/empty/mission file scope, and real scanner snapshots fed into the client through file creation, explicit grouping, deletion, and selected-inspector refresh. These checks use the DOM double, not real browser layout verification. Receipts were refreshed only for the relevant recorded test checks; the visualizer stays source-connected with no upper-state receipt. PR #1 remains open and nothing is deployed/live.


## MVP navigation from 023ddb3

Search previously dimmed unmatched cards without helping a user reach distant results, and gap selection did not scroll to its card. The shared live/export client now lists clickable search results, reports the total and no-match state, searches every assigned file path, and expands beyond the initial twelve matches on request. Enter locates the first result; Escape clears the search. Result and gap selection use current scaled geometry to reveal and focus the card. Redraws retain keyboard focus on surviving cards/results, return it to search when its target disappears, and leave existing search focus alone. Card/result selection is also exposed through `aria-pressed`.

Validation: **63/63 tests pass on Node v20.20.2 and v24.19.0**. Three focused regressions exercise safe result text, searching a third assigned file, expansion and live result removal, offline operation without requests, distant-card navigation at actual size and fit scale, and focus continuity/fallback. These are DOM-double interaction checks; real browser scrolling, layout, and accessibility remain unverified under the documented restrictions. Syntax and whitespace checks pass. The source/evidence contract is unchanged, the visualizer has no upper-state receipt, and PR #1 stays open without deployment/live claims.


## Outcome walkthroughs from cd8e3a4

The owner-approved product direction connects the build to intended outcomes and shows where demonstrated behavior stops. Optional manifest outcomes declare a goal, ordered steps with expected results, and supporting pieces. A separate outcome receipt carries a named example, per-step input/output and explicit handoff descriptions, complete participating/supporting source hashes, and a hash of the normalized outcome definition. Plan/source/selected-input changes reject previous examples. Partial/failed/invalid records and unmapped targets remain inspectable. Piece verification does not grant outcome proof, and outcome proof does not grant piece or mission proof or alter the evidence index. No outcome live state is supported.

The shared client adds outcome selection, participating-piece highlights, ordered examples, first unresolved-point feedback, piece inspection/return links, and declared scope information. Unassigned pieces become informational review findings, not conclusions that code is unnecessary. This uses existing source, APIs, and export assets. BuildMap declares its own goal; its browser step and whole outcome remain unproved.

Validation: **71/71 tests pass on Node v20.20.2 and v24.19.0**. Six focused tests cover plan/source separation, actual execution and I/O recording in authored fixtures, full source/support/plan/input freshness, partial/failed/missing-handoff/invalid receipts, ownership/missing/orphan scope, and safe export round trips. Two shared-client tests cover escaped samples, outcome-to-piece navigation, highlighting through search, refresh/staleness/removal, and offline operation; the existing HTTP check covers plan edits and outcome gap ids. Syntax/whitespace checks pass. Client checks remain DOM-double observations, not browser layout/accessibility/integration proof. No browser workaround, deployment, or live claim was made; PR #1 stays open.

Current authoring is through manifest/evidence files. Examples and handoff descriptions remain user-recorded claims; there is no automatic instrumentation, semantic comparison with expected-result prose, or receipt authentication. A named example does not prove every input. Those boundaries are explicit in the README.

A read-only Node v24.19.0 dogfood observation recovered intent, scanned the repo, started a temporary local server, and fetched `/api/map`. Its fingerprint and selected fields matched the direct scan. The receipt records selected values for those three steps and leaves browser inspection absent; the walkthrough remains unproved with `inspect` as its first unresolved point. The server was closed. This records a partial example, not a complete trace, runtime instrumentation, or browser proof.

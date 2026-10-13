# BuildMap v0.1 — next-chat handoff

Repository: `DavisAI1974/BuildMap`

PR: https://github.com/DavisAI1974/BuildMap/pull/1

Branch: `feat/buildmap-v1-living-map`

Continuation base: `b43600ab8d920ed4a872c9e8f7405456839bd353`. The parser/HTTP-source pass follows this commit; use the current branch head, not the continuation base.

**Fetch the current branch head first and preserve anything newer; do not reset to the historical checkpoint.** This file is updated alongside the latest review corrections and validation.

## Active request and boundaries

Continue the BuildMap v0.1 review/improvement pass. Use the repository and tests as the source of truth. Make focused, high-leverage improvements, preserve the evidence-state contract, and keep README/evidence honest. The user also asked for the remaining build gaps; the maintained list is `BUILD_GAPS.md`.

PR #1 stays open. The default branch does not contain the app yet. No merge, deployment, npm publication, or live claim was performed. Do not treat the remaining product roadmap as a requirement to build every future feature before v0.1 can be reviewed.

## Read first

1. `NEXT_CHAT_HANDOFF.md`
2. `BUILD_GAPS.md`
3. `README.md`
4. `REVIEW_NOTES.md`
5. `.buildmap/project.json` and `.buildmap/evidence.json`
6. Source and tests relevant to the next change.

`GPT6_REVIEW_HANDOFF.md` preserves the original product intent; its historical test counts, progress claims, and initial implementation descriptions have been superseded by the current files.

## Current MVP direction

The user wants a usable MVP and insists work carries into the final build. Improve the existing product source, rather than building a parallel prototype. Cards now preview two file paths, show present/missing counts and additional-file counts, and open the full inspector list. Discovered files remain independent pieces until explicitly grouped in the manifest. Tests exercise actual scan-to-client creation, grouping, deletion, and selection refresh. The live app and standalone exports share the same client.

A captured MVP was shown in conversation and saved as BuildMap_MVP.html outside the repository. It is a snapshot, not a hosted/deployed/live product. Browser limitations still apply. The wider roadmap is not required before using the core MVP.

## What landed

- Source existence, observed connectivity, and explicit proof claims are separate. Declared dependencies never grant connected status; bare manifest statuses and status-only receipts never grant upper states.
- Optional `inputHashes` binds selected dependency/test/data/config files without adding source pieces or edges. Changed/missing/unsafe/malformed inputs reject receipts and update fingerprints; the inspector/API exposes recorded/current inputs and reasons. Existing receipts keep their semantics; inputs cannot replace source binding or descriptive evidence.
- Partial implementation stays visible. Source-bound receipts become stale on implementation changes; unbound claims disclose unknown freshness. The mission is an unproved intent target.
- Acorn-parsed JavaScript imports/re-exports, lexical TypeScript/JSX discovery, Python packages/relative imports, HTML/CSS relationships, explicit assets/configuration, and visible scan limitations.
- Consistent dependency-to-dependent arrows with file provenance; declared-vs-observed wiring is distinct.
- Explicit dependency plans are compared in both directions. Omitted `dependsOn` is unspecified; `[]` declares no cross-piece dependencies. Drift findings do not change proof states.
- Unmapped, malformed, and falsy evidence records are visible. File-only claims in manifest components remain assessed/inspectable without granting component proof. Project findings open the mission inspector.
- Clickable prioritized gaps, inspector, real fit scaling, actual-size restoration, selection preservation/removal, safe display, and stale-refresh feedback.
- Git-aware inventory respects ignores while preserving tracked source, keeps subtree boundaries, disables fsmonitor hooks, and supports root aliases with containment.
- Read-only `/api/map`, `/api/gaps`, `/api/health`; one-shot `--json` and safe self-contained HTML `--html OUTPUT` exports.
- GitHub branch/tag targeting with `--ref`, exact clone revision metadata in `project.source`, explicit snapshot labeling, clone cleanup, and rejection of local ref selection. No evidence state is granted by provenance.
- Overlapping declarations retain every implementation file/hash, reject component proof until ownership is resolved, and keep ambiguous file claims inspectable without choosing a wiring owner.
- Computed JS import paths no longer create literal-prefix connections; HTML/CSS root asset URLs resolve query/fragment suffixes. Filtered cards leave keyboard navigation, gap selection reveals its piece, and the inspector marks ownership conflicts.
- A bounded parser-backed Node HTTP/global fetch adapter matches unique literal paths with endpoint/method/source locations. Ambiguous or unsupported paths stay unresolved. Source matches compare against dependency plans but never grant upper states or prove deployed origin/transport/execution.
- README, review notes, gap report, and dogfood receipts updated. Node 20+ remains supported, with one pinned runtime parser dependency: Acorn. Run `npm ci` after checkout; the lockfile is committed.

## Current validation and proof state

- **60/60 tests passed on Node v20.20.2 (`node --test`) and v24.19.0 (`npm test`).**
- Node 20 copied-dogfood CLI smoke showed that a selected `package.json` edit invalidates all four receipts without changing their implementation; current selected input bindings match.
- Node 20 dogfood CLI JSON/server smoke passed: five mapped components, API/assets, matching CLI/API fingerprints, no live claims, clean SIGTERM exit.
- JS syntax and whitespace checks passed.
- Local HTTP/API/assets and live source edits covered by tests.
- Public default-clone smoke with `octocat/Hello-World` recovered README intent and cleaned up.
- Real branch/JSON smoke cloned BuildMap's PR branch at `705ff1f3a523297e7c96474252bebb3ffc6e0a3f`, mapped its five components, reported that exact revision, and cleaned up.
- Offline fixture checks cover branch and tag selection, failed-ref cleanup, HTML export safety/overwrite refusal, and client live/offline logic through a DOM double.
- Dogfood map: **four verified components from current source-bound recorded receipts with selected dependency/test-input bindings, one source-connected visualizer, no live states, no missing implementation, no unexpected plan dependencies, no unmapped evidence, one HTTP source reference, and only the visualizer behavior-unproved finding**.

Do not call DOM-double tests browser verification. Receipts are manually recorded claims; source hashes bind each piece's implementation and optional input hashes bind only explicitly selected dependency/test/data/config files. Complete transitive input coverage, environment identity, and continuing deployment liveness are not established.

## Remaining gaps in priority order

### Release-confidence checks

1. Real browser end-to-end: live server, exported snapshot, narrow screens, representative larger map, selection/gaps/search/fit/keyboard, source edits, and failure/recovery. Record only what is actually observed.

Completed release check: the full suite and CLI/server smoke passed on Node 20.20.2. No additional runtime check is currently pending.

### Broader product work

2. Wider wiring discovery: HTTP wrappers/frameworks/dynamic routing/origin association, TypeScript/JSX parsers and aliases, Python src layouts, and other languages. Basic JS parsing and literal Node-HTTP/fetch path matching are implemented.
3. Complete/automatic dependency/test-input coverage and independent CI/runtime/deployment receipt provenance. Explicit selected-input freshness is implemented.
4. Large-repo performance and capability/subsystem navigation. Full scans/hashes and all-node rendering are current limitations.
5. Deeper attributed intent recovery, contradiction review/interviews, and source-derived mechanism explanations.

Git arrival animation, continuous remote refresh, all five conceptual zoom levels, and automated deployment/publication are deferred extensions. See `BUILD_GAPS.md` for completion criteria.

## Current browser limitation

The installed Playwright package has no local browser executable. The available cloud browser returned `ERR_CONNECTION_REFUSED` for the workspace server. Its URL security policy also rejected local HTML-file navigation and expressly prohibited workarounds around that rejection. No workaround was attempted. Use a permitted browser environment for the outstanding observation; do not retry the blocked action or claim success from the DOM harness. The visualizer has no computing/verified/live receipt.

The only current graph finding is the visualizer behavior-unproved gap. Its declared server dependency now has an observed heuristic HTTP source path match with locations; this is not runtime/browser proof.

## Resume commands

If a checkout is already available, inspect its status before switching or fetching. Otherwise clone and select the feature branch:

```bash
git clone https://github.com/DavisAI1974/BuildMap.git
cd BuildMap
git fetch origin feat/buildmap-v1-living-map
git switch feat/buildmap-v1-living-map
git log --oneline -4
git status --short
npm ci
npm test
node src/cli.js . --json
```

Local server:

```bash
node src/cli.js .
```

Remote branch snapshot (uses the current public branch; does not follow later pushes):

```bash
node src/cli.js https://github.com/DavisAI1974/BuildMap --ref feat/buildmap-v1-living-map --json
```

Offline map:

```bash
node src/cli.js . --html ../buildmap.html
```

The output must be a new file; put it outside the mapped repo.

## Publication mechanics in this environment

Shell clones/fetches work, but shell push failed because GitHub username credentials are unavailable. The connected GitHub API successfully published tested trees in focused commits and updated the branch with an expected-head lease and `force:false`. Published tree hashes were compared against the tested local tree. Do not repeatedly try unauthenticated shell push or force-overwrite newer work; use the connector when needed and verify the final PR head.

The current checkout is `/workspace/scratch/89392d8bfad0/BuildMap`; scratch may not persist into the next chat, so Git is authoritative. Equivalent local commits were preserved in `review/local-*` backup branches before aligning to API-created commits. There are no active subagents and no intentional smoke server left running. Temporary JSON/HTML review files are reproducible intermediates, not remaining deliverables.

Refresh receipts only after relevant checks pass. Avoid framework churn and gratuitous tests/validators. Keep commentary brief and continue within the user's authorized scope.

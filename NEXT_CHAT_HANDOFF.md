# BuildMap v0.1 — next-chat handoff

Repository: `DavisAI1974/BuildMap`

PR: https://github.com/DavisAI1974/BuildMap/pull/1

Branch: `feat/buildmap-v1-living-map`

Last functional checkpoint: `885109f19dac14a41d4b7a1ac5843c15a7c83b3b`.

This handoff is committed after that functional checkpoint. **Fetch the current branch head first and preserve anything newer; do not reset to the historical checkpoint.** The user requested a new-chat checkpoint because the conversation was slowing down. Feature work stopped at this boundary.

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

## What landed

- Source existence, observed connectivity, and explicit proof claims are separate. Declared dependencies never grant connected status; bare manifest statuses and status-only receipts never grant upper states.
- Partial implementation stays visible. Source-bound receipts become stale on implementation changes; unbound claims disclose unknown freshness. The mission is an unproved intent target.
- JS/TS lexical import/re-export discovery, Python packages/relative imports, HTML/CSS relationships, explicit assets/configuration, and visible scan limitations.
- Consistent dependency-to-dependent arrows with file provenance; declared-vs-observed wiring is distinct.
- Explicit dependency plans are compared in both directions. Omitted `dependsOn` is unspecified; `[]` declares no cross-piece dependencies. Drift findings do not change proof states.
- Unmapped, malformed, and falsy evidence records are visible. File-only claims in manifest components remain assessed/inspectable without granting component proof. Project findings open the mission inspector.
- Clickable prioritized gaps, inspector, real fit scaling, actual-size restoration, selection preservation/removal, safe display, and stale-refresh feedback.
- Git-aware inventory respects ignores while preserving tracked source, keeps subtree boundaries, disables fsmonitor hooks, and supports root aliases with containment.
- Read-only `/api/map`, `/api/gaps`, `/api/health`; one-shot `--json` and safe self-contained HTML `--html OUTPUT` exports.
- GitHub branch/tag targeting with `--ref`, exact clone revision metadata in `project.source`, explicit snapshot labeling, clone cleanup, and rejection of local ref selection. No evidence state is granted by provenance.
- README, review notes, gap report, and dogfood receipts updated. Runtime remains dependency-free on Node 20+; tests currently ran on Node 24.

## Current validation and proof state

- `npm test`: **44/44 passed on Node v24.19.0**.
- JS syntax and whitespace checks passed.
- Local HTTP/API/assets and live source edits covered by tests.
- Public default-clone smoke with `octocat/Hello-World` recovered README intent and cleaned up.
- Real branch/JSON smoke cloned BuildMap's PR branch at `705ff1f3a523297e7c96474252bebb3ffc6e0a3f`, mapped its five components, reported that exact revision, and cleaned up.
- Offline fixture checks cover branch and tag selection, failed-ref cleanup, HTML export safety/overwrite refusal, and client live/offline logic through a DOM double.
- Dogfood map: **four verified components from current source-bound recorded receipts, one source-connected visualizer, no live states, no missing implementation, no unexpected plan dependencies, no unmapped evidence**.

Do not call DOM-double tests browser verification. Receipts are manually recorded claims; source hashes bind each piece's implementation only, not transitive dependencies, test inputs, environment, or continuing deployment liveness.

## Remaining gaps in priority order

### Release-confidence checks

1. Real browser end-to-end: live server, exported snapshot, narrow screens, representative larger map, selection/gaps/search/fit/keyboard, source edits, and failure/recovery. Record only what is actually observed.
2. Run the existing suite plus CLI/server smoke on the advertised minimum Node 20 runtime. Current execution evidence is Node 24.

### Broader product work

3. Parser-backed/wider wiring discovery: HTTP, TypeScript aliases, Python src layouts, regex/template corner cases, other languages.
4. Dependency/test-input freshness and independent CI/runtime/deployment receipt provenance.
5. Large-repo performance and capability/subsystem navigation. Full scans/hashes and all-node rendering are current limitations.
6. Deeper attributed intent recovery, contradiction review/interviews, and source-derived mechanism explanations.

Git arrival animation, continuous remote refresh, all five conceptual zoom levels, and automated deployment/publication are deferred extensions. See `BUILD_GAPS.md` for completion criteria.

## Current browser limitation

The installed Playwright package has no local browser executable. The available cloud browser returned `ERR_CONNECTION_REFUSED` for the workspace server. Its URL security policy also rejected local HTML-file navigation and expressly prohibited workarounds around that rejection. No workaround was attempted. Use a permitted browser environment for the outstanding observation; do not retry the blocked action or claim success from the DOM harness. The visualizer has no computing/verified/live receipt.

The three current graph findings all concern the visualizer: no observed cross-piece connection, declared server dependency unobserved, and behavior unproved. HTTP serving is implemented; the first two findings are a discovery limitation rather than evidence that the runtime connection is missing.

## Resume commands

If a checkout is already available, inspect its status before switching or fetching. Otherwise clone and select the feature branch:

```bash
git clone https://github.com/DavisAI1974/BuildMap.git
cd BuildMap
git fetch origin feat/buildmap-v1-living-map
git switch feat/buildmap-v1-living-map
git log --oneline -4
git status --short
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

The original checkout was `/workspace/scratch/ef2e17966c5d/BuildMap`; scratch may not persist into the next chat, so Git is authoritative. Equivalent local commits were preserved in `review/local-*` backup branches before aligning to API-created commits. There are no active subagents and no intentional smoke server left running. Temporary JSON/HTML review files are reproducible intermediates, not remaining deliverables.

Refresh receipts only after relevant checks pass. Avoid framework churn and gratuitous tests/validators. Keep commentary brief and continue within the user's authorized scope.

# BuildMap

**A living map of software being built: what each piece does, what exists, what is connected, what has evidence, and what is missing next.**

BuildMap watches a repository by rescanning it every time its browser client polls. Planned pieces appear before their implementation exists. Source references add observed connections. Recorded observations and checks can advance a piece beyond source existence. A gap list keeps missing implementation, unobserved wiring, and unsupported claims in view.

The core contract is **existence, connection, computation, verification, and live use are different things**. BuildMap borrows the spatial language of workflow maps; it is a software map, not a workflow editor.

## Quick start

Requires Node.js 20+ and no npm dependencies. Git is required for GitHub URL input and Git-inventory tests. Local mapping falls back to filesystem discovery when Git is unavailable.

v0.1 is currently on [PR #1](https://github.com/DavisAI1974/BuildMap/pull/1); the default branch does not contain the app yet.

```bash
git clone https://github.com/DavisAI1974/BuildMap.git
cd BuildMap
git switch feat/buildmap-v1-living-map
npm test
node src/cli.js .
```

Open **http://127.0.0.1:4173**. Click a piece or a gap to inspect its files, purpose, contribution, connections, evidence assessment, and source hashes. Search includes names, paths, states, and gap descriptions. **Fit map** scales the full map into the viewport; **Actual size** restores readable cards and scrolling.

Point it at another project, choose a port, or get a one-shot snapshot:

```bash
node src/cli.js ../some-project
node src/cli.js --port 5000 ../some-project
node src/cli.js ../some-project --json
node src/cli.js ../some-project --html ../buildmap.html
node src/cli.js --help
```

A nonexistent local target becomes an empty project folder. Mapping otherwise reads the project without modifying it. The HTTP server binds to loopback by default and exposes map metadata, including local paths and recorded evidence; choose a broader `--host` only when you intend that information to be accessible.

Public GitHub repository URLs are also supported:

```bash
node src/cli.js https://github.com/owner/repository
node src/cli.js https://github.com/owner/repository --ref feature/map
```

This makes a shallow clone of the **default branch**, or the branch/tag named by `--ref`, into a temporary folder. `--ref` accepts branch/tag names, including names with slashes; raw commit SHAs and GitHub `/tree/` URL paths are not supported. It applies only to GitHub URL input and never checks out a local working tree. It is a read-only snapshot, not a live view of later GitHub pushes. Restart to fetch a new snapshot. Temporary clones are removed on normal exit, Ctrl+C, or SIGTERM; force-killing the process can leave one behind. Repository URLs with branch paths, queries, or fragments are not supported. For private repositories or commit-level local checkout, clone with your usual credentials, check out the revision locally, and pass its path. GitHub snapshots report their URL, selected ref, and cloned commit in `project.source` and the UI; this metadata does not grant evidence states or deployment proof.

The review exercised public clone/JSON mode against `octocat/Hello-World`, recovered its README intent, and confirmed cleanup. A branch-specific smoke also cloned BuildMap’s PR branch at `705ff1f3a523297e7c96474252bebb3ffc6e0a3f`, mapped its five components, reported the exact revision, and confirmed cleanup. Offline fixture tests cover both branch and tag selection and cleanup after a missing ref. Local HTTP serving and live source edits are covered by tests. Browser integration and visual layout remain pending: the available browser could not reach the workspace server. Client rendering/refresh logic has a DOM harness; that is not a browser test. The browser also blocks local HTML-file navigation, so the snapshot export has not been visually verified here.

## Share an interactive snapshot

```bash
node src/cli.js ../some-project --html ../buildmap.html
```

Open the single HTML file in a browser to inspect the captured map, select gaps, search pieces, and fit the map without running a server or fetching external assets. The same client renders both live maps and exports. The header shows **snapshot** and the capture time; exports do not poll, watch source changes, or grant new evidence states.

Exports contain map metadata, file paths, the mapped root, and recorded evidence notes, rather than full repository source. The output must be a new file in an existing directory; existing files are never overwritten. Put it outside the mapped project to keep generated HTML from becoming another discovered piece. `--html` and `--json` are separate one-shot modes.

## Start from what exists

Greenfield can begin with a manifest, README, both, or neither. Planned pieces can exist before any code. Missing intent does not block mapping.

Brownfield uses this intent ladder:

1. Explicit mission in `.buildmap/project.json`.
2. First usable prose in README, architecture/design docs, or `SPEC.md`.
3. Discovered implementation and source relationships.
4. Comparison of declared dependencies with observed connections.

Intent is labeled **declared**, **inferred**, or **unknown**. README extraction is a heuristic, not a semantic understanding of the repository. A gap recommends documenting intent or interviewing the owner when it is missing. There is no built-in interview agent in v0.1.

## Evidence states

| State | Meaning in the current snapshot | Basis |
| --- | --- | --- |
| `planned` | Some or all declared implementation is missing, or no files are declared. | Manifest and current file inventory. |
| `coded` | All implementation files exist. | Current file inventory. |
| `connected` | Complete implementation has at least one resolved source reference, including internal references. | Heuristic source discovery. |
| `computing` | Useful work has been observed. | Explicit evidence record. |
| `verified` | A behavior check has been recorded as passing. | Explicit evidence record. |
| `live` | Active use in a deployed/runtime system has been recorded. | Explicit evidence record. |

**Declaring a dependency draws a dashed line; it does not earn `connected`.** A manifest `status` is descriptive only and cannot grant proof. A receipt cannot hide missing implementation. Partial pieces stay `planned`, with present and missing files listed separately.

Each piece exposes `baseStatus` independently of its evidence-driven `status`. A tested standalone piece may be `verified` while its source state remains `coded`. The gap list still flags missing cross-piece connections, even for pieces with upper evidence states.

Within one snapshot, weaker receipts cannot downgrade source-discovered state. Across snapshots, deletion or changed source can invalidate earlier claims. The mission card is an **intent target**, not an inferred verified/live outcome.

### Recording evidence

`.buildmap/evidence.json` accepts component ids and discovered file paths:

```json
{
  "components": {
    "queue-engine": {
      "status": "verified",
      "command": "npm test -- queue-engine",
      "note": "FIFO behavior and edge cases passed."
    }
  },
  "files": {
    "src/worker.js": {
      "status": "computing",
      "note": "Observed processing an input and emitting the expected output."
    }
  }
}
```

Evidence targets use the exact ids and file paths reported by the map. Unknown/deleted targets and malformed collections become visible project findings rather than disappearing. Click a project finding to inspect its raw recorded claim on the mission card.

A file receipt grants a state only to a discovered file piece. If the file belongs to a manifest component, its receipt is retained as an assessed **file-only claim** in that component's inspector; it cannot verify the behavior of the whole component. Use a component-level receipt for that claim. Missing or stale file-only claims remain visible too.

Upper states require a recognized status plus a nonempty `note`, `command`, or `proof`. **These are user-recorded claims. BuildMap does not run commands, authenticate receipts, or prove that a named command passed.** Do not grant `verified` merely because a test file exists, or `live` merely because a deploy script exists.

For freshness, add an optional `sourceHashes` object containing the current SHA-256 of **every implementation file in that piece**. Copy the entire object from `/api/map`, `--json`, or the piece inspector after the observation/check passes:

```json
{
  "status": "verified",
  "command": "npm test -- queue-engine",
  "note": "Check passed against the recorded source.",
  "sourceHashes": {
    "src/queue.js": "<actual 64-character SHA-256 from the map>"
  }
}
```

The placeholder is illustrative and will not match real source. A mismatch, missing hash, extra bound file, or missing implementation rejects the claim for the current snapshot. Unbound receipts remain supported but display **freshness unknown**. Matching hashes establish source identity only; they do not authenticate the observation, track transitive dependencies, or establish that a deployment is still running.

### Evidence index

The header's **Evidence index** is a weighted summary of piece states: planned 0, coded 20, connected 45, computing 65, verified 85, live 100, averaged across mapped pieces. It is **not** percentage complete, test coverage, a probability of correctness, or mission proof. The mission card is excluded. Undocumented future requirements are absent from the denominator, so even an index of 100 cannot prove completeness.

## Describing pieces

A minimal `.buildmap/project.json`:

```json
{
  "name": "Order Intelligence",
  "mission": "Understand the current order queue before making a decision.",
  "components": [
    {
      "id": "feed",
      "name": "Market feed",
      "files": ["src/feed.ts"],
      "purpose": "Read incoming exchange events.",
      "contributes": "Gives the system raw events to reconstruct.",
      "visual": { "kind": "flow", "label": "Ingest" }
    },
    {
      "id": "fifo",
      "name": "FIFO queue",
      "files": ["src/fifo.ts"],
      "dependsOn": ["feed"],
      "purpose": "Reconstruct queue position and volume ahead.",
      "contributes": "Shows how much liquidity is in front of an order.",
      "visual": { "kind": "queue", "label": "Reconstruct" }
    }
  ]
}
```

Files are exact project-relative paths, not glob patterns. `file` is accepted for a single path; leading `./` and duplicate paths are normalized. Explicitly declared assets/configuration also count as implementation. A file belongs to one component: overlapping assignments and duplicate/reserved ids produce diagnostics. `__mission__` and the `file:` prefix are reserved. Component descriptions must be strings, and `dependsOn` must be an array of piece ids. Omitting `dependsOn` leaves dependency intent unspecified. An explicit empty array declares that the piece should have no cross-piece dependencies.

Mini-visuals include `flow`, `scanner`, `graph`, `proof`, `lens`, `goal`, `gate`, and `queue`; unknown kinds use a simple arrow. They are illustrative mechanisms chosen by the manifest or inferred from filenames, not execution traces or behavior extracted from a program. The inspector labels that distinction.

## Connections and gaps

Solid arrows run **dependency → dependent**. For a source import, the inspector shows the importer and imported file. Dashed arrows are declared dependencies; a matching source connection replaces their dashed rendering while both records remain available in the API. Green lines indicate a declared contribution to the mission. None of these lines establishes runtime data flow.

When a manifest piece explicitly supplies `dependsOn`, BuildMap also compares its incoming observed dependencies with that plan. An observed dependency outside the list becomes an **unexpected-dependency** review gap, with importer/imported provenance. Edges expose `planStatus` (`matched`, `undeclared`, or `unspecified`) and the inspector labels connections outside the plan. Omitting the list does not invent a zero-dependency requirement. Drift findings do not rewrite the plan or change proof states.

The prioritized gap list includes:

- missing or partial implementation;
- rejected or stale evidence claims;
- unknown dependency ids, declared dependencies with no observed match, and observed dependencies outside an explicit plan;
- pieces without cross-piece source connections;
- existing pieces with no computation/verification evidence;
- unbound receipts, unmapped targets, file-only claims inside components, malformed configuration, unresolved relative JS/TS references, and scan limitations.

A missing source connection is a **review prompt**, not proof of dead code. Entry points, HTTP calls, dependency injection, generated code, and unsupported languages can be connected at runtime without visible imports. BuildMap deliberately shows its own server-to-browser dependency as unobserved because its HTTP wiring is outside import discovery.

### Discovery scope

The scanner inventories common source extensions, HTML/CSS, Dockerfiles, Makefiles, and explicitly declared files.

In a Git worktree, it uses Git's tracked/non-ignored inventory, including nested ignore rules and negation. Tracked source is retained even under normally excluded build/dependency directories. Default dependency/build/cache exclusions apply to untracked files. Mapping a subfolder stays inside that subtree, and deleted tracked files do not establish implementation. Repository fsmonitor hooks are disabled during inventory.

Outside Git, or when Git is unavailable, filesystem discovery skips default dependency/build/cache directories and hidden directories; it does not interpret `.gitignore`. Git failures other than a non-repository or absent executable produce a fallback diagnostic. The API reports `scan.inventoryMode` as `git` or `filesystem`.

Neither mode inspects binaries or follows directory symlinks; Git inventory does not recurse into submodules. Explicit manifest files may override ignores and can include configuration/assets, but cannot establish implementation outside the mapped root. A symlink alias for the project root is supported.

Relationship discovery is heuristic:

| Source | Relationships discovered |
| --- | --- |
| JavaScript/TypeScript | Local static imports, literal `require`/dynamic imports, re-exports, extensionless and index modules, `.js` references to `.ts`/`.tsx` sources. Comments and ordinary string examples are skipped. |
| Python | Repository-root modules, packages, sibling/parent relative imports, named submodules. |
| HTML | Local script/link references; leading `/` is interpreted relative to the project root. |
| CSS | Quoted `@import` references. |
| Other inventoried languages | Files only; no relationship parser yet. |

JS regular-expression literals, template interpolation, import shadowing, TypeScript aliases, Python `src` layouts and multiline import forms, bundler resolution, and HTML server-root conventions are not fully modeled. Dependency discovery above 1 MB is skipped with a diagnostic; the file stays in the inventory. Syntax presence does not prove a reference executes. Changes to scanned file contents change the fingerprint even when the graph stays the same.

## Agent/API access

No database, bundler, framework, or third-party runtime dependencies are required.

| Interface | Output |
| --- | --- |
| `GET /api/map` | Project, states, nodes, edges with provenance, gaps, diagnostics, scan scope, hashes, fingerprint, timestamp. |
| `GET /api/gaps` | Project summary, prioritized gaps, diagnostics, fingerprint, timestamp. |
| `GET /api/health` | Server availability and mapped root; not a scan/proof check. |
| `node src/cli.js PATH --json` | Full map snapshot to stdout, then exit. |
| `node src/cli.js PATH --html OUTPUT` | Self-contained interactive HTML snapshot to a new file, then exit. |

Gap records contain `id`, `kind`, `nodeId` (or null), `message`, and `priority` (`blocker`, `warning`, `info`). Drift gaps also carry `dependencyId` and source `observations`; evidence diagnostics can carry the original `evidence` record. GitHub maps expose origin/ref/revision metadata in `project.source`; local maps report local source mode. Nodes expose `dependencyIntent` and, when applicable, assessed `fileEvidence` entries. They are evidence-based prompts for the builder, not instructions to execute. APIs are read-only and do not expose arbitrary repository files as static downloads.

## Architecture and validation

Intent recovery (`src/intent.js`), Git/filesystem inventory, and source discovery (`src/imports.js`) feed the snapshot/evidence/gap model (`src/scan.js`). The CLI selects a target; the local server exposes snapshots and serves `public/`. The live browser client polls `/api/map` every 1.6 seconds, redraws on fingerprint changes, preserves selection, and displays a stale-snapshot warning when refresh fails. `src/export.js` embeds the captured map and those same assets into one HTML file; snapshot mode performs no requests or polling.

```bash
npm test
```

Tests cover intent fallback, planned/partial implementation, declared versus observed wiring, explicit evidence and freshness, unmapped/file-only claims, explicit-plan drift, imports/assets, Git ignores/tracked files/subtrees, malformed config, path containment, CLI arguments/JSON mode, branch/tag selection and clone provenance, HTML export safety and overwrite refusal, HTTP endpoints/live edits, and live/offline client rendering/selection/filtering/refresh through a DOM double. They do not replace browser layout or deployment verification. See [REVIEW_NOTES.md](REVIEW_NOTES.md) for review findings and [BUILD_GAPS.md](BUILD_GAPS.md) for the current remaining work, with release checks separated from later capabilities.

BuildMap dogfoods its own manifest and source-bound test receipts. Its visualizer has no computing/verified/live claim until an actual browser observation supports one. Future work should improve language parsers, runtime/CI receipts, and capability-level navigation before adding decoration.

## License

MIT

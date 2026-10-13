# BuildMap

**A living visual map of what your software is, what each piece does, what is actually connected, and how close you are to the finished system.**

BuildMap is not a static architecture diagrammer. It watches the real repository and turns software construction into a visible machine: planned pieces can exist before their files do, new files light up as they are created, connections appear when code is wired together, and higher proof states only appear when evidence exists.

The goal is simple: make it hard to confuse **"we created the file"** with **"the system actually uses it."**

## What v0.1 proves

BuildMap can already:

- start from a **greenfield** folder, even if it is nearly empty;
- start from a **brownfield** repository and map what is already there;
- accept a local path, with an optional public GitHub repository URL mode when network access is available;
- recover project intent from `.buildmap/project.json`, README, architecture/design docs, or `SPEC.md`;
- continue when intent is missing and clearly mark that an interview would help;
- render planned components as ghosted pieces before the implementation exists;
- discover code files and relative JavaScript/TypeScript/Python relationships;
- distinguish `planned → coded → connected → computing → verified → live`;
- refuse to infer the higher three states from file existence alone;
- show a small visual mechanism on every piece so the map explains function, not just topology;
- refresh continuously while files are being added or changed;
- explain how a piece contributes to the final mission.

BuildMap **dogfoods itself**: this repository contains a `.buildmap/project.json`, so when you point BuildMap at BuildMap you can watch its own pieces and proof states.

## Quick start

Requires Node.js 20+ and no npm dependencies.

```bash
git clone https://github.com/DavisAI1974/BuildMap.git
cd BuildMap
node src/cli.js .
```

Then open:

```text
http://127.0.0.1:4173
```

You can also point it at another local project:

```bash
node src/cli.js ../some-project
```

Or a public GitHub repository:

```bash
node src/cli.js https://github.com/owner/repository
```

BuildMap performs a shallow clone into a temporary folder and maps it read-only. For a private repository in v0.1, clone it normally with your existing Git credentials and pass the local path.

> **Verification note:** local-folder mode is runtime-smoke-tested in v0.1. The build sandbox used for this release blocks outbound DNS, so the public GitHub URL clone path could not be exercised end-to-end here. The path is included, but BuildMap does not claim it as verified evidence yet.

## Greenfield vs. brownfield

The modes share one rule: **start with whatever evidence exists; do not require ceremony before the map can begin.**

### Greenfield

BuildMap can start with any of these:

1. a README describing what you want to build;
2. a `.buildmap/project.json` describing planned pieces;
3. both;
4. neither — start coding and let BuildMap discover reality first, then add intent later or use an interview process.

A planned component can exist on the map before its file exists. That gives you the "ghosted puzzle" view: the intended machine is visible from day one and illuminates as implementation lands.

### Brownfield

BuildMap follows an intent ladder instead of immediately interrogating the owner:

1. read `.buildmap/project.json` if one exists;
2. read README and obvious architecture/design/spec docs;
3. map the actual repository and code relationships;
4. compare stated intent with code reality;
5. interview only where intent is missing, ambiguous, or contradictory.

That keeps adoption lightweight and lets old repositories become useful immediately.

## The proof-state model

A visual map becomes misleading if every existing file is painted green. BuildMap therefore uses monotonic evidence states:

| State | Meaning | Can BuildMap infer it automatically? |
| --- | --- | --- |
| `planned` | The piece is intended but implementation is missing. | Yes, from the manifest. |
| `coded` | The implementation file exists. | Yes. |
| `connected` | Code or a declared dependency connects the piece to another piece. | Yes. |
| `computing` | The piece has been observed doing useful work. | **No — evidence required.** |
| `verified` | A test/check proves the intended behavior. | **No — evidence required.** |
| `live` | The piece is proven active in the real deployed/runtime system. | **No — evidence required.** |

BuildMap never lets weaker evidence downgrade a stronger discovered state.

Explicit evidence lives in `.buildmap/evidence.json`:

```json
{
  "components": {
    "queue-engine": {
      "status": "verified",
      "command": "npm test -- queue-engine",
      "note": "FIFO behavior and edge cases pass."
    }
  }
}
```

This is intentionally boring in v0.1. Later versions can ingest CI receipts, runtime traces, deployment metadata, coverage, and domain-specific proofs directly.

## Describing planned pieces

A minimal `.buildmap/project.json`:

```json
{
  "name": "Order Intelligence",
  "mission": "Understand the true state of the order queue before making a decision.",
  "components": [
    {
      "id": "feed",
      "name": "Market feed",
      "files": ["src/feed.ts"],
      "purpose": "Normalize incoming exchange events.",
      "contributes": "Gives the rest of the system trustworthy raw events.",
      "visual": { "kind": "flow", "label": "Ingest" }
    },
    {
      "id": "fifo",
      "name": "FIFO queue",
      "files": ["src/fifo.ts"],
      "dependsOn": ["feed"],
      "purpose": "Reconstruct queue position and volume ahead.",
      "contributes": "Shows how much liquidity is really in front of an order.",
      "visual": { "kind": "queue", "label": "Reconstruct" }
    }
  ]
}
```

Supported v0.1 mini-visuals include `flow`, `scanner`, `graph`, `proof`, `lens`, `goal`, `gate`, and `queue`. Unknown values fall back to a simple transformation arrow.

## How the map is different from a workflow diagram

Workflow tools generally draw static objects and arrows. BuildMap borrows only the spatial language.

A BuildMap piece carries four separate ideas:

**Reality** — does the implementation actually exist?

**Connectivity** — does it participate in the software graph?

**Function** — what does this piece do, shown both in words and a small visual mechanism?

**Contribution** — why does this piece make the project closer to the intended outcome?

That lets the map answer a much more useful question than "what talk to what?":

> **What did this file buy us, is it really part of the machine yet, and what gap remains between here and the goal?**

## Current architecture

v0.1 deliberately stays small and dependency-free:

```text
README / docs / .buildmap manifest
              │
              ▼
      intent recovery
              │
              ▼
      repository scanner ──── imports / planned dependencies
              │
              ▼
       proof-state model
              │
              ▼
       local HTTP server
              │
              ▼
      interactive SVG/HTML map
              │
              ▼
          project mission
```

There is no database, bundler, React dependency, or diagramming framework yet. That is deliberate: v0.1 exists to prove the BuildMap idea, not a frontend stack.

## Tests

```bash
npm test
```

The current suite verifies the critical v0.1 promises: planned pieces appear before files, code wiring advances pieces to connected, explicit evidence can advance but not downgrade state, README intent is usable in brownfield mode, and missing intent does not block the map.

## Where this should go next

The strongest next steps are not more decoration. They are deeper truth:

- richer dependency discovery across more languages;
- Git history so a piece can visually "arrive" with its commit;
- CI/test receipts that automatically earn `verified`;
- runtime/deployment evidence that can earn `computing` and `live`;
- architecture-drift detection between planned and actual connections;
- interview-assisted intent recovery when README/docs are unclear;
- capability and subsystem zoom levels above individual files;
- optional agent hooks so coding agents can read BuildMap gaps before deciding what to build next.

That last item is central to the original motivation: BuildMap should not merely document a build. It should help keep the **builder** ultra-focused by making missing pieces, dead ends, and unsupported assumptions visually obvious while work is still happening.

## Project status

This is the first working proof of concept. Expect the data model and UI to evolve quickly. The important contract to preserve is the distinction between **existence**, **connection**, and **proof**.

## License

MIT

# Parked existing-piece refinement

Base: verified free-MVP commit `ed6cf32272982d938226270889fc98f50af3bafb` on PR #1.

This branch preserves an unfinished `--extend-piece` draft that was paused for the browser and completion work. It is **not in the active MVP PR** and is not a finished or verified feature. Do not merge the branch wholesale or treat inherited MVP receipts as proof of these changed source files.

## Intended narrow change

An explicitly requested local interview selects one existing declared component and adds unassigned or planned exact file paths after review. Retain its id, original metadata and walkthrough references. Do not remove/move existing ownership, rename pieces, rewrite goals, create source, execute code, or invent evidence. New source scope should invalidate earlier bound piece/outcome/completion checks normally.

The draft changes only `src/cli.js`, `src/setup.js` and one expected CLI-options object in `tests/server.test.js`. It adds mode validation/help/routing, existing-piece selection, a replacement path through the guarded plan writer, selected-receipt concurrency checks, and refusal for ownership conflict or an unbound upper-state component claim.

## Remaining work

- Review the draft against the current completion/evidence contract before using it. Confirm normalized component selection maps safely to the original manifest entry, preserves all original fields/ids and cannot replace a different declaration.
- Add focused checks for actual CLI append to an existing piece, preservation of metadata/source/evidence/goals, no-op/cancellation/incomplete input, malformed or linked paths, ownership/direct-file goal references, unbound upper-state claims and concurrent plan/selected-receipt changes. Reuse the current authoring tests; avoid a broad editor or validator expansion.
- Check that scope expansion keeps file-only claims file-only and rejects old bound piece/outcome/completion records until the relevant observation is repeated.
- Finish README/help/gap-sheet wording only for implemented behavior. Run the appropriate Node 20/24 checks. Refresh receipts only after actual passing checks, then rerun the browser baseline and complete named MVP observation/review if this change is integrated.

Current checkpoint validation is limited to JS syntax and whitespace checks. Before it was paused, the existing 13 server tests passed; there are **no focused extension tests** and no current full-suite/browser observation for the extension. The active free-MVP branch independently retains its 92-test / 19-browser-check checkpoint and scoped MVP verified display.

Next chat may continue this one bounded free refinement after reading the active handoff and this draft. Keep the Guide code preview parked on its separate branch. Do not generate HTML previews unless asked, deploy, merge PR #1, or mark anything live.

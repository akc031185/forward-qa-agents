# Working rules for this repo

## Session protocol (mandatory)

1. **Start of every session:** read `PROGRESS.md` top entry first. That is the source of truth for
   where the work stands. Do not reconstruct state from git alone when the log exists.
2. **End of every session, or after any commit:** run `npm run progress` to stamp today's entry
   with measured numbers, then fill in **Done** (with times, commit hashes, run ids),
   **Decided**, and **Open / next**. Newest day stays on top. Never leave the placeholders blank.
3. If a session ends without the log updated, the next session's first job is to backfill it and
   mark the entry *reconstructed*.

## Verification

- `npm run typecheck` and `npm test` must pass before any commit. `LLM_PROVIDER=none` is the
  default and every deliverable must exist under it.

## Principles (from README)

- Deterministic first. Local open-weight models only. One agent, one folder, no cross-imports.
- No real client, product, or colleague names in code, fixtures, docs, or the progress log.

## Field guide sites

- One generated site per agent, one source. `npm run catalog:author` runs `_build/author/plates.mjs`
  (text, code slices, annotations) and `_build/author/diagrams.mjs` (inline SVG), writes
  `_build/sites/{fdt,sdet,audit}/content/*.json`, then builds into the sibling checkouts
  `../forward-deployed-tester`, `../sdet-architect` and `../ai-site-auditor` (GitHub Pages repos,
  output only; the audit site is not published yet). Prefer `block(file, startRe, endRe)` over
  line numbers for code slices so plates survive edits.
  Edit the two author files, never the JSON, never the HTML; then commit and push each site repo.
- The SDET Roadmap is a separate site: content in `_build/author/roadmap-data.mjs`, renderer
  `_build/author/roadmap.mjs`, output `../sdet-roadmap` via `npm run catalog:roadmap`. Every stage
  needs a goal, at most six steps, a deliverable, and gates of metric · target · how to measure.
  Targets are fixed bars or relative to the learner's own baseline; never a vendor's claimed result.
- Code blocks in a plate must be the repo's real code (sliced by line range, then annotated), and
  every number must come from a recorded run (`workspace/*/run.log`, the `runs` table) or the test
  output. No invented figures.
- Prose rule: anything over two lines is a bullet list of at most six items; the generator
  rejects longer lists.

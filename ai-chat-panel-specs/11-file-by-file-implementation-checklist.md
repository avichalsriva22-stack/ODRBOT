# 11 — File-by-File Implementation Checklist

Every file to create or modify, grouped by phase (doc 00 §Implementation
order). A coding agent should work top-to-bottom; each `[ ]` is a discrete,
independently testable unit of work. Paths are relative to repo root.

## Phase 1 — Plumbing

### New files
- [ ] `src/app/ai/models/ai-tool.model.ts` (doc 02 §1)
- [ ] `src/app/ai/models/ai-message.model.ts` (doc 02 §2)
- [ ] `src/app/ai/models/ai-settings.model.ts` (doc 02 §3)
- [ ] `src/app/ai/models/ai-feature-flag.ts` (doc 02 §4)
- [ ] `src/app/ai/models/ai-bridge.d.ts` (doc 07 §5)
- [ ] `src/app/ai/services/ai-transcript-store.service.ts` (doc 02 §5, stub/in-memory)
- [ ] `src/app/ai/services/ai-command.service.ts` (doc 04 §2)
- [ ] `src/app/ai/services/ai-settings.service.ts` (doc 07 §6)
- [ ] `src/app/ai/services/ai-llm-client.service.ts` (doc 06 §1)
- [ ] `src/app/ai/ai.module.ts` (empty shell for now, populated through later phases)
- [ ] `src/electron/anthropic-sse-parser.js` (doc 07 §3)

### Modified files
- [ ] `main.js` — add `safeStorage` key management + IPC handlers (doc 07 §2–3)
- [ ] `preload.js` — add `aiBridge` contextBridge export (doc 07 §4)
- [ ] `src/environments/environment.ts` — add `aiChatPanelEnabled: true`
- [ ] `src/environments/environment.prod.ts` — add `aiChatPanelEnabled: false`
- [ ] `package.json` — add `ajv` dependency if no JSON Schema validator already present (doc 09 §1; check first, don't duplicate)

### Acceptance criteria
- `AiSettingsService.setApiKey('test')` then app restart (in dev, via a
  manual test) → `hasApiKey()` returns true.
- No Angular component yet references any of the above — pure service layer,
  fully unit-testable per doc 10 §1.

## Phase 2 — Read-only context

### New files
- [ ] `src/app/ai/services/ai-context.service.ts` (doc 05)
- [ ] `src/app/ai/services/ai-tool-context-builder.service.ts` (doc 04 §3)

### Modified files
- [ ] `src/app/map/models/tv-road.model.ts` — add `getPredecessorRoadId()` /
      `getSuccessorRoadId()` helpers if not already present (doc 05 §5)

### Acceptance criteria
- Doc 10 §2's `ai-context.service.spec.ts` cases all pass against real map
  fixtures from `src/tests/maps/`.

## Phase 3 — Tier 1 tools

### New files (one pair `.ts` + `.spec.ts` each, under `src/app/ai/tools/`)
- [ ] `lane/set-lane-width.tool.ts`
- [ ] `lane/set-lane-height.tool.ts`
- [ ] `lane/set-lane-marking.tool.ts`
- [ ] `lane/add-lane.tool.ts`
- [ ] `lane/remove-lane.tool.ts`
- [ ] `road/set-road-speed.tool.ts`
- [ ] `road/set-road-type.tool.ts`
- [ ] `road/set-road-elevation.tool.ts`
- [ ] `road/set-road-super-elevation.tool.ts`
- [ ] `road/rename-object.tool.ts`
- [ ] `query/get-selected-object.tool.ts`
- [ ] `query/get-road-info.tool.ts`
- [ ] `query/list-roads.tool.ts`
- [ ] `query/list-junctions.tool.ts`
- [ ] `project/export-opendrive.tool.ts`
- [ ] `project/undo-last-action.tool.ts`
- [ ] `ai-tool-registry.service.ts` (doc 04 §1) — register all of the above

### New command files (only where doc 03 specifies "new command needed")
- [ ] `src/app/commands/set-lane-width-command.ts`
- [ ] `src/app/commands/set-lane-height-command.ts`
- [ ] `src/app/commands/set-lane-marking-command.ts`
- [ ] `src/app/commands/add-lane-command.ts`
- [ ] `src/app/commands/remove-lane-command.ts`
- [ ] `src/app/commands/set-road-elevation-command.ts`
- [ ] `src/app/commands/set-road-super-elevation-command.ts`
  (each: `.ts` + `.spec.ts`, following the exact pattern of existing
  `set-position-command.ts`/`.spec.ts` for style consistency)

### Acceptance criteria
- `ai-tool-registry.service.spec.ts` passes with exactly these 16 tools
  registered (query/project tools have no preconditions beyond existence
  checks, so they ship in this phase too, ahead of Tier 2/3, since they have
  zero dependency on the safety layer).
- Every new `*-command.ts` has undo/redo verified against a real `TvRoad`
  fixture (execute → assert new state → undo → assert exact original state,
  deep-equal, not just "field changed back").

## Phase 4 — LLM integration (headless)

### New files
- [ ] `src/app/ai/services/ai-conversation.service.ts` (doc 06 §3–4)
- [ ] `src/tests/ai/prompt-eval-cases.json` (doc 10 §4)
- [ ] `src/tests/ai/prompt-eval-runner.spec.ts` — scripted harness that loads
      `prompt-eval-cases.json`, calls a real (or recorded-cassette) API, and
      asserts expected tool names were called. Use recorded HTTP fixtures
      (e.g. `nock`-style interception, check `package.json`/devDependencies
      for an existing HTTP mocking lib before adding one) for CI runs so the
      suite doesn't require live API access on every CI run; a separate
      `npm run test:ai-live` script (added to `package.json`) runs the same
      file against the real API for pre-release manual verification only.

### Acceptance criteria
- All doc 10 §3 mocked-loop unit tests pass.
- Doc 10 §4's 25-case eval set run manually against real API; ≥ 90% of
  cases (23/25) produce the expected tool call(s) before shipping Phase 5.
  Any repeated failure mode gets a system-prompt wording fix (doc 06 §5),
  re-run until threshold met.

## Phase 5 — Chat panel UI

### New files
- [ ] `src/app/ai/ui/ai-chat-panel/ai-chat-panel.component.ts/.html/.scss` (+ `.spec.ts`)
- [ ] `src/app/ai/ui/ai-message-bubble/ai-message-bubble.component.ts/.html/.scss` (+ `.spec.ts`)
- [ ] `src/app/ai/ui/ai-tool-call-card/ai-tool-call-card.component.ts/.html/.scss` (+ `.spec.ts`)
- [ ] `src/app/ai/ui/ai-diff-preview/ai-diff-preview.component.ts/.html/.scss` (+ `.spec.ts`)
- [ ] `src/app/ai/ui/ai-settings-dialog/ai-settings-dialog.component.ts/.html/.scss` (+ `.spec.ts`)

### Modified files
- [ ] `src/app/ai/ai.module.ts` — fill in declarations/exports/imports now that all UI components exist
- [ ] `src/app/app.module.ts` (or wherever `EditorModule`/feature modules are
      imported — locate the actual root/editor module registration point and
      import `AiModule` there)
- [ ] `src/app/views/editor/editor.component.html` (doc 08 §1)
- [ ] `src/app/views/editor/editor.component.ts` — add `aiFeatureEnabled`,
      `aiPanelExpanded` fields
- [ ] `src/app/views/editor/menu-bar/menu-bar.component.html` +
      `menu-bar.component.ts` — add AI Assistant toggle button (doc 08 §1)

### Acceptance criteria
- Doc 10 §6 integration tests pass.
- Manual smoke: panel opens, empty state shows, typing + sending a
  Tier-1-only request round-trips end to end against a real dev API key.

## Phase 6 — Safety layer

### New files
- [ ] `src/app/ai/services/ai-preview.service.ts` (doc 09 §3)

### Modified files
- [ ] `ai-conversation.service.ts` — wire `runToolCall`'s preview branch
      (doc 06 §4) if stubbed in Phase 4
- [ ] Every Tier-1 tool file with `requiresPreview: true` (only `remove_lane`
      in Tier 1) — implement `preview()`
- [ ] `ai-tool-call-card.component.ts/.html` — wire Confirm/Cancel to
      `AiPreviewService.confirm/reject` (doc 08 §4, doc 09 §3)

### Acceptance criteria
- Doc 10 §3's preview-pause/confirm/reject test cases pass.
- Doc 10 §5 code-review checklist passes for everything shipped so far.

## Phase 7 — Tier 2/3 tools

### New files (tool + spec, under `src/app/ai/tools/`)
- [ ] `road/create-road.tool.ts`
- [ ] `road/extend-road-from-selected.tool.ts`
- [ ] `junction/create-roundabout.tool.ts`
- [ ] `junction/create-junction.tool.ts`
- [ ] `junction/add-crosswalk.tool.ts`
- [ ] `signal/add-traffic-signal.tool.ts`
- [ ] `signal/add-road-sign.tool.ts`
- [ ] `prop/add-prop-point.tool.ts`
- [ ] `prop/add-prop-curve.tool.ts`
- [ ] `prop/add-prop-polygon.tool.ts`
- [ ] `prop/add-prop-span.tool.ts`
- [ ] `marking/add-point-marking.tool.ts`
- [ ] `marking/add-text-marking.tool.ts`
- [ ] `terrain/edit-surface.tool.ts`

### New factory (required refactor, doc 03 Tier 2 `create_roundabout` note)
- [ ] `src/app/factories/road-circle.factory.ts` — extract pure
      `makeRoundabout(options)` from `RoadCircleTool`'s existing creation
      strategy; `RoadCircleTool` itself refactored to call this new factory
      instead of inlining the logic (both the manual tool and the AI tool
      must call the same code path — this is a refactor of existing code,
      not just an addition, and needs its own regression pass on the manual
      Road Circle Tool to confirm no behavior change)

### New commands (as needed per doc 03 Tier 2/3 "command mapping" notes)
- [ ] `src/app/commands/link-roads-command.ts` (only if `RoadLinkManager`
      doesn't already expose an undoable operation — check first)
- [ ] `src/app/commands/add-crosswalk-command.ts` (only if `CrosswalkTool`'s
      output isn't already `AddObjectCommand`-compatible)
- [ ] `src/app/utils/maths.ts` — add `Maths.isSimplePolygon(points)` if no
      equivalent exists in `src/app/core/maths`

### Modified files
- [ ] `ai-tool-registry.service.ts` — register the 14 new tools
- [ ] `ai-settings-dialog.component.html` — confirm advanced-tools toggle
      already present from Phase 5 correctly gates these (should need no
      change if Phase 5 built it generically)

### Acceptance criteria
- All 30 tools now registered; doc 10 §1's "exactly 30 entries" test updated
  and passing.
- Doc 10 §4 eval set expanded to cover Tier 2/3 cases (already counted in
  the 25-case minimum); re-run against real API, ≥ 90% pass rate.
- Manual E2E smoke test doc 10 §7, item 4 (roundabout create/cancel/confirm/
  undo) passes on packaged app.

## Phase 8 — Hardening & GA

- [ ] Full doc 10 test suite green in CI.
- [ ] `src/environments/environment.prod.ts` — flip `aiChatPanelEnabled: true`
- [ ] Update `README.md` — add a short "AI Assistant" section under Features
      pointing at how to configure an API key (mirrors doc 08 §7's UX)
- [ ] Update `tutorials.md` if it documents tool usage (check existing
      structure/convention before adding)

### Acceptance criteria
- Doc 10 §7 full manual E2E smoke test passes on both Windows and Linux
  packaged builds (repo's stated supported OSes).

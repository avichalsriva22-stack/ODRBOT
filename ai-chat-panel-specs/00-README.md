# Truevision Designer — AI Chat Panel Feature
## Specification Package — Index

This directory contains the **complete, implementation-ready specification** for adding
an AI natural-language side panel to Truevision Designer (`truevisionai/designer`).
A coding agent should be able to implement the entire feature from these documents
without needing further product decisions. Nothing is deferred to "later" — every
tool, schema, file, and edge case referenced by the feature is specified somewhere
in this package.

## Target repository facts (confirmed by direct inspection, do not re-derive)

- Framework: Angular **12.1.x**, Angular Material, `fxLayout`/flex-layout for panel
  layout. NgModules (not standalone components). RxJS for state.
- Shell: Electron (`main.js` + `preload.js`), `contextIsolation: true`,
  `nodeIntegration: true`, preload uses `contextBridge.exposeInMainWorld(...)`.
- State: single global singleton `TvMapInstance.map` (a `TvMap`), wrapped by
  `MapService` (`src/app/services/map/map.service.ts`).
- Mutation choke point: `src/app/commands/commands.ts` (`Commands` static facade)
  → `src/app/commands/command-history.ts` (`CommandHistory`, static undo/redo stacks).
  Every command implements `ICommand { execute(); undo(); redo(); }`
  (`src/app/commands/command.ts`).
- Programmatic (non-UI) model builders already exist and are the integration point
  for AI-driven creation:
  - `src/app/factories/road-factory.service.ts` (`RoadFactory.makeRoad(options)`)
  - `src/app/factories/junction.factory.ts` (`JunctionFactory.createByType(...)`)
  - `src/app/factories/lane-section.factory.ts` (`LaneSectionFactory`)
  - `src/app/services/road/road-width.service.ts`, `road-geometry.service.ts`
  - `src/app/managers/road/road-manager.ts`, `road-link.manager.ts`
- Tool switching: `ToolBarService.setToolByType(ToolType)` →
  `ToolFactory.createTool(type)` → `Commands.SetTool(tool)`. Full enum in
  `src/app/tools/tool-types.enum.ts` (39 tool types).
- Editor shell: `src/app/views/editor/editor.component.html` — flex row with
  viewport (76%) + right sidebar (24%, currently `app-object-inspector` +
  conditional `app-graph-viewport`), and a bottom `mat-tab-group` (Project
  Browser / Console tabs). The AI chat panel is added here.
- Import/export: `src/app/importers/open-drive/*`, `src/app/exporters/*` (via
  `src/app/factories/exporter.factory.ts` / `importer.factory.ts`).
- No existing AI/LLM integration of any kind exists in the codebase today.

## Document map

| # | File | Purpose |
|---|------|---------|
| 00 | `00-README.md` | This index |
| 01 | `01-architecture-overview.md` | System architecture, module boundaries, data flow diagram (textual), non-functional requirements |
| 02 | `02-data-models-and-state.md` | All new TypeScript interfaces/types shared across the feature |
| 03 | `03-tool-registry-full-catalog.md` | Exhaustive catalog of every AI-callable tool (function), one per Designer tool type, with full JSON Schema, backing implementation, and command mapping |
| 04 | `04-command-execution-layer.md` | `AiCommandService`, `AiCommand` wrapper, execution/undo integration spec |
| 05 | `05-context-and-state-serialization.md` | `AiContextService` — what state is sent to the LLM each turn and how it's compacted |
| 06 | `06-llm-integration-and-conversation-manager.md` | `AiConversationService`, Claude API tool-use loop, system prompt, streaming, retry/error handling |
| 07 | `07-electron-security-and-ipc.md` | API key storage, main-process proxy, IPC contract, network egress |
| 08 | `08-ui-chat-panel-component.md` | `AiChatPanelComponent` — full UI/UX spec, states, HTML structure, styles |
| 09 | `09-validation-preview-safety-undo.md` | Preview/diff, confirmation flow, validation rules, rollback, rate limiting, permission model |
| 10 | `10-testing-plan.md` | Unit, integration, and E2E test plan with concrete test cases |
| 11 | `11-file-by-file-implementation-checklist.md` | Every file to create or modify, in dependency order, with a done/not-done checklist |

## Extension package: autonomous multi-step map building (docs 12–15)

Docs 00–11 spec a **co-pilot**: one instruction → a few tool calls, capped,
always confirming individually. Docs 12–15 add the layer that makes the
tool "build a complete map from a high-level instruction or image," on top
of the same foundation:

| # | File | Purpose |
|---|------|---------|
| 12 | `12-planning-and-orchestration-layer.md` | Goal-mode plan generation, step dependency resolution, plan execution, error recovery, self-verification |
| 13 | `13-vision-input-pipeline.md` | Attaching reference images/sketches, preprocessing, multimodal transport, how the planner uses them |
| 14 | `14-autonomous-mode-and-batch-confirmation.md` | Plan review UI, live progress panel, which steps still need individual confirmation, plan-level undo |
| 15 | `15-composite-scene-template-tools.md` | Tier 4 tools (`build_intersection`, `build_roundabout_with_arms`, `build_parking_lot`, `build_residential_block`, `build_highway_segment`) — hand-written composite builders the planner prefers over manual step sequencing |

Nothing in docs 01–11 is replaced by this extension — `AiToolRegistry`,
`AiCommandService`, `AiContextService`, `CommandHistory` integration, and
every Tier 1–3 tool are reused unchanged as the primitives this layer
orchestrates.

### Additional implementation phases (after Phase 8)

9. **Phase 9 — Planning layer (doc 12)**: `AiIntentClassifierService`,
   `AiPlan`/`AiPlanStep` models, `AiPlannerService`, `AiPlanExecutorService`
   headless (no UI yet) — test via doc 10-style mocked-loop specs extended
   for plan generation/execution/recovery.
10. **Phase 10 — Vision input (doc 13)**: image attachment UI, preprocessing,
    transport; verify against doc 10 §4-style eval cases using real
    reference images.
11. **Phase 11 — Autonomous UI + Tier 4 tools (docs 14, 15)**: plan review
    card, live progress panel, plan-level undo buffering, the 6 composite
    tools and their factories. Ship behind the same `AiFeatureFlag`
    (doc 02 §4) plus a second flag, `AiFeatureFlag.goalModeEnabled`, so goal
    mode can be dark-launched independently of the chat-mode co-pilot once
    that has already reached GA.

## Implementation order (mandatory)

Implement in this order; each phase is independently shippable behind a feature
flag (`AiFeatureFlag.enabled`, see doc 02) and each phase's acceptance criteria
must pass before moving to the next:

1. **Phase 1 — Plumbing (docs 02, 04, 07, 11 §A)**: data models, command
   execution layer, Electron secure key storage/IPC proxy, feature flag. No UI,
   no LLM calls yet. Verify with unit tests only.
2. **Phase 2 — Read-only context (docs 02, 05)**: `AiContextService` can
   serialize current map state to JSON. Verify serialization snapshot tests.
3. **Phase 3 — Tool registry, tier 1 (doc 03 §Tier 1)**: implement the 10 "leaf"
   tools (lane width, lane height, road speed, etc.) that mutate an
   already-selected object and take 1–2 scalar params. No spatial reasoning
   required.
4. **Phase 4 — LLM integration (doc 06)**: wire Claude tool-use loop against the
   Tier 1 tools only, headless (drive it from a script/test harness, not the UI
   yet).
5. **Phase 5 — Chat panel UI (doc 08)**: build the panel, wire it to the
   Phase 4 conversation service. Ship behind feature flag.
6. **Phase 6 — Safety layer (doc 09)**: add preview/diff/confirm flow, retrofit
   onto everything shipped so far.
7. **Phase 7 — Tool registry, tier 2 and 3 (doc 03 §Tier 2/3)**: spatial tools
   (create road, create junction, create roundabout) and multi-step/composite
   tools (crosswalk-at-junction, prop placement along curve).
8. **Phase 8 — Testing hardening & GA (doc 10)**: full test suite, remove
   feature flag.

Do not skip ahead — Tier 2/3 tools depend on the safety layer (doc 09) because
they mutate geometry irreversibly-in-spirit (splines, junction topology) and
must be previewable before commit.

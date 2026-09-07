# 01 — Architecture Overview

## 1. Goal

Add a side panel to Truevision Designer where a user types natural-language
instructions (e.g. "add a 3-lane road 100m north of the selected road", "widen
lane -2 to 4 meters", "add a crosswalk at this junction") and the app performs
the equivalent of the manual tool-clicking workflow, using an LLM (Claude) as
the interpreter that maps instructions to a fixed, closed set of typed
"tool calls" against the existing Designer command layer.

## 2. Non-goals

- The AI does **not** get free-form code execution, file-system access, or
  direct DOM/network access. It can only call functions we explicitly expose.
- The AI does **not** bypass `CommandHistory`. Every mutation it makes is a
  normal undoable `ICommand`.
- The AI does **not** auto-apply destructive/topology-changing actions without
  a preview step (see doc 09).
- This is not a "vibe-code the whole map from a prompt" generator in v1 — it is
  an instruction-following co-pilot for the existing tool surface. Bulk/
  procedural generation (e.g. "generate a 10km highway network") is explicitly
  out of scope and should be rejected by the system prompt (doc 06 §5).

## 3. High-level module map (new code)

```
src/app/ai/
├── ai.module.ts                          NgModule, declares/exports everything below
├── models/
│   ├── ai-tool.model.ts                  AiTool, AiToolResult, AiToolContext interfaces
│   ├── ai-message.model.ts               AiChatMessage, AiRole, AiToolCallRecord
│   ├── ai-settings.model.ts              AiSettings (model id, key presence, etc.)
│   └── ai-feature-flag.ts                AiFeatureFlag static gate
├── tools/
│   ├── ai-tool-registry.service.ts       Central registry: name -> AiTool
│   ├── road/
│   │   ├── create-road.tool.ts
│   │   ├── set-road-speed.tool.ts
│   │   ├── delete-road.tool.ts
│   │   └── ...                           (full list in doc 03)
│   ├── lane/
│   │   ├── set-lane-width.tool.ts
│   │   ├── set-lane-height.tool.ts
│   │   ├── add-lane.tool.ts
│   │   ├── remove-lane.tool.ts
│   │   ├── set-lane-marking.tool.ts
│   │   └── ...
│   ├── junction/
│   │   ├── create-junction.tool.ts
│   │   ├── create-roundabout.tool.ts
│   │   ├── add-crosswalk.tool.ts
│   │   ├── add-traffic-signal.tool.ts
│   │   └── ...
│   ├── marking/
│   │   ├── add-point-marking.tool.ts
│   │   ├── add-text-marking.tool.ts
│   │   ├── add-prop-point.tool.ts
│   │   ├── add-prop-curve.tool.ts
│   │   ├── add-prop-polygon.tool.ts
│   │   ├── add-prop-span.tool.ts
│   │   └── add-road-sign.tool.ts
│   ├── terrain/
│   │   └── edit-surface.tool.ts
│   ├── query/
│   │   ├── get-selected-object.tool.ts
│   │   ├── get-road-info.tool.ts
│   │   ├── list-roads.tool.ts
│   │   └── list-junctions.tool.ts
│   └── project/
│       ├── export-opendrive.tool.ts
│       └── undo-last-action.tool.ts
├── services/
│   ├── ai-command.service.ts             Executes AiTool results as ICommand via CommandHistory
│   ├── ai-context.service.ts             Serializes MapService state -> compact JSON for the LLM
│   ├── ai-conversation.service.ts        Owns chat state, drives the tool-use loop against the LLM client
│   ├── ai-preview.service.ts             Dry-run/diff before commit (doc 09)
│   ├── ai-settings.service.ts            Reads/writes settings via Electron secure storage bridge
│   └── ai-llm-client.service.ts          Thin client over the IPC bridge to main-process Claude proxy
└── ui/
    ├── ai-chat-panel/
    │   ├── ai-chat-panel.component.ts
    │   ├── ai-chat-panel.component.html
    │   └── ai-chat-panel.component.scss
    ├── ai-message-bubble/
    │   ├── ai-message-bubble.component.ts
    │   ├── ai-message-bubble.component.html
    │   └── ai-message-bubble.component.scss
    ├── ai-tool-call-card/
    │   ├── ai-tool-call-card.component.ts
    │   ├── ai-tool-call-card.component.html
    │   └── ai-tool-call-card.component.scss
    ├── ai-diff-preview/
    │   ├── ai-diff-preview.component.ts
    │   ├── ai-diff-preview.component.html
    │   └── ai-diff-preview.component.scss
    └── ai-settings-dialog/
        ├── ai-settings-dialog.component.ts
        ├── ai-settings-dialog.component.html
        └── ai-settings-dialog.component.scss
```

Electron layer (modified, not new module):
```
main.js          + IPC handler: 'ai:chat-completion' (proxies to Anthropic API)
preload.js       + contextBridge.exposeInMainWorld('aiBridge', {...})
```

## 4. Data flow (per user turn)

1. User types text in `AiChatPanelComponent` and presses send.
2. `AiConversationService.sendMessage(text)`:
   a. Calls `AiContextService.buildContext()` → compact JSON snapshot of
      current map state + selection + active tool.
   b. Appends the user message to the in-memory conversation transcript.
   c. Calls `AiLlmClientService.complete(transcript, toolSchemas, context)`.
3. `AiLlmClientService` sends the request over `window.aiBridge.chatCompletion(...)`
   (IPC) → Electron main process → Anthropic Messages API (with `tools`
   parameter built from `AiToolRegistry.getSchemas()`) → response streamed back.
4. Response contains either:
   - Plain text → rendered directly as an assistant message.
   - One or more `tool_use` blocks → for each:
     i. `AiToolRegistry.get(name)` resolves the `AiTool`.
     ii. `AiTool.validate(args)` runs (schema + semantic checks, doc 09 §2).
     iii. If the tool is marked `requiresPreview: true` (doc 09 §3), the tool's
          `preview(args)` is called and a diff card is shown; execution pauses
          for user confirmation.
     iv. Otherwise (or after confirmation), `AiTool.run(args)` returns one or
         more `ICommand` objects, which `AiCommandService.execute(commands)`
         pushes through the existing `CommandHistory.execute(...)`.
     v. The tool's textual result (e.g. "Created Road-14, length 100m") is sent
        back to the LLM as a `tool_result` message, and the loop continues
        (step 3) until the model returns a final text-only turn (max 8 tool
        round-trips per user message, see doc 06 §4).
5. `AiConversationService` appends the final assistant message + a structured
   log of every `AiToolCallRecord` (tool name, args, resulting command ids,
   timestamp) to the transcript, which is rendered in the panel.

## 5. State ownership

- **Source of truth for the map**: unchanged — `TvMapInstance.map` via
  `MapService`. The AI layer never holds its own copy of the map; it always
  reads live via `AiContextService` and writes only via `ICommand`s executed
  through the existing `CommandHistory`.
- **Source of truth for the conversation**: new — `AiConversationService`
  holds an in-memory `AiChatMessage[]` (see doc 02). Not persisted across app
  restarts in v1 (see doc 02 §5 for the extension point when persistence is
  added later — the interface is defined now so it is not a breaking change).
- **Source of truth for settings** (API key presence, selected model, feature
  flag): `AiSettingsService`, backed by Electron's `safeStorage` via IPC (doc 07).

## 6. Non-functional requirements

- **Latency**: first token must render in the panel within 3s under normal
  network conditions (streaming, not wait-for-full-response).
- **Determinism of side effects**: identical tool args must always produce
  identical `ICommand` sequences (no hidden randomness in tool implementations,
  except where explicitly parameterized, e.g. auto-generated IDs which already
  come from `TvRoad.getNextId()` / `mapService.map.generateRoadId()`).
- **Undo parity**: every AI-driven change must be undoable with the existing
  Ctrl+Z shortcut exactly as if a human had performed the equivalent manual
  tool action. No new undo mechanism is introduced.
- **Isolation**: a failed or malformed tool call must never corrupt map state.
  Tools must validate fully before constructing any `ICommand` (doc 09 §2).
- **Offline-safe failure**: if there is no network or no API key configured,
  the panel must show a clear inline state (doc 08 §6), never throw an
  unhandled error into the Angular error zone.
- **No secrets in renderer**: the Anthropic API key must never enter the
  Chromium renderer process's JS heap or be visible in DevTools; see doc 07.

## 7. Feature flag

`AiFeatureFlag` (doc 02 §6) gates:
- Registration of `AiModule` routes/panel in `editor.component.html`.
- Registration of the IPC handlers in `main.js` (still registered, but chat
  panel entry point is hidden until flag is true — flag is a UI/menu gate,
  not a security boundary).

Default: `false` in `environment.prod.ts`, `true` in `environment.ts` (dev).

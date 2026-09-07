# 10 — Testing Plan

Repo already uses Karma + Jasmine (`karma.conf.js`, `ng test`) with existing
`*.spec.ts` conventions throughout (e.g. `road-tool.spec.ts`,
`add-object-command.spec.ts`, `commands.spec.ts`). Follow the same
conventions — do not introduce a second test runner.

## 1. Unit tests — data & command layer (Phase 1)

- `ai-tool-registry.service.spec.ts`: registering a duplicate tool name
  throws; `getAnthropicToolSchemas()` returns exactly 30 entries matching
  doc 03's table; `getEnabledToolSchemas(false)` excludes every Tier-2/3 tool
  name.
- `ai-command.service.spec.ts`: unknown tool name throws
  `AiToolRegistryError`; a tool whose `validate()` throws never reaches
  `CommandHistory.execute` (spy on `CommandHistory.execute`/`executeMany`
  and assert zero calls); a tool returning 2 commands calls `executeMany`
  once, not `execute` twice (regression test for doc 04 §4's warning).
- Per-tool spec (one per file under `src/app/ai/tools/**`, 30 total,
  mirroring doc 03's per-tool "preconditions"): valid args → correct
  `ICommand` type(s) returned with correct before/after payload; each listed
  precondition violation → `AiToolValidationError` with the exact expected
  message substring (assert on message content since the model reads these
  messages back, per doc 06 rule 5 — a vague message is a real regression,
  not just a style nit).

## 2. Unit tests — context & serialization (Phase 2)

- `ai-context.service.spec.ts`, using the existing test map fixtures under
  `src/tests/maps/` and `src/tests/mocks/` (reuse, do not create parallel
  fixtures):
  - Empty map → `roadCount: 0`, `roadsSummary: []`, `truncated: false`.
  - Map with 50 roads, nothing selected → `roadsSummary.length === 30`,
    `truncated: true`.
  - Selected road with a linked successor → both the selected road and its
    successor appear in `roadsSummary` even if `roadCount > 30` and they
    wouldn't otherwise make the "nearest to origin" cut.
  - Snapshot test: serialized JSON size for a 30-road map stays under the
    4,000-token budget (approx via `JSON.stringify(...).length / 4 < 4000`,
    doc 05 §2).

## 3. Unit tests — conversation loop (Phase 4)

Mock `AiLlmClientService.streamCompletion` to emit scripted `AiStreamEvent`
sequences (no real network/IPC):
- Plain text response (no tool calls) → one assistant message, loop stops,
  `apiTranscript` has exactly 2 entries (user + assistant).
- Single tool call, `requiresPreview: false` → tool executes automatically,
  loop continues, second `runTurn` fires with the tool result appended.
- Single tool call, `requiresPreview: true` → loop **pauses**
  (`AiPreviewService.awaitUserConfirmation` promise unresolved); calling
  `AiPreviewService.confirm(id)` unblocks it and the loop continues; calling
  `reject(id)` unblocks it with a `rejected` outcome and the loop still
  continues (does not hang, does not execute commands) — assert
  `CommandHistory.execute` was never called in the reject path.
- `maxToolRoundTrips` reached → loop stops with the exact fallback message
  from doc 06 §3, no further LLM calls made (assert call count).
- Malformed JSON in a `tool_use_input_delta` accumulation → handled as a
  failed tool call, does not throw uncaught, conversation continues.
- Transport error, retryable → exactly one automatic retry attempted (assert
  `streamCompletion` called twice for that turn), then surfaces error if
  retry also fails.
- Transport error, `auth`/`rate_limit` → zero retries, immediate error
  message with correct `AiChatError.kind`.
- Cancellation mid-stream → `cancelCurrentTurn()` results in
  `streaming: false`, no further stream events processed after
  unsubscribe (assert via a spy that a late-arriving mocked event after
  cancel is ignored).

## 4. Prompt/behavior evaluation set (Phase 4, manual + scripted against real API)

Not unit tests in the strict sense, but required before Phase 5 ships: a
fixed set of **≥ 25 scripted user prompts** run against a real (dev-key)
Anthropic API call, with a human reviewing whether the resulting tool
call(s) match expectations. Store these as a checked-in fixture file
`src/tests/ai/prompt-eval-cases.json` (array of
`{ prompt: string, mapFixture: string, expectedToolCalls: string[] }`) so
regressions in prompt wording are re-runnable, even though the assertion is
"tool name(s) called" not full conversational equality (LLM text varies).
Minimum required coverage:
- One case per Tier 1 tool (10 cases) using explicit, unambiguous phrasing.
- One case per Tier 1 tool using **relative/pronoun phrasing** ("make it
  wider", "this road's speed") requiring correct use of `selection` context.
- 5 cases for Tier 2 spatial tools requiring the model to compute
  coordinates from relative language ("just past the end of this road").
- 3 cases where the correct behavior is to ask a clarifying question
  (genuinely ambiguous request with nothing selected).
- 2 cases that should be refused/redirected per system prompt rule 7 (bulk
  generation requests).

## 5. Code-review checklist (enforced manually / via PR template, not
automatable, but must be documented since doc 04/09 rely on it)

- [ ] No `AiTool.run()` or `preview()` implementation calls
      `CommandHistory.execute`/`executeMany` directly (only
      `AiCommandService` does, and `UndoLastActionTool` per its documented
      exception, doc 04 §2).
- [ ] Every new tool file has a matching `.spec.ts`.
- [ ] Every new tool with `requiresPreview: true` implements `preview()`
      and its spec covers the diff shape from doc 09 §4.
- [ ] No renderer-side code path can read `window.aiBridge`'s key (there is
      no `getApiKey` method to call, but check no one added one).
- [ ] Every tool `parameters` schema's `enum` values match the corresponding
      TypeScript enum in the map model exactly (drift check — e.g.
      `TvLaneType` gaining a new value later must be reflected in
      `add_lane`'s schema).

## 6. Integration tests (Karma, Phase 5–6)

- `ai-chat-panel.component.spec.ts`: renders empty state when no messages;
  renders message bubbles in order; send button disabled while streaming;
  Stop button appears while streaming and calls `cancelCurrentTurn()`.
- `ai-tool-call-card.component.spec.ts`: each `status` value renders the
  correct visual state (doc 08 §4) — table-driven test over all 6 statuses.
- `ai-settings-dialog.component.spec.ts`: Save calls
  `AiSettingsService.setApiKey`; Clear calls `clearApiKey`; advanced-tools
  toggle updates `AiSettings.advancedToolsEnabled` and is reflected in a
  subsequent `AiToolRegistry.getEnabledToolSchemas` call (integration
  across the two services).

## 7. Manual E2E smoke test (Phase 8, before flipping prod flag)

Run once against the packaged Electron app (not just `ng serve`), covering
the full IPC path end to end:
1. Fresh install, no key configured → empty state shows "Add your API key".
2. Add a real key via settings dialog → key persists across app restart
   (verifies `safeStorage` round-trip on the actual target OS).
3. "Set the selected road's speed to 60" with a road selected → succeeds,
   viewport doesn't need refresh, undo (Ctrl+Z) reverts it.
4. "Create a roundabout here" → preview card appears, Cancel → nothing
   added to the map; re-ask, Confirm → roundabout appears, single Ctrl+Z
   removes the whole thing.
5. Turn off Wi-Fi mid-stream → error banner shows `network` state, retry
   button works once connectivity restored.
6. Export via "export this to opendrive" → native save dialog appears,
   file written matches manual Export menu output for the same map.

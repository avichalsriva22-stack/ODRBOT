# 14 — Autonomous Mode and Batch Confirmation UI

## 1. Entry points into goal mode

Two ways a plan (doc 12) gets created:
- **Automatic**: `AiIntentClassifierService` (doc 12 §2) classifies a
  message as `'goal'`.
- **Explicit**: a mode toggle in the chat panel header, next to the
  settings gear (doc 08 §2) — a two-state segmented button `Chat | Build`.
  Selecting `Build` forces `mode: 'goal'` for the next message regardless of
  classifier output (lets a user override a borderline classification
  without having to reword their prompt).

`AiChatPanelComponent` tracks `currentMode: 'chat' | 'goal' | 'auto'`
(`'auto'` = default, defers to the classifier per message).

## 2. Plan review card (`AiPlanReviewCardComponent`)

New component, `src/app/ai/ui/ai-plan-review-card/`. Rendered in place of a
normal `AiToolCallCardComponent` when a message produces an `AiPlan` in
`status: 'awaiting_review'`.

Layout:
```
┌─────────────────────────────────────────────┐
│ 📋 Plan: Build 4-way signalized intersection │
│ [thumbnail] [thumbnail]   (if images used)   │
│                                                │
│ Summary: I'll create 4 arm roads (30m each)  │
│ meeting at the origin, link them into a      │
│ junction, add crosswalks on all 4 legs, and  │
│ traffic signals at each entry...             │
│                                                │
│ ▸ 18 steps  (expand to view full list)       │
│                                                │
│  [ Reject ]     [ Edit... ]     [ Run Plan ] │
└─────────────────────────────────────────────┘
```

- **Expand ("18 steps")** reveals the full ordered `AiPlanStep[]` list, each
  row showing `description`, `toolName` (humanized, doc 08 §4 icon mapping
  reused), and resolved-where-possible args (unresolved
  `${stepN...}` placeholders shown literally with a small ⚡ icon and
  tooltip "resolved automatically during execution").
- **Reject** — discards the plan, `AiPlan.status = 'aborted'` before it ever
  runs, sends a `tool_result`-equivalent note back into conversation so the
  model knows to stop (mirrors doc 06 §4's rejection handling for a single
  tool, applied at the plan level).
- **Edit...** — opens `AiPlanEditDialogComponent` (§2.1) for lightweight
  manual adjustment without a full replan.
- **Run Plan** — confirms; `AiPlanExecutorService.executePlan(plan)` starts
  (doc 12 §5); card transforms in place into the live progress view (§4).

### 2.1 `AiPlanEditDialogComponent` (lightweight edit, not a replan)

Supports only:
- Removing a step (and anything that structurally depends on it, shown as a
  cascade warning before confirming removal).
- Editing a scalar arg value directly (e.g. changing `length: 30` to
  `length: 40` on one step) — re-validated via that tool's `validate()`
  (doc 02 §1) on dialog close, inline error shown if now invalid.

Does **not** support adding new steps or reordering (that's what asking the
model to replan is for — a "Ask AI to revise" text box at the bottom of the
edit dialog re-invokes `AiPlannerService.generatePlan` with the original
goal text plus the user's correction appended, producing a fresh plan that
replaces the one being edited).

## 3. Which steps still pause for individual confirmation during a run

`AiPlanExecutorService.stepNeedsIndividualConfirmation(step, plan)` (doc 12
§5) implements this exact policy — autonomous execution does **not** mean
"no human ever looks at anything again," it means "review the plan once
instead of once per step," with one exception category:

A step pauses for individual confirmation **only if**:
- Its tool's `requiresPreview` is `true` (doc 09 §2) **and**
- The step's `AiDiffEntry[]` preview (computed the same way as doc 09 §4)
  contains an `irreversibleWarning`, **or**
- The step removes/overwrites something that already existed **before this
  plan started** (i.e. not something the plan itself created two steps ago —
  a plan deleting its own scratch work needs no extra gate, but a plan
  editing a road the user had before the goal-mode request began does).

All other `requiresPreview: true` steps (the common case: `create_road`,
`create_roundabout`, etc. creating brand-new objects) run **without** a
per-step popup in goal mode — the user already reviewed the plan as a whole
in §2. This is the key UX difference from chat mode and the reason doc 12
§1 calls plan review "supervised batch" rather than "individually
confirmed."

## 4. Live progress panel (`AiPlanProgressComponent`)

Replaces the plan review card in place once `Run Plan` is clicked. New
component, `src/app/ai/ui/ai-plan-progress/`.

```
┌─────────────────────────────────────────────┐
│ ▶ Running: Build 4-way signalized intersection│
│ ████████████░░░░░░░░  11 / 18 steps          │
│                                                │
│ ✓ Create north arm road            (Road-14) │
│ ✓ Create south arm road            (Road-15) │
│ ✓ Create east arm road             (Road-16) │
│ ✓ Create west arm road             (Road-17) │
│ ✓ Link roads into junction         (Junction-3)│
│ ⚙ Add crosswalk (north leg)        running…  │
│ ○ Add crosswalk (south leg)        pending   │
│ ...                                            │
│ ✗ Add traffic signal (east)        failed    │
│    ↳ retrying with adjusted position…        │
│                                                │
│  [ Pause ]              [ Abort ]            │
└─────────────────────────────────────────────┘
```

- Backed by `AiPlanExecutorService.emitProgress(plan)` (doc 12 §5) —
  implement as a `BehaviorSubject<AiPlan>` per plan id that the component
  subscribes to (`AiPlanExecutorService.watchPlan(planId): Observable<AiPlan>`),
  updated on every step status change, not polled.
- Row icons: `✓` succeeded, `⚙` running (spinner), `○` pending, `✗` failed,
  `⤫` skipped (grey), matching doc 08 §4's palette for visual consistency.
- **Pause** button toggles to **Resume** while paused (doc 12 §8).
- **Abort** requires a confirm-are-you-sure (native `confirm()`-style
  Material dialog, not a silent action, since it's the one destructive-to-
  the-task-not-the-map action available here) then calls
  `AiPlanExecutorService.abort(plan.id)`.
- On completion (`completed` or `completed_with_errors`), the panel
  collapses to a summary line: `"✓ Completed: 18/18 steps"` or
  `"⚠ Completed with 1 error — 17/18 steps"` with a "View details" expand
  toggle that re-reveals the full row list (state, not re-fetched).
- If `completed_with_errors` and doc 12 §6's optional LLM verification pass
  ran, its `propose_fix` suggestion (if any) renders as a follow-up
  assistant chat message below the progress card, in normal chat-bubble
  style (doc 08 §3) — keeps the "what do I do about the failure" answer in
  the natural conversational flow rather than another modal.

## 5. Plan-level undo

A full multi-step plan must be revertible as **one action**, not 18
separate Ctrl+Z presses.

Implementation: `AiPlanExecutorService` allocates `plan.commandGroupId`
(doc 12 §3) at plan creation and wraps **the entire executed step
sequence** in a single `CommandHistory.executeMany(...)` call boundary —
concretely, buffer each step's resulting `ICommand[]` into one array as
they succeed, and instead of calling `AiCommandService.execute()` per step
(which pushes an individual undo entry per step or per `executeMany` batch
depending on tier), route plan-mode execution through a **new** method:

```ts
// AiCommandService additions
async executeAsPlanStep ( toolName: string, args: Record<string, any>, planBuffer: ICommand[] ): Promise<AiToolRunResult> {
	const tool = this.toolRegistry.get( toolName )!;
	const ctx = this.toolContextService.build();
	await tool.validate( args, ctx );
	const result = await tool.run( args, ctx );
	planBuffer.push( ...result.commands );   // buffered, NOT executed yet
	return result;
}
```

`AiPlanExecutorService.executePlan` accumulates every step's commands into
`planBuffer: ICommand[]` across the whole run, and only calls
`CommandHistory.executeMany( ...planBuffer )` **once**, after the loop
completes (or once per "wave" if truly required for referencing already-
created ids mid-plan — see note below). One Ctrl+Z then undoes the entire
build.

**Important caveat, must be handled**: because `resolveArgs` (doc 12 §4.2)
needs a *real* object id from an earlier step before a later step can even
construct valid args (e.g. `create_junction` needs the actual new road ids,
not a promise of them), commands **cannot** be purely buffered without ever
touching live state — `RoadFactory.makeRoad()` etc. already assign real ids
to in-memory `TvRoad` objects the moment they're constructed (doc 03's
backing implementations), which happens inside `tool.run()`, before
`CommandHistory.execute` is even called. This means:
- `tool.run()` producing the object and assigning it an id is fine to
  happen "early" (ids are cheap/local, not a `CommandHistory` mutation).
- What must stay buffered is only the **`CommandHistory.execute` call
  itself** (the point at which the object becomes part of the visible,
  undo-tracked map) — so buffering as designed above is correct: `run()`
  executes per-step (producing real ids other steps can reference), but the
  actual `CommandHistory` push is deferred to one batched call at the end.
- Consequence: if the plan is **aborted or fails partway**, the buffered-
  but-not-yet-pushed commands for steps that already ran are still applied
  by flushing `planBuffer` up to the failure point via one
  `executeMany(...planBuffer)` call before marking the plan
  `completed_with_errors`/`aborted` — i.e. always flush whatever succeeded,
  so partial progress is real, undoable, and visible on the map, not
  silently discarded. Only fully-unexecuted remaining steps are dropped.

This is the one piece of doc 04's execution layer that goal mode extends
(a new `executeAsPlanStep` method alongside the existing `execute` method,
doc 04 §2) rather than reuses unchanged — call this out in code review
(doc 10 §5 checklist gains one line: *"plan execution buffers commands and
flushes via a single executeMany, never calls CommandHistory.execute per
step"*).

## 6. Settings interaction

`AiSettings` (doc 02 §3) gains:
```ts
planStepConfirmationPolicy: 'batch' | 'always_confirm_creates';
```
Default `'batch'` (the behavior in §3 above). Power users who want every
single creation step confirmed individually even in goal mode (effectively
disabling the batch-review benefit for maximum caution) can flip this in
`AiSettingsDialogComponent` (doc 08 §7) — when set to `'always_confirm_creates'`,
`stepNeedsIndividualConfirmation` additionally returns `true` for any step
whose tool has `requiresPreview: true`, regardless of the irreversibility/
pre-existing-object checks in §3.

# 12 — Planning and Orchestration Layer

## 0. Why this doc exists

Docs 00–11 spec a **co-pilot**: one instruction → one-or-a-few tool calls,
capped at `maxToolRoundTrips` (default 8), refusing bulk requests by design
(doc 06 §5 rule 7). This doc specs the layer that sits **on top of** that
foundation to support the actual goal: "build me a full intersection /
neighborhood / highway segment from a high-level instruction," potentially
30–150+ tool calls, self-verified, resumable, and reviewable as a whole
rather than one popup at a time.

**Nothing in docs 01–11 is replaced.** `AiToolRegistry`, `AiCommandService`,
`AiContextService`, and every tool in doc 03 are reused as-is. This is an
additive orchestration layer that calls the same primitives through the same
`AiCommandService.execute()` chokepoint (doc 04 §2) — the safety guarantees
in doc 09 (validation, `CommandHistory`, undo) still apply to every
individual step.

## 1. Two modes, one panel

`AiConversationService` (doc 06 §3) gains a `mode: 'chat' | 'goal'` on each
user message, inferred automatically (not a manual toggle the user must
remember — see §2) or set explicitly via the UI (doc 14 §1).

- **Chat mode** (existing, docs 00–11 unchanged): single instruction, ≤8
  round trips, every preview-requiring step confirmed individually.
- **Goal mode** (new, this doc): a plan is generated first, reviewed once
  (doc 14), then executed as a supervised batch with progress reporting
  (doc 14) and self-verification (§5).

## 2. Mode inference

`AiIntentClassifierService` (new, `src/app/ai/services/ai-intent-classifier.service.ts`)
runs **before** the main conversation loop, on every new user message that
isn't a follow-up to an in-progress plan:

```ts
@Injectable( { providedIn: 'root' } )
export class AiIntentClassifierService {

	/** Cheap heuristic pass — no LLM call, keeps mode-switch instant. */
	classify ( text: string ): 'chat' | 'goal' | 'ambiguous' {

		const goalSignals = [
			/\bbuild\b/i, /\bcreate\b.*\b(intersection|neighborhood|block|network|segment|town)\b/i,
			/\ban? (entire|whole|complete)\b/i, /\bfrom (this|the) (image|sketch|photo)\b/i,
			/\blayout\b/i, /\bmulti[- ]?lane (highway|interchange)\b/i,
		];
		const chatSignals = [
			/^(set|widen|narrow|rename|delete|remove|undo|export)\b/i,
			/\bthis (road|lane|junction)\b/i, /\bselected\b/i,
		];

		const hasImage = /* message has an AiImageAttachment, doc 13 */ false;

		if ( hasImage ) return 'goal'; // image input always implies a build task, doc 13 §4
		if ( goalSignals.some( r => r.test( text ) ) && !chatSignals.some( r => r.test( text ) ) ) return 'goal';
		if ( chatSignals.some( r => r.test( text ) ) ) return 'chat';
		return 'ambiguous';
	}
}
```

`'ambiguous'` results in a short clarifying assistant reply
("Do you want me to make one specific change, or build something more
complete from scratch? I can do either.") with two quick-reply buttons
(doc 14 §1) rather than guessing — this keeps false-positive "goal mode" from
firing on a plain one-line edit request.

## 3. `AiPlan` data model (`src/app/ai/models/ai-plan.model.ts`)

```ts
export interface AiPlan {
	id: string;
	goalText: string;                    // the user's original instruction (+ image refs if any)
	createdAt: number;
	status: AiPlanStatus;
	steps: AiPlanStep[];
	/** Grouping id passed to CommandHistory so the whole plan is one undo unit, doc 14 §5. */
	commandGroupId: string;
}

export type AiPlanStatus =
	| 'drafting'        // LLM still producing the plan
	| 'awaiting_review' // plan complete, shown to user, not yet started
	| 'running'
	| 'paused'          // user paused, or a step needs clarification
	| 'completed'
	| 'completed_with_errors'
	| 'aborted';

export interface AiPlanStep {
	id: string;
	index: number;                       // execution order
	description: string;                 // human-readable, e.g. "Create north arm road (30m)"
	toolName: string;                    // one of the 30 tools from doc 03, or a Tier 4 composite tool (doc 15)
	args: Record<string, any>;
	/** Other step ids whose successful completion this step depends on (e.g. "create junction" depends on all 4 arm roads existing). */
	dependsOn: string[];
	status: 'pending' | 'running' | 'succeeded' | 'failed' | 'skipped';
	resultSummary?: string;
	errorMessage?: string;
	/** True if args reference a placeholder that must be resolved from an earlier step's createdIds (see §4.2). */
	hasUnresolvedReferences: boolean;
}
```

## 4. `AiPlannerService` (`src/app/ai/services/ai-planner.service.ts`)

### 4.1 Plan generation

Planning is itself an LLM call, but a **structurally different** one from
the chat loop: instead of the tool-use loop (doc 06 §3), the planner asks
the model to emit the **entire step list up front** as a single structured
response, using a dedicated tool `submit_plan` (schema below) rather than
executing tools immediately. This keeps planning cheap (one call) and
inspectable (doc 14 shows the whole thing before anything runs).

```ts
const SUBMIT_PLAN_TOOL = {
	name: 'submit_plan',
	description: 'Submit the full ordered list of steps needed to accomplish the requested build. Each step must map to exactly one available tool call. Do not include steps for tools that do not exist in the provided tool list.',
	input_schema: {
		type: 'object',
		properties: {
			steps: {
				type: 'array',
				items: {
					type: 'object',
					properties: {
						description: { type: 'string', description: 'Short human-readable label for this step.' },
						toolName: { type: 'string' },
						args: { type: 'object', description: 'Arguments for the tool. Use ${stepN.createdIds[0].id} to reference an id created by an earlier step (see reference syntax).' },
						dependsOnStepIndices: { type: 'array', items: { type: 'integer' } },
					},
					required: [ 'description', 'toolName', 'args', 'dependsOnStepIndices' ],
				},
			},
			summary: { type: 'string', description: 'One-paragraph plain-language summary of the overall plan, for the user to review.' },
		},
		required: [ 'steps', 'summary' ],
	},
};
```

`AiPlannerService.generatePlan(goalText, images, context)`:
1. Builds a **planning system prompt** (§4.3, distinct from doc 06 §5's
   execution prompt).
2. Sends one non-streaming (or streamed-but-single-turn) request with
   `tools: [SUBMIT_PLAN_TOOL, ...toolRegistry.getEnabledToolSchemas(true)]`
   (`getEnabledToolSchemas(true)` — planning always sees the full advanced
   catalog regardless of the user's chat-mode `advancedToolsEnabled` setting,
   because goal mode is an explicit request to build something; the
   *execution* of Tier-2 steps still respects preview rules, see §6).
3. Forces the model to call `submit_plan` (Anthropic `tool_choice: {type:
   "tool", name: "submit_plan"}`) so the response is always a plan, never
   free text or a premature real tool call.
4. Parses the result into `AiPlan` (doc §3), assigning `id`s to each step and
   converting `dependsOnStepIndices` → `dependsOn: string[]` (step ids).
5. Sets `status: 'awaiting_review'`.

### 4.2 Reference resolution (`${stepN....}` placeholders)

Because plan generation happens **before** any step runs, the model cannot
know real ids (e.g. a newly created road's id) when writing step 5's args if
step 5 needs step 2's output. The model is instructed (planning prompt, §4.3)
to write placeholder expressions like `"${step2.createdIds[0].id}"` instead
of a literal id.

`AiPlanExecutorService` (§5) resolves these at **execution time**, right
before calling `AiCommandService.execute(step.toolName, resolvedArgs)`:

```ts
function resolveArgs ( args: Record<string, any>, completedSteps: Map<string, AiToolRunResult> ): Record<string, any> {
	const resolved = structuredClone( args );
	walkAndReplace( resolved, ( value: string ) => {
		const match = /^\$\{step(\d+)\.createdIds\[(\d+)\]\.id\}$/.exec( value );
		if ( !match ) return value;
		const [ , stepIndex, idIndex ] = match;
		const result = completedSteps.get( `step-${ stepIndex }` );
		if ( !result ) throw new AiPlanReferenceError( `Referenced step ${ stepIndex } has not completed yet.` );
		return result.createdIds?.[ Number( idIndex ) ]?.id ?? ( () => { throw new AiPlanReferenceError( `Step ${ stepIndex } produced no createdIds[${ idIndex }].` ); } )();
	} );
	return resolved;
}
```

This is why doc 02 §1's `AiToolRunResult.createdIds` field exists — it was
specced in the base package specifically so this layer could be added
without changing that interface.

### 4.3 Planning system prompt (literal text)

```
You are planning a multi-step map-building task for Truevision Designer.
You will NOT execute anything yourself — you only produce an ordered list
of tool calls via submit_plan. Another system will execute your plan step
by step and verify each result before proceeding.

Rules:
1. Break the goal into the smallest reasonable set of steps using ONLY the
   tools listed. Prefer Tier 4 composite tools (build_intersection,
   build_roundabout, build_parking_lot, build_residential_block — see their
   descriptions) over manually sequencing primitive tools, when a composite
   tool fits the request — they are more reliable.
2. Compute concrete coordinates, headings, and lengths yourself from the
   map context provided. Do not leave placeholder values like "TBD" in args.
3. If a later step needs the id of something an earlier step creates, use
   the exact placeholder syntax: "${stepN.createdIds[0].id}" (N = 1-based
   step index). Do not invent ids.
4. List dependsOnStepIndices for any step that structurally requires an
   earlier step to have completed (referenced ids, or spatial adjacency
   that must exist first, e.g. a junction step depends on all its arm-road
   steps).
5. If the request is underspecified in a way that would produce a poor
   result (e.g. "build an intersection" with no location given and nothing
   selected), make a reasonable assumption (e.g. place it at the origin, or
   extend from the selected road) and state the assumption plainly in the
   summary rather than blocking on a question — the user reviews the plan
   before anything runs and can reject it.
6. Keep the plan under 60 steps. If the request is larger than that (e.g.
   "build a whole city"), plan only a clearly-bounded first piece and say
   so explicitly in the summary, suggesting the user ask for the next piece
   once this one is done.
7. If reference images were provided, describe in the summary what you
   inferred from them (road count, rough layout, notable features) before
   listing steps, so the user can correct misreadings before execution.

Available tools (name, description, schema): ${JSON.stringify(toolSchemas)}
Current map context: ${JSON.stringify(mapContext)}
```

Rule 6 replaces doc 06 §5 rule 7's outright refusal — goal mode is exactly
the "bulk generation" case chat mode declines, scoped with an explicit size
cap instead of a blanket no.

## 5. `AiPlanExecutorService` (`src/app/ai/services/ai-plan-executor.service.ts`)

Executes an `awaiting_review` (now confirmed, doc 14 §2) plan step by step:

```ts
async executePlan ( plan: AiPlan ): Promise<void> {

	plan.status = 'running';
	const completed = new Map<string, AiToolRunResult>();
	const remaining = [ ...plan.steps ];

	while ( remaining.length > 0 ) {

		if ( this.isPaused( plan.id ) ) { plan.status = 'paused'; await this.awaitResume( plan.id ); plan.status = 'running'; }
		if ( this.isAborted( plan.id ) ) { plan.status = 'aborted'; return; }

		const runnable = remaining.filter( s => s.dependsOn.every( depId => completed.has( depId ) ) );

		if ( runnable.length === 0 ) {
			// dependency deadlock — should be impossible if the planner respected rule 4, but guard anyway
			this.markRemainingFailed( remaining, 'Unresolvable step dependency.' );
			plan.status = 'completed_with_errors';
			return;
		}

		for ( const step of runnable ) {

			step.status = 'running';
			this.emitProgress( plan );

			try {
				const resolvedArgs = resolveArgs( step.args, completed );
				await this.toolRegistry.get( step.toolName )!.validate( resolvedArgs, this.ctxBuilder.build() );

				if ( this.stepNeedsIndividualConfirmation( step, plan ) ) {   // doc 14 §3
					const confirmed = await this.previewService.awaitUserConfirmation( step.id );
					if ( !confirmed ) { step.status = 'skipped'; remaining.splice( remaining.indexOf( step ), 1 ); continue; }
				}

				const result = await this.commandService.execute( step.toolName, resolvedArgs );
				completed.set( step.id, result );
				step.status = 'succeeded';
				step.resultSummary = result.summary;

			} catch ( err ) {
				step.status = 'failed';
				step.errorMessage = err instanceof Error ? err.message : String( err );

				const recovered = await this.attemptRecovery( plan, step, err );  // §6
				if ( !recovered ) {
					this.emitProgress( plan );
					// dependent steps cannot run — mark them skipped, continue with independent branches
					this.skipDependents( plan, step, remaining );
				}
			}

			remaining.splice( remaining.indexOf( step ), 1 );
			this.emitProgress( plan );
		}
	}

	plan.status = plan.steps.some( s => s.status === 'failed' ) ? 'completed_with_errors' : 'completed';
	this.emitProgress( plan );
}
```

Key properties:
- **Parallelism within a dependency wave is allowed but not required** — the
  `runnable` filter naturally batches independent steps (e.g. 4 arm roads of
  an intersection have no dependency on each other); implementers may
  `Promise.all` a `runnable` batch instead of a `for` loop for speed, but
  must preserve **command ordering determinism** for undo purposes if so
  (execute sequentially into `CommandHistory` even if validation/preview ran
  concurrently) — sequential `for` loop as written above is the simpler,
  safe default; parallelizing is an optimization, not a correctness
  requirement, and may be deferred.
- Every step still goes through `AiCommandService.execute()` — doc 04's
  chokepoint and doc 09's validation layers are untouched.

## 6. Self-verification

After `executePlan` finishes (`completed` or `completed_with_errors`),
`AiPlanExecutorService.verifyPlan(plan)` runs a lightweight check pass, not
another full LLM call by default (cost/latency):

1. For every step with `createdIds`, confirm the referenced object still
   exists in `MapService` (catches the case where a later step's failure
   somehow orphaned an earlier creation — shouldn't happen given
   `CommandHistory` semantics, but cheap to assert).
2. Re-run `AiContextService.buildContext()` and diff `roadCount`/
   `junctionCount` against the expected delta from `plan.steps` — logs a
   warning (surfaced in the progress panel, doc 14 §4) if they don't match,
   rather than failing silently.
3. **Optional LLM verification pass** (only triggered if
   `plan.status === 'completed_with_errors'`): send the failed steps' error
   messages + updated context back to the model with a `propose_fix` tool
   (same shape as recovery in §7) so the user gets an actionable suggestion
   in the progress panel rather than a raw stack of error strings.

## 7. Error recovery (`attemptRecovery`)

On a step failure, before giving up on its dependents:
1. If the error is `AiToolValidationError` (doc 02 §6) — i.e. the plan's
   assumption was wrong (e.g. computed coordinates overlap an existing
   road) — call the model **once** with a small `propose_fix` tool exposing
   just that one step's description, args, and error message, asking for
   corrected args for that single step only (cheap, targeted, not a full
   replan). If the fix validates, retry the step (max 1 retry per step).
2. If the error is `AiToolExecutionError` or anything else — no retry,
   mark failed, move on. Silent infinite retry loops are explicitly
   disallowed.
3. All recovery attempts are visible in the progress panel (doc 14 §4) as a
   sub-entry under the step, not hidden — "Step 7 failed, retrying with
   adjusted position..." then either "✓ succeeded on retry" or "✗ still
   failed, skipped."

## 8. Cancellation and resume

- **Pause**: sets an in-memory flag checked at the top of each loop
  iteration (`isPaused`); in-flight step finishes, no new step starts.
- **Abort**: sets `plan.status = 'aborted'`; already-executed steps' commands
  remain in `CommandHistory` (they're real, valid map edits) — abort stops
  *future* steps, it does not roll back completed ones automatically (the
  user can use the plan-level undo, doc 14 §5, if they want everything
  gone).
- **Resume**: re-enters `executePlan` with the same `plan` object; already
  `succeeded`/`skipped` steps are not re-run (loop only considers `remaining`,
  which excludes them).
- Plans are **not** persisted across app restart in v1 (same non-goal as
  doc 02 §5's transcript persistence) — an aborted-by-app-close plan is
  simply gone; partially-applied map changes remain (they're normal
  `CommandHistory` entries) and are individually undoable as usual.

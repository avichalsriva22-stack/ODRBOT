# 09 — Validation, Preview, Safety, and Undo

## 1. Layered validation

Three layers, in order, before any `ICommand` is constructed:

1. **JSON Schema layer** — enforced by the LLM API itself (Anthropic
   validates `tool_use.input` against `input_schema` before it's even
   returned to us) plus a defensive re-check in `AiCommandService.execute`
   using a lightweight schema validator (add `ajv` as a new dependency —
   check `package.json` for an existing JSON Schema validator first; if none
   exists, `ajv` is the standard choice and is small/well-maintained).
2. **Semantic layer** — `AiTool.validate(args, ctx)` (doc 02 §1), one
   implementation per tool, checking things schema can't express (referenced
   ids exist, positions are within map bounds, etc. — see doc 03's
   "preconditions" per tool).
3. **Command-construction layer** — `AiTool.run()` itself may still discover
   an invalid state while building commands (e.g. a race where the object
   was deleted by the user between context-build and tool-run); in that case
   `run()` throws `AiToolExecutionError`, caught the same way as validation
   errors (doc 06 §4's `runToolCall` catch block).

## 2. Rule: which tools require preview

A tool sets `requiresPreview: true` (doc 02 §1) if **any** of the following
is true — this is the exact rule set, not a vague guideline:

- It creates new topology (roads, junctions, connections) — Tier 2 tools.
- It removes an existing object (`remove_lane`).
- It edits terrain over an area (`edit_surface`).
- It is irreversible in a way that isn't just "state before/after" (none in
  v1's catalog currently qualify beyond the above, but this criterion is
  kept explicit for future tools).

All Tier 1 leaf tools, all prop/marking placement tools, and all query/
project tools (except none — `export_opendrive`/`undo_last_action` are
explicitly `false` per doc 03) are `requiresPreview: false` because they are
single-field edits or additive placements with obvious, cheap-to-undo
effects and low cognitive cost to review after the fact via the tool-call
card's "Undo this" affordance (doc 08 §4).

## 3. `AiPreviewService` (`src/app/ai/services/ai-preview.service.ts`)

```ts
@Injectable( { providedIn: 'root' } )
export class AiPreviewService {

	private pendingConfirmations = new Map<string, { resolve: ( confirmed: boolean ) => void }>();

	/** Called by AiConversationService.runToolCall (doc 06 §4). Resolves when the UI calls confirm()/reject(). */
	awaitUserConfirmation ( toolCallRecordId: string ): Promise<boolean> {
		return new Promise( resolve => {
			this.pendingConfirmations.set( toolCallRecordId, { resolve } );
		} );
	}

	/** Called by AiToolCallCardComponent's Confirm button. */
	confirm ( toolCallRecordId: string ): void {
		this.pendingConfirmations.get( toolCallRecordId )?.resolve( true );
		this.pendingConfirmations.delete( toolCallRecordId );
	}

	/** Called by AiToolCallCardComponent's Cancel button. */
	reject ( toolCallRecordId: string ): void {
		this.pendingConfirmations.get( toolCallRecordId )?.resolve( false );
		this.pendingConfirmations.delete( toolCallRecordId );
	}
}
```

Timeout: if no user response within **5 minutes**, auto-reject (treat as
`rejected`) and inform the model via the tool result text — prevents a
conversation from hanging forever on an abandoned confirmation, and prevents
a stale confirmation being clicked long after the user moved on to other
edits that may have invalidated the preview.

## 4. Diff computation per tool

Each `requiresPreview: true` tool's `preview()` method (doc 02 §1) computes
`AiDiffEntry[]` by reading current state and comparing to what `run()` would
produce, **without calling `run()`** (to guarantee no side effects happen
during preview). Concretely:

- `remove_lane`: diff = one entry per lane whose id will change (the removed
  lane shows `after: null`; renumbered siblings show `before: "-3"`,
  `after: "-2"` etc.).
- `create_road` / `extend_road_from_selected`: diff = descriptive entries
  ("New road", "Length", "Position", "Lanes") rather than before/after pairs
  (there is no "before" for a new object) — `AiDiffEntry.before` is `null`
  for all rows in creation-tool previews.
- `create_roundabout` / `create_junction`: same creation-style diff, one row
  per generated road plus one for the junction.
- `add_crosswalk` / `add_traffic_signal`: descriptive rows (position, road,
  type).
- `edit_surface`: if `surfaceId` provided (edit mode), before/after rows for
  changed fields; if creating, descriptive rows.

## 5. Rejection handling

When the user clicks Cancel: `AiPreviewService.reject()` resolves `false`,
`runToolCall` marks the record `rejected` and returns a tool_result telling
the model the action was not applied (doc 06 §4's exact string). The model
sees this as a normal tool result and can react in conversation (e.g. offer
an alternative) — rejection is not a conversation-ending error.

## 6. Non-goals for v1 preview (explicitly deferred, documented so it's a
conscious decision, not an oversight)

- **Ghost geometry in the 3D viewport** (rendering a translucent preview of
  a new road/junction before commit) is not required for v1. The textual
  diff card is sufficient for launch. This is the one place in this spec
  package where "future work" is named — it is out of scope, not
  half-specified, and requires no interface changes to add later (it would
  hook into the same `preview()` result, adding an optional
  `AiToolPreviewResult.viewportPreviewData` field is a backward-compatible
  addition whenever it's prioritized).

## 7. Undo integration guarantees

- Every executed tool call's commands go through `CommandHistory`
  (doc 04 §2) — standard Ctrl+Z / Ctrl+Y (or app's existing redo shortcut,
  check `src/app/core/shortcuts/` for the exact binding) undoes/redoes them
  exactly like manual edits.
- Multi-command tools use `executeMany` (one undo step per AI action, doc 04
  §4).
- The per-card "Undo this" button (doc 08 §4) is a convenience wrapper
  around `CommandHistory.undo()`, gated to only appear when it would
  actually undo *this* action (top-of-stack check) — this prevents users
  from accidentally undoing unrelated later edits by clicking an old card.

## 8. Rate limiting / abuse prevention (local, not server-side)

- `AiConversationService` enforces `maxToolRoundTrips` (doc 02 §3, default
  8) per user message to prevent runaway loops.
- No per-minute request throttling is implemented client-side in v1 (relying
  on Anthropic's own account-level rate limits, surfaced as `kind:
  'rate_limit'` errors per doc 06 §6/doc 08 §6) — note this explicitly as a
  conscious v1 scope decision, not a gap: the user is spending their own API
  budget, so local throttling is a UX nicety, not a safety requirement.

## 9. Data the AI must never be able to do, structurally (defense in depth)

Restated for completeness even though covered elsewhere:
- Cannot read the API key (doc 07 §6 — bridge is write-only for the key).
- Cannot call arbitrary JS/eval — tool arguments are JSON data, never code.
- Cannot access the file system directly — the only file I/O tool is
  `export_opendrive`, which reuses the existing, already-reviewed
  `ExporterFactory` + native save dialog, not a new file-write path.
- Cannot bypass `CommandHistory` (doc 04 §2 — single execution chokepoint,
  enforced by code review checklist in doc 10 §5).

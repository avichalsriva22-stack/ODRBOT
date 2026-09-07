# 04 — Command Execution Layer

## 1. `AiToolRegistry` (`src/app/ai/tools/ai-tool-registry.service.ts`)

```ts
@Injectable( { providedIn: 'root' } )
export class AiToolRegistry {

	private tools = new Map<string, AiTool>();

	constructor ( private injector: Injector ) {
		this.registerAll();
	}

	private registerAll (): void {
		// One line per tool in doc 03's summary table, in the same order.
		this.register( this.injector.get( CreateRoadTool ) );
		this.register( this.injector.get( SetLaneWidthTool ) );
		// ... all 30 tools ...
	}

	register ( tool: AiTool ): void {
		if ( this.tools.has( tool.name ) ) {
			throw new Error( `Duplicate AI tool name registered: ${ tool.name }` );
		}
		this.tools.set( tool.name, tool );
	}

	get ( name: string ): AiTool | undefined {
		return this.tools.get( name );
	}

	getAll (): AiTool[] {
		return Array.from( this.tools.values() );
	}

	/** Produces the exact shape Anthropic's Messages API `tools` param expects. */
	getAnthropicToolSchemas (): { name: string; description: string; input_schema: AiJsonSchema }[] {
		return this.getAll().map( t => ( {
			name: t.name,
			description: t.description,
			input_schema: t.parameters,
		} ) );
	}

	/** Filters by AiSettings.advancedToolsEnabled — Tier 2/3 tools are excluded when false. */
	getEnabledToolSchemas ( advancedEnabled: boolean ): ReturnType<AiToolRegistry['getAnthropicToolSchemas']> {
		const tier1AndQueryNames = new Set( [ /* the Tier-1 + query + project tool names from doc 03 */ ] );
		return this.getAnthropicToolSchemas().filter( s =>
			advancedEnabled || tier1AndQueryNames.has( s.name ) );
	}
}
```

Each individual tool class (e.g. `CreateRoadTool`) is a small `@Injectable`
implementing `AiTool`, injecting whatever existing services/factories it
needs (e.g. `RoadFactory`, `MapService`). This keeps DI working normally and
each tool independently unit-testable (doc 10 §2).

## 2. `AiCommandService` (`src/app/ai/services/ai-command.service.ts`)

```ts
@Injectable( { providedIn: 'root' } )
export class AiCommandService {

	constructor ( private toolRegistry: AiToolRegistry, private toolContextService: AiToolContextBuilderService ) {}

	async execute ( toolName: string, args: Record<string, any> ): Promise<AiToolRunResult> {

		const tool = this.toolRegistry.get( toolName );

		if ( !tool ) throw new AiToolRegistryError( `Unknown tool: ${ toolName }` );

		const ctx = this.toolContextService.build();

		await tool.validate( args, ctx );          // throws AiToolValidationError

		const result = await tool.run( args, ctx ); // pure: builds ICommand[], does not execute

		if ( result.commands.length === 1 ) {
			CommandHistory.execute( result.commands[ 0 ] );
		} else if ( result.commands.length > 1 ) {
			CommandHistory.executeMany( ...result.commands );
		}
		// commands.length === 0 is valid for query/export tools — nothing to execute.

		return result;
	}
}
```

Notes:
- `execute()` is the **only** place `CommandHistory.execute` /
  `executeMany` is called from AI code. No individual `AiTool.run()`
  implementation may call `CommandHistory` itself — this is enforced by code
  review checklist (doc 10 §5) since TypeScript can't enforce it structurally.
- If `tool.run()` throws, nothing has been pushed to `CommandHistory` yet —
  map state is guaranteed untouched (this is why `run()` must be pure
  command-construction, not incremental mutation).
- `undo_last_action`'s tool (`UndoLastActionTool.run()`) is the **one
  exception**: because there is no `ICommand` that means "undo", its `run()`
  calls `CommandHistory.undo()` directly inside `run()` and returns
  `{ commands: [], summary: '...' }`. `AiCommandService.execute` treats this
  identically (zero commands returned = nothing further to execute) — the
  side effect already happened inside the tool. Document this exception
  inline with a comment in `undo-last-action.tool.ts`.

## 3. `AiToolContextBuilderService`

Small service, separate from `AiContextService` (doc 05) which builds the
**LLM-facing** JSON. This one builds the **tool-facing** `AiToolContext`
(doc 02 §1) — a thin object carrying live references (`MapService`,
`ToolManager`) plus the current `AiSelectionSnapshot`, computed by reading:
- `ToolManager.getCurrentTool()?.toolType`
- Whatever the app's current "selection" service exposes today (locate the
  existing selection-tracking mechanism used by `SelectObjectCommand`/
  `AddSelectCommand` and read from it — do not introduce a second selection
  source of truth; if selection state is only available as "whatever is
  currently flagged `isSelected` on scene objects", add a minimal
  `getCurrentSelection()` read helper next to those commands rather than a
  new state store).

## 4. Composite/multi-command tools

Tools like `create_roundabout` and `create_junction` return multiple
`ICommand`s in `AiToolRunResult.commands`. `AiCommandService.execute` batches
them via `CommandHistory.executeMany(...)`, which already wraps multiple
commands in a single `MultiCmdsCommand` — meaning **one Ctrl+Z undoes the
entire roundabout/junction creation as one step**, not one road at a time.
This is the correct existing behavior and requires no new code beyond using
`executeMany` — call this out explicitly in code review since it's easy to
accidentally call `CommandHistory.execute` in a loop instead, which would
require N undos to revert one AI action.

## 5. Idempotency / re-run safety

If the LLM (due to a retry after a transport error, see doc 06 §6) sends the
same `tool_use` block twice, `AiConversationService` (doc 06 §3) deduplicates
by Anthropic's `tool_use.id` before calling `AiCommandService.execute` a
second time. This is a conversation-layer concern, not a command-layer one —
`AiCommandService` itself has no dedup logic and always executes what it's
given (single-responsibility).

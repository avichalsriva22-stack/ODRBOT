# 02 — Data Models and Shared State

All interfaces below live under `src/app/ai/models/`. These are the exact
contracts every other spec document references — implement them first
(Phase 1).

## 1. `ai-tool.model.ts`

```ts
import { ICommand } from 'app/commands/command';

/** JSON Schema subset we support for tool parameters (Anthropic tool-use compatible). */
export interface AiJsonSchemaProperty {
	type: 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object';
	description: string;
	enum?: ( string | number )[];
	items?: AiJsonSchemaProperty;          // required if type === 'array'
	properties?: Record<string, AiJsonSchemaProperty>; // required if type === 'object'
	required?: string[];                   // required if type === 'object'
	minimum?: number;
	maximum?: number;
	default?: any;
}

export interface AiJsonSchema {
	type: 'object';
	properties: Record<string, AiJsonSchemaProperty>;
	required: string[];
}

/** Result returned by AiTool.run(). Never mutates state directly. */
export interface AiToolRunResult {
	/** Commands to be executed (in order) through CommandHistory. Empty array = no-op / query-only tool. */
	commands: ICommand[];
	/** Human-readable summary shown in the chat transcript and sent back to the LLM as the tool_result. */
	summary: string;
	/** Optional structured data returned to the LLM for query tools (e.g. list of road ids). Must be JSON-serializable. */
	data?: Record<string, any>;
	/** IDs of any newly created objects, for reference in follow-up turns. */
	createdIds?: { type: 'road' | 'junction' | 'lane' | 'object'; id: number | string }[];
}

/** Result of AiTool.preview(). Used by the safety layer (doc 09). */
export interface AiToolPreviewResult {
	/** Short human-readable description of what will change. */
	description: string;
	/** Structured before/after summary rendered by AiDiffPreviewComponent. */
	diff: AiDiffEntry[];
	/** True if this action is irreversible in a way undo cannot fully restore (e.g. id counters). Almost never true. */
	irreversibleWarning?: string;
}

export interface AiDiffEntry {
	field: string;              // e.g. "Lane -2 width"
	before: string | number | null;
	after: string | number | null;
}

/** Category used for grouping in the registry, the system prompt, and the UI tool-call card icon. */
export type AiToolCategory =
	| 'road' | 'lane' | 'junction' | 'marking' | 'prop' | 'signal'
	| 'terrain' | 'query' | 'project';

/** Contract every AI-callable tool implements. One class per file under src/app/ai/tools/**. */
export interface AiTool<TArgs = any> {
	/** Unique, stable, snake_case name — this is the literal string sent to the LLM. Never rename once shipped. */
	name: string;
	category: AiToolCategory;
	/** Sent verbatim to the LLM as the tool description. Should state preconditions explicitly (e.g. "requires a road to be selected"). */
	description: string;
	parameters: AiJsonSchema;
	/** If true, run() is never called directly — preview() must be shown and confirmed first. See doc 09 §3 for the exact rule set. */
	requiresPreview: boolean;
	/** Cheap synchronous/async validation beyond JSON Schema (e.g. "road id must exist"). Throws AiToolValidationError on failure. */
	validate( args: TArgs, ctx: AiToolContext ): Promise<void> | void;
	/** Only called when requiresPreview === true. Must not mutate state. */
	preview?( args: TArgs, ctx: AiToolContext ): Promise<AiToolPreviewResult>;
	/** Builds and returns ICommand[] but does NOT execute them — AiCommandService executes. Must not mutate state itself. */
	run( args: TArgs, ctx: AiToolContext ): Promise<AiToolRunResult>;
}

/** Injected into every tool call; the read-only "world" the tool operates on. */
export interface AiToolContext {
	mapService: import('app/services/map/map.service').MapService;
	selection: AiSelectionSnapshot;
}

export interface AiSelectionSnapshot {
	selectedRoadId?: number;
	selectedJunctionId?: number;
	selectedLaneId?: number;
	selectedLaneSectionS?: number;
	activeTool?: string; // ToolType[ToolManager.getCurrentTool()?.toolType ]
}

export class AiToolValidationError extends Error {
	constructor ( message: string, public readonly field?: string ) {
		super( message );
		this.name = 'AiToolValidationError';
	}
}
```

## 2. `ai-message.model.ts`

```ts
export type AiRole = 'user' | 'assistant' | 'system';

export interface AiChatMessage {
	id: string;                 // uuid
	role: AiRole;
	text: string;                // rendered markdown-lite (see doc 08 §5 for allowed subset)
	createdAt: number;           // epoch ms
	toolCalls?: AiToolCallRecord[];
	/** Present while a message is still streaming in. */
	streaming?: boolean;
	/** Present if this assistant turn failed (network/API/tool error). */
	error?: AiChatError;
}

export interface AiToolCallRecord {
	id: string;                  // Anthropic tool_use id, or generated uuid for local tracking
	toolName: string;
	args: Record<string, any>;
	status: 'pending_preview' | 'pending_confirmation' | 'running' | 'succeeded' | 'failed' | 'rejected';
	summary?: string;             // set on success
	errorMessage?: string;        // set on failure
	preview?: import('./ai-tool.model').AiToolPreviewResult;
	createdCommandIds?: string[]; // ids into CommandHistory, for debugging/telemetry only
}

export interface AiChatError {
	kind: 'network' | 'auth' | 'rate_limit' | 'invalid_tool_args' | 'unknown';
	message: string;
	retryable: boolean;
}
```

## 3. `ai-settings.model.ts`

```ts
export interface AiSettings {
	/** Never holds the raw key — only whether one is configured. Raw key lives in Electron safeStorage, see doc 07. */
	apiKeyConfigured: boolean;
	model: AiModelId;
	/** Soft cap on tool round-trips per user message (doc 06 §4). */
	maxToolRoundTrips: number;
	/** User-level opt-in: whether Tier 2/3 (spatial/destructive) tools are enabled at all. Default false until doc 09 ships. */
	advancedToolsEnabled: boolean;
}

export type AiModelId = 'claude-sonnet-5' | 'claude-opus-4-8' | 'claude-haiku-4-5-20251001';

export const DEFAULT_AI_SETTINGS: AiSettings = {
	apiKeyConfigured: false,
	model: 'claude-sonnet-5',
	maxToolRoundTrips: 8,
	advancedToolsEnabled: false,
};
```

## 4. `ai-feature-flag.ts`

```ts
import { environment } from 'src/environments/environment';

export abstract class AiFeatureFlag {
	static get enabled (): boolean {
		return !!( environment as any ).aiChatPanelEnabled;
	}
}
```

Add to both environment files:
```ts
// src/environments/environment.ts (dev)
export const environment = { /* ...existing... */, aiChatPanelEnabled: true };

// src/environments/environment.prod.ts
export const environment = { /* ...existing... */, aiChatPanelEnabled: false };
```
Flip `aiChatPanelEnabled` to `true` in prod only at the end of Phase 8 (doc 00).

## 5. Persistence extension point (not implemented in v1, interface reserved)

```ts
// src/app/ai/services/ai-transcript-store.service.ts (STUB ONLY — throws NotImplemented in v1)
export interface AiTranscriptStore {
	save( projectId: string, messages: AiChatMessage[] ): Promise<void>;
	load( projectId: string ): Promise<AiChatMessage[]>;
}
```
`AiConversationService` depends on the `AiTranscriptStore` interface (via DI
token `AI_TRANSCRIPT_STORE`) but the v1 provider is an in-memory no-op
(`InMemoryTranscriptStore`) so swapping in a real file-backed store later is a
one-line DI change, not a refactor. This satisfies "don't leave anything
half-designed" without requiring persistence to ship in v1.

## 6. Error taxonomy (used throughout docs 04–09)

| Error class | Thrown by | Meaning |
|---|---|---|
| `AiToolValidationError` | `AiTool.validate()` | Args fail semantic checks (e.g. road id not found) |
| `AiToolExecutionError` | `AiCommandService.execute()` | `ICommand.execute()` threw |
| `AiLlmTransportError` | `AiLlmClientService` | Network/IPC failure talking to main process or Anthropic |
| `AiLlmApiError` | `AiLlmClientService` | Anthropic API returned a non-2xx (auth, rate limit, etc.) — carries `status` and `AiChatError.kind` |
| `AiToolRegistryError` | `AiToolRegistry` | LLM requested an unknown tool name (should be impossible if `tools` param matches registry, but must be handled defensively) |

All five extend a common `AiError extends Error { readonly code: string }` base
defined alongside `AiChatError` in `ai-message.model.ts`.

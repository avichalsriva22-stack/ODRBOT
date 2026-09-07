/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

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

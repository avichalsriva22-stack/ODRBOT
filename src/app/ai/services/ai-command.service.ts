/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable } from '@angular/core';
import { CommandHistory } from 'app/commands/command-history';
import { AiToolRunResult } from '../models/ai-tool.model';
import { AiToolExecutionError, AiToolRegistryError } from '../models/ai-message.model';
import { AiToolRegistry } from '../tools/ai-tool-registry.service';
import { AiToolContextBuilderService } from './ai-tool-context-builder.service';
import { AiEventBusService } from './ai-event-bus.service';

/**
 * Single execution chokepoint for all AI-driven mutations (doc 04 §2).
 *
 * This is the ONLY place `CommandHistory.execute` / `executeMany` is called
 * from AI code. No individual `AiTool.run()` implementation may call
 * `CommandHistory` itself — enforced by code review checklist (doc 10 §5).
 *
 * The one documented exception is `UndoLastActionTool.run()`, which calls
 * `CommandHistory.undo()` directly and returns `{ commands: [] }`.
 */
@Injectable( { providedIn: 'root' } )
export class AiCommandService {

	constructor (
		private toolRegistry: AiToolRegistry,
		private toolContextBuilder: AiToolContextBuilderService,
		private eventBus: AiEventBusService
	) {}

	async execute ( toolName: string, args: Record<string, any> ): Promise<AiToolRunResult> {

		const tool = this.toolRegistry.get( toolName );

		if ( !tool ) {
			throw new AiToolRegistryError( `Unknown tool: ${ toolName }` );
		}

		const ctx = this.toolContextBuilder.build();

		// validate() throws AiToolValidationError on failure
		await tool.validate( args, ctx );

		// run() is pure: builds ICommand[] but does NOT execute them.
		// If run() throws, nothing has been pushed to CommandHistory yet —
		// map state is guaranteed untouched.
		let result: AiToolRunResult;
		try {
			result = await tool.run( args, ctx );
		} catch ( err ) {
			throw new AiToolExecutionError(
				err instanceof Error ? err.message : 'Unknown error during tool run'
			);
		}

		// Execute the commands through CommandHistory.
		// commands.length === 0 is valid for query/export tools and for
		// undo_last_action (which already called CommandHistory.undo() inside run()).
		if ( result.commands.length === 0 && tool.category !== 'query' && tool.name !== 'export_opendrive' && tool.name !== 'undo_last_action' ) {
			console.warn( `[AiCommandService] Mutating tool '${ toolName }' produced 0 commands. Ensure state changes are encapsulated in ICommand for undo tracking.` );
		}

		try {
			if ( result.commands.length === 1 ) {
				CommandHistory.execute( result.commands[ 0 ] );
			} else if ( result.commands.length > 1 ) {
				// executeMany wraps in MultiCmdsCommand — one Ctrl+Z undoes the entire action
				CommandHistory.executeMany( ...result.commands );
			}
		} catch ( err ) {
			throw new AiToolExecutionError(
				err instanceof Error ? err.message : 'Unknown error executing commands'
			);
		}

		return result;
	}

	async executeAsPlanStep ( toolName: string, args: Record<string, any>, planBuffer: any[] ): Promise<AiToolRunResult> {
		const tool = this.toolRegistry.get( toolName );

		if ( !tool ) {
			throw new AiToolRegistryError( `Unknown tool: ${ toolName }` );
		}

		const ctx = this.toolContextBuilder.build();

		// validate() throws AiToolValidationError on failure
		await tool.validate( args, ctx );

		// run() is pure: builds ICommand[] but does NOT execute them globally yet
		let result: AiToolRunResult;
		try {
			result = await tool.run( args, ctx );
		} catch ( err ) {
			throw new AiToolExecutionError(
				err instanceof Error ? err.message : 'Unknown error during tool run'
			);
		}

		// Execute the commands immediately so that subsequent steps can query the map state.
		for (const command of result.commands) {
			command.execute();
		}

		// Buffer the commands instead of calling CommandHistory.execute
		planBuffer.push( ...result.commands );

		return result;
	}
}

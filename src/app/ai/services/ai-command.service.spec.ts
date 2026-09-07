/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiCommandService } from './ai-command.service';
import { AiToolRegistry } from '../tools/ai-tool-registry.service';
import { AiToolContextBuilderService } from './ai-tool-context-builder.service';
import { AiTool, AiToolContext, AiToolRunResult } from '../models/ai-tool.model';
import { AiToolRegistryError, AiToolExecutionError } from '../models/ai-message.model';
import { CommandHistory } from 'app/commands/command-history';
import { ICommand } from 'app/commands/command';

describe( 'AiCommandService', () => {

	let service: AiCommandService;
	let mockRegistry: jasmine.SpyObj<AiToolRegistry>;
	let mockContextBuilder: jasmine.SpyObj<AiToolContextBuilderService>;
	let mockContext: AiToolContext;

	beforeEach( () => {

		mockRegistry = jasmine.createSpyObj( 'AiToolRegistry', [ 'get' ] );
		mockContextBuilder = jasmine.createSpyObj( 'AiToolContextBuilderService', [ 'build' ] );
		mockContext = { mapService: {} as any, selection: {} };
		mockContextBuilder.build.and.returnValue( mockContext );

		service = new AiCommandService( mockRegistry, mockContextBuilder );

		// Spy on CommandHistory static methods
		spyOn( CommandHistory, 'execute' );
		spyOn( CommandHistory, 'executeMany' );

	} );

	it( 'should throw AiToolRegistryError for unknown tool', async () => {

		mockRegistry.get.and.returnValue( undefined );

		try {
			await service.execute( 'nonexistent_tool', {} );
			fail( 'expected error' );
		} catch ( err ) {
			expect( err instanceof AiToolRegistryError ).toBe( true );
			expect( err.message ).toContain( 'Unknown tool' );
		}

	} );

	it( 'should call validate and run, then execute single command', async () => {

		const mockCmd: ICommand = { execute: () => {}, undo: () => {}, redo: () => {} };
		const mockTool: AiTool = {
			name: 'test_tool',
			category: 'road',
			description: 'test',
			parameters: { type: 'object', properties: {}, required: [] },
			requiresPreview: false,
			validate: jasmine.createSpy( 'validate' ).and.resolveTo(),
			run: jasmine.createSpy( 'run' ).and.resolveTo( {
				commands: [ mockCmd ],
				summary: 'done',
			} as AiToolRunResult ),
		};

		mockRegistry.get.and.returnValue( mockTool );

		const result = await service.execute( 'test_tool', { arg: 1 } );

		expect( mockTool.validate ).toHaveBeenCalledWith( { arg: 1 }, mockContext );
		expect( mockTool.run ).toHaveBeenCalledWith( { arg: 1 }, mockContext );
		expect( CommandHistory.execute ).toHaveBeenCalledWith( mockCmd );
		expect( CommandHistory.executeMany ).not.toHaveBeenCalled();
		expect( result.summary ).toBe( 'done' );

	} );

	it( 'should use executeMany for multiple commands', async () => {

		const cmd1: ICommand = { execute: () => {}, undo: () => {}, redo: () => {} };
		const cmd2: ICommand = { execute: () => {}, undo: () => {}, redo: () => {} };
		const mockTool: AiTool = {
			name: 'multi_tool',
			category: 'junction',
			description: 'test',
			parameters: { type: 'object', properties: {}, required: [] },
			requiresPreview: false,
			validate: jasmine.createSpy( 'validate' ).and.resolveTo(),
			run: jasmine.createSpy( 'run' ).and.resolveTo( {
				commands: [ cmd1, cmd2 ],
				summary: 'multi done',
			} as AiToolRunResult ),
		};

		mockRegistry.get.and.returnValue( mockTool );

		await service.execute( 'multi_tool', {} );

		expect( CommandHistory.executeMany ).toHaveBeenCalledWith( cmd1, cmd2 );
		expect( CommandHistory.execute ).not.toHaveBeenCalled();

	} );

	it( 'should not call CommandHistory for zero-command results (query tools)', async () => {

		const mockTool: AiTool = {
			name: 'query_tool',
			category: 'query',
			description: 'test',
			parameters: { type: 'object', properties: {}, required: [] },
			requiresPreview: false,
			validate: jasmine.createSpy( 'validate' ).and.resolveTo(),
			run: jasmine.createSpy( 'run' ).and.resolveTo( {
				commands: [],
				summary: 'queried',
				data: { roads: [] },
			} as AiToolRunResult ),
		};

		mockRegistry.get.and.returnValue( mockTool );

		const result = await service.execute( 'query_tool', {} );

		expect( CommandHistory.execute ).not.toHaveBeenCalled();
		expect( CommandHistory.executeMany ).not.toHaveBeenCalled();
		expect( result.data ).toEqual( { roads: [] } );

	} );

	it( 'should propagate validation errors without executing commands', async () => {

		const { AiToolValidationError } = await import( '../models/ai-tool.model' );
		const mockTool: AiTool = {
			name: 'fail_validate',
			category: 'road',
			description: 'test',
			parameters: { type: 'object', properties: {}, required: [] },
			requiresPreview: false,
			validate: jasmine.createSpy( 'validate' ).and.callFake( () => {
				throw new AiToolValidationError( 'road not found', 'roadId' );
			} ),
			run: jasmine.createSpy( 'run' ),
		};

		mockRegistry.get.and.returnValue( mockTool );

		try {
			await service.execute( 'fail_validate', { roadId: 999 } );
			fail( 'expected error' );
		} catch ( err ) {
			expect( err.name ).toBe( 'AiToolValidationError' );
		}

		expect( mockTool.run ).not.toHaveBeenCalled();
		expect( CommandHistory.execute ).not.toHaveBeenCalled();

	} );

} );

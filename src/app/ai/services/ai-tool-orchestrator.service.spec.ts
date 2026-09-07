import { TestBed } from '@angular/core/testing';
import { AiToolOrchestratorService } from './ai-tool-orchestrator.service';
import { AiToolRegistry } from '../tools/ai-tool-registry.service';
import { AiCommandService } from './ai-command.service';
import { AiToolContextBuilderService } from './ai-tool-context-builder.service';
import { AiPreviewService } from './ai-preview.service';
import { MapService } from 'app/services/map/map.service';
import { AiLlmClientService } from './ai-llm-client.service';
import { AiSettingsService } from './ai-settings.service';
import { AiPlan } from '../models/ai-plan.model';

describe( 'AiToolOrchestratorService', () => {
	let service: AiToolOrchestratorService;
	let toolRegistrySpy: jasmine.SpyObj<AiToolRegistry>;
	let commandServiceSpy: jasmine.SpyObj<AiCommandService>;
	let ctxBuilderSpy: jasmine.SpyObj<AiToolContextBuilderService>;
	let previewSpy: jasmine.SpyObj<AiPreviewService>;
	let mapServiceSpy: jasmine.SpyObj<MapService>;
	let settingsSpy: any;

	beforeEach( () => {
		toolRegistrySpy = jasmine.createSpyObj( 'AiToolRegistry', [ 'get' ] );
		commandServiceSpy = jasmine.createSpyObj( 'AiCommandService', [ 'execute', 'executeAsPlanStep' ] );
		ctxBuilderSpy = jasmine.createSpyObj( 'AiToolContextBuilderService', [ 'build' ] );
		previewSpy = jasmine.createSpyObj( 'AiPreviewService', [ 'awaitUserConfirmation' ] );
		mapServiceSpy = jasmine.createSpyObj( 'MapService', [], { map: { getRoad: () => undefined } } );
		settingsSpy = { current: { planStepConfirmationPolicy: 'batch', model: 'claude-sonnet-5' } };

		TestBed.configureTestingModule( {
			providers: [
				AiToolOrchestratorService,
				{ provide: AiToolRegistry, useValue: toolRegistrySpy },
				{ provide: AiCommandService, useValue: commandServiceSpy },
				{ provide: AiToolContextBuilderService, useValue: ctxBuilderSpy },
				{ provide: AiPreviewService, useValue: previewSpy },
				{ provide: MapService, useValue: mapServiceSpy },
				{ provide: AiLlmClientService, useValue: jasmine.createSpyObj( 'AiLlmClientService', [ 'streamCompletion' ] ) },
				{ provide: AiSettingsService, useValue: settingsSpy }
			]
		} );
		service = TestBed.inject( AiToolOrchestratorService );
	} );

	it( 'should execute plan via executeAsPlanStep and flush commands', async () => {
		const plan: AiPlan = {
			id: 'p1', goalText: '', createdAt: 0, status: 'awaiting_review', commandGroupId: 'g1',
			steps: [
				{ id: 's1', index: 1, description: '', toolName: 't1', args: {}, dependsOn: [], status: 'pending', hasUnresolvedReferences: false }
			]
		};

		const mockTool = { validate: jasmine.createSpy().and.returnValue( Promise.resolve() ), requiresPreview: false };
		toolRegistrySpy.get.and.returnValue( mockTool as any );
		commandServiceSpy.executeAsPlanStep.and.callFake( async ( _name, _args, buf: any[] ) => {
			buf.push( { execute: () => {}, undo: () => {} } as any );
			return { summary: 'ok', commands: [] } as any;
		} );

		await service.executePlan( plan );

		expect( plan.status ).toBe( 'completed' );
		expect( plan.steps[ 0 ].status ).toBe( 'succeeded' );
		expect( commandServiceSpy.executeAsPlanStep ).toHaveBeenCalled();
	} );

	it( 'should skip dependents on failure', async () => {
		const plan: AiPlan = {
			id: 'p1', goalText: '', createdAt: 0, status: 'awaiting_review', commandGroupId: 'g1',
			steps: [
				{ id: 's1', index: 1, description: '', toolName: 't1', args: {}, dependsOn: [], status: 'pending', hasUnresolvedReferences: false },
				{ id: 's2', index: 2, description: '', toolName: 't2', args: {}, dependsOn: [ 's1' ], status: 'pending', hasUnresolvedReferences: false }
			]
		};

		const mockTool = { validate: jasmine.createSpy().and.returnValue( Promise.resolve() ), requiresPreview: false };
		toolRegistrySpy.get.and.returnValue( mockTool as any );
		commandServiceSpy.executeAsPlanStep.and.throwError( 'Exec fail' );

		await service.executePlan( plan );

		expect( plan.status ).toBe( 'completed_with_errors' );
		expect( plan.steps[ 0 ].status ).toBe( 'failed' );
		expect( plan.steps[ 1 ].status ).toBe( 'skipped' );
	} );

	it( 'should resolve cross-step arg references', async () => {
		const plan: AiPlan = {
			id: 'p1', goalText: '', createdAt: 0, status: 'awaiting_review', commandGroupId: 'g1',
			steps: [
				{ id: 's1', index: 1, description: '', toolName: 't1', args: {}, dependsOn: [], status: 'pending', hasUnresolvedReferences: false },
				{ id: 's2', index: 2, description: '', toolName: 't2', args: { refId: '${s1.createdIds[0].id}' }, dependsOn: [ 's1' ], status: 'pending', hasUnresolvedReferences: true }
			]
		};

		const mockTool = { validate: jasmine.createSpy().and.returnValue( Promise.resolve() ), requiresPreview: false };
		toolRegistrySpy.get.and.returnValue( mockTool as any );

		commandServiceSpy.executeAsPlanStep.and.callFake( async ( name, _args, buf: any[] ) => {
			if ( name === 't1' ) return { summary: 'ok', createdIds: [ { type: 'road', id: 42 } ], commands: [] } as any;
			return { summary: 'ok', commands: [] } as any;
		} );

		await service.executePlan( plan );

		expect( plan.status ).toBe( 'completed' );
		expect( commandServiceSpy.executeAsPlanStep ).toHaveBeenCalledWith( 't2', { refId: 42 }, jasmine.any( Array ) );
	} );

	it( 'should emit plan via watchPlan', async () => {
		const plan: AiPlan = {
			id: 'p1', goalText: '', createdAt: 0, status: 'awaiting_review', commandGroupId: 'g1',
			steps: [
				{ id: 's1', index: 1, description: '', toolName: 't1', args: {}, dependsOn: [], status: 'pending', hasUnresolvedReferences: false }
			]
		};

		const mockTool = { validate: jasmine.createSpy().and.returnValue( Promise.resolve() ), requiresPreview: false };
		toolRegistrySpy.get.and.returnValue( mockTool as any );
		commandServiceSpy.executeAsPlanStep.and.returnValue( Promise.resolve( { summary: 'ok', commands: [] } ) as any );

		const emitted: string[] = [];
		service.watchPlan( 'p1' ).subscribe( p => { if ( p && p.id === 'p1' ) emitted.push( p.status ); } );

		await service.executePlan( plan );

		expect( emitted ).toContain( 'completed' );
	} );
} );

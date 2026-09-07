import { TestBed } from '@angular/core/testing';
import { AiPlannerService } from './ai-planner.service';
import { AiLlmClientService, AiStreamEvent } from './ai-llm-client.service';
import { AiToolRegistry } from '../tools/ai-tool-registry.service';
import { AiSettingsService } from './ai-settings.service';
import { Subject } from 'rxjs';
import { AiMapContext } from './ai-context.service';

describe('AiPlannerService', () => {
	let service: AiPlannerService;
	let llmClientSpy: jasmine.SpyObj<AiLlmClientService>;
	let toolRegistrySpy: jasmine.SpyObj<AiToolRegistry>;
	let settingsSpy: jasmine.SpyObj<AiSettingsService>;

	beforeEach(() => {
		llmClientSpy = jasmine.createSpyObj('AiLlmClientService', ['streamCompletion']);
		toolRegistrySpy = jasmine.createSpyObj('AiToolRegistry', ['getEnabledToolSchemas']);
		settingsSpy = jasmine.createSpyObj('AiSettingsService', [], { current: { model: 'claude-sonnet-5' } });

		TestBed.configureTestingModule({
			providers: [
				AiPlannerService,
				{ provide: AiLlmClientService, useValue: llmClientSpy },
				{ provide: AiToolRegistry, useValue: toolRegistrySpy },
				{ provide: AiSettingsService, useValue: settingsSpy }
			]
		});
		service = TestBed.inject(AiPlannerService);
	});

	it('should generate a plan', async () => {

		toolRegistrySpy.getEnabledToolSchemas.and.returnValue([{ name: 'test_tool', description: 'desc', input_schema: {} as any }]);

		const streamSubject = new Subject<AiStreamEvent>();
		llmClientSpy.streamCompletion.and.returnValue(streamSubject.asObservable());

		const planPromise = service.generatePlan('build intersection', {} as AiMapContext);

		const mockPlan = {
			summary: 'Will build intersection',
			steps: [
				{ description: 'step 1', toolName: 'create_road', args: { length: 10 }, dependsOnStepIndices: [] },
				{ description: 'step 2', toolName: 'create_road', args: { length: 20 }, dependsOnStepIndices: [1] }
			]
		};
		const jsonStr = JSON.stringify(mockPlan);
		
		streamSubject.next({ type: 'tool_use_input_delta', id: 'tool1', partialJson: jsonStr } as any);
		streamSubject.complete();

		const plan = await planPromise;

		expect(plan.status).toBe('awaiting_review');
		expect(plan.steps.length).toBe(2);
		expect(plan.steps[0].index).toBe(1);
		expect(plan.steps[1].index).toBe(2);
		
		// Dependency mapped correctly to UUID
		expect(plan.steps[1].dependsOn[0]).toBe(plan.steps[0].id);
	});
});

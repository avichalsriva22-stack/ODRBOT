import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { AiConversationService } from './ai-conversation.service';
import { AiLlmClientService, AiStreamEvent } from './ai-llm-client.service';
import { AiToolRegistry } from '../tools/ai-tool-registry.service';
import { AiCommandService } from './ai-command.service';
import { AiContextService } from './ai-context.service';
import { AiPreviewService } from './ai-preview.service';
import { AiSettingsService } from './ai-settings.service';
import { AiToolContextBuilderService } from './ai-tool-context-builder.service';
import { BehaviorSubject, Observable, of, Subject, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { AiTool, AiToolCategory, AiToolContext, AiToolPreviewResult, AiToolRunResult, AiToolValidationError } from '../models/ai-tool.model';

describe('AiConversationService', () => {
	let service: AiConversationService;
	let llmClientSpy: jasmine.SpyObj<AiLlmClientService>;
	let toolRegistrySpy: jasmine.SpyObj<AiToolRegistry>;
	let commandServiceSpy: jasmine.SpyObj<AiCommandService>;
	let contextServiceSpy: jasmine.SpyObj<AiContextService>;
	let toolContextBuilderSpy: jasmine.SpyObj<AiToolContextBuilderService>;
	let previewServiceSpy: jasmine.SpyObj<AiPreviewService>;
	let settingsServiceSpy: jasmine.SpyObj<AiSettingsService>;

	let mockSettings: any;

	beforeEach(() => {
		llmClientSpy = jasmine.createSpyObj('AiLlmClientService', ['streamCompletion']);
		toolRegistrySpy = jasmine.createSpyObj('AiToolRegistry', ['getEnabledToolSchemas', 'get']);
		commandServiceSpy = jasmine.createSpyObj('AiCommandService', ['execute']);
		contextServiceSpy = jasmine.createSpyObj('AiContextService', ['buildContext']);
		toolContextBuilderSpy = jasmine.createSpyObj('AiToolContextBuilderService', ['build']);
		previewServiceSpy = jasmine.createSpyObj('AiPreviewService', ['awaitUserConfirmation']);
		settingsServiceSpy = jasmine.createSpyObj('AiSettingsService', [], { current: {} });

		mockSettings = {
			model: 'test-model',
			maxToolRoundTrips: 3,
			advancedToolsEnabled: false
		};
		Object.defineProperty(settingsServiceSpy, 'current', { get: () => mockSettings });

		contextServiceSpy.buildContext.and.returnValue({} as any);
		toolContextBuilderSpy.build.and.returnValue({} as any);

		TestBed.configureTestingModule({
			providers: [
				AiConversationService,
				{ provide: AiLlmClientService, useValue: llmClientSpy },
				{ provide: AiToolRegistry, useValue: toolRegistrySpy },
				{ provide: AiCommandService, useValue: commandServiceSpy },
				{ provide: AiContextService, useValue: contextServiceSpy },
				{ provide: AiToolContextBuilderService, useValue: toolContextBuilderSpy },
				{ provide: AiPreviewService, useValue: previewServiceSpy },
				{ provide: AiSettingsService, useValue: settingsServiceSpy }
			]
		});
		service = TestBed.inject(AiConversationService);
	});

	it('should handle a plain text response with no tool calls', async () => {
		llmClientSpy.streamCompletion.and.returnValue(of(
			{ type: 'text_delta', text: 'Hello ' },
			{ type: 'text_delta', text: 'world!' },
			{ type: 'message_stop' }
		) as Observable<AiStreamEvent>);

		await service.sendMessage('Hi');

		const msgs = service['messages$'].value;
		expect(msgs.length).toBe(2);
		expect(msgs[0].role).toBe('user');
		expect(msgs[0].text).toBe('Hi');
		expect(msgs[1].role).toBe('assistant');
		expect(msgs[1].text).toBe('Hello world!');
		expect(msgs[1].streaming).toBeFalse();

		expect(service['apiTranscript'].length).toBe(2);
	});

	it('should execute a single tool call with requiresPreview: false and continue the loop', async () => {
		const mockTool: AiTool = {
			name: 'mock_tool',
			category: 'road',
			description: '',
			parameters: { type: 'object', properties: {}, required: [] },
			requiresPreview: false,
			validate: () => {},
			run: async () => ({ commands: [], summary: 'Did a thing' })
		};
		toolRegistrySpy.get.and.returnValue(mockTool);
		commandServiceSpy.execute.and.returnValue(Promise.resolve({ summary: 'Did a thing', commands: [] }));

		// First turn: model outputs a tool call
		// Second turn: model outputs text
		llmClientSpy.streamCompletion.and.returnValues(
			of(
				{ type: 'text_delta', text: 'Sure, ' },
				{ type: 'tool_use_start', id: 'call_1', name: 'mock_tool' },
				{ type: 'tool_use_input_delta', id: 'call_1', partialJson: '{}' },
				{ type: 'tool_use_end', id: 'call_1' },
				{ type: 'message_stop' }
			),
			of(
				{ type: 'text_delta', text: 'Done.' },
				{ type: 'message_stop' }
			)
		);

		await service.sendMessage('Do it');

		expect(llmClientSpy.streamCompletion).toHaveBeenCalledTimes(2);
		expect(commandServiceSpy.execute).toHaveBeenCalledWith('mock_tool', {});
		
		const msgs = service['messages$'].value;
		// 1 user msg, 1 assistant msg with tool call, 1 assistant msg with final text
		expect(msgs.length).toBe(3);
		expect(msgs[1].toolCalls![0].status).toBe('succeeded');
	});

	it('should pause for confirmation if requiresPreview is true, and execute on confirm', async () => {
		const mockTool: AiTool = {
			name: 'mock_preview_tool',
			category: 'road',
			description: '',
			parameters: { type: 'object', properties: {}, required: [] },
			requiresPreview: true,
			validate: () => {},
			preview: async () => ({ description: 'Preview', diff: [] }),
			run: async () => ({ commands: [], summary: 'Executed' })
		};
		toolRegistrySpy.get.and.returnValue(mockTool);
		commandServiceSpy.execute.and.returnValue(Promise.resolve({ summary: 'Executed', commands: [] }));

		// Simulate the user confirming via the service
		previewServiceSpy.awaitUserConfirmation.and.returnValue(Promise.resolve(true));

		llmClientSpy.streamCompletion.and.returnValues(
			of(
				{ type: 'tool_use_start', id: 'call_1', name: 'mock_preview_tool' },
				{ type: 'tool_use_input_delta', id: 'call_1', partialJson: '{}' },
				{ type: 'tool_use_end', id: 'call_1' },
				{ type: 'message_stop' }
			),
			of(
				{ type: 'text_delta', text: 'Done.' },
				{ type: 'message_stop' }
			)
		);

		await service.sendMessage('Do it');

		expect(previewServiceSpy.awaitUserConfirmation).toHaveBeenCalledWith('call_1');
		expect(commandServiceSpy.execute).toHaveBeenCalled();
	});

	it('should pause for confirmation, and NOT execute on reject', async () => {
		const mockTool: AiTool = {
			name: 'mock_preview_tool',
			category: 'road',
			description: '',
			parameters: { type: 'object', properties: {}, required: [] },
			requiresPreview: true,
			validate: () => {},
			preview: async () => ({ description: 'Preview', diff: [] }),
			run: async () => ({ commands: [], summary: 'Executed' })
		};
		toolRegistrySpy.get.and.returnValue(mockTool);

		// Simulate user rejecting
		previewServiceSpy.awaitUserConfirmation.and.returnValue(Promise.resolve(false));

		llmClientSpy.streamCompletion.and.returnValues(
			of(
				{ type: 'tool_use_start', id: 'call_1', name: 'mock_preview_tool' },
				{ type: 'tool_use_input_delta', id: 'call_1', partialJson: '{}' },
				{ type: 'message_stop' }
			),
			of(
				{ type: 'text_delta', text: 'Aborted.' },
				{ type: 'message_stop' }
			)
		);

		await service.sendMessage('Do it');

		expect(previewServiceSpy.awaitUserConfirmation).toHaveBeenCalled();
		expect(commandServiceSpy.execute).not.toHaveBeenCalled();
		const msgs = service['messages$'].value;
		expect(msgs[1].toolCalls![0].status).toBe('rejected');
	});

	it('should stop when maxToolRoundTrips is reached', async () => {
		const mockTool: AiTool = {
			name: 'mock_tool', category: 'road', description: '',
			parameters: { type: 'object', properties: {}, required: [] },
			requiresPreview: false,
			validate: () => {}, run: async () => ({ commands: [], summary: '' })
		};
		toolRegistrySpy.get.and.returnValue(mockTool);
		commandServiceSpy.execute.and.returnValue(Promise.resolve({ summary: '', commands: [] }));
		mockSettings.maxToolRoundTrips = 2; // only 2 round trips allowed

		// It will just loop endlessly calling tools until stopped
		llmClientSpy.streamCompletion.and.returnValue(
			of(
				{ type: 'tool_use_start', id: 'call_n', name: 'mock_tool' },
				{ type: 'tool_use_input_delta', id: 'call_n', partialJson: '{}' },
				{ type: 'message_stop' }
			)
		);

		await service.sendMessage('Do it');

		expect(llmClientSpy.streamCompletion).toHaveBeenCalledTimes(2);
		const msgs = service['messages$'].value;
		const lastMsg = msgs[msgs.length - 1];
		expect(lastMsg.role).toBe('assistant');
		expect(lastMsg.text).toContain('I\'ve made several changes but the task seems to still be in progress');
	});

	it('should handle malformed JSON gracefully', async () => {
		llmClientSpy.streamCompletion.and.returnValues(
			of(
				{ type: 'tool_use_start', id: 'call_1', name: 'mock_tool' },
				{ type: 'tool_use_input_delta', id: 'call_1', partialJson: '{ invalid json ' },
				{ type: 'message_stop' }
			),
			of({ type: 'message_stop' })
		);

		await service.sendMessage('Do it');

		const msgs = service['messages$'].value;
		expect(msgs[1].toolCalls![0].status).toBe('failed');
		expect(commandServiceSpy.execute).not.toHaveBeenCalled();
	});

	it('should automatically retry once on network error', fakeAsync(() => {
		let callCount = 0;
		llmClientSpy.streamCompletion.and.callFake(() => {
			callCount++;
			if (callCount === 1) {
				return throwError({ message: 'Network failed', retryable: true });
			}
			return of({ type: 'text_delta', text: 'Success on retry' }, { type: 'message_stop' }) as any;
		});

		service.sendMessage('Hi');
		tick(1000); // Fast-forward the 1-second timeout

		expect(llmClientSpy.streamCompletion).toHaveBeenCalledTimes(2);
		const msgs = service['messages$'].value;
		const lastMsg = msgs[msgs.length - 1];
		expect(lastMsg.text).toBe('Success on retry');
	}));

	it('should not retry on auth/rate_limit error', fakeAsync(() => {
		llmClientSpy.streamCompletion.and.returnValue(throwError({ status: 401, type: 'auth' }));

		service.sendMessage('Hi');
		tick(1000); // just in case

		expect(llmClientSpy.streamCompletion).toHaveBeenCalledTimes(1);
		const msgs = service['messages$'].value;
		const lastMsg = msgs[msgs.length - 1];
		expect(lastMsg.error?.kind).toBe('auth');
	}));

	it('should handle cancellation mid-stream', fakeAsync(() => {
		const stream$ = new Subject<AiStreamEvent>();
		llmClientSpy.streamCompletion.and.returnValue(stream$);

		service.sendMessage('Hi');

		stream$.next({ type: 'text_delta', text: 'Halfway ' });

		service.cancelCurrentTurn();

		stream$.next({ type: 'text_delta', text: 'there.' });
		stream$.complete();

		const msgs = service['messages$'].value;
		const lastMsg = msgs[msgs.length - 1];
		expect(lastMsg.text).toBe('Halfway '); // "there." should be ignored
		expect(lastMsg.streaming).toBeFalse();
	}));
});

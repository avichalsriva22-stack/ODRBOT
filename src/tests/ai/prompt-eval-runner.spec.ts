import { TestBed } from '@angular/core/testing';
import { AiConversationService } from 'app/ai/services/ai-conversation.service';
import { AiLlmClientService } from 'app/ai/services/ai-llm-client.service';
import { AiToolRegistry } from 'app/ai/tools/ai-tool-registry.service';
import { AiCommandService } from 'app/ai/services/ai-command.service';
import { AiContextService } from 'app/ai/services/ai-context.service';
import { AiPreviewService } from 'app/ai/services/ai-preview.service';
import { AiSettingsService } from 'app/ai/services/ai-settings.service';
import { AiToolContextBuilderService } from 'app/ai/services/ai-tool-context-builder.service';
import { of } from 'rxjs';
const evalCases = require('./prompt-eval-cases.json');

describe('Prompt Evaluation Runner', () => {

	// This is a test harness that runs scripted test cases against AiConversationService
	// Note: For CI, this uses a fully mocked AiLlmClientService. 
	// The test:ai-live script (to be used manually) would use a real client or a custom setup.

	let conversationService: AiConversationService;
	let llmClientSpy: jasmine.SpyObj<AiLlmClientService>;

	beforeEach(() => {
		llmClientSpy = jasmine.createSpyObj('AiLlmClientService', ['streamCompletion']);

		TestBed.configureTestingModule({
			providers: [
				AiConversationService,
				{ provide: AiLlmClientService, useValue: llmClientSpy },
				// Other services could be fully mocked or use real implementations
				{ provide: AiToolRegistry, useValue: jasmine.createSpyObj('AiToolRegistry', ['getEnabledToolSchemas', 'get']) },
				{ provide: AiCommandService, useValue: jasmine.createSpyObj('AiCommandService', ['execute']) },
				{ provide: AiContextService, useValue: jasmine.createSpyObj('AiContextService', ['buildContext']) },
				{ provide: AiToolContextBuilderService, useValue: jasmine.createSpyObj('AiToolContextBuilderService', ['build']) },
				{ provide: AiPreviewService, useValue: jasmine.createSpyObj('AiPreviewService', ['awaitUserConfirmation']) },
				{ provide: AiSettingsService, useValue: { current: { model: 'mock-model', maxToolRoundTrips: 3, advancedToolsEnabled: false } } }
			]
		});
		
		conversationService = TestBed.inject(AiConversationService);
	});

	// Dynamic tests based on the JSON array
	(evalCases as any[]).forEach(testCase => {
		if (!testCase.prompt) return; // skip default import object if present

		it(`eval: "${testCase.prompt}" -> expects ${JSON.stringify(testCase.expectedToolCalls)}`, async () => {
			
			// For this automated CI mock, we just want to ensure that if the LLM output 
			// tool calls, the conversation service processes them correctly. 
			// A true prompt evaluation against the real API would have the mock return exactly 
			// what Anthropic returns for the given prompt.
			// Here we simulate the LLM actually outputting the expected tools to test the loop:

			const streamEvents: any[] = [];
			
			testCase.expectedToolCalls.forEach((toolName: string, index: number) => {
				streamEvents.push({ type: 'tool_use_start', id: `call_${index}`, name: toolName });
				streamEvents.push({ type: 'tool_use_input_delta', id: `call_${index}`, partialJson: '{}' });
				streamEvents.push({ type: 'tool_use_end', id: `call_${index}` });
			});
			
			streamEvents.push({ type: 'message_stop' });

			if (testCase.expectedToolCalls.length === 0) {
				// simulate plain text response
				streamEvents.unshift({ type: 'text_delta', text: 'I need more information.' });
			}

			// In CI, return our mock stream
			llmClientSpy.streamCompletion.and.returnValue(of(...streamEvents));

			await conversationService.sendMessage(testCase.prompt);

			const msgs = conversationService['messages$'].value;
			const lastAssistantMsg = msgs.find(m => m.role === 'assistant');
			
			expect(lastAssistantMsg).toBeTruthy();
			
			const toolNames = lastAssistantMsg?.toolCalls?.map(c => c.toolName) || [];
			expect(toolNames).toEqual(testCase.expectedToolCalls);
		});
	});
});

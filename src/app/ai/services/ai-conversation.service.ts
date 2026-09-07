import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, toArray } from 'rxjs/operators';
import { AiLlmClientService, AiApiMessage, AiApiContentBlock, AiStreamEvent } from './ai-llm-client.service';
import { AiToolRegistry } from '../tools/ai-tool-registry.service';
import { AiCommandService } from './ai-command.service';
import { AiContextService } from './ai-context.service';
import { AiPreviewService } from './ai-preview.service';
import { AiSettingsService } from './ai-settings.service';
import { AiToolValidationError } from '../models/ai-tool.model';
import { AiChatMessage, AiToolCallRecord, AiChatError, AiImageAttachment } from '../models/ai-message.model';
import { AiToolContextBuilderService } from './ai-tool-context-builder.service';
import { MathUtils } from 'three';
import { AiIntentClassifierService } from './ai-intent-classifier.service';
import { AiPlannerService } from './ai-planner.service';

// Maps Bridge/API errors to UI chat errors
function mapErrorToAiChatError(err: any): AiChatError {
	if (err && (err.type === 'auth' || err.status === 401)) {
		return { kind: 'auth', message: 'API key is missing or invalid.', retryable: false };
	}
	if (err && (err.type === 'rate_limit' || err.status === 429)) {
		return { kind: 'rate_limit', message: 'You have exceeded the API rate limit.', retryable: false };
	}
	return { kind: 'network', message: err?.message || 'A network or transport error occurred.', retryable: true };
}

@Injectable({ providedIn: 'root' })
export class AiConversationService {

	private messages$ = new BehaviorSubject<AiChatMessage[]>([]);
	readonly messages: Observable<AiChatMessage[]> = this.messages$.asObservable();

	private apiTranscript: AiApiMessage[] = []; // Anthropic-shape mirror
	private currentStreamSubscription: any = null;

	constructor(
		private llmClient: AiLlmClientService,
		private toolRegistry: AiToolRegistry,
		private commandService: AiCommandService,
		private contextService: AiContextService,
		private toolContextBuilder: AiToolContextBuilderService,
		private previewService: AiPreviewService,
		private settingsService: AiSettingsService,
		private intentClassifier: AiIntentClassifierService,
		private planner: AiPlannerService
	) {}

	async sendMessage(userText: string, images?: AiImageAttachment[], explicitMode: 'chat' | 'goal' | 'auto' = 'auto'): Promise<void> {
		const hasImage = !!(images && images.length > 0);
		
		// Immediately append user message to UI so they don't wait for the intent classifier LLM
		this.appendMessage({ role: 'user', text: userText, images });
		
		const thinkingMsg = this.appendMessage({ role: 'assistant', text: 'Thinking...', streaming: true });
		
		let mode: 'chat' | 'goal' | 'ambiguous';
		try {
			if (explicitMode === 'auto') {
				mode = await this.intentClassifier.classify(userText, hasImage);
			} else {
				mode = explicitMode;
			}
		} catch (err: any) {
			const chatErr = mapErrorToAiChatError(err);
			this.updateMessage(thinkingMsg.id, msg => ({
				...msg,
				text: '',
				streaming: false,
				error: chatErr
			}));
			return;
		}

		if (mode === 'ambiguous') {
			this.updateMessage(thinkingMsg.id, msg => ({
				...msg,
				streaming: false,
				text: 'Do you want me to make one specific change, or build something more complete from scratch? I can do either.'
			}));
			
			const ambBlocks: AiApiContentBlock[] = [];
			if (images && images.length > 0) {
				for (const img of images) {
					ambBlocks.push({
						type: 'image',
						source: { type: 'base64', media_type: img.mediaType, data: img.base64 }
					});
				}
			}
			if (userText) ambBlocks.push({ type: 'text', text: userText });
			this.apiTranscript.push({ role: 'user', content: ambBlocks });
			this.apiTranscript.push({ role: 'assistant', content: [{ type: 'text', text: 'Do you want me to make one specific change, or build something more complete from scratch? I can do either.' }] });
			
			return;
		}

		if (mode === 'goal') {
			try {
				const plan = await this.planner.generatePlan(userText, this.contextService.buildContext(), images || [], this.apiTranscript);
				// update the planning message with the plan
				this.updateMessage(thinkingMsg.id, msg => ({
					...msg,
					text: 'I have created a plan for your request.',
					streaming: false,
					planId: plan.id
				}));
			} catch (err: any) {
				const chatErr = mapErrorToAiChatError(err);
				this.updateMessage(thinkingMsg.id, msg => ({
					...msg,
					text: '',
					streaming: false,
					error: chatErr
				}));
			}
			return;
		}

		// For 'chat' mode, remove the 'Thinking...' message because runTurn creates its own streaming message
		const currentMsgs = this.messages$.value;
		this.messages$.next(currentMsgs.filter(m => m.id !== thinkingMsg.id));

		const contentBlocks: AiApiContentBlock[] = [];
		if (images && images.length > 0) {
			for (const img of images) {
				contentBlocks.push({
					type: 'image',
					source: { type: 'base64', media_type: img.mediaType, data: img.base64 }
				});
			}
		}
		if (userText) {
			contentBlocks.push({ type: 'text', text: userText });
		}

		this.apiTranscript.push({ role: 'user', content: contentBlocks });

		await this.runTurn(0);
	}

	private appendMessage(msg: Omit<AiChatMessage, 'id' | 'createdAt' | 'toolCalls'>): AiChatMessage {
		const newMsg: AiChatMessage = {
			...msg,
			id: MathUtils.generateUUID(),
			createdAt: Date.now(),
			toolCalls: []
		};
		this.messages$.next([...this.messages$.value, newMsg]);
		return newMsg;
	}

	private updateMessage(id: string, updateFn: (msg: AiChatMessage) => AiChatMessage): void {
		const current = this.messages$.value;
		const index = current.findIndex(m => m.id === id);
		if (index === -1) return;
		const newMsgs = [...current];
		newMsgs[index] = updateFn(newMsgs[index]);
		this.messages$.next(newMsgs);
	}

	private markMessageError(id: string, error: AiChatError): void {
		this.updateMessage(id, msg => ({ ...msg, error, streaming: false }));
	}

	private finalizeStreamingMessage(id: string): void {
		this.updateMessage(id, msg => ({ ...msg, streaming: false }));
	}

	private recordToolCall(msgId: string, call: { id: string; name: string }): AiToolCallRecord {
		const record: AiToolCallRecord = {
			id: call.id,
			toolName: call.name,
			status: 'pending_preview',
			args: {}
		};
		this.updateMessage(msgId, msg => ({ ...msg, toolCalls: [...(msg.toolCalls || []), record] }));
		return record;
	}

	private updateToolCallStatus(id: string, status: AiToolCallRecord['status'], extra: Partial<AiToolCallRecord> = {}): void {
		const current = this.messages$.value;
		let found = false;
		for (let i = current.length - 1; i >= 0; i--) {
			const msg = current[i];
			if (msg.toolCalls) {
				const toolIdx = msg.toolCalls.findIndex(t => t.id === id);
				if (toolIdx !== -1) {
					const newMsgs = [...current];
					const newToolCalls = [...msg.toolCalls];
					newToolCalls[toolIdx] = { ...newToolCalls[toolIdx], status, ...extra };
					newMsgs[i] = { ...msg, toolCalls: newToolCalls };
					this.messages$.next(newMsgs);
					found = true;
					break;
				}
			}
		}
	}

	private buildSystemPrompt(context: any): string {
		return `You are the AI assistant embedded in Truevision Designer, a 3D road-design
tool that edits OpenDRIVE (.xodr) road networks. You help the user modify
the current map by calling the tools provided. You cannot see the 3D
viewport directly — you only know what is in the JSON context below and
what the tools tell you.

Rules:
1. Only use the tools provided. Never claim to have made a change unless a
   tool call succeeded.
2. When the user refers to "the road", "this junction", "it", etc., use the
   \`selection\` field in the context. If nothing is selected and the request
   is ambiguous, ask a brief clarifying question instead of guessing.
3. When the user gives a relative spatial instruction (e.g. "north of the
   selected road", "at the end of this road", "50 meters further"), compute
   the absolute x, y, and heading yourself from the road geometry given in
   the context (start/end position, heading) before calling a tool. Do not
   ask the user for coordinates unless the context does not contain enough
   information to compute them.
4. Prefer \`extend_road_from_selected\` over \`create_road\` whenever a road is
   selected and the user wants continuity/connection.
5. If a tool call fails validation, read the error message and either fix
   your arguments and retry once, or explain the problem to the user in
   plain language — do not retry the same failing call more than once.
6. Some tools require user confirmation before they take effect (you will
   see this in the tool result). This is normal; wait for the result of the
   next turn rather than assuming the action happened.
7. Do not perform bulk/procedural generation (e.g. "build an entire city",
   "generate 50 roads") — these tools are for targeted, specific edits.
   If asked for something like this, explain that you can help with one
   piece at a time and ask which part to start with.
8. Only call \`export_opendrive\` or \`undo_last_action\` when the user
   explicitly asks for that specific action.
9. Keep your text responses brief and concrete — state what you did or are
   about to do, not generic filler.

Current map context (JSON):
${JSON.stringify(context)}`;
	}

	private handleStreamEvent(
		event: AiStreamEvent, 
		assistantMessage: AiChatMessage, 
		pendingToolCalls: { id: string; name: string; inputJson: string }[],
		state: { textBuffer: string }
	): void {
		if (event.type === 'text_delta') {
			state.textBuffer += event.text;
			this.updateMessage(assistantMessage.id, msg => ({ ...msg, text: state.textBuffer }));
		} else if (event.type === 'tool_use_start') {
			pendingToolCalls.push({ id: event.id, name: event.name, inputJson: '' });
		} else if (event.type === 'tool_use_input_delta') {
			const currentCall = pendingToolCalls.find(c => c.id === event.id);
			if (currentCall) {
				currentCall.inputJson += event.partialJson;
			}
		}
	}

	private async runTurn(roundTrip: number, isRetry = false): Promise<void> {
		const settings = this.settingsService.current;

		if (roundTrip >= settings.maxToolRoundTrips) {
			this.appendMessage({
				role: 'assistant',
				text: "I've made several changes but the task seems to still be in progress — could you confirm what's left, or ask me to continue?",
			});
			return;
		}

		const context = this.contextService.buildContext();
		const system = this.buildSystemPrompt(context);

		const assistantMessage = this.appendMessage({ role: 'assistant', text: '', streaming: true });

		const pendingToolCalls: { id: string; name: string; inputJson: string }[] = [];
		const state = { textBuffer: '' };

		try {
			const stream$ = this.llmClient.streamCompletion({
				model: settings.model,
				system,
				messages: this.apiTranscript,
				tools: this.toolRegistry.getEnabledToolSchemas(settings.advancedToolsEnabled),
				maxTokens: 2048,
			}).pipe(
				tap(event => this.handleStreamEvent(event, assistantMessage, pendingToolCalls, state)),
				toArray()
			);

			const subscriptionPromise = new Promise<void>((resolve, reject) => {
				this.currentStreamSubscription = stream$.subscribe({
					next: () => {},
					error: (err) => reject(err),
					complete: () => resolve()
				});
			});

			await subscriptionPromise;
			this.currentStreamSubscription = null;
		} catch (err: any) {
			this.currentStreamSubscription = null;
			
			const chatErr = mapErrorToAiChatError(err);
			
			if (!isRetry && chatErr.kind === 'network' && err?.retryable !== false) {
				// Automatic retry for network errors once
				this.updateMessage(assistantMessage.id, msg => ({ ...msg, streaming: false, error: { kind: 'network', message: 'Connection issue. Retrying in 1s...', retryable: true } }));
				
				await new Promise(r => setTimeout(r, 1000));
				
				// Remove the failed message attempt
				const msgs = this.messages$.value;
				this.messages$.next(msgs.filter(m => m.id !== assistantMessage.id));
				
				return this.runTurn(roundTrip, true);
			}
			
			this.markMessageError(assistantMessage.id, chatErr);
			return;
		}

		// Check if we were cancelled manually (which just completes the observable cleanly, but we want to know)
		if (!assistantMessage.streaming) {
			// Finalize was already called by cancelCurrentTurn or it's finished
			// We can proceed with what we got
		} else {
			this.finalizeStreamingMessage(assistantMessage.id);
		}

		if (pendingToolCalls.length === 0) {
			this.apiTranscript.push({ role: 'assistant', content: [{ type: 'text', text: state.textBuffer }] });
			return;
		}

		const parseInput = (json: string) => {
			try { return JSON.parse(json || '{}'); } catch { return {}; }
		};

		this.apiTranscript.push({
			role: 'assistant',
			content: [
				...(state.textBuffer ? [{ type: 'text' as const, text: state.textBuffer }] : []),
				...pendingToolCalls.map(c => ({ type: 'tool_use' as const, id: c.id, name: c.name, input: parseInput(c.inputJson) })),
			],
		});

		const toolResultBlocks: AiApiContentBlock[] = [];

		for (const call of pendingToolCalls) {
			const record = this.recordToolCall(assistantMessage.id, call);
			const outcome = await this.runToolCall(call, record);
			toolResultBlocks.push({
				type: 'tool_result',
				tool_use_id: call.id,
				content: outcome.resultText,
				is_error: outcome.isError,
			});
		}

		this.apiTranscript.push({ role: 'user', content: toolResultBlocks });

		// Don't auto-continue if we were manually cancelled
		if (!this.messages$.value.find(m => m.id === assistantMessage.id)?.error) {
			await this.runTurn(roundTrip + 1);
		}
	}

	cancelCurrentTurn(): void {
		if (this.currentStreamSubscription) {
			this.currentStreamSubscription.unsubscribe();
			this.currentStreamSubscription = null;
		}
		
		const current = this.messages$.value;
		if (current.length > 0) {
			const lastMsg = current[current.length - 1];
			if (lastMsg.role === 'assistant' && lastMsg.streaming) {
				this.finalizeStreamingMessage(lastMsg.id);
			}
		}
	}

	private async runToolCall(
		call: { id: string; name: string; inputJson: string },
		record: AiToolCallRecord
	): Promise<{ resultText: string; isError: boolean }> {
		let args: Record<string, any>;
		try {
			args = JSON.parse(call.inputJson || '{}');
		} catch {
			this.updateToolCallStatus(record.id, 'failed', { errorMessage: 'Malformed tool arguments (invalid JSON).' });
			return { resultText: 'Error: malformed tool arguments.', isError: true };
		}

		const tool = this.toolRegistry.get(call.name);

		if (!tool) {
			this.updateToolCallStatus(record.id, 'failed', { errorMessage: `Unknown tool: ${call.name}` });
			return { resultText: `Error: unknown tool "${call.name}".`, isError: true };
		}

		const ctx = this.toolContextBuilder.build();

		try {
			// Validate can be sync or async
			const validateResult = tool.validate(args, ctx);
			if (validateResult instanceof Promise) {
				await validateResult;
			}
		} catch (err: any) {
			const message = err instanceof AiToolValidationError ? err.message : 'Validation failed.';
			this.updateToolCallStatus(record.id, 'failed', { errorMessage: message });
			return { resultText: `Error: ${message}`, isError: true };
		}

		let needsPreview = tool.requiresPreview;
		if (this.settingsService.current.planStepConfirmationPolicy === 'batch') {
			needsPreview = false;
		}

		if (needsPreview) {
			this.updateToolCallStatus(record.id, 'pending_preview');
			
			const preview = await tool.preview!(args, ctx);
			this.updateToolCallStatus(record.id, 'pending_confirmation', { preview });

			const confirmed = await this.previewService.awaitUserConfirmation(record.id);

			if (!confirmed) {
				this.updateToolCallStatus(record.id, 'rejected');
				return { resultText: 'User rejected this action; it was not applied. Ask if they want a different approach.', isError: false };
			}
		}

		this.updateToolCallStatus(record.id, 'running');

		try {
			const result = await this.commandService.execute(call.name, args);
			this.updateToolCallStatus(record.id, 'succeeded', { summary: result.summary });
			return { resultText: JSON.stringify({ summary: result.summary, data: result.data ?? null }), isError: false };
		} catch (err: any) {
			const message = err instanceof Error ? err.message : 'Unknown execution error.';
			this.updateToolCallStatus(record.id, 'failed', { errorMessage: message });
			return { resultText: `Error executing ${call.name}: ${message}`, isError: true };
		}
	}
}

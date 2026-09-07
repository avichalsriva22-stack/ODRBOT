# 06 — LLM Integration and Conversation Manager

## 1. `AiLlmClientService` (`src/app/ai/services/ai-llm-client.service.ts`)

Thin renderer-side client. It never talks to `api.anthropic.com` directly —
it calls the Electron bridge (doc 07), which proxies from the main process.

```ts
@Injectable( { providedIn: 'root' } )
export class AiLlmClientService {

	/** Streams events as they arrive; caller (AiConversationService) accumulates them. */
	streamCompletion (
		request: AiCompletionRequest
	): Observable<AiStreamEvent> {
		return new Observable( subscriber => {
			const unsubscribeFn = window.aiBridge.streamChatCompletion(
				request,
				( event: AiStreamEvent ) => subscriber.next( event ),
				( error: AiBridgeError ) => subscriber.error( mapBridgeError( error ) ),
				() => subscriber.complete(),
			);
			return () => unsubscribeFn();
		} );
	}
}

export interface AiCompletionRequest {
	model: AiModelId;
	system: string;                         // system prompt, see §5
	messages: AiApiMessage[];               // Anthropic Messages API shape
	tools: { name: string; description: string; input_schema: AiJsonSchema }[];
	maxTokens: number;                      // default 2048
}

/** Mirrors Anthropic Messages API roles/content blocks — user/assistant only, content is text or tool_use/tool_result blocks. */
export interface AiApiMessage {
	role: 'user' | 'assistant';
	content: AiApiContentBlock[];
}

export type AiApiContentBlock =
	| { type: 'text'; text: string }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
	| { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export type AiStreamEvent =
	| { type: 'text_delta'; text: string }
	| { type: 'tool_use_start'; id: string; name: string }
	| { type: 'tool_use_input_delta'; id: string; partialJson: string }
	| { type: 'tool_use_end'; id: string }
	| { type: 'message_stop' }
	| { type: 'error'; error: AiBridgeError };
```

## 2. Model selection

Default model: `claude-sonnet-5` (per `AiSettings.model`, doc 02 §3). The
settings dialog (doc 08 §7) lets the user switch to `claude-opus-4-8` for
harder multi-step requests or `claude-haiku-4-5-20251001` for fast simple
edits. Model id strings must be read from `AiSettings`, never hardcoded
outside `ai-settings.model.ts`.

## 3. `AiConversationService` — the tool-use loop

```ts
@Injectable( { providedIn: 'root' } )
export class AiConversationService {

	private messages$ = new BehaviorSubject<AiChatMessage[]>( [] );
	readonly messages: Observable<AiChatMessage[]> = this.messages$.asObservable();

	private apiTranscript: AiApiMessage[] = []; // Anthropic-shape mirror, kept in lockstep with messages$

	constructor (
		private llmClient: AiLlmClientService,
		private toolRegistry: AiToolRegistry,
		private commandService: AiCommandService,
		private contextService: AiContextService,
		private previewService: AiPreviewService,
		private settingsService: AiSettingsService,
	) {}

	async sendMessage ( userText: string ): Promise<void> {

		this.appendMessage( { role: 'user', text: userText } );
		this.apiTranscript.push( { role: 'user', content: [ { type: 'text', text: userText } ] } );

		await this.runTurn( 0 );
	}

	private async runTurn ( roundTrip: number ): Promise<void> {

		const settings = this.settingsService.current;

		if ( roundTrip >= settings.maxToolRoundTrips ) {
			this.appendMessage( {
				role: 'assistant',
				text: "I've made several changes but the task seems to still be in progress — could you confirm what's left, or ask me to continue?",
			} );
			return;
		}

		const context = this.contextService.buildContext();
		const system = buildSystemPrompt( context ); // see §5

		const assistantMessage = this.appendMessage( { role: 'assistant', text: '', streaming: true } );

		const pendingToolCalls: { id: string; name: string; inputJson: string }[] = [];
		let textBuffer = '';

		try {
			await firstValueFrom(
				this.llmClient.streamCompletion( {
					model: settings.model,
					system,
					messages: this.apiTranscript,
					tools: this.toolRegistry.getEnabledToolSchemas( settings.advancedToolsEnabled ),
					maxTokens: 2048,
				} ).pipe(
					tap( event => this.handleStreamEvent( event, assistantMessage, pendingToolCalls, textBuffer ) ),
					toArray(),
				)
			);
		} catch ( err ) {
			this.markMessageError( assistantMessage.id, mapErrorToAiChatError( err ) );
			return;
		}

		this.finalizeStreamingMessage( assistantMessage.id );

		if ( pendingToolCalls.length === 0 ) {
			// plain text turn, conversation stops here until next user message
			this.apiTranscript.push( { role: 'assistant', content: [ { type: 'text', text: textBuffer } ] } );
			return;
		}

		this.apiTranscript.push( {
			role: 'assistant',
			content: [
				...( textBuffer ? [ { type: 'text' as const, text: textBuffer } ] : [] ),
				...pendingToolCalls.map( c => ( { type: 'tool_use' as const, id: c.id, name: c.name, input: JSON.parse( c.inputJson || '{}' ) } ) ),
			],
		} );

		const toolResultBlocks: AiApiContentBlock[] = [];

		for ( const call of pendingToolCalls ) {
			const record = this.recordToolCall( assistantMessage.id, call );
			const outcome = await this.runToolCall( call, record ); // handles preview/confirm internally, see §4
			toolResultBlocks.push( {
				type: 'tool_result',
				tool_use_id: call.id,
				content: outcome.resultText,
				is_error: outcome.isError,
			} );
		}

		this.apiTranscript.push( { role: 'user', content: toolResultBlocks } );

		await this.runTurn( roundTrip + 1 );
	}

	// handleStreamEvent, finalizeStreamingMessage, appendMessage, recordToolCall,
	// markMessageError: straightforward BehaviorSubject-array-update helpers.
	// runToolCall: see §4.
}
```

## 4. `runToolCall` — where preview/confirmation plugs in

```ts
private async runToolCall (
	call: { id: string; name: string; inputJson: string },
	record: AiToolCallRecord,
): Promise<{ resultText: string; isError: boolean }> {

	let args: Record<string, any>;
	try {
		args = JSON.parse( call.inputJson || '{}' );
	} catch {
		this.updateToolCallStatus( record.id, 'failed', { errorMessage: 'Malformed tool arguments (invalid JSON).' } );
		return { resultText: 'Error: malformed tool arguments.', isError: true };
	}

	const tool = this.toolRegistry.get( call.name );

	if ( !tool ) {
		this.updateToolCallStatus( record.id, 'failed', { errorMessage: `Unknown tool: ${ call.name }` } );
		return { resultText: `Error: unknown tool "${ call.name }".`, isError: true };
	}

	try {
		await tool.validate( args, this.toolContextBuilder.build() );
	} catch ( err ) {
		const message = err instanceof AiToolValidationError ? err.message : 'Validation failed.';
		this.updateToolCallStatus( record.id, 'failed', { errorMessage: message } );
		return { resultText: `Error: ${ message }`, isError: true };
	}

	if ( tool.requiresPreview ) {
		this.updateToolCallStatus( record.id, 'pending_preview' );
		const preview = await tool.preview!( args, this.toolContextBuilder.build() );
		this.updateToolCallStatus( record.id, 'pending_confirmation', { preview } );

		const confirmed = await this.previewService.awaitUserConfirmation( record.id ); // resolves when the UI card's Confirm/Reject button is clicked, see doc 09 §4

		if ( !confirmed ) {
			this.updateToolCallStatus( record.id, 'rejected' );
			return { resultText: 'User rejected this action; it was not applied. Ask if they want a different approach.', isError: false };
		}
	}

	this.updateToolCallStatus( record.id, 'running' );

	try {
		const result = await this.commandService.execute( call.name, args );
		this.updateToolCallStatus( record.id, 'succeeded', { summary: result.summary } );
		return { resultText: JSON.stringify( { summary: result.summary, data: result.data ?? null } ), isError: false };
	} catch ( err ) {
		const message = err instanceof Error ? err.message : 'Unknown execution error.';
		this.updateToolCallStatus( record.id, 'failed', { errorMessage: message } );
		return { resultText: `Error executing ${ call.name }: ${ message }`, isError: true };
	}
}
```

This is the exact mechanism by which doc 09's preview flow is not
optional/bolted-on — it's structurally in the main loop, blocking on a
promise the UI resolves.

## 5. System prompt (`buildSystemPrompt(context)`)

Full literal text (implementer must not paraphrase — this is the actual
prompt to ship, tune wording only after testing per doc 10 §4):

```
You are the AI assistant embedded in Truevision Designer, a 3D road-design
tool that edits OpenDRIVE (.xodr) road networks. You help the user modify
the current map by calling the tools provided. You cannot see the 3D
viewport directly — you only know what is in the JSON context below and
what the tools tell you.

Rules:
1. Only use the tools provided. Never claim to have made a change unless a
   tool call succeeded.
2. When the user refers to "the road", "this junction", "it", etc., use the
   `selection` field in the context. If nothing is selected and the request
   is ambiguous, ask a brief clarifying question instead of guessing.
3. When the user gives a relative spatial instruction (e.g. "north of the
   selected road", "at the end of this road", "50 meters further"), compute
   the absolute x, y, and heading yourself from the road geometry given in
   the context (start/end position, heading) before calling a tool. Do not
   ask the user for coordinates unless the context does not contain enough
   information to compute them.
4. Prefer `extend_road_from_selected` over `create_road` whenever a road is
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
8. Only call `export_opendrive` or `undo_last_action` when the user
   explicitly asks for that specific action.
9. Keep your text responses brief and concrete — state what you did or are
   about to do, not generic filler.

Current map context (JSON):
${ JSON.stringify( context ) }
```

## 6. Retry / transport error handling

- `AiLlmClientService.streamCompletion` errors map via `mapBridgeError` into
  `AiLlmTransportError` (network/IPC) or `AiLlmApiError` (HTTP status from
  Anthropic, carried through the bridge, see doc 07 §3).
- `AiConversationService` retries **once, automatically, with no user action**
  only for transport errors classified `retryable: true` (network blip) —
  simple `setTimeout` + retry after 1s, not exponential backoff (v1 scope).
- Auth errors (`401`) and rate-limit errors (`429`) are never auto-retried —
  surfaced immediately as an `AiChatError` in the message (doc 08 §6 defines
  the exact inline UI for each `kind`).
- If a retry also fails, mark the message `error` and stop — do not continue
  the tool-use loop.

## 7. Cancellation

`AiConversationService.cancelCurrentTurn()` — called when the user clicks a
"Stop" button (doc 08 §4) while `streaming: true`. Unsubscribes the
in-flight `streamCompletion` Observable (which must propagate an abort
through the IPC bridge, doc 07 §3, to actually cancel the upstream HTTP
request, not just stop listening client-side) and marks the message
`streaming: false` with whatever partial text/tool calls had already
arrived preserved as-is (no rollback of already-executed tool calls — only
pending/not-yet-executed ones are simply not run).

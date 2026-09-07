/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AiModelId } from '../models/ai-settings.model';
import { AiJsonSchema } from '../models/ai-tool.model';
import { AiLlmTransportError, AiLlmApiError } from '../models/ai-message.model';
import { AiBridgeStreamEvent, AiBridgeError } from '../models/ai-bridge.d';

/**
 * AiLlmClientService (doc 06 §1).
 *
 * Thin renderer-side client. It never talks to `api.anthropic.com` directly —
 * it calls the Electron bridge (doc 07), which proxies from the main process.
 */
import { AiSettingsService } from './ai-settings.service';

@Injectable( { providedIn: 'root' } )
export class AiLlmClientService {

	constructor(private settings: AiSettingsService) {}

	/** Streams events as they arrive; caller (AiConversationService) accumulates them. */
	streamCompletion ( request: AiCompletionRequest ): Observable<AiStreamEvent> {

		return new Observable( subscriber => {

			if ( !window.aiBridge ) {
				subscriber.error( new AiLlmTransportError( 'AI bridge not available — running outside Electron?' ) );
				return;
			}

			const provider = this.settings.current.provider;
			const isOpenRouter = provider === 'openrouter';

			let payload: any = {
				model: isOpenRouter ? this.settings.current.openRouterModel : request.model,
				max_tokens: request.maxTokens,
			};

			if (isOpenRouter) {
				payload.messages = [
					{ role: 'system', content: request.system },
					...this.translateToOpenAiMessages(request.messages)
				];
				if (request.tools && request.tools.length > 0) {
					payload.tools = request.tools.map(t => ({
						type: 'function',
						function: { name: t.name, description: t.description, parameters: t.input_schema }
					}));
					if (request.tool_choice) {
						if (request.tool_choice.type === 'tool' || request.tool_choice.type === 'function') {
							payload.tool_choice = { type: 'function', function: { name: request.tool_choice.name } };
						} else if (request.tool_choice.type === 'any') {
							payload.tool_choice = 'required';
						} else {
							payload.tool_choice = request.tool_choice;
						}
					}
				}
			} else {
				payload.system = request.system;
				payload.messages = request.messages;
				if (request.tools && request.tools.length > 0) {
					payload.tools = request.tools;
					if (request.tool_choice) {
						payload.tool_choice = request.tool_choice;
					}
				}
			}

			const unsubscribeFn = window.aiBridge.streamChatCompletion(
				provider,
				payload,
				( event: AiBridgeStreamEvent ) => subscriber.next( event as AiStreamEvent ),
				( error: AiBridgeError ) => subscriber.error( mapBridgeError( error ) ),
				() => subscriber.complete(),
			);

			return () => unsubscribeFn();

		} );

	}

	private translateToOpenAiMessages(anthropicMessages: AiApiMessage[]): any[] {
		const result = [];
		for (const msg of anthropicMessages) {
			
			// For user/assistant without tools, or simple text blocks
			if (msg.role === 'user' || msg.role === 'assistant') {
				let textContent = '';
				let toolCalls = [];
				let toolResults = [];

				for (const block of msg.content) {
					if (block.type === 'text') textContent += block.text;
					if (block.type === 'tool_use') {
						toolCalls.push({
							id: block.id,
							type: 'function',
							function: {
								name: block.name,
								arguments: JSON.stringify(block.input)
							}
						});
					}
					if (block.type === 'tool_result') {
						toolResults.push({
							role: 'tool',
							tool_call_id: block.tool_use_id,
							content: block.is_error ? JSON.stringify({error: block.content}) : block.content
						});
					}
				}

				if (textContent || toolCalls.length > 0) {
					const openAiMsg: any = { role: msg.role, content: textContent };
					if (toolCalls.length > 0) openAiMsg.tool_calls = toolCalls;
					result.push(openAiMsg);
				}

				if (toolResults.length > 0) {
					result.push(...toolResults);
				}
			}
		}
		return result;
	}

}

export interface AiCompletionRequest {
	model: AiModelId;
	system: string;                         // system prompt, see doc 06 §5
	messages: AiApiMessage[];               // Anthropic Messages API shape
	tools: { name: string; description: string; input_schema: AiJsonSchema }[];
	maxTokens: number;                      // default 2048
	tool_choice?: any;
}

/** Mirrors Anthropic Messages API roles/content blocks — user/assistant only, content is text or tool_use/tool_result blocks. */
export interface AiApiMessage {
	role: 'user' | 'assistant';
	content: AiApiContentBlock[];
}

export type AiApiContentBlock =
	| { type: 'text'; text: string }
	| { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }
	| { type: 'tool_use'; id: string; name: string; input: Record<string, any> }
	| { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

export type AiStreamEvent =
	| { type: 'text_delta'; text: string }
	| { type: 'tool_use_start'; id: string; name: string }
	| { type: 'tool_use_input_delta'; id: string; partialJson: string }
	| { type: 'tool_use_end'; id: string }
	| { type: 'message_stop' }
	| { type: 'error'; error: AiBridgeError };

/** Maps bridge errors to the error taxonomy (doc 02 §6). */
function mapBridgeError ( error: AiBridgeError ): AiLlmTransportError | AiLlmApiError {
	if ( error.status ) {
		const kind = error.status === 401 ? 'auth' as const
			: error.status === 429 ? 'rate_limit' as const
			: 'unknown' as const;
		return new AiLlmApiError( error.message, error.status, kind );
	}
	return new AiLlmTransportError( error.message );
}

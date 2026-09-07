/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

/** Typed stream event union mirroring Anthropic SSE events (doc 06 §1). */
export type AiBridgeStreamEvent =
	| { type: 'text_delta'; text: string }
	| { type: 'tool_use_start'; id: string; name: string }
	| { type: 'tool_use_input_delta'; id: string; partialJson: string }
	| { type: 'tool_use_end'; id: string }
	| { type: 'message_stop' }
	| { type: 'error'; error: AiBridgeError };

export interface AiBridgeError {
	kind: string;
	message: string;
	status?: number;
}

declare global {
	interface Window {
		aiBridge: {
			setApiKey( provider: 'anthropic' | 'openrouter', key: string ): Promise<{ ok: boolean }>;
			hasApiKey( provider: 'anthropic' | 'openrouter' ): Promise<boolean>;
			clearApiKey( provider: 'anthropic' | 'openrouter' ): Promise<{ ok: boolean }>;
			streamChatCompletion(
				provider: 'anthropic' | 'openrouter',
				payload: unknown,
				onEvent: ( e: AiBridgeStreamEvent ) => void,
				onError: ( e: AiBridgeError ) => void,
				onDone: () => void,
			): () => void; // unsubscribe
		};
	}
}

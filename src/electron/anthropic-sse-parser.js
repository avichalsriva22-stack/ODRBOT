/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 *
 * anthropic-sse-parser.js — plain Node.js, no Angular.
 *
 * Parses Anthropic's text/event-stream SSE response body into typed
 * AiStreamEvent objects as defined in doc 06 §1. Maps Anthropic's
 * content_block_start / content_block_delta / content_block_stop /
 * message_stop SSE event types to our internal event union.
 */

function createAnthropicSseParser(onEvent) {
	const decoder = new TextDecoder();
	let buffer = '';
	let currentEventType = null;

	return function parseChunk(chunk) {
		buffer += typeof chunk === 'string' ? chunk : decoder.decode( chunk, { stream: true } );
		const lines = buffer.split( '\n' );
		buffer = lines.pop() || '';

		for ( const line of lines ) {
			if ( line.startsWith( 'event: ' ) ) {
				currentEventType = line.slice( 7 ).trim();
			} else if ( line.startsWith( 'data: ' ) ) {
				const dataStr = line.slice( 6 ).trim();
				if ( !dataStr ) continue;

				let data;
				try {
					data = JSON.parse( dataStr );
				} catch {
					continue;
				}

				const event = mapSseEvent( currentEventType, data );
				if ( event ) {
					onEvent( event );
				}

				currentEventType = null;

			} else if ( line.trim() === '' ) {
				currentEventType = null;
			}
		}
	};
}

function mapSseEvent ( eventType, data ) {
	switch ( eventType ) {
		case 'content_block_start': {
			if ( data.content_block && data.content_block.type === 'tool_use' ) {
				return {
					type: 'tool_use_start',
					id: data.content_block.id,
					name: data.content_block.name,
				};
			}
			return null;
		}
		case 'content_block_delta': {
			if ( data.delta ) {
				if ( data.delta.type === 'text_delta' ) {
					return {
						type: 'text_delta',
						text: data.delta.text,
					};
				}
				if ( data.delta.type === 'input_json_delta' ) {
					return {
						type: 'tool_use_input_delta',
						id: data.index !== undefined ? String( data.index ) : '',
						partialJson: data.delta.partial_json,
					};
				}
			}
			return null;
		}
		case 'content_block_stop': {
			return {
				type: 'tool_use_end',
				id: data.index !== undefined ? String( data.index ) : '',
			};
		}
		case 'message_stop': {
			return { type: 'message_stop' };
		}
		case 'error': {
			return {
				type: 'error',
				error: {
					kind: 'unknown',
					message: data.error?.message || 'Unknown SSE error',
				},
			};
		}
		default:
			return null;
	}
}

module.exports = { createAnthropicSseParser, parseAnthropicSse: () => {} }; // keep dummy export for backwards compat in case something breaks

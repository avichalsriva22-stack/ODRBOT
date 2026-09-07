/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

function createOpenAiSseParser(onEvent) {
	const decoder = new TextDecoder();
	let buffer = '';
	let activeToolCalls = new Map(); // id -> true

	return function parseChunk(chunk) {
		buffer += typeof chunk === 'string' ? chunk : decoder.decode( chunk, { stream: true } );
		const lines = buffer.split( '\n' );
		buffer = lines.pop() || '';

		for ( const line of lines ) {
			if ( line.startsWith( 'data: ' ) ) {
				const dataStr = line.slice( 6 ).trim();
				if ( dataStr === '[DONE]' ) {
					for (const id of activeToolCalls.keys()) {
						onEvent({ type: 'tool_use_end', id });
					}
					onEvent({ type: 'message_stop' });
					continue;
				}

				let data;
				try {
					data = JSON.parse( dataStr );
				} catch {
					continue;
				}

				if ( data.choices && data.choices.length > 0 ) {
					const choice = data.choices[ 0 ];
					const delta = choice.delta;

					if ( delta.content ) {
						onEvent({
							type: 'text_delta',
							text: delta.content,
						});
					}

					if ( delta.tool_calls ) {
						for ( const tc of delta.tool_calls ) {
							const tcId = String( tc.index ); // we use index as ID for streaming correlation
							if ( tc.function && tc.function.name ) {
								activeToolCalls.set(tcId, true);
								onEvent({
									type: 'tool_use_start',
									id: tcId,
									name: tc.function.name,
								});
							}
							if ( tc.function && tc.function.arguments ) {
								onEvent({
									type: 'tool_use_input_delta',
									id: tcId,
									partialJson: tc.function.arguments,
								});
							}
						}
					}

					if ( choice.finish_reason ) {
						for (const id of activeToolCalls.keys()) {
							onEvent({ type: 'tool_use_end', id });
						}
						activeToolCalls.clear();
						
						if (choice.finish_reason !== 'tool_calls') {
							onEvent({ type: 'message_stop' });
						}
					}
				}
			}
		}
	};
}

module.exports = { createOpenAiSseParser };

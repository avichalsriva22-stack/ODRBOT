/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiLlmClientService } from './ai-llm-client.service';
import { AiLlmTransportError, AiLlmApiError } from '../models/ai-message.model';

describe( 'AiLlmClientService', () => {

	let service: AiLlmClientService;

	beforeEach( () => {
		service = new AiLlmClientService({} as any);
	} );

	it( 'should error when aiBridge is not available', ( done ) => {

		// Ensure aiBridge is not on window in test env
		delete ( window as any ).aiBridge;

		const obs = service.streamCompletion( {
			model: 'claude-sonnet-5',
			system: 'test',
			messages: [],
			tools: [],
			maxTokens: 1024,
		} );

		obs.subscribe( {
			next: () => fail( 'should not emit' ),
			error: ( err ) => {
				expect( err instanceof AiLlmTransportError ).toBe( true );
				expect( err.message ).toContain( 'AI bridge not available' );
				done();
			},
		} );

	} );

	it( 'should forward stream events from the bridge', ( done ) => {

		const events: any[] = [];

		// Mock aiBridge
		( window as any ).aiBridge = {
			streamChatCompletion: ( payload: any, onEvent: Function, onError: Function, onDone: Function ) => {
				// Simulate streaming
				setTimeout( () => {
					onEvent( { type: 'text_delta', text: 'hello' } );
					onEvent( { type: 'message_stop' } );
					onDone();
				}, 0 );
				return () => {}; // unsubscribe
			},
			setApiKey: () => Promise.resolve( { ok: true } ),
			hasApiKey: () => Promise.resolve( false ),
			clearApiKey: () => Promise.resolve( { ok: true } ),
		};

		const obs = service.streamCompletion( {
			model: 'claude-sonnet-5',
			system: 'test',
			messages: [],
			tools: [],
			maxTokens: 1024,
		} );

		obs.subscribe( {
			next: ( event ) => events.push( event ),
			complete: () => {
				expect( events.length ).toBe( 2 );
				expect( events[ 0 ].type ).toBe( 'text_delta' );
				expect( events[ 1 ].type ).toBe( 'message_stop' );
				delete ( window as any ).aiBridge;
				done();
			},
		} );

	} );

	it( 'should map auth errors correctly', ( done ) => {

		( window as any ).aiBridge = {
			streamChatCompletion: ( payload: any, onEvent: Function, onError: Function, onDone: Function ) => {
				setTimeout( () => {
					onError( { kind: 'auth', message: 'Invalid API key', status: 401 } );
				}, 0 );
				return () => {};
			},
			setApiKey: () => Promise.resolve( { ok: true } ),
			hasApiKey: () => Promise.resolve( false ),
			clearApiKey: () => Promise.resolve( { ok: true } ),
		};

		const obs = service.streamCompletion( {
			model: 'claude-sonnet-5',
			system: 'test',
			messages: [],
			tools: [],
			maxTokens: 1024,
		} );

		obs.subscribe( {
			error: ( err ) => {
				expect( err instanceof AiLlmApiError ).toBe( true );
				expect( err.status ).toBe( 401 );
				expect( err.errorKind ).toBe( 'auth' );
				delete ( window as any ).aiBridge;
				done();
			},
		} );

	} );

	it( 'should map network errors correctly', ( done ) => {

		( window as any ).aiBridge = {
			streamChatCompletion: ( payload: any, onEvent: Function, onError: Function, onDone: Function ) => {
				setTimeout( () => {
					onError( { kind: 'network', message: 'Connection refused' } );
				}, 0 );
				return () => {};
			},
			setApiKey: () => Promise.resolve( { ok: true } ),
			hasApiKey: () => Promise.resolve( false ),
			clearApiKey: () => Promise.resolve( { ok: true } ),
		};

		const obs = service.streamCompletion( {
			model: 'claude-sonnet-5',
			system: 'test',
			messages: [],
			tools: [],
			maxTokens: 1024,
		} );

		obs.subscribe( {
			error: ( err ) => {
				expect( err instanceof AiLlmTransportError ).toBe( true );
				expect( err.message ).toBe( 'Connection refused' );
				delete ( window as any ).aiBridge;
				done();
			},
		} );

	} );

} );

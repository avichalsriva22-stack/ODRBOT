/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { InMemoryTranscriptStore } from './ai-transcript-store.service';

describe( 'InMemoryTranscriptStore', () => {

	let store: InMemoryTranscriptStore;

	beforeEach( () => {
		store = new InMemoryTranscriptStore();
	} );

	it( 'should return empty array for unknown project', async () => {
		const result = await store.load( 'unknown-project' );
		expect( result ).toEqual( [] );
	} );

	it( 'should save and load messages', async () => {
		const messages = [
			{ id: '1', role: 'user' as const, text: 'hello', createdAt: Date.now() },
			{ id: '2', role: 'assistant' as const, text: 'hi', createdAt: Date.now() },
		];

		await store.save( 'project-1', messages );
		const result = await store.load( 'project-1' );

		expect( result.length ).toBe( 2 );
		expect( result[ 0 ].text ).toBe( 'hello' );
		expect( result[ 1 ].text ).toBe( 'hi' );
	} );

	it( 'should return a copy, not the original reference', async () => {
		const messages = [
			{ id: '1', role: 'user' as const, text: 'hello', createdAt: Date.now() },
		];

		await store.save( 'project-1', messages );

		// mutate the original
		messages.push( { id: '2', role: 'user' as const, text: 'added', createdAt: Date.now() } );

		const result = await store.load( 'project-1' );
		expect( result.length ).toBe( 1 ); // should still be 1, not 2
	} );

	it( 'should overwrite on re-save', async () => {
		await store.save( 'p', [ { id: '1', role: 'user' as const, text: 'first', createdAt: 1 } ] );
		await store.save( 'p', [ { id: '2', role: 'assistant' as const, text: 'second', createdAt: 2 } ] );

		const result = await store.load( 'p' );
		expect( result.length ).toBe( 1 );
		expect( result[ 0 ].text ).toBe( 'second' );
	} );

} );

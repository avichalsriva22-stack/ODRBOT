/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiSettingsService } from './ai-settings.service';
import { DEFAULT_AI_SETTINGS } from '../models/ai-settings.model';

describe( 'AiSettingsService', () => {

	let service: AiSettingsService;

	beforeEach( () => {
		service = new AiSettingsService();
	} );

	it( 'should initialize with default settings', () => {

		const current = service.current;
		expect( current.apiKeyConfigured ).toBe( false );
		expect( current.model ).toBe( 'claude-sonnet-5' );
		expect( current.maxToolRoundTrips ).toBe( 8 );
		expect( current.advancedToolsEnabled ).toBe( false );

	} );

	it( 'should update model', () => {

		service.setModel( 'claude-opus-4-8' );
		expect( service.current.model ).toBe( 'claude-opus-4-8' );

	} );

	it( 'should update maxToolRoundTrips', () => {

		service.setMaxToolRoundTrips( 12 );
		expect( service.current.maxToolRoundTrips ).toBe( 12 );

	} );

	it( 'should update advancedToolsEnabled', () => {

		service.setAdvancedToolsEnabled( true );
		expect( service.current.advancedToolsEnabled ).toBe( true );

	} );

	it( 'should emit settings changes through observable', ( done ) => {

		const values: boolean[] = [];
		service.settings.subscribe( settings => {
			values.push( settings.advancedToolsEnabled );
			if ( values.length === 2 ) {
				expect( values ).toEqual( [ false, true ] );
				done();
			}
		} );

		service.setAdvancedToolsEnabled( true );

	} );

	describe( 'when aiBridge is unavailable', () => {

		it( 'hasApiKey should return false', async () => {
			// aiBridge is not available in test environment
			const result = await service.hasApiKey();
			expect( result ).toBe( false );
		} );

		it( 'setApiKey should throw', async () => {
			try {
				await service.setApiKey( 'test-key' );
				fail( 'expected error' );
			} catch ( err ) {
				expect( err.message ).toContain( 'AI bridge not available' );
			}
		} );

		it( 'clearApiKey should throw', async () => {
			try {
				await service.clearApiKey();
				fail( 'expected error' );
			} catch ( err ) {
				expect( err.message ).toContain( 'AI bridge not available' );
			}
		} );

	} );

	describe( 'when aiBridge is available', () => {

		let mockBridge: any;

		beforeEach( () => {
			mockBridge = {
				setApiKey: jasmine.createSpy( 'setApiKey' ).and.resolveTo( { ok: true } ),
				hasApiKey: jasmine.createSpy( 'hasApiKey' ).and.resolveTo( true ),
				clearApiKey: jasmine.createSpy( 'clearApiKey' ).and.resolveTo( { ok: true } ),
				streamChatCompletion: jasmine.createSpy( 'streamChatCompletion' ),
			};
			( window as any ).aiBridge = mockBridge;
		} );

		afterEach( () => {
			delete ( window as any ).aiBridge;
		} );

		it( 'should set API key and update settings', async () => {

			await service.setApiKey( 'sk-test-key' );

			expect( mockBridge.setApiKey ).toHaveBeenCalledWith( 'sk-test-key' );
			expect( service.current.apiKeyConfigured ).toBe( true );

		} );

		it( 'should check hasApiKey', async () => {

			const result = await service.hasApiKey();
			expect( result ).toBe( true );

		} );

		it( 'should clear API key and update settings', async () => {

			await service.setApiKey( 'sk-test-key' );
			expect( service.current.apiKeyConfigured ).toBe( true );

			await service.clearApiKey();
			expect( mockBridge.clearApiKey ).toHaveBeenCalled();
			expect( service.current.apiKeyConfigured ).toBe( false );

		} );

		it( 'initialize should read key state', async () => {

			await service.initialize();
			expect( mockBridge.hasApiKey ).toHaveBeenCalled();
			expect( service.current.apiKeyConfigured ).toBe( true );

		} );

	} );

} );

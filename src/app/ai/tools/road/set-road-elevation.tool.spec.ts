/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { SetRoadElevationTool } from './set-road-elevation.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { SetRoadElevationCommand } from 'app/commands/set-road-elevation-command';

describe( 'SetRoadElevationTool', () => {

	it( 'should validate correctly', () => {
		const tool = new SetRoadElevationTool();
		const road = new TvRoad( 'test' );
		spyOn( road, 'getLength' ).and.returnValue( 100 );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { roadId: 1, sOffset: 50, elevation: 10 }, mockContext ) ).not.toThrow();
		expect( () => tool.validate( { roadId: 1, sOffset: 150, elevation: 10 }, mockContext ) ).toThrowError( AiToolValidationError );
	} );

	it( 'should generate a SetRoadElevationCommand', async () => {
		const tool = new SetRoadElevationTool();
		const road = new TvRoad( 'test' );
		spyOn( road, 'getLength' ).and.returnValue( 100 );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 1, sOffset: 10, elevation: 5 }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof SetRoadElevationCommand ).toBeTrue();
		expect( result.summary ).toContain( '10m to 5m' );
	} );

} );

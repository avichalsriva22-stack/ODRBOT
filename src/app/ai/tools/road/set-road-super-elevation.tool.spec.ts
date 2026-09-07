/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { SetRoadSuperElevationTool } from './set-road-super-elevation.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { SetRoadSuperElevationCommand } from 'app/commands/set-road-super-elevation-command';

describe( 'SetRoadSuperElevationTool', () => {

	it( 'should validate correctly', () => {
		const tool = new SetRoadSuperElevationTool();
		const road = new TvRoad( 'test' );
		spyOn( road, 'getLength' ).and.returnValue( 100 );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { roadId: 1, sOffset: 50, angleDegrees: 5 }, mockContext ) ).not.toThrow();
		expect( () => tool.validate( { roadId: 1, sOffset: 150, angleDegrees: 5 }, mockContext ) ).toThrowError( AiToolValidationError );
	} );

	it( 'should generate a SetRoadSuperElevationCommand', async () => {
		const tool = new SetRoadSuperElevationTool();
		const road = new TvRoad( 'test' );
		spyOn( road, 'getLength' ).and.returnValue( 100 );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 1, sOffset: 10, angleDegrees: 5 }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof SetRoadSuperElevationCommand ).toBeTrue();
		expect( result.summary ).toContain( '5 degrees' );
	} );

} );

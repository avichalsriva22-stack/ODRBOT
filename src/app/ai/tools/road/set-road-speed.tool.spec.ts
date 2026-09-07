/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { SetRoadSpeedTool } from './set-road-speed.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvRoadTypeClass } from 'app/map/models/tv-road-type.class';
import { TvRoadType, TvUnit } from 'app/map/models/tv-common';
import { SetValueCommand } from 'app/commands/set-value-command';

describe( 'SetRoadSpeedTool', () => {

	it( 'should validate correctly', () => {
		const tool = new SetRoadSpeedTool();
		const road = new TvRoad( 'test' );
		road.type.push( new TvRoadTypeClass( 0, TvRoadType.TOWN, 40, TvUnit.KM_PER_HOUR ) );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { roadId: 1, maxSpeed: 60 }, mockContext ) ).not.toThrow();
		
		const roadNoType = new TvRoad( 'test2' );
		roadNoType.type = [];
		const mockContextNoType = {
			mapService: { map: { getRoad: () => roadNoType } }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { roadId: 1, maxSpeed: 60 }, mockContextNoType ) ).toThrowError( AiToolValidationError );
	} );

	it( 'should generate a SetValueCommand for speed', async () => {
		const tool = new SetRoadSpeedTool();
		const road = new TvRoad( 'test' );
		road.type.push( new TvRoadTypeClass( 0, TvRoadType.TOWN, 40, TvUnit.KM_PER_HOUR ) );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 1, maxSpeed: 50 }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof SetValueCommand ).toBeTrue();
		expect( result.summary ).toContain( '50 km/h' );
	} );

} );

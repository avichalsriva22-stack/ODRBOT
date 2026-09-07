/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { SetRoadTypeTool } from './set-road-type.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvRoadTypeClass } from 'app/map/models/tv-road-type.class';
import { TvRoadType, TvUnit } from 'app/map/models/tv-common';
import { SetValueCommand } from 'app/commands/set-value-command';

describe( 'SetRoadTypeTool', () => {

	it( 'should validate correctly', () => {
		const tool = new SetRoadTypeTool();
		const road = new TvRoad( 'test' );
		road.type.push( new TvRoadTypeClass( 0, TvRoadType.TOWN, 40, TvUnit.KM_PER_HOUR ) );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { roadId: 1, roadType: 'rural' }, mockContext ) ).not.toThrow();
	} );

	it( 'should generate a SetValueCommand for type', async () => {
		const tool = new SetRoadTypeTool();
		const road = new TvRoad( 'test' );
		road.type.push( new TvRoadTypeClass( 0, TvRoadType.TOWN, 40, TvUnit.KM_PER_HOUR ) );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 1, roadType: 'motorway' }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof SetValueCommand ).toBeTrue();
		expect( result.summary ).toContain( 'motorway' );
	} );

} );

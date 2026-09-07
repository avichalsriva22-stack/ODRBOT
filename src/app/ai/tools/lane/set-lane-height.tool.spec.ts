/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { SetLaneHeightTool } from './set-lane-height.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneSection } from 'app/map/models/tv-lane-section';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneSide, TvLaneType } from 'app/map/models/tv-common';
import { TvLaneHeight } from 'app/map/lane-height/lane-height.model';
import { SetLaneHeightCommand } from 'app/commands/set-lane-height-command';

describe( 'SetLaneHeightTool', () => {

	it( 'should validate correctly', () => {
		const tool = new SetLaneHeightTool();
		const road = new TvRoad( 'test' );
		spyOn( road, 'getLength' ).and.returnValue( 100 );
		const section = new TvLaneSection( 0, 0, false, road );
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		section.addLaneInstance( lane );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { roadId: 1, laneId: 1, innerHeight: 0.1, outerHeight: 0.2 }, mockContext ) ).not.toThrow();
		expect( () => tool.validate( { roadId: 1, laneId: 2, innerHeight: 0.1, outerHeight: 0.2 }, mockContext ) ).toThrowError( AiToolValidationError );
	} );

	it( 'should generate a SetLaneHeightCommand', async () => {
		const tool = new SetLaneHeightTool();
		const road = new TvRoad( 'test' );
		spyOn( road, 'getLength' ).and.returnValue( 100 );
		const section = new TvLaneSection( 0, 0, false, road );
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		lane.addHeightRecord( 0, 0, 0 );
		section.addLaneInstance( lane );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 1, laneId: 1, innerHeight: 0.5, outerHeight: 0.5, sOffset: 10 }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof SetLaneHeightCommand ).toBeTrue();
		expect( result.summary ).toContain( 'inner: 0.5, outer: 0.5' );
	} );

} );

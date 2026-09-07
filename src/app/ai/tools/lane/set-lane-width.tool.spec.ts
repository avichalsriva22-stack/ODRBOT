/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { SetLaneWidthTool } from './set-lane-width.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneSection } from 'app/map/models/tv-lane-section';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneSide, TvLaneType } from 'app/map/models/tv-common';
import { TvLaneWidth } from 'app/map/models/tv-lane-width';
import { SetLaneWidthCommand } from 'app/commands/set-lane-width-command';

describe( 'SetLaneWidthTool', () => {

	it( 'should validate correctly', () => {
		const tool = new SetLaneWidthTool();
		const road = new TvRoad( 'test' );
		spyOn( road, 'getLength' ).and.returnValue( 100 );
		const section = new TvLaneSection( 0, 0, false, road );
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		section.addLaneInstance( lane );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { roadId: 1, laneId: 1, width: 3 }, mockContext ) ).not.toThrow();
		expect( () => tool.validate( { roadId: 1, laneId: 2, width: 3 }, mockContext ) ).toThrowError( AiToolValidationError );
	} );

	it( 'should generate a SetLaneWidthCommand', async () => {
		const tool = new SetLaneWidthTool();
		const road = new TvRoad( 'test' );
		spyOn( road, 'getLength' ).and.returnValue( 100 );
		const section = new TvLaneSection( 0, 0, false, road );
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		lane.addWidthRecord( 0, 2, 0, 0, 0 );
		section.addLaneInstance( lane );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 1, laneId: 1, width: 3.5, sOffset: 10 }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof SetLaneWidthCommand ).toBeTrue();
		expect( result.summary ).toContain( '3.5m' );
	} );

} );

/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { SetLaneMarkingTool } from './set-lane-marking.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneSection } from 'app/map/models/tv-lane-section';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneSide, TvLaneType } from 'app/map/models/tv-common';
import { TvLaneRoadMark } from 'app/map/models/tv-lane-road-mark';
import { SetLaneMarkingCommand } from 'app/commands/set-lane-marking-command';

describe( 'SetLaneMarkingTool', () => {

	it( 'should validate correctly', () => {
		const tool = new SetLaneMarkingTool();
		const road = new TvRoad( 'test' );
		const section = new TvLaneSection( 0, 0, false, road );
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		section.addLaneInstance( lane );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { roadId: 1, laneId: 1, side: 'left', markingType: 'solid' }, mockContext ) ).not.toThrow();
		expect( () => tool.validate( { roadId: 1, laneId: 2, side: 'left', markingType: 'solid' }, mockContext ) ).toThrowError( AiToolValidationError );
	} );

	it( 'should generate a SetLaneMarkingCommand', async () => {
		const tool = new SetLaneMarkingTool();
		const road = new TvRoad( 'test' );
		const section = new TvLaneSection( 0, 0, false, road );
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		lane.roadMarks.set( 0, TvLaneRoadMark.createSolid( lane, 0 ) );
		section.addLaneInstance( lane );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 1, laneId: 1, side: 'left', markingType: 'solid-broken', color: 'yellow' }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof SetLaneMarkingCommand ).toBeTrue();
		expect( result.summary ).toContain( 'solid-broken' );
	} );

} );

/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { RemoveLaneTool } from './remove-lane.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneSection } from 'app/map/models/tv-lane-section';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneType, TvLaneSide } from 'app/map/models/tv-common';
import { RemoveLaneCommand } from 'app/commands/remove-lane-command';

describe( 'RemoveLaneTool', () => {

	it( 'should validate correctly', () => {
		const tool = new RemoveLaneTool();
		const road = new TvRoad( 'test' );
		const section = new TvLaneSection( 0, 0, false, road );
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		section.addLaneInstance( lane );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		// Fails because it's the last driving lane
		expect( () => tool.validate( { roadId: 1, laneId: 1 }, mockContext ) ).toThrowError( AiToolValidationError );
		// Succeeds with force=true
		expect( () => tool.validate( { roadId: 1, laneId: 1, force: true }, mockContext ) ).not.toThrow();
		
		// Adds another driving lane
		section.addLaneInstance( new TvLane( TvLaneSide.RIGHT, -1, TvLaneType.driving ) );
		expect( () => tool.validate( { roadId: 1, laneId: 1 }, mockContext ) ).not.toThrow();
	} );

	it( 'should generate a RemoveLaneCommand', async () => {
		const tool = new RemoveLaneTool();
		const road = new TvRoad( 'test' );
		const section = new TvLaneSection( 0, 0, false, road );
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		section.addLaneInstance( lane );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 1, laneId: 1, force: true }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof RemoveLaneCommand ).toBeTrue();
		expect( result.summary ).toContain( 'Removed Lane 1' );
	} );

	it( 'should generate a preview diff', async () => {
		const tool = new RemoveLaneTool();
		const road = new TvRoad( 'test' );
		const section = new TvLaneSection( 0, 0, false, road );
		
		const lane1 = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		const lane2 = new TvLane( TvLaneSide.LEFT, 2, TvLaneType.sidewalk );
		section.addLaneInstance( lane1 );
		section.addLaneInstance( lane2 );
		
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.preview!( { roadId: 1, laneId: 1 }, mockContext );

		expect(result.diff.length).toBe(2);
		expect(result.diff[0]).toEqual({ field: 'Lane 1', before: 'Exists', after: null });
		expect(result.diff[1]).toEqual({ field: 'Lane 2 ID', before: 2, after: 1 });
		expect(result.description).toContain('Removing Lane 1');
	});

} );

/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AddLaneTool } from './add-lane.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneSection } from 'app/map/models/tv-lane-section';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneType, TvLaneSide } from 'app/map/models/tv-common';
import { AddLaneCommand } from 'app/commands/add-lane-command';

describe( 'AddLaneTool', () => {

	it( 'should validate correctly', () => {
		const tool = new AddLaneTool();
		const road = new TvRoad( 'test' );
		const section = new TvLaneSection( 0, 0, false, road );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		expect( () => tool.validate( { roadId: 1, side: 'left', laneType: 'driving' }, mockContext ) ).not.toThrow();
		expect( () => tool.validate( { roadId: 1, side: 'left', laneType: 'invalidType' }, mockContext ) ).toThrowError( AiToolValidationError );
	} );

	it( 'should generate a AddLaneCommand', async () => {
		const tool = new AddLaneTool();
		const road = new TvRoad( 'test' );
		const section = new TvLaneSection( 0, 0, false, road );
		const mockLane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		spyOn( section, 'createLeftLane' ).and.returnValue( mockLane );
		spyOn( road.getLaneProfile(), 'getLaneSectionAt' ).and.returnValue( section );

		const mockContext = {
			mapService: { map: { getRoad: () => road } }
		} as unknown as AiToolContext;

		const result = await tool.run( { roadId: 1, side: 'left', laneType: 'driving', width: 3.5 }, mockContext );

		expect( result.commands.length ).toBe( 1 );
		expect( result.commands[ 0 ] instanceof AddLaneCommand ).toBeTrue();
		expect( result.summary ).toContain( 'Added a driving lane' );
	} );

	it( 'should not lose lanes when multiple AddLaneCommand are executed sequentially and then re-executed in MultiCommand', () => {
		const road = new TvRoad( 'test' );
		const section = new TvLaneSection( 0, 0, false, road );
		
		// Setup initial state: 0, 1, -1
		const center = new TvLane( TvLaneSide.CENTER, 0, TvLaneType.driving, false, section );
		const left1 = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving, false, section );
		const right1 = new TvLane( TvLaneSide.RIGHT, -1, TvLaneType.driving, false, section );
		section.addLaneInstance( center, false );
		section.addLaneInstance( left1, false );
		section.addLaneInstance( right1, false );
		section.sortLanes();

		const leftShoulder = new TvLane( TvLaneSide.LEFT, 2, TvLaneType.shoulder, false, section );
		const cmd2 = new AddLaneCommand( section, leftShoulder );
		
		const rightShoulder = new TvLane( TvLaneSide.RIGHT, -2, TvLaneType.shoulder, false, section );
		const cmd3 = new AddLaneCommand( section, rightShoulder );

		// Simulate executeAsPlanStep
		cmd2.execute();
		cmd3.execute();

		// Simulate MultiCommand.execute()
		cmd2.execute();
		cmd3.execute();

		expect( section.getLaneById( 2 ) ).toBeDefined();
		expect( section.getLaneById( -2 ) ).toBeDefined();
	} );

} );

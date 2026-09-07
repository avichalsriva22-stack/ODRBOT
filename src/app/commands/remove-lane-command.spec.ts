/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { TvLaneSection } from 'app/map/models/tv-lane-section';
import { RemoveLaneCommand } from './remove-lane-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneType } from 'app/map/models/tv-common';

describe( 'RemoveLaneCommand', () => {

	it( 'should correctly apply, undo, and redo removing a lane', () => {

		const road = new TvRoad( 'test' );
		
		const section = new TvLaneSection( 0, 0, false, road );
		section.createCenterLane();
		section.createLeftLane( 1, TvLaneType.driving, false, true );
		const lane2 = section.createLeftLane( 2, TvLaneType.shoulder, false, true );

		const cmd = new RemoveLaneCommand( section, lane2 );

		// Execute
		cmd.execute();
		expect( section.getLeftLanes().length ).toBe( 1 );
		expect( section.hasLane( 2 ) ).toBe( false );

		// Undo
		cmd.undo();
		expect( section.getLeftLanes().length ).toBe( 2 );
		expect( section.hasLane( 2 ) ).toBe( true );

		// Redo
		cmd.redo();
		expect( section.getLeftLanes().length ).toBe( 1 );

	} );

} );

/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneSection } from 'app/map/models/tv-lane-section';
import { AddLaneCommand } from './add-lane-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneType, TvLaneSide } from 'app/map/models/tv-common';

describe( 'AddLaneCommand', () => {

	it( 'should correctly apply, undo, and redo adding a lane and renumbering siblings', () => {

		const road = new TvRoad( 'test' );
		
		const section = new TvLaneSection( 0, 0, false, road );
		section.createCenterLane();
		section.createLeftLane( 1, TvLaneType.driving, false, true );

		const newLane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );

		const cmd = new AddLaneCommand( section, newLane );

		// Execute
		cmd.execute();
		expect( section.getLeftLanes().length ).toBe( 2 );
		// The old lane 1 should have been shifted to 2, and new lane is 1
		expect( section.hasLane( 1 ) ).toBe( true );
		expect( section.hasLane( 2 ) ).toBe( true );

		// Undo
		cmd.undo();
		expect( section.getLeftLanes().length ).toBe( 1 );
		expect( section.hasLane( 1 ) ).toBe( true );
		expect( section.hasLane( 2 ) ).toBe( false );

		// Redo
		cmd.redo();
		expect( section.getLeftLanes().length ).toBe( 2 );

	} );

} );

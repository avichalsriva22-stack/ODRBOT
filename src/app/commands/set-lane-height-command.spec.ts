/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneHeight } from 'app/map/lane-height/lane-height.model';
import { SetLaneHeightCommand } from './set-lane-height-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneType, TvLaneSide } from 'app/map/models/tv-common';

describe( 'SetLaneHeightCommand', () => {

	it( 'should correctly apply, undo, and redo lane heights', () => {

		const road = new TvRoad( 'test' );
		
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		spyOn( lane, 'getRoad' ).and.returnValue( road );

		const oldHeights = [ new TvLaneHeight( 0, 0, 0 ) ];
		const newHeights = [ new TvLaneHeight( 0, 0.1, 0.2 ), new TvLaneHeight( 10, 0.15, 0.25 ) ];

		const cmd = new SetLaneHeightCommand( lane, oldHeights, newHeights );

		// Execute
		cmd.execute();
		expect( lane.height.length ).toBe( 2 );
		expect( lane.height[ 0 ].inner ).toBe( 0.1 );
		expect( lane.height[ 1 ].outer ).toBe( 0.25 );

		// Undo
		cmd.undo();
		expect( lane.height.length ).toBe( 1 );
		expect( lane.height[ 0 ].inner ).toBe( 0 );

		// Redo
		cmd.redo();
		expect( lane.height.length ).toBe( 2 );
		expect( lane.height[ 0 ].inner ).toBe( 0.1 );

	} );

} );

/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneWidth } from 'app/map/models/tv-lane-width';
import { SetLaneWidthCommand } from './set-lane-width-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneType, TvLaneSide } from 'app/map/models/tv-common';

describe( 'SetLaneWidthCommand', () => {

	it( 'should correctly apply, undo, and redo lane widths', () => {

		const road = new TvRoad( 'test' );
		
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		spyOn( lane, 'getRoad' ).and.returnValue( road );

		const oldWidths = [ new TvLaneWidth( 0, 3.6, 0, 0, 0 ) ];
		const newWidths = [ new TvLaneWidth( 0, 4.0, 0, 0, 0 ), new TvLaneWidth( 10, 4.5, 0, 0, 0 ) ];

		const cmd = new SetLaneWidthCommand( lane, oldWidths, newWidths );

		// Execute
		cmd.execute();
		expect( lane.getWidthArray().length ).toBe( 2 );
		expect( lane.getWidthArray()[ 0 ].a ).toBe( 4.0 );
		expect( lane.getWidthArray()[ 1 ].a ).toBe( 4.5 );

		// Undo
		cmd.undo();
		expect( lane.getWidthArray().length ).toBe( 1 );
		expect( lane.getWidthArray()[ 0 ].a ).toBe( 3.6 );

		// Redo
		cmd.redo();
		expect( lane.getWidthArray().length ).toBe( 2 );
		expect( lane.getWidthArray()[ 0 ].a ).toBe( 4.0 );

	} );

} );

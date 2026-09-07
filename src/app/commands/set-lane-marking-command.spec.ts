/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneRoadMark, TvRoadMarkLaneChange } from 'app/map/models/tv-lane-road-mark';
import { SetLaneMarkingCommand } from './set-lane-marking-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvLaneType, TvLaneSide, TvRoadMarkTypes, TvRoadMarkWeights, TvColors } from 'app/map/models/tv-common';

describe( 'SetLaneMarkingCommand', () => {

	it( 'should correctly apply, undo, and redo lane markings', () => {

		const road = new TvRoad( 'test' );
		
		const lane = new TvLane( TvLaneSide.LEFT, 1, TvLaneType.driving );
		spyOn( lane, 'getRoad' ).and.returnValue( road );

		const oldMarks = [ new TvLaneRoadMark( 0, TvRoadMarkTypes.NONE, TvRoadMarkWeights.STANDARD, TvColors.WHITE, 0, TvRoadMarkLaneChange.NONE, 0, lane ) ];
		const newMarks = [ new TvLaneRoadMark( 0, TvRoadMarkTypes.SOLID, TvRoadMarkWeights.STANDARD, TvColors.YELLOW, 0.15, TvRoadMarkLaneChange.NONE, 0, lane ) ];

		const cmd = new SetLaneMarkingCommand( lane, oldMarks, newMarks );

		// Execute
		cmd.execute();
		expect( lane.roadMarks.length ).toBe( 1 );
		expect( lane.roadMarks.toArray()[ 0 ].type ).toBe( TvRoadMarkTypes.SOLID );
		expect( lane.roadMarks.toArray()[ 0 ].color ).toBe( TvColors.YELLOW );

		// Undo
		cmd.undo();
		expect( lane.roadMarks.length ).toBe( 1 );
		expect( lane.roadMarks.toArray()[ 0 ].type ).toBe( TvRoadMarkTypes.NONE );

		// Redo
		cmd.redo();
		expect( lane.roadMarks.length ).toBe( 1 );
		expect( lane.roadMarks.toArray()[ 0 ].type ).toBe( TvRoadMarkTypes.SOLID );

	} );

} );

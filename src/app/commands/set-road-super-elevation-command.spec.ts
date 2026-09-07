/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { TvRoad } from 'app/map/models/tv-road.model';
import { TvSuperElevation } from 'app/map/models/tv-lateral.profile';
import { SetRoadSuperElevationCommand } from './set-road-super-elevation-command';

describe( 'SetRoadSuperElevationCommand', () => {

	it( 'should correctly apply, undo, and redo road super elevation', () => {

		const road = new TvRoad( 'test' );
		
		const profile = road.getLateralProfile();
		
		const oldElevations = [ new TvSuperElevation( 0, 0, 0, 0, 0 ) ];
		const newElevations = [ new TvSuperElevation( 0, 0.5, 0.1, 0, 0 ) ];

		const cmd = new SetRoadSuperElevationCommand( road, oldElevations, newElevations );

		// Execute
		cmd.execute();
		expect( profile.getSuperElevations().length ).toBe( 1 );
		expect( profile.getSuperElevations()[ 0 ].a ).toBe( 0.5 );

		// Undo
		cmd.undo();
		expect( profile.getSuperElevations().length ).toBe( 1 );
		expect( profile.getSuperElevations()[ 0 ].a ).toBe( 0 );

		// Redo
		cmd.redo();
		expect( profile.getSuperElevations().length ).toBe( 1 );
		expect( profile.getSuperElevations()[ 0 ].a ).toBe( 0.5 );

	} );

} );

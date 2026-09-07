/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { TvRoad } from 'app/map/models/tv-road.model';
import { TvElevationProfile } from 'app/map/road-elevation/tv-elevation-profile.model';
import { SetRoadElevationCommand } from './set-road-elevation-command';
import { TvElevation } from 'app/map/road-elevation/tv-elevation.model';

describe( 'SetRoadElevationCommand', () => {

	it( 'should correctly apply, undo, and redo road elevation', () => {

		const road = new TvRoad( 'test' );
		
		const oldProfile = new TvElevationProfile();
		oldProfile.addElevation( new TvElevation( 0, 0, 0, 0, 0 ) );

		const newProfile = new TvElevationProfile();
		newProfile.addElevation( new TvElevation( 0, 5, 0.1, 0, 0 ) );

		const cmd = new SetRoadElevationCommand( road, oldProfile, newProfile );

		// Execute
		cmd.execute();
		expect( road.getElevationProfile().getElevations()[ 0 ].a ).toBe( 5 );

		// Undo
		cmd.undo();
		expect( road.getElevationProfile().getElevations()[ 0 ].a ).toBe( 0 );

		// Redo
		cmd.redo();
		expect( road.getElevationProfile().getElevations()[ 0 ].a ).toBe( 5 );

	} );

} );

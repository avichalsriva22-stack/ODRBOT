/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from 'app/commands/base-command';
import { MapEvents } from 'app/events/map-events';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvElevationProfile } from 'app/map/road-elevation/tv-elevation-profile.model';

export class SetRoadElevationCommand extends BaseCommand {

	private oldProfile: TvElevationProfile;
	private newProfile: TvElevationProfile;

	constructor ( private road: TvRoad, oldProfile: TvElevationProfile, newProfile: TvElevationProfile ) {
		super();
		this.oldProfile = oldProfile.clone();
		this.newProfile = newProfile.clone();
	}

	execute (): void {
		this.applyProfile( this.newProfile );
	}

	undo (): void {
		this.applyProfile( this.oldProfile );
	}

	redo (): void {
		this.execute();
	}

	private applyProfile ( profile: TvElevationProfile ): void {
		this.road.setElevationProfile( profile.clone() );
		MapEvents.objectUpdated.emit( this.road );
	}
}

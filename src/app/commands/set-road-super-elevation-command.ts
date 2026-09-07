/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from 'app/commands/base-command';
import { MapEvents } from 'app/events/map-events';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvSuperElevation } from 'app/map/models/tv-lateral.profile';

export class SetRoadSuperElevationCommand extends BaseCommand {

	private oldElevations: TvSuperElevation[];
	private newElevations: TvSuperElevation[];

	constructor ( private road: TvRoad, oldElevations: TvSuperElevation[], newElevations: TvSuperElevation[] ) {
		super();
		this.oldElevations = oldElevations.map( e => e.clone() );
		this.newElevations = newElevations.map( e => e.clone() );
	}

	execute (): void {
		this.applyElevations( this.newElevations );
	}

	undo (): void {
		this.applyElevations( this.oldElevations );
	}

	redo (): void {
		this.execute();
	}

	private applyElevations ( elevations: TvSuperElevation[] ): void {
		const profile = this.road.getLateralProfile();
		
		// Remove existing
		const existing = profile.getSuperElevations();
		existing.forEach( e => profile.removeSuperElevation( e ) );
		
		// Add new
		elevations.forEach( e => profile.addSuperElevation( e.clone() ) );
		profile.computeCoefficients( this.road.getLength() );

		MapEvents.objectUpdated.emit( this.road );
	}
}

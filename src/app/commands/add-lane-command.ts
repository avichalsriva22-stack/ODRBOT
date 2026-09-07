/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from 'app/commands/base-command';
import { MapEvents } from 'app/events/map-events';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneSection } from 'app/map/models/tv-lane-section';

export class AddLaneCommand extends BaseCommand {

	private hasExecuted = false;

	constructor ( private laneSection: TvLaneSection, private newLane: TvLane ) {
		super();
	}

	execute (): void {
		if ( !this.hasExecuted ) {
			this.laneSection.addLaneInstance( this.newLane, true );
			this.hasExecuted = true;
			MapEvents.laneCreated.emit( this.newLane );
			MapEvents.objectUpdated.emit( this.laneSection.getRoad() );
		}
	}

	undo (): void {
		this.laneSection.removeLane( this.newLane );
		this.hasExecuted = false;
		MapEvents.objectUpdated.emit( this.laneSection.getRoad() );
	}

	redo (): void {
		this.execute();
	}
}

/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from 'app/commands/base-command';
import { MapEvents } from 'app/events/map-events';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneSection } from 'app/map/models/tv-lane-section';

export class RemoveLaneCommand extends BaseCommand {

	private hasExecuted = false;

	constructor ( private laneSection: TvLaneSection, private laneToRemove: TvLane ) {
		super();
	}

	execute (): void {
		if ( !this.hasExecuted ) {
			this.laneSection.removeLane( this.laneToRemove );
			this.hasExecuted = true;
			MapEvents.objectUpdated.emit( this.laneSection.getRoad() );
		}
	}

	undo (): void {
		this.laneSection.addLaneInstance( this.laneToRemove, true );
		this.hasExecuted = false;
		MapEvents.objectUpdated.emit( this.laneSection.getRoad() );
	}

	redo (): void {
		this.execute();
	}
}

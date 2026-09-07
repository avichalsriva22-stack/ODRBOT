/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from 'app/commands/base-command';
import { MapEvents } from 'app/events/map-events';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneHeight } from 'app/map/lane-height/lane-height.model';

export class SetLaneHeightCommand extends BaseCommand {

	private oldHeights: TvLaneHeight[];
	private newHeights: TvLaneHeight[];

	constructor ( private lane: TvLane, oldHeights: TvLaneHeight[], newHeights: TvLaneHeight[] ) {
		super();
		this.oldHeights = oldHeights.map( h => h.clone() );
		this.newHeights = newHeights.map( h => h.clone() );
	}

	execute (): void {
		this.applyHeights( this.newHeights );
	}

	undo (): void {
		this.applyHeights( this.oldHeights );
	}

	redo (): void {
		this.execute();
	}

	private applyHeights ( heights: TvLaneHeight[] ): void {
		this.lane.clearLaneHeight();
		heights.forEach( h => this.lane.addHeightRecordInstance( h.clone() ) );
		MapEvents.objectUpdated.emit( this.lane );
		MapEvents.objectUpdated.emit( this.lane.getRoad() );
	}
}

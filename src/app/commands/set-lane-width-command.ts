/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from 'app/commands/base-command';
import { MapEvents } from 'app/events/map-events';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneWidth } from 'app/map/models/tv-lane-width';

export class SetLaneWidthCommand extends BaseCommand {

	private oldWidths: TvLaneWidth[];
	private newWidths: TvLaneWidth[];

	constructor ( private lane: TvLane, oldWidths: TvLaneWidth[], newWidths: TvLaneWidth[] ) {
		super();
		this.oldWidths = oldWidths.map( w => w.clone() );
		this.newWidths = newWidths.map( w => w.clone() );
	}

	execute (): void {
		this.applyWidths( this.newWidths );
	}

	undo (): void {
		this.applyWidths( this.oldWidths );
	}

	redo (): void {
		this.execute();
	}

	private applyWidths ( widths: TvLaneWidth[] ): void {
		this.lane.clearLaneWidth();
		widths.forEach( w => this.lane.addWidthRecordInstance( w.clone() ) );
		MapEvents.objectUpdated.emit( this.lane );
		MapEvents.objectUpdated.emit( this.lane.getRoad() );
	}
}

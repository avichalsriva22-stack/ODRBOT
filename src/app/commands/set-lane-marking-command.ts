/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from 'app/commands/base-command';
import { MapEvents } from 'app/events/map-events';
import { TvLane } from 'app/map/models/tv-lane';
import { TvLaneRoadMark } from 'app/map/models/tv-lane-road-mark';

export class SetLaneMarkingCommand extends BaseCommand {

	private oldMarks: TvLaneRoadMark[];
	private newMarks: TvLaneRoadMark[];

	constructor ( private lane: TvLane, oldMarks: TvLaneRoadMark[], newMarks: TvLaneRoadMark[] ) {
		super();
		this.oldMarks = oldMarks.map( m => m.clone( m.sOffset, this.lane ) );
		this.newMarks = newMarks.map( m => m.clone( m.sOffset, this.lane ) );
	}

	execute (): void {
		this.applyMarks( this.newMarks );
	}

	undo (): void {
		this.applyMarks( this.oldMarks );
	}

	redo (): void {
		this.execute();
	}

	private applyMarks ( marks: TvLaneRoadMark[] ): void {
		this.lane.clearRoadMarks();
		marks.forEach( m => this.lane.addRoadMarkInstance( m.clone( m.sOffset, this.lane ) ) );
		MapEvents.objectUpdated.emit( this.lane );
		MapEvents.objectUpdated.emit( this.lane.getRoad() );
	}
}

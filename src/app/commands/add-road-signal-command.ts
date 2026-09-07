import { BaseCommand } from './base-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvRoadSignal } from 'app/map/models/signals/tv-road-signal';

export class AddRoadSignalCommand extends BaseCommand {
	constructor(private road: TvRoad, private signal: TvRoadSignal) {
		super();
	}

	execute(): void {
		this.road.addRoadSignalInstance(this.signal);
	}

	undo(): void {
		this.road.removeRoadSignal(this.signal);
	}

	redo(): void {
		this.execute();
	}
}

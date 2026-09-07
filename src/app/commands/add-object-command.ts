/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from "./base-command";
import { MapEvents } from "../events/map-events";
import { TvMapInstance } from 'app/map/services/tv-map-instance';
import { RoadCreatedEvent } from '../events/road/road-created-event';
import { JunctionCreatedEvent } from '../events/junction/junction-created-event';
import { TvRoad } from '../map/models/tv-road.model';
import { TvJunction } from '../map/models/junctions/tv-junction';

export class AddObjectCommand extends BaseCommand {

	constructor ( private object: any | any[] ) {

		super();

	}

	execute (): void {
		if (Array.isArray(this.object)) {
			this.object.forEach(obj => this.addToMap(obj));
		} else {
			this.addToMap(this.object);
		}
		MapEvents.objectAdded.emit( this.object );
	}

	undo (): void {
		if (Array.isArray(this.object)) {
			this.object.forEach(obj => this.removeFromMap(obj));
		} else {
			this.removeFromMap(this.object);
		}
		MapEvents.objectRemoved.emit( this.object );
	}

	private addToMap(obj: any): void {
		if (obj && typeof obj === 'object') {
			if (obj instanceof TvRoad) {
				TvMapInstance.map.addRoad(obj);
				MapEvents.roadCreated.emit(new RoadCreatedEvent(obj));
			} else if (obj instanceof TvJunction) {
				TvMapInstance.map.addJunction(obj);
				MapEvents.junctionCreated.emit(new JunctionCreatedEvent(obj));
			}
		}
	}

	private removeFromMap(obj: any): void {
		if (obj && typeof obj === 'object') {
			if (obj.isRoad) {
				TvMapInstance.map.removeRoad(obj);
			} else if (obj.isJunction) {
				TvMapInstance.map.removeJunction(obj);
			}
		}
	}

	redo (): void {

		this.execute();

	}

}

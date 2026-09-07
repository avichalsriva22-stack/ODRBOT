/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from "./base-command";
import { MapEvents } from "../events/map-events";
import { RoadCreatedEvent } from '../events/road/road-created-event';
import { JunctionCreatedEvent } from '../events/junction/junction-created-event';
import { TvRoad } from '../map/models/tv-road.model';
import { TvJunction } from '../map/models/junctions/tv-junction';

export class RemoveObjectCommand extends BaseCommand {

	constructor ( private object: object | object[], private fireUnselectEvent = false ) {
		super();
	}

	execute (): void {
		if ( this.fireUnselectEvent ) {
			MapEvents.objectUnselected.emit( this.object );
		}
		if ( Array.isArray( this.object ) ) {
			this.object.forEach( obj => this.removeFromMap(obj) );
			this.object.forEach( obj => MapEvents.objectRemoved.emit( obj ) );
		} else {
			this.removeFromMap(this.object);
			MapEvents.objectRemoved.emit( this.object );
		}
	}

	undo (): void {
		if ( Array.isArray( this.object ) ) {
			this.object.forEach( obj => this.addToMap(obj) );
			this.object.forEach( obj => MapEvents.objectAdded.emit( obj ) );
		} else {
			this.addToMap(this.object);
			MapEvents.objectAdded.emit( this.object );
		}
		if ( this.fireUnselectEvent ) {
			MapEvents.objectSelected.emit( this.object );
		}
	}

	private addToMap(obj: any): void {
		if (obj && typeof obj === 'object') {
			if (obj instanceof TvRoad) {
				import('app/map/services/tv-map-instance').then(m => m.TvMapInstance.map.addRoad(obj));
				MapEvents.roadCreated.emit(new RoadCreatedEvent(obj));
			} else if (obj instanceof TvJunction) {
				import('app/map/services/tv-map-instance').then(m => m.TvMapInstance.map.addJunction(obj));
				MapEvents.junctionCreated.emit(new JunctionCreatedEvent(obj));
			}
		}
	}

	private removeFromMap(obj: any): void {
		if (obj && typeof obj === 'object') {
			if (obj instanceof TvRoad) {
				import('app/map/services/tv-map-instance').then(m => m.TvMapInstance.map.removeRoad(obj));
			} else if (obj instanceof TvJunction) {
				import('app/map/services/tv-map-instance').then(m => m.TvMapInstance.map.removeJunction(obj));
			}
		}
	}

	redo (): void {

		this.execute();

	}

}

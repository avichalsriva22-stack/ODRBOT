/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { BaseCommand } from "./base-command";
import { TvRoad } from "../map/models/tv-road.model";
import { TvContactPoint } from "../map/models/tv-common";
import { TvLink } from "../map/models/tv-link";

export class LinkRoadsCommand extends BaseCommand {

	private oldPredecessor1: TvLink;
	private oldSuccessor1: TvLink;
	private oldPredecessor2: TvLink;
	private oldSuccessor2: TvLink;

	constructor (
		private road1: TvRoad,
		private contact1: TvContactPoint,
		private road2: TvRoad,
		private contact2: TvContactPoint
	) {
		super();
		this.oldPredecessor1 = road1.getPredecessor();
		this.oldSuccessor1 = road1.getSuccessor();
		this.oldPredecessor2 = road2.getPredecessor();
		this.oldSuccessor2 = road2.getSuccessor();
	}

	execute (): void {
		if ( this.contact1 === TvContactPoint.START ) {
			this.road1.linkPredecessorRoad( this.road2, this.contact2 );
		} else {
			this.road1.linkSuccessorRoad( this.road2, this.contact2 );
		}
	}

	undo (): void {
		// Restore previous state
		if ( this.contact1 === TvContactPoint.START ) {
			this.road1.removePredecessor();
			if (this.oldPredecessor1) this.road1.setPredecessor(this.oldPredecessor1);
		} else {
			this.road1.removeSuccessor();
			if (this.oldSuccessor1) this.road1.setSuccessor(this.oldSuccessor1);
		}

		if ( this.contact2 === TvContactPoint.START ) {
			this.road2.removePredecessor();
			if (this.oldPredecessor2) this.road2.setPredecessor(this.oldPredecessor2);
		} else {
			this.road2.removeSuccessor();
			if (this.oldSuccessor2) this.road2.setSuccessor(this.oldSuccessor2);
		}
	}

	redo (): void {
		this.execute();
	}
}

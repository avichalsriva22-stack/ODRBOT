/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable } from "@angular/core";
import { TvLaneHeight } from "app/map/lane-height/lane-height.model";
import { TvLaneType } from "app/map/models/tv-common";
import { TvLane } from "app/map/models/tv-lane";
import { TvLaneSection } from "app/map/models/tv-lane-section";
import { TvRoad } from "app/map/models/tv-road.model";
import { LaneUtils } from "app/utils/lane.utils";

@Injectable( {
	providedIn: 'root'
} )
export class LaneHeightManager {


	onLaneTypeChanged ( road: TvRoad, laneSection: TvLaneSection, lane: TvLane ): void {

		const heightValue = this.getHeightValueByType( lane.type );

		lane.height.forEach( height => height.setHeight( heightValue ) );

	}

	onLaneCreated ( road: TvRoad, laneSection: TvLaneSection, lane: TvLane ): void {

		this.createDefaultNodes( road, laneSection, lane );

	}

	onLaneUpdated ( road: TvRoad, laneSection: TvLaneSection, lane: TvLane ): void {

		this.createDefaultNodes( road, laneSection, lane );

		if ( lane.height.length == 0 ) {
			return;
		}

		const succcessor = lane.getSuccessorLane();
		const predecessor = lane.getPredecessorLane();

		const lastHeight = lane.height[ lane.height.length - 1 ];
		const firstHeight = lane.height[ 0 ];

		if ( succcessor && lastHeight ) {
			this.syncSuccessor( succcessor, lastHeight );
		}

		if ( predecessor && firstHeight ) {
			this.syncPredecessor( predecessor, firstHeight );
		}

	}

	private syncSuccessor ( successor: TvLane, height: TvLaneHeight ): void {

		if ( successor.height.length == 0 ) {
			const clone = height.clone();
			clone.sOffset = 0;
			successor.addHeightRecordInstance( clone );
			return;
		}

		const successorFirstHeight = successor.height[0];
		successorFirstHeight?.copyHeight( height );

	}

	private syncPredecessor ( predecessor: TvLane, height: TvLaneHeight ): void {

		if ( predecessor.height.length == 0 ) return;

		const predecessorLastHeight = predecessor.height[ predecessor.height.length - 1 ];
		predecessorLastHeight?.copyHeight( height );

	}

	private createDefaultNodes ( road: TvRoad, laneSection: TvLaneSection, lane: TvLane ): void {

		if ( road.isJunction ) return;

		this.ensureMinimumTwoNodes( road, laneSection, lane );

		this.updateFirstAndLastNodes( road, laneSection, lane );

	}

	private ensureMinimumTwoNodes ( road: TvRoad, laneSection: TvLaneSection, lane: TvLane ): void {

		const nextLaneSection = LaneUtils.findNextLaneSection( road, laneSection );

		const sEnd = nextLaneSection ? nextLaneSection.s - laneSection.s : road.length - laneSection.s;

		if ( lane.getLaneHeightCount() === 0 ) {

			let height = this.getHeightValueByType( lane.type );

			lane.addHeightRecord( 0, height, height );
			lane.addHeightRecord( sEnd, height, height );

		}

		if ( lane.getLaneHeightCount() == 1 ) {

			const inner = lane.height[ 0 ].inner;
			const outer = lane.height[ 0 ].outer;

			lane.addHeightRecord( sEnd, inner, outer );

		}

	}

	private updateFirstAndLastNodes ( road: TvRoad, laneSection: TvLaneSection, lane: TvLane ): void {

		if ( lane.height.length === 0 ) return;

		const firstHeight = lane.height[ 0 ];

		if ( firstHeight.sOffset !== 0 ) {

			firstHeight.sOffset = 0;

		}

		const lastHeight = lane.height[ lane.height.length - 1 ];

		if ( lastHeight.sOffset !== road.length - laneSection.s ) {

			lastHeight.sOffset = road.length - laneSection.s;

		}

	}

	private getHeightValueByType ( type: TvLaneType ): number {

		switch ( type ) {

			case TvLaneType.sidewalk:
				return 0.12;

			case TvLaneType.curb:
				return 0.12;

			default:
				return 0;
		}

	}
}

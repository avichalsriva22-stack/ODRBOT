/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { Injectable } from '@angular/core';
import { MapService } from 'app/services/map/map.service';
import { SelectionService } from 'app/tools/selection.service';
import { ToolManager } from 'app/managers/tool-manager';
import { ToolType } from 'app/tools/tool-types.enum';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvJunction } from 'app/map/models/junctions/tv-junction';

export interface AiMapContext {
	mapName: string;
	roadCount: number;
	junctionCount: number;
	selection: {
		type: 'road' | 'junction' | 'lane' | 'none';
		id?: number;
		summary?: string;
	};
	activeTool: string;
	roadsSummary: AiRoadSummary[];
	junctionsSummary: AiJunctionSummary[];
	truncated: boolean;
}

export interface AiRoadSummary {
	id: number;
	name: string;
	length: number;
	startPosition: { x: number; y: number };
	endPosition: { x: number; y: number };
	headingDegrees: number;
	leftLanes: { id: number; type: string; width: number }[];
	rightLanes: { id: number; type: string; width: number }[];
	maxSpeed: number;
	roadType: string;
	isJunctionRoad: boolean;
}

export interface AiJunctionSummary {
	id: number;
	name: string;
	type: string;
	connectingRoadIds: number[];
	position: { x: number; y: number };
}

@Injectable( { providedIn: 'root' } )
export class AiContextService {

	private readonly MAX_ROADS = 30;
	private readonly MAX_JUNCTIONS = 15;

	constructor (
		private mapService: MapService,
		private selectionService: SelectionService
	) {}

	buildContext (): AiMapContext {

		const map = this.mapService.map;
		if ( !map ) {
			return {
				mapName: '', roadCount: 0, junctionCount: 0,
				selection: { type: 'none' }, activeTool: 'Pointer',
				roadsSummary: [], junctionsSummary: [], truncated: false
			};
		}

		const allRoads = map.getRoads();
		const allJunctions = map.getJunctions();

		const activeToolEnum = ToolManager.getCurrentTool()?.toolType;
		const activeTool = activeToolEnum !== undefined ? ToolType[ activeToolEnum ] : 'Pointer';

		const selection = this.buildSelectionSummary();
		const priorityRoadIds = new Set<number>();
		const priorityJunctionIds = new Set<number>();

		// Determine priority based on selection
		if ( selection.type === 'road' && selection.id !== undefined ) {
			const road = map.getRoad( selection.id );
			if ( road ) {
				priorityRoadIds.add( road.id );
				const predId = road.getPredecessorRoadId();
				if ( predId !== undefined ) priorityRoadIds.add( predId );
				const succId = road.getSuccessorRoadId();
				if ( succId !== undefined ) priorityRoadIds.add( succId );
			}
		} else if ( selection.type === 'junction' && selection.id !== undefined ) {
			const junction = map.getJunction( selection.id );
			if ( junction ) {
				priorityJunctionIds.add( junction.id );
				junction.getIncomingRoads().forEach( r => priorityRoadIds.add( r.id ) );
			}
		} else if ( selection.type === 'lane' ) {
			// Lane selection means its parent road is implicitly prioritized
			const lastObj = this.selectionService.getLastSelectedObject();
			if ( lastObj && lastObj.laneSection && lastObj.laneSection.road ) {
				const road = lastObj.laneSection.road as TvRoad;
				priorityRoadIds.add( road.id );
				const predId = road.getPredecessorRoadId();
				if ( predId !== undefined ) priorityRoadIds.add( predId );
				const succId = road.getSuccessorRoadId();
				if ( succId !== undefined ) priorityRoadIds.add( succId );
			}
		}

		let roadsTruncated = false;
		let junctionsTruncated = false;

		const selectedRoads = this.selectItems<TvRoad>( allRoads, priorityRoadIds, this.MAX_ROADS, r => this.getRoadCenterDistanceToOrigin( r ) );
		if ( allRoads.length > this.MAX_ROADS ) roadsTruncated = true;

		const selectedJunctions = this.selectItems<TvJunction>( allJunctions, priorityJunctionIds, this.MAX_JUNCTIONS, j => this.getJunctionDistanceToOrigin( j ) );
		if ( allJunctions.length > this.MAX_JUNCTIONS ) junctionsTruncated = true;

		return {
			mapName: 'Untitled',
			roadCount: allRoads.length,
			junctionCount: allJunctions.length,
			selection,
			activeTool,
			roadsSummary: selectedRoads.map( r => this.mapRoadSummary( r ) ),
			junctionsSummary: selectedJunctions.map( j => this.mapJunctionSummary( j ) ),
			truncated: roadsTruncated || junctionsTruncated
		};
	}

	private buildSelectionSummary (): AiMapContext['selection'] {

		const road = this.selectionService.findSelectedObject<TvRoad>( TvRoad as any );
		if ( road ) {
			return {
				type: 'road',
				id: road.id,
				summary: `Road ${ road.id }, length ${ road.length.toFixed( 1 ) }m, type ${ road.getRoadTypeAt( 0 )?.type || 'unknown' }, max speed ${ road.getRoadTypeAt( 0 )?.speed?.max || 0 }`
			};
		}

		const junction = this.selectionService.findSelectedObject<TvJunction>( TvJunction as any );
		if ( junction ) {
			return {
				type: 'junction',
				id: junction.id,
				summary: `Junction ${ junction.id }, type ${ junction.type }`
			};
		}

		const lastSelected = this.selectionService.getLastSelectedObject();
		if ( lastSelected && lastSelected.id !== undefined && lastSelected.laneSection && lastSelected.type !== undefined ) {
			const parentRoad = lastSelected.laneSection.road as TvRoad;
			return {
				type: 'lane',
				id: lastSelected.id,
				summary: `Lane ${ lastSelected.id } (type ${ lastSelected.type }) on Road ${ parentRoad.id }`
			};
		}

		return { type: 'none' };
	}

	private selectItems<T extends { id: number }> ( all: T[], priorityIds: Set<number>, maxCount: number, distanceFn: ( item: T ) => number ): T[] {
		if ( all.length <= maxCount ) return [ ...all ];

		const result: T[] = [];
		const remaining: { item: T; dist: number }[] = [];

		for ( const item of all ) {
			if ( priorityIds.has( item.id ) ) {
				result.push( item );
			} else {
				remaining.push( { item, dist: distanceFn( item ) } );
			}
		}

		// Sort remaining by distance to origin
		remaining.sort( ( a, b ) => a.dist - b.dist );

		// Fill up to maxCount
		while ( result.length < maxCount && remaining.length > 0 ) {
			result.push( remaining.shift()!.item );
		}

		return result;
	}

	private getRoadCenterDistanceToOrigin ( road: TvRoad ): number {
		if ( road.length === 0 ) {
			try {
				const start = road.getStartCoord();
				if ( start ) return start.position.x * start.position.x + start.position.y * start.position.y;
			} catch {
				return Number.MAX_SAFE_INTEGER;
			}
		}
		try {
			const mid = road.getRoadPosition( road.length / 2, 0 );
			if ( mid ) return mid.x * mid.x + mid.y * mid.y;
		} catch {
			return Number.MAX_SAFE_INTEGER;
		}
		return Number.MAX_SAFE_INTEGER;
	}

	private getJunctionDistanceToOrigin ( junction: TvJunction ): number {
		if ( !junction.centroid ) return Number.MAX_SAFE_INTEGER;
		return junction.centroid.x * junction.centroid.x + junction.centroid.y * junction.centroid.y;
	}

	private mapRoadSummary ( road: TvRoad ): AiRoadSummary {

		let startX = 0, startY = 0, endX = 0, endY = 0, heading = 0;
		try {
			const startPos = road.getStartPosTheta();
			if ( startPos ) {
				startX = startPos.x;
				startY = startPos.y;
				heading = startPos.hdg * ( 180 / Math.PI ); // convert radians to degrees
			}
			const endPos = road.getEndPosTheta();
			if ( endPos ) {
				endX = endPos.x;
				endY = endPos.y;
			}
		} catch {
			// ignore geometry missing errors
		}

		const section = road.laneSections.length > 0 ? road.laneSections[ 0 ] : null;
		let leftLanes = [];
		let rightLanes = [];

		if ( section ) {
			leftLanes = section.getLeftLanes().map( l => ( {
				id: l.id,
				type: l.type,
				width: l.getWidthValue( 0 )
			} ) );
			rightLanes = section.getRightLanes().map( l => ( {
				id: l.id,
				type: l.type,
				width: l.getWidthValue( 0 )
			} ) );
		}

		return {
			id: road.id,
			name: road.name || '',
			length: road.length,
			startPosition: { x: startX, y: startY },
			endPosition: { x: endX, y: endY },
			headingDegrees: heading,
			leftLanes,
			rightLanes,
			maxSpeed: road.getRoadTypeAt( 0 )?.speed?.max || 0,
			roadType: road.getRoadTypeAt( 0 )?.type || 'unknown',
			isJunctionRoad: road.isJunction
		};
	}

	private mapJunctionSummary ( junction: TvJunction ): AiJunctionSummary {
		return {
			id: junction.id,
			name: junction.name || '',
			type: junction.type,
			connectingRoadIds: junction.getIncomingRoads().map( r => r.id ),
			position: {
				x: junction.centroid?.x || 0,
				y: junction.centroid?.y || 0
			}
		};
	}

}

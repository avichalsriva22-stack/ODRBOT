/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { AddLaneCommand } from 'app/commands/add-lane-command';
import { TvLaneType, TvLaneSide } from 'app/map/models/tv-common';
import { TvLane } from 'app/map/models/tv-lane';

export interface AddLaneArgs {
	roadId: number;
	side: 'left' | 'right';
	laneType: string;
	width?: number;
}

export class AddLaneTool implements AiTool<AddLaneArgs> {
	
	public readonly name = 'add_lane';
	public readonly category: AiToolCategory = 'lane';
	public readonly description = 'Add a new lane to a road, to the left or right of the existing lanes.';
	public readonly requiresPreview = false;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Target road id' },
			side: { type: 'string' as const, enum: [ 'left', 'right' ], description: 'Side of the road' },
			laneType: { type: 'string' as const, description: 'Type of lane (driving, shoulder, sidewalk, etc.)' },
			width: { type: 'number' as const, minimum: 0.5, maximum: 12, default: 3.6, description: 'Width of the lane' }
		},
		required: [ 'roadId', 'side', 'laneType' ]
	};

	validate ( args: AddLaneArgs, ctx: AiToolContext ): void {
		const road = ctx.mapService.map.getRoad( args.roadId );
		if ( !road ) {
			throw new AiToolValidationError( `Road with id ${ args.roadId } not found.` );
		}
		
		const laneSection = road.getLaneProfile().getLaneSectionAt( 0 );
		if ( !laneSection ) {
			throw new AiToolValidationError( `Road ${ args.roadId } has no default lane section.` );
		}

		if ( !Object.values( TvLaneType ).includes( args.laneType as TvLaneType ) ) {
			throw new AiToolValidationError( `Invalid lane type: ${ args.laneType }` );
		}
	}

	async run ( args: AddLaneArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		const road = ctx.mapService.map.getRoad( args.roadId );
		const laneSection = road.getLaneProfile().getLaneSectionAt( 0 );

		let newLane;
		if ( args.side === 'left' ) {
			const leftLanes = laneSection.getLeftLanes();
			const id = leftLanes.length > 0 ? Math.max(...leftLanes.map(l => l.id)) + 1 : 1;
			newLane = new TvLane( TvLaneSide.LEFT, id, args.laneType as TvLaneType, false, laneSection );
		} else {
			const rightLanes = laneSection.getRightLanes();
			const id = rightLanes.length > 0 ? Math.min(...rightLanes.map(l => l.id)) - 1 : -1;
			newLane = new TvLane( TvLaneSide.RIGHT, id, args.laneType as TvLaneType, false, laneSection );
		}
		newLane.addWidthRecordAtStart( args.width || 3.6 );

		const command = new AddLaneCommand( laneSection, newLane );

		return {
			commands: [ command ],
			summary: `Added a ${ args.laneType } lane to the ${ args.side } side of Road ${ args.roadId }.`
		};
	}
}

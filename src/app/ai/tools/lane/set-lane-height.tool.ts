/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { SetLaneHeightCommand } from 'app/commands/set-lane-height-command';
import { TvLaneHeight } from 'app/map/lane-height/lane-height.model';

export interface SetLaneHeightArgs {
	roadId: number;
	laneId: number;
	innerHeight: number;
	outerHeight: number;
	sOffset?: number;
}

export class SetLaneHeightTool implements AiTool<SetLaneHeightArgs> {
	
	public readonly name = 'set_lane_height';
	public readonly category: AiToolCategory = 'lane';
	public readonly description = 'Set the height offset of a lane (used for curbs/sidewalks).';
	public readonly requiresPreview = false;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Target road id' },
			laneId: { type: 'integer' as const, description: 'Lane id' },
			innerHeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Inner height offset' },
			outerHeight: { type: 'number' as const, minimum: 0, maximum: 1, description: 'Outer height offset' },
			sOffset: { type: 'number' as const, minimum: 0, default: 0, description: 'Position along road in meters' }
		},
		required: [ 'roadId', 'laneId', 'innerHeight', 'outerHeight' ]
	};

	validate ( args: SetLaneHeightArgs, ctx: AiToolContext ): void {
		const road = ctx.mapService.map.getRoad( args.roadId );
		if ( !road ) {
			throw new AiToolValidationError( `Road with id ${ args.roadId } not found.` );
		}

		const sOffset = args.sOffset ?? 0;
		if ( sOffset > road.getLength() ) {
			throw new AiToolValidationError( `sOffset ${ sOffset } exceeds road length ${ road.getLength() }.` );
		}

		const laneSection = road.getLaneProfile().getLaneSectionAt( sOffset );
		if ( !laneSection ) {
			throw new AiToolValidationError( `No lane section found at sOffset ${ sOffset }.` );
		}

		if ( !laneSection.hasLane( args.laneId ) ) {
			throw new AiToolValidationError( `Lane with id ${ args.laneId } not found at sOffset ${ sOffset }.` );
		}
		const lane = laneSection.getLaneById( args.laneId );
	}

	async run ( args: SetLaneHeightArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		const road = ctx.mapService.map.getRoad( args.roadId );
		const sOffset = args.sOffset ?? 0;
		const laneSection = road.getLaneProfile().getLaneSectionAt( sOffset );
		const lane = laneSection.getLaneById( args.laneId );

		const oldHeights = lane.height;
		const newHeights = oldHeights.map( h => h.clone() );

		// Update or insert the new height record
		const existingRecordIndex = newHeights.findIndex( h => h.sOffset === sOffset );
		if ( existingRecordIndex !== -1 ) {
			newHeights[ existingRecordIndex ].inner = args.innerHeight;
			newHeights[ existingRecordIndex ].outer = args.outerHeight;
		} else {
			newHeights.push( new TvLaneHeight( sOffset, args.innerHeight, args.outerHeight ) );
			newHeights.sort( ( a, b ) => a.sOffset - b.sOffset );
		}

		const command = new SetLaneHeightCommand( lane, oldHeights, newHeights );

		return {
			commands: [ command ],
			summary: `Set height of Lane ${ args.laneId } on Road ${ args.roadId } (inner: ${ args.innerHeight }, outer: ${ args.outerHeight }).`
		};
	}
}

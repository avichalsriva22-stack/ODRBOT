/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { SetLaneWidthCommand } from 'app/commands/set-lane-width-command';
import { TvLaneWidth } from 'app/map/models/tv-lane-width';

export interface SetLaneWidthArgs {
	roadId: number;
	laneId: number;
	width: number;
	sOffset?: number;
}

export class SetLaneWidthTool implements AiTool<SetLaneWidthArgs> {
	
	public readonly name = 'set_lane_width';
	public readonly category: AiToolCategory = 'lane';
	public readonly description = 'Set the width (in meters) of a specific lane on a specific road, optionally at a given position along the road. Requires the road to already exist.';
	public readonly requiresPreview = false;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Target road id' },
			laneId: { type: 'integer' as const, description: 'Lane id, negative = right side, positive = left side' },
			width: { type: 'number' as const, minimum: 0.5, maximum: 12, description: 'New width in meters' },
			sOffset: { type: 'number' as const, minimum: 0, default: 0, description: 'Position along road in meters' }
		},
		required: [ 'roadId', 'laneId', 'width' ]
	};

	validate ( args: SetLaneWidthArgs, ctx: AiToolContext ): void {
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

	async run ( args: SetLaneWidthArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		const road = ctx.mapService.map.getRoad( args.roadId );
		const sOffset = args.sOffset ?? 0;
		const laneSection = road.getLaneProfile().getLaneSectionAt( sOffset );
		const lane = laneSection.getLaneById( args.laneId );

		const oldWidths = lane.getWidthArray();
		const newWidths = oldWidths.map( w => w.clone() );

		// Update or insert the new width record
		const existingRecordIndex = newWidths.findIndex( w => w.s === sOffset );
		if ( existingRecordIndex !== -1 ) {
			newWidths[ existingRecordIndex ].a = args.width;
		} else {
			newWidths.push( new TvLaneWidth( sOffset, args.width, 0, 0, 0 ) );
			newWidths.sort( ( a, b ) => a.s - b.s );
		}

		const command = new SetLaneWidthCommand( lane, oldWidths, newWidths );

		return {
			commands: [ command ],
			summary: `Set width of Lane ${ args.laneId } on Road ${ args.roadId } to ${ args.width }m at sOffset ${ sOffset }m.`
		};
	}
}

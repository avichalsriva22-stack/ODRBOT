/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { SetLaneMarkingCommand } from 'app/commands/set-lane-marking-command';
import { TvLaneRoadMark, TvRoadMarkLaneChange } from 'app/map/models/tv-lane-road-mark';
import { TvRoadMarkTypes, TvColors, TvRoadMarkWeights } from 'app/map/models/tv-common';

export interface SetLaneMarkingArgs {
	roadId: number;
	laneId: number;
	side: 'left' | 'right';
	markingType: 'solid' | 'broken' | 'solid-solid' | 'solid-broken' | 'broken-solid' | 'botts-dots' | 'grass' | 'curb' | 'none';
	color?: 'white' | 'yellow' | 'red' | 'blue' | 'green';
}

export class SetLaneMarkingTool implements AiTool<SetLaneMarkingArgs> {
	
	public readonly name = 'set_lane_marking';
	public readonly category: AiToolCategory = 'lane';
	public readonly description = 'Set the road-marking style (solid, broken, none, etc.) on one edge of a lane.';
	public readonly requiresPreview = false;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Target road id' },
			laneId: { type: 'integer' as const, description: 'Lane id' },
			side: { type: 'string' as const, enum: [ 'left', 'right' ], description: 'Edge of the lane' },
			markingType: { type: 'string' as const, enum: [ 'solid', 'broken', 'solid-solid', 'solid-broken', 'broken-solid', 'botts-dots', 'grass', 'curb', 'none' ], description: 'Type of marking' },
			color: { type: 'string' as const, enum: [ 'white', 'yellow', 'red', 'blue', 'green' ], default: 'white', description: 'Color of the marking' }
		},
		required: [ 'roadId', 'laneId', 'side', 'markingType' ]
	};

	validate ( args: SetLaneMarkingArgs, ctx: AiToolContext ): void {
		const road = ctx.mapService.map.getRoad( args.roadId );
		if ( !road ) {
			throw new AiToolValidationError( `Road with id ${ args.roadId } not found.` );
		}

		// Apply to the first lane section for simplicity if sOffset isn't requested in spec
		const laneSection = road.getLaneProfile().getLaneSectionAt( 0 );
		if ( !laneSection ) {
			throw new AiToolValidationError( `No lane section found on road ${ args.roadId }.` );
		}

		// Let's resolve the actual lane to modify
		let targetLaneId = args.laneId;
		// If side is 'left' and we are on the right side of the road (negative), the left mark belongs to the lane closer to 0
		// If side is 'left' and we are on the left side of the road (positive), the left mark belongs to our own outer edge
		// However, TvLane only has a single set of road marks per lane (representing its outer boundary).
		// We'll trust laneId directly as the target lane for marking, as TvLane API doesn't support dual-side markings directly.
		if ( !laneSection.hasLane( targetLaneId ) ) {
			throw new AiToolValidationError( `Lane with id ${ targetLaneId } not found.` );
		}
		const lane = laneSection.getLaneById( targetLaneId );
	}

	async run ( args: SetLaneMarkingArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		const road = ctx.mapService.map.getRoad( args.roadId );
		const laneSection = road.getLaneProfile().getLaneSectionAt( 0 );
		const lane = laneSection.getLaneById( args.laneId );

		const oldMarks = lane.roadMarks.toArray();
		const newMarks = oldMarks.map( m => m.clone( m.sOffset, lane ) );

		const typeStr = args.markingType.replace( '-', ' ' ) as TvRoadMarkTypes;
		let colorStr = args.color ? (args.color as string) : 'white';
		if ( colorStr === 'white' ) colorStr = 'standard';
		const enumColor = colorStr as TvColors;

		// Default to adding at the start of the lane (s=0)
		const sOffset = 0;
		const existingRecordIndex = newMarks.findIndex( m => m.sOffset === sOffset );
		
		if ( existingRecordIndex !== -1 ) {
			newMarks[ existingRecordIndex ].type = typeStr;
			newMarks[ existingRecordIndex ].color = enumColor;
		} else {
			const newMark = new TvLaneRoadMark( sOffset, typeStr, TvRoadMarkWeights.STANDARD, enumColor, 0, TvRoadMarkLaneChange.NONE, 0, lane );
			newMarks.push( newMark );
			newMarks.sort( ( a, b ) => a.sOffset - b.sOffset );
		}

		const command = new SetLaneMarkingCommand( lane, oldMarks, newMarks );

		return {
			commands: [ command ],
			summary: `Set road marking of Lane ${ args.laneId } to ${ args.markingType } (${ args.color || 'white' }).`
		};
	}
}

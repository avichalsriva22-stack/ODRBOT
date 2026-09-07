/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { RemoveLaneCommand } from 'app/commands/remove-lane-command';
import { TvLaneType } from 'app/map/models/tv-common';

export interface RemoveLaneArgs {
	roadId: number;
	laneId: number;
	force?: boolean;
}

export class RemoveLaneTool implements AiTool<RemoveLaneArgs> {
	
	public readonly name = 'remove_lane';
	public readonly category: AiToolCategory = 'lane';
	public readonly description = 'Remove a lane from a road.';
	public readonly requiresPreview = true;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Target road id' },
			laneId: { type: 'integer' as const, description: 'Lane id' },
			force: { type: 'boolean' as const, default: false, description: 'Force remove the last driving lane' }
		},
		required: [ 'roadId', 'laneId' ]
	};

	validate ( args: RemoveLaneArgs, ctx: AiToolContext ): void {
		const road = ctx.mapService.map.getRoad( args.roadId );
		if ( !road ) {
			throw new AiToolValidationError( `Road with id ${ args.roadId } not found.` );
		}

		const laneSection = road.getLaneProfile().getLaneSectionAt( 0 );
		if ( !laneSection ) {
			throw new AiToolValidationError( `Road ${ args.roadId } has no default lane section.` );
		}

		if ( !laneSection.hasLane( args.laneId ) ) {
			throw new AiToolValidationError( `Lane with id ${ args.laneId } not found.` );
		}
		const lane = laneSection.getLaneById( args.laneId );

		if ( lane.type === TvLaneType.driving && !args.force ) {
			// Check if it's the last driving lane
			const drivingLanes = laneSection.getLanes().filter( l => l.type === TvLaneType.driving );
			if ( drivingLanes.length <= 1 ) {
				throw new AiToolValidationError( `Cannot remove the last driving lane on road ${ args.roadId }. Pass force=true to override.` );
			}
		}
	}

	async preview ( args: RemoveLaneArgs, ctx: AiToolContext ): Promise<import('../../models/ai-tool.model').AiToolPreviewResult> {
		const road = ctx.mapService.map.getRoad( args.roadId );
		const laneSection = road.getLaneProfile().getLaneSectionAt( 0 );
		const laneToRemove = laneSection.getLaneById( args.laneId );

		const diff: import('../../models/ai-tool.model').AiDiffEntry[] = [];
		diff.push({ field: `Lane ${laneToRemove.id}`, before: 'Exists', after: null });

		// Check for renumbered siblings (assuming standard OpenDRIVE renumbering inward)
		const lanes = laneSection.getLanes();
		lanes.forEach(l => {
			if (laneToRemove.id > 0 && l.id > laneToRemove.id) {
				diff.push({ field: `Lane ${l.id} ID`, before: l.id, after: l.id - 1 });
			} else if (laneToRemove.id < 0 && l.id < laneToRemove.id) {
				diff.push({ field: `Lane ${l.id} ID`, before: l.id, after: l.id + 1 });
			}
		});

		return {
			description: `Removing Lane ${args.laneId} from Road ${args.roadId}.`,
			diff
		};
	}

	async run ( args: RemoveLaneArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		const road = ctx.mapService.map.getRoad( args.roadId );
		const laneSection = road.getLaneProfile().getLaneSectionAt( 0 );
		const lane = laneSection.getLaneById( args.laneId );

		const command = new RemoveLaneCommand( laneSection, lane );

		return {
			commands: [ command ],
			summary: `Removed Lane ${ args.laneId } from Road ${ args.roadId }.`
		};
	}
}

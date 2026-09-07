/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { SetValueCommand } from 'app/commands/set-value-command';

export interface SetRoadSpeedArgs {
	roadId: number;
	maxSpeed: number;
}

export class SetRoadSpeedTool implements AiTool<SetRoadSpeedArgs> {
	
	public readonly name = 'set_road_speed';
	public readonly category: AiToolCategory = 'road';
	public readonly description = 'Set the speed limit for a road.';
	public readonly requiresPreview = false;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Target road id' },
			maxSpeed: { type: 'number' as const, minimum: 5, maximum: 200, description: 'Speed limit in km/h' }
		},
		required: [ 'roadId', 'maxSpeed' ]
	};

	validate ( args: SetRoadSpeedArgs, ctx: AiToolContext ): void {
		const road = ctx.mapService.map.getRoad( args.roadId );
		if ( !road ) {
			throw new AiToolValidationError( `Road with id ${ args.roadId } not found.` );
		}
		if ( !road.type || road.type.length === 0 ) {
			throw new AiToolValidationError( `Road ${ args.roadId } has no type definitions to attach speed to.` );
		}
	}

	async run ( args: SetRoadSpeedArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		const road = ctx.mapService.map.getRoad( args.roadId );
		const roadType = road.type[ 0 ];

		// Update maxSpeed on the road's first type configuration
		const command = new SetValueCommand( roadType.speed, 'max', args.maxSpeed, roadType.speed.max );

		return {
			commands: [ command ],
			summary: `Set speed limit of Road ${ args.roadId } to ${ args.maxSpeed } km/h.`
		};
	}
}

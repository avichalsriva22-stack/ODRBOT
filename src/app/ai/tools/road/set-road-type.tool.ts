/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { SetValueCommand } from 'app/commands/set-value-command';
import { TvRoadTypeClass } from 'app/map/models/tv-road-type.class';

export interface SetRoadTypeArgs {
	roadId: number;
	roadType: 'unknown' | 'rural' | 'motorway' | 'town' | 'lowSpeed' | 'pedestrian' | 'bicycle';
}

export class SetRoadTypeTool implements AiTool<SetRoadTypeArgs> {
	
	public readonly name = 'set_road_type';
	public readonly category: AiToolCategory = 'road';
	public readonly description = 'Set the road type classification (affects default speed/rendering).';
	public readonly requiresPreview = false;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Target road id' },
			roadType: { type: 'string' as const, enum: [ 'unknown', 'rural', 'motorway', 'town', 'lowSpeed', 'pedestrian', 'bicycle' ], description: 'Road type classification' }
		},
		required: [ 'roadId', 'roadType' ]
	};

	validate ( args: SetRoadTypeArgs, ctx: AiToolContext ): void {
		const road = ctx.mapService.map.getRoad( args.roadId );
		if ( !road ) {
			throw new AiToolValidationError( `Road with id ${ args.roadId } not found.` );
		}
		if ( !road.type || road.type.length === 0 ) {
			throw new AiToolValidationError( `Road ${ args.roadId } has no type definitions.` );
		}
	}

	async run ( args: SetRoadTypeArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		const road = ctx.mapService.map.getRoad( args.roadId );
		const roadTypeConfig = road.type[ 0 ];

		const enumType = TvRoadTypeClass.stringToTypes( args.roadType );

		// Update type on the road's first type configuration
		const command = new SetValueCommand( roadTypeConfig, 'type', enumType, roadTypeConfig.type );

		return {
			commands: [ command ],
			summary: `Set road type of Road ${ args.roadId } to ${ args.roadType }.`
		};
	}
}

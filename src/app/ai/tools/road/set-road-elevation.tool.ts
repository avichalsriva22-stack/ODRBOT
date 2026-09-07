/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { SetRoadElevationCommand } from 'app/commands/set-road-elevation-command';

export interface SetRoadElevationArgs {
	roadId: number;
	sOffset: number;
	elevation: number;
	slope?: number;
}

export class SetRoadElevationTool implements AiTool<SetRoadElevationArgs> {
	
	public readonly name = 'set_road_elevation';
	public readonly category: AiToolCategory = 'road';
	public readonly description = 'Add or update an elevation record on a road at a given position.';
	public readonly requiresPreview = false;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Target road id' },
			sOffset: { type: 'number' as const, minimum: 0, description: 'Position along the road in meters' },
			elevation: { type: 'number' as const, description: 'Elevation in meters' },
			slope: { type: 'number' as const, default: 0, description: 'Slope (optional)' }
		},
		required: [ 'roadId', 'sOffset', 'elevation' ]
	};

	validate ( args: SetRoadElevationArgs, ctx: AiToolContext ): void {
		const road = ctx.mapService.map.getRoad( args.roadId );
		if ( !road ) {
			throw new AiToolValidationError( `Road with id ${ args.roadId } not found.` );
		}
		if ( args.sOffset > road.getLength() ) {
			throw new AiToolValidationError( `sOffset ${ args.sOffset } exceeds road length ${ road.getLength() }.` );
		}
	}

	async run ( args: SetRoadElevationArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		const road = ctx.mapService.map.getRoad( args.roadId );
		const oldProfile = road.getElevationProfile();
		
		// Create a modified new profile
		const newProfile = oldProfile.clone();
		
		const sOffset = args.sOffset;
		const elevation = args.elevation;
		const slope = args.slope ?? 0;

		const existingElevations = newProfile.getElevations();
		const index = existingElevations.findIndex( e => Math.abs( e.s - sOffset ) < 0.01 );

		if ( index !== -1 ) {
			existingElevations[ index ].a = elevation;
			existingElevations[ index ].b = slope;
		} else {
			newProfile.createAndAddElevation( sOffset, elevation, slope, 0, 0 );
		}

		newProfile.computeCoefficients( road.getLength() );

		const command = new SetRoadElevationCommand( road, oldProfile, newProfile );

		return {
			commands: [ command ],
			summary: `Set elevation of Road ${ args.roadId } at ${ sOffset }m to ${ elevation }m.`
		};
	}
}

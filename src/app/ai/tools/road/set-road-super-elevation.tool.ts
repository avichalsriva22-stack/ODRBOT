/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { SetRoadSuperElevationCommand } from 'app/commands/set-road-super-elevation-command';
import { TvSuperElevation } from 'app/map/models/tv-lateral.profile';

export interface SetRoadSuperElevationArgs {
	roadId: number;
	sOffset: number;
	angleDegrees: number;
}

export class SetRoadSuperElevationTool implements AiTool<SetRoadSuperElevationArgs> {
	
	public readonly name = 'set_road_super_elevation';
	public readonly category: AiToolCategory = 'road';
	public readonly description = 'Set the roll/tilt (superelevation / banking) of a road at a given position.';
	public readonly requiresPreview = false;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Target road id' },
			sOffset: { type: 'number' as const, minimum: 0, description: 'Position along the road in meters' },
			angleDegrees: { type: 'number' as const, minimum: -30, maximum: 30, description: 'Roll/tilt angle in degrees' }
		},
		required: [ 'roadId', 'sOffset', 'angleDegrees' ]
	};

	validate ( args: SetRoadSuperElevationArgs, ctx: AiToolContext ): void {
		const road = ctx.mapService.map.getRoad( args.roadId );
		if ( !road ) {
			throw new AiToolValidationError( `Road with id ${ args.roadId } not found.` );
		}
		if ( args.sOffset > road.getLength() ) {
			throw new AiToolValidationError( `sOffset ${ args.sOffset } exceeds road length ${ road.getLength() }.` );
		}
	}

	async run ( args: SetRoadSuperElevationArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		const road = ctx.mapService.map.getRoad( args.roadId );
		const profile = road.getLateralProfile();
		
		const oldElevations = profile.getSuperElevations();
		const newElevations = oldElevations.map( e => e.clone() );
		
		const sOffset = args.sOffset;
		// Convert degrees to a (which represents the tilt value, typically a slope or angle in radians for OpenDRIVE, wait, openDRIVE uses slope. E.g. tan(angle) or just radians?
		// Usually angle is in radians in ODR, let's convert degrees to radians:
		const radians = args.angleDegrees * Math.PI / 180;

		const existingIndex = newElevations.findIndex( e => Math.abs( e.s - sOffset ) < 0.01 );

		if ( existingIndex !== -1 ) {
			newElevations[ existingIndex ].a = radians;
		} else {
			const elevation = new TvSuperElevation(sOffset, radians, 0, 0, 0);
			newElevations.push( elevation );
			newElevations.sort( ( a, b ) => a.s - b.s );
		}

		const command = new SetRoadSuperElevationCommand( road, oldElevations, newElevations );

		return {
			commands: [ command ],
			summary: `Set super elevation of Road ${ args.roadId } at ${ sOffset }m to ${ args.angleDegrees } degrees.`
		};
	}
}

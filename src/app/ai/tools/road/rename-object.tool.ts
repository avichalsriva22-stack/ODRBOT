/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolCategory, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { SetValueCommand } from 'app/commands/set-value-command';

export interface RenameObjectArgs {
	objectType: 'road' | 'junction';
	objectId: number;
	name: string;
}

export class RenameObjectTool implements AiTool<RenameObjectArgs> {
	
	public readonly name = 'rename_object';
	public readonly category: AiToolCategory = 'road';
	public readonly description = 'Rename a road or junction.';
	public readonly requiresPreview = false;
	public readonly parameters = {
		type: 'object' as const,
		properties: {
			objectType: { type: 'string' as const, enum: [ 'road', 'junction' ], description: 'Type of object to rename' },
			objectId: { type: 'integer' as const, description: 'Object ID' },
			name: { type: 'string' as const, minLength: 1, maxLength: 64, description: 'New name for the object' }
		},
		required: [ 'objectType', 'objectId', 'name' ]
	};

	validate ( args: RenameObjectArgs, ctx: AiToolContext ): void {
		if ( args.objectType === 'road' ) {
			const road = ctx.mapService.map.getRoad( args.objectId );
			if ( !road ) {
				throw new AiToolValidationError( `Road with id ${ args.objectId } not found.` );
			}
		} else if ( args.objectType === 'junction' ) {
			const junction = ctx.mapService.map.getJunction( args.objectId );
			if ( !junction ) {
				throw new AiToolValidationError( `Junction with id ${ args.objectId } not found.` );
			}
		} else {
			throw new AiToolValidationError( `Unknown object type: ${ args.objectType }` );
		}
	}

	async run ( args: RenameObjectArgs, ctx: AiToolContext ): Promise<AiToolRunResult> {
		
		let obj;
		if ( args.objectType === 'road' ) {
			obj = ctx.mapService.map.getRoad( args.objectId );
		} else {
			obj = ctx.mapService.map.getJunction( args.objectId );
		}

		// Update name property
		const command = new SetValueCommand( obj, 'name', args.name, obj.name );

		return {
			commands: [ command ],
			summary: `Renamed ${ args.objectType } ${ args.objectId } to "${ args.name }".`
		};
	}
}

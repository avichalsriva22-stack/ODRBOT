/*
 * Copyright Truesense AI Solutions Pvt Ltd, All Rights Reserved.
 */

import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { TvContactPoint } from 'app/map/models/tv-common';
import { LinkRoadsCommand } from 'app/commands/link-roads-command';

export class LinkRoadsTool implements AiTool {
	name = 'link_roads';
	description = 'Link two roads together at their start or end points (sets predecessor/successor relationship without creating a junction).';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'road';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId1: { type: 'integer' as const, description: 'ID of the first road' },
			contactPoint1: { type: 'string' as const, enum: ['start', 'end'], description: 'Contact point of the first road' },
			roadId2: { type: 'integer' as const, description: 'ID of the second road to link to' },
			contactPoint2: { type: 'string' as const, enum: ['start', 'end'], description: 'Contact point of the second road' }
		},
		required: ['roadId1', 'contactPoint1', 'roadId2', 'contactPoint2']
	};

	validate(args: any, ctx: AiToolContext): void {
		const road1 = ctx.mapService.map.getRoad(args.roadId1);
		if (!road1) throw new AiToolValidationError(`Road ID ${args.roadId1} not found.`);

		const road2 = ctx.mapService.map.getRoad(args.roadId2);
		if (!road2) throw new AiToolValidationError(`Road ID ${args.roadId2} not found.`);

		if (road1.id === road2.id) {
			throw new AiToolValidationError('Cannot link a road to itself.');
		}

		// Calculate endpoints to ensure they are close enough
		const p1 = args.contactPoint1 === 'start' ? road1.getStartPosTheta().position : road1.getEndPosTheta().position;
		const p2 = args.contactPoint2 === 'start' ? road2.getStartPosTheta().position : road2.getEndPosTheta().position;

		if (p1.distanceTo(p2) > 5) {
			throw new AiToolValidationError(`The specified contact points are too far apart (${p1.distanceTo(p2).toFixed(2)}m). Roads must be within 5m to be linked directly.`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const road1 = ctx.mapService.map.getRoad(args.roadId1)!;
		const road2 = ctx.mapService.map.getRoad(args.roadId2)!;
		
		const cp1 = args.contactPoint1 === 'start' ? TvContactPoint.START : TvContactPoint.END;
		const cp2 = args.contactPoint2 === 'start' ? TvContactPoint.START : TvContactPoint.END;

		const command = new LinkRoadsCommand(road1, cp1, road2, cp2);

		return {
			summary: `Linked road ${args.roadId1} (${args.contactPoint1}) to road ${args.roadId2} (${args.contactPoint2}).`,
			commands: [command]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		return {
			description: `Linking road ${args.roadId1} (${args.contactPoint1}) to road ${args.roadId2} (${args.contactPoint2}).`,
			diff: [
				{
					field: 'Link',
					before: 'None',
					after: `Road ${args.roadId1} <-> Road ${args.roadId2}`
				}
			]
		};
	}
}

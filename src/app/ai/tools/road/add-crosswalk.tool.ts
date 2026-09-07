import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadObjectFactory } from 'app/services/road-object/road-object.factory';
import { TvRoadObjectType } from 'app/map/models/objects/tv-road-object';
import { AddObjectCommand } from 'app/commands/add-object-command';

export class AddCrosswalkTool implements AiTool {
	name = 'add_crosswalk';
	description = 'Add a crosswalk to a specific road at a specific longitudinal position (s).';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'road';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'ID of the road (optional if a road is currently selected)' },
			s: { type: 'number' as const, description: 'Longitudinal distance along the road to place the crosswalk' }
		},
		required: ['s']
	};

	validate(args: any, ctx: AiToolContext): void {
		const roadId = args.roadId ?? ctx.selection.selectedRoadId;
		if (!roadId) {
			throw new AiToolValidationError('No road ID provided and no road is selected.');
		}

		const road = ctx.mapService.map.getRoad(roadId);
		if (!road) {
			throw new AiToolValidationError(`Road with ID ${roadId} not found.`);
		}

		if (road.isJunction) {
			throw new AiToolValidationError('Cannot create crosswalk on a junction road.');
		}

		if (args.s < 0 || args.s > road.length) {
			throw new AiToolValidationError(`Position 's' (${args.s}) must be between 0 and the road's length (${road.length}).`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const roadId = args.roadId ?? ctx.selection.selectedRoadId;
		const road = ctx.mapService.map.getRoad(roadId)!;
		const roadCoord = road.getRoadCoord(args.s);
		
		const crosswalk = RoadObjectFactory.createRoadObject(TvRoadObjectType.crosswalk, roadCoord);
		const command = new AddObjectCommand(crosswalk);

		return {
			summary: `Added crosswalk on road ${road.id} at s = ${args.s}.`,
			commands: [command],
			createdIds: [{ type: 'object', id: crosswalk.id }]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		const roadId = args.roadId ?? ctx.selection.selectedRoadId;
		return {
			description: `Adding a crosswalk to road ${roadId} at s = ${args.s}.`,
			diff: [
				{
					field: 'New Crosswalk',
					before: 'None',
					after: `At s = ${args.s}`
				}
			]
		};
	}
}

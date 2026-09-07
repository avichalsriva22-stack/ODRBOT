import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { SetValueCommand } from 'app/commands/set-value-command';
import { MultiCmdsCommand } from 'app/commands/multi-cmds-command';
import { TvRoadObjectType } from 'app/map/models/objects/tv-road-object';

export class EditCrosswalkTool implements AiTool {
	name = 'edit_crosswalk';
	description = 'Edits the width or length of a crosswalk on a given road.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'road';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'ID of the road containing the crosswalk' },
			crosswalkId: { type: 'string' as const, description: 'ID of the crosswalk (optional if road only has one)' },
			width: { type: 'number' as const, description: 'New width of the crosswalk' },
			length: { type: 'number' as const, description: 'New length of the crosswalk' }
		},
		required: ['roadId']
	};

	validate(args: any, ctx: AiToolContext): void {
		const roadId = args.roadId || ctx.selection.selectedRoadId;
		if (!roadId) {
			throw new AiToolValidationError('Please specify a roadId or select a road.');
		}
		const road = ctx.mapService.map.getRoad(roadId);
		if (!road) {
			throw new AiToolValidationError(`Road ID ${roadId} not found.`);
		}
		
		const crosswalks = road.getRoadObjects().filter(o => o.attr_type === TvRoadObjectType.crosswalk);
		if (crosswalks.length === 0) {
			throw new AiToolValidationError(`No crosswalks found on road ${roadId}.`);
		}
		if (crosswalks.length > 1 && !args.crosswalkId) {
			throw new AiToolValidationError(`Multiple crosswalks found on road ${roadId}. Please specify crosswalkId.`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		
		const roadId = args.roadId || ctx.selection.selectedRoadId;
		const road = ctx.mapService.map.getRoad(roadId)!;
		
		let crosswalk = null;
		if (args.crosswalkId) {
			crosswalk = road.getRoadObjects().find(o => o.uuid === args.crosswalkId);
		} else {
			crosswalk = road.getRoadObjects().find(o => o.attr_type === TvRoadObjectType.crosswalk);
		}
		
		if (!crosswalk) {
			throw new AiToolValidationError(`Crosswalk not found.`);
		}

		const commands = [];
		if (args.width !== undefined) {
			commands.push(new SetValueCommand(crosswalk, 'width', args.width));
		}
		if (args.length !== undefined) {
			commands.push(new SetValueCommand(crosswalk, 'length', args.length));
		}

		if (commands.length === 0) {
			throw new AiToolValidationError('No properties to update provided (width or length).');
		}

		return {
			summary: `Updated crosswalk ${crosswalk.uuid} on road ${roadId}.`,
			commands: [new MultiCmdsCommand(commands)]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		const roadId = args.roadId || ctx.selection.selectedRoadId;
		const road = ctx.mapService.map.getRoad(roadId)!;
		let crosswalk = args.crosswalkId 
			? road.getRoadObjects().find(o => o.uuid === args.crosswalkId)
			: road.getRoadObjects().find(o => o.attr_type === TvRoadObjectType.crosswalk);

		const diffs: AiDiffEntry[] = [];
		if (args.width !== undefined) {
			diffs.push({ field: 'Width', before: crosswalk!.width, after: args.width });
		}
		if (args.length !== undefined) {
			diffs.push({ field: 'Length', before: crosswalk!.length, after: args.length });
		}

		return {
			description: `Editing crosswalk on road ${roadId}.`,
			diff: diffs
		};
	}
}

import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { SetLaneWidthCommand } from 'app/commands/set-lane-width-command';
import { MultiCmdsCommand } from 'app/commands/multi-cmds-command';

export class SetRoadWidthTool implements AiTool {
	name = 'set_road_width';
	description = 'Sets the total width of a road, mathematically distributing it evenly across all driving/sidewalk lanes.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'road';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'ID of the road to edit' },
			totalWidth: { type: 'number' as const, description: 'Total desired width in meters (e.g. 12.5)' }
		},
		required: ['roadId', 'totalWidth']
	};

	validate(args: any, ctx: AiToolContext): void {
		const road = ctx.mapService.map.getRoad(args.roadId);
		if (!road) {
			throw new AiToolValidationError(`Road ID ${args.roadId} not found.`);
		}
		if (args.totalWidth <= 0) {
			throw new AiToolValidationError('Width must be greater than 0');
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		
		const road = ctx.mapService.map.getRoad(args.roadId)!;
		const laneSection = road.getLaneProfile().getLaneSectionAt(0); // For simplicity, take first section
		const lanes = laneSection.getNonCenterLanes();
		
		if (lanes.length === 0) {
			throw new AiToolValidationError('Road has no lanes to widen.');
		}

		const widthPerLane = args.totalWidth / lanes.length;
		const commands = [];

		for (const lane of lanes) {
			let record = lane.getWidthArray()[0];
			if (record) {
				const oldWidths = lane.getWidthArray();
				const newWidths = oldWidths.map(w => {
					const nw = w.clone();
					nw.a = widthPerLane;
					return nw;
				});
				commands.push(new SetLaneWidthCommand(lane, oldWidths, newWidths));
			}
		}

		return {
			summary: `Set road ${args.roadId} width to ${args.totalWidth}m (${widthPerLane.toFixed(2)}m per lane)`,
			commands: [new MultiCmdsCommand(commands)]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		const road = ctx.mapService.map.getRoad(args.roadId)!;
		const lanes = road.getLaneProfile().getLaneSectionAt(0).getNonCenterLanes();
		const oldTotal = lanes.reduce((sum, lane) => sum + (lane.getWidthArray()[0]?.a || 0), 0);

		return {
			description: `Setting total width of road ${args.roadId} to ${args.totalWidth}m.`,
			diff: [
				{
					field: `Total Width`,
					before: `${oldTotal.toFixed(2)}m`,
					after: `${args.totalWidth}m`
				}
			]
		};
	}
}

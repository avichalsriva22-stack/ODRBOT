import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { SetPointPositionCommand } from 'app/commands/set-point-position-command';
import { Vector3 } from 'app/core/maths';

export class MoveSplinePointTool implements AiTool {
	name = 'move_spline_point';
	description = 'Moves a specific control point (0 for start, 1 for next point, etc.) of a road to change its shape or angle.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'road';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'ID of the road to edit' },
			pointIndex: { type: 'integer' as const, description: 'Index of the control point to move (0 for start point, last index for end point)' },
			deltaX: { type: 'number' as const, description: 'Delta X' },
			deltaY: { type: 'number' as const, description: 'Delta Y' }
		},
		required: ['roadId', 'pointIndex', 'deltaX', 'deltaY']
	};

	validate(args: any, ctx: AiToolContext): void {
		const road = ctx.mapService.map.getRoad(args.roadId);
		if (!road) {
			throw new AiToolValidationError(`Road ID ${args.roadId} not found.`);
		}
		const spline = road.spline;
		const points = spline.getControlPoints();
		if (args.pointIndex < 0 || args.pointIndex >= points.length) {
			throw new AiToolValidationError(`Point index ${args.pointIndex} out of bounds for road ${args.roadId} (has ${points.length} points).`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		
		const road = ctx.mapService.map.getRoad(args.roadId)!;
		const spline = road.spline;
		const point = spline.getControlPoints()[args.pointIndex];
		
		const oldPos = point.getPosition().clone();
		const newPos = oldPos.clone().add(new Vector3(args.deltaX, args.deltaY, 0));
		
		const command = new SetPointPositionCommand(spline, point, newPos, oldPos);

		return {
			summary: `Moved point ${args.pointIndex} of road ${args.roadId} by (${args.deltaX}, ${args.deltaY})`,
			commands: [command]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		
		return {
			description: `Moving control point ${args.pointIndex} of road ${args.roadId}.`,
			diff: [
				{
					field: `Point ${args.pointIndex} Position`,
					before: `Current`,
					after: `+(${args.deltaX}, ${args.deltaY})`
				}
			]
		};
	}
}

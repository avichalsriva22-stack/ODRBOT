import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { DragSplineCommand } from 'app/commands/drag-spline-command';
import { UpdatePositionCommand } from 'app/commands/update-position-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvJunction } from 'app/map/models/junctions/tv-junction';
import { Vector3 } from 'app/core/maths';
import { ICommand } from 'app/commands/command';

export class MoveObjectTool implements AiTool {
	name = 'move_object';
	description = 'Move an object (road, junction, or prop) by a relative delta X and Y.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'project';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			objectId: { type: 'string' as const, description: 'ID of the object to move' },
			deltaX: { type: 'number' as const, description: 'Delta X to move' },
			deltaY: { type: 'number' as const, description: 'Delta Y to move' }
		},
		required: ['deltaX', 'deltaY']
	};

	validate(args: any, ctx: AiToolContext): void {
		const target = this.resolveTargetObject(args, ctx);
		if (!target) {
			throw new AiToolValidationError('Could not find object to move. Please specify objectId or ensure an object is selected.');
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		
		const target = this.resolveTargetObject(args, ctx)!;
		const deltaX = args.deltaX ?? 0;
		const deltaY = args.deltaY ?? 0;
		const deltaVec = new Vector3(deltaX, deltaY, 0);

		let command: ICommand;

		if (target instanceof TvRoad) {
			const spline = target.spline;
			const oldPositions = spline.getControlPoints().map(p => p.getPosition().clone());
			const newPositions = oldPositions.map(p => p.clone().add(deltaVec));
			command = new DragSplineCommand(spline, newPositions, oldPositions);
		} else {
			const oldPos = (target as any).getPosition().clone();
			const newPos = oldPos.clone().add(deltaVec);
			command = new UpdatePositionCommand(target, newPos, oldPos);
		}

		const id = (target as any).id || (target as any).uuid;

		return {
			summary: `Moved object ${id} by (${deltaX}, ${deltaY})`,
			commands: [command]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		const target = this.resolveTargetObject(args, ctx)!;
		const id = (target as any).id || (target as any).uuid;

		return {
			description: `Moving object ${id} by (${args.deltaX}, ${args.deltaY}).`,
			diff: [
				{
					field: 'Position',
					before: `Current`,
					after: `+(${args.deltaX}, ${args.deltaY})`
				}
			]
		};
	}

	private resolveTargetObject(args: any, ctx: AiToolContext): any {
		let target: any = null;

		if (args.objectId) {
			if (!isNaN(Number(args.objectId))) {
				target = ctx.mapService.map.getRoad(Number(args.objectId));
			}
			if (!target) {
				try { target = ctx.mapService.map.getJunction(Number(args.objectId)); } catch {}
			}
			if (!target) {
				target = ctx.mapService.map.getRoads().flatMap(r => r.getRoadSignals()).find(s => s.uuid === args.objectId)
						|| ctx.mapService.map.getRoads().flatMap(r => r.getRoadObjects()).find(o => o.uuid === args.objectId);
			}
		}

		if (!target) {
			if (ctx.selection.selectedRoadId && !ctx.selection.selectedJunctionId && !ctx.selection.selectedLaneId) {
				target = ctx.mapService.map.getRoad(ctx.selection.selectedRoadId);
			} else if (ctx.selection.selectedJunctionId) {
				try { target = ctx.mapService.map.getJunction(ctx.selection.selectedJunctionId); } catch {}
			}
		}

		return target;
	}
}

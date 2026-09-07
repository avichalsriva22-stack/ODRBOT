import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { RemoveObjectCommand } from 'app/commands/remove-object-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { TvJunction } from 'app/map/models/junctions/tv-junction';

export class DeleteObjectTool implements AiTool {
	name = 'delete_object';
	description = 'Deletes a specified road, junction, or prop by ID. If no ID is provided, tries to delete the currently selected object.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'project';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			objectId: { type: 'string' as const, description: 'ID of the object to delete (e.g. 100 for road, J_1 for junction)' },
			objectType: { type: 'string' as const, enum: ['road', 'junction', 'prop'], description: 'Type of object to delete' }
		},
		required: []
	};

	validate(args: any, ctx: AiToolContext): void {
		const target = this.resolveTargetObject(args, ctx);
		if (!target) {
			throw new AiToolValidationError('Could not find object to delete. Please specify objectId and objectType, or ensure an object is selected.');
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		
		const target = this.resolveTargetObject(args, ctx)!;
		const command = new RemoveObjectCommand(target, true); // true to fire unselect event

		const id = (target as any).id || (target as any).uuid;

		return {
			summary: `Deleted object with ID: ${id}`,
			commands: [command]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		const target = this.resolveTargetObject(args, ctx)!;
		const id = (target as any).id || (target as any).uuid;

		return {
			description: `Deleting object with ID: ${id}.`,
			diff: [
				{
					field: 'Object',
					before: `Exists (${id})`,
					after: 'Deleted'
				}
			]
		};
	}

	private resolveTargetObject(args: any, ctx: AiToolContext): any {
		let target: any = null;

		if (args.objectId) {
			if (args.objectType === 'road') {
				target = ctx.mapService.map.getRoad(Number(args.objectId));
			} else if (args.objectType === 'junction') {
				try { target = ctx.mapService.map.getJunction(Number(args.objectId)); } catch {}
			} else if (args.objectType === 'prop') {
				// We don't have a direct getProp by ID in MapService easily accessible here without knowing type
				// Fallback to selection if prop is not found by direct lookup
				target = ctx.mapService.map.getRoads().flatMap(r => r.getRoadSignals()).find(s => s.uuid === args.objectId)
						|| ctx.mapService.map.getRoads().flatMap(r => r.getRoadObjects()).find(o => o.uuid === args.objectId);
			}
			
			// Try fuzzy lookup if exact type lookup failed
			if (!target && !isNaN(Number(args.objectId))) {
				target = ctx.mapService.map.getRoad(Number(args.objectId));
			}
			if (!target) {
				try { target = ctx.mapService.map.getJunction(Number(args.objectId)); } catch {}
			}
		}

		if (!target) {
			// Fallback to selected object
			if (ctx.selection.selectedRoadId && !ctx.selection.selectedJunctionId && !ctx.selection.selectedLaneId) {
				target = ctx.mapService.map.getRoad(ctx.selection.selectedRoadId);
			} else if (ctx.selection.selectedJunctionId) {
				try { target = ctx.mapService.map.getJunction(ctx.selection.selectedJunctionId); } catch {}
			}
		}

		return target;
	}
}

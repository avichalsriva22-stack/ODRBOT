import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { JunctionToolHelper } from 'app/modules/junction/junction-tool.helper';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { Vector3 } from 'app/core/maths';
import { TvContactPoint } from 'app/map/models/tv-common';
import { LinkFactory } from 'app/map/models/link-factory';
import { TvLinkType } from 'app/map/models/tv-link';

export class CreateJunctionTool implements AiTool {
	name = 'create_junction';
	description = 'Create a custom junction connecting a specified set of existing roads at a given position. Use for irregular intersections; use create_roundabout for circular ones.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'junction';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadIds: { 
				type: 'array' as const, 
				items: { type: 'integer' as const, description: 'Road ID' }, 
				description: 'IDs of roads to connect',
				minimum: 2,
				maximum: 8
			},
			centerX: { type: 'number' as const, description: 'X coordinate' },
			centerY: { type: 'number' as const, description: 'Y coordinate' }
		},
		required: ['roadIds', 'centerX', 'centerY']
	};

	constructor(private junctionToolHelper: JunctionToolHelper) {}

	validate(args: any, ctx: AiToolContext): void {
		const { roadIds, centerX, centerY } = args;
		if (!roadIds || roadIds.length < 2) {
			throw new AiToolValidationError('At least 2 road IDs are required to create a junction.');
		}
		
		const center = new Vector3(centerX, centerY, 0);
		
		for (const id of roadIds) {
			const road = ctx.mapService.map.getRoad(id);
			if (!road) {
				throw new AiToolValidationError(`Road ID ${id} not found.`);
			}
			
			const startDist = road.getStartPosTheta().position.distanceTo(center);
			const endDist = road.getEndPosTheta().position.distanceTo(center);
			
			if (Math.min(startDist, endDist) > 25) {
				throw new AiToolValidationError(`Road ID ${id} is too far from the junction center (${centerX}, ${centerY}). Please re-check coordinates.`);
			}
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const center = new Vector3(args.centerX, args.centerY, 0);
		const links = [];

		for (const id of args.roadIds) {
			const road = ctx.mapService.map.getRoad(id)!;
			const startDist = road.getStartPosTheta().position.distanceTo(center);
			const endDist = road.getEndPosTheta().position.distanceTo(center);
			
			const contact = startDist < endDist ? TvContactPoint.START : TvContactPoint.END;
			const link = LinkFactory.createLink(TvLinkType.ROAD, road, contact);
			links.push(link);
		}

		const junction = this.junctionToolHelper.createCustomJunction(links);
		const createdIds: { type: 'junction' | 'road', id: number }[] = [{ type: 'junction', id: junction.id }];
		const allObjects: any[] = [junction];
		
		// If connecting roads are generated, add them to createdIds
		const connectingRoads = junction.getConnectingRoads();
		if (connectingRoads && connectingRoads.length > 0) {
			for (const connectingRoad of connectingRoads) {
				allObjects.push(connectingRoad);
				createdIds.push({ type: 'road' as const, id: connectingRoad.id });
			}
		}

		return {
			summary: `Created custom junction connecting ${args.roadIds.length} roads at (${args.centerX}, ${args.centerY}).`,
			commands: [new AddObjectCommand(allObjects)],
			createdIds
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		return {
			description: `Creating a custom junction connecting roads [${args.roadIds.join(', ')}] at (${args.centerX}, ${args.centerY}).`,
			diff: [
				{
					field: 'New Junction',
					before: 'None',
					after: `Connecting roads: ${args.roadIds.join(', ')}`
				}
			]
		};
	}
}

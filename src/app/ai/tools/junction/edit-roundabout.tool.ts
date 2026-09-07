import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadCircleFactory } from 'app/factories/road-circle.factory';
import { RoadFactory } from 'app/factories/road-factory.service';
import { SplineGeometryGenerator } from 'app/services/spline/spline-geometry-generator';
import { ConnectionFactory } from 'app/factories/connection.factory';
import { RemoveObjectCommand } from 'app/commands/remove-object-command';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { MultiCmdsCommand } from 'app/commands/multi-cmds-command';
import { Vector3 } from 'app/core/maths';
import { TvContactPoint } from 'app/map/models/tv-common';

export class EditRoundaboutTool implements AiTool {
	name = 'edit_roundabout';
	description = 'Edits an existing roundabout by mathematically regenerating it in place with new parameters (e.g. changing radius or arm count).';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'junction';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			junctionId: { type: 'integer' as const, description: 'Numeric ID of the roundabout junction to edit (e.g. 0, 1, 2)' },
			radius: { type: 'number' as const, minimum: 8, maximum: 60, description: 'New radius of roundabout' },
			armCount: { type: 'integer' as const, minimum: 3, maximum: 8, description: 'New number of arms' }
		},
		required: ['junctionId']
	};

	constructor(
		private roadCircleFactory: RoadCircleFactory,
		private roadFactory: RoadFactory,
		private splineBuilder: SplineGeometryGenerator,
		private connectionFactory: ConnectionFactory
	) {}

	validate(args: any, ctx: AiToolContext): void {
		const junctionId = args.junctionId ?? ctx.selection.selectedJunctionId;
		if (junctionId === undefined || junctionId === null) {
			throw new AiToolValidationError('Please specify a junctionId or select the roundabout junction first.');
		}
		const numId = Number(junctionId);
		if (isNaN(numId)) {
			throw new AiToolValidationError(`Invalid junction ID "${junctionId}". Junction IDs are numeric integers (e.g. 0, 1, 2).`);
		}
		let junction;
		try {
			junction = ctx.mapService.map.getJunction(numId);
		} catch {
			throw new AiToolValidationError(`Junction ID ${numId} not found on the map.`);
		}
		// Basic check that it's a roundabout
		if (!junction.name.toLowerCase().includes('roundabout')) {
			throw new AiToolValidationError('Selected junction does not appear to be a roundabout.');
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		
		const junctionId = Number(args.junctionId ?? ctx.selection.selectedJunctionId);
		const junction = ctx.mapService.map.getJunction(junctionId)!;
		
		// Gather old objects to delete
		const roadsToRemove = [...junction.getConnectingRoads(), ...junction.getIncomingRoads()];
		const commands = [];
		const createdIds = [];

		// Delete old roads and junction
		commands.push(new RemoveObjectCommand(roadsToRemove, false));
		commands.push(new RemoveObjectCommand(junction, true));

		// Estimate old parameters if not provided
		const oldRadius = roadsToRemove[0]?.spline.getLength() / (Math.PI / 2) || 20; // very rough estimate
		const oldArmCount = junction.getIncomingRoads().length;

		// Re-generate
		const result = this.roadCircleFactory.makeRoundabout({
			center: junction.centroid.clone(),
			radius: args.radius ?? oldRadius,
			armCount: args.armCount ?? oldArmCount,
			armLength: 40,
			laneCount: 1,
			roadFactory: this.roadFactory,
			splineBuilder: this.splineBuilder
		});

		// Add new objects
		commands.push(new AddObjectCommand(junction));
		createdIds.push({ type: 'junction' as const, id: junction.id });

		for (const road of result.circleRoads) {
			road.junction = junction;
			commands.push(new AddObjectCommand(road));
			createdIds.push({ type: 'road' as const, id: road.id });
		}
		
		for (const arm of result.armRoads) {
			arm.linkJunction(junction, TvContactPoint.END);
			commands.push(new AddObjectCommand(arm));
			createdIds.push({ type: 'road' as const, id: arm.id });
		}

		// Temporarily add to map so ConnectionFactory can find incoming roads
		ctx.mapService.map.addJunction(junction);
		result.circleRoads.forEach(r => ctx.mapService.map.addRoad(r));
		result.armRoads.forEach(r => ctx.mapService.map.addRoad(r));

		// Re-apply smoothing
		this.connectionFactory.addCornerConnections(junction);

		// Remove from map (AddObjectCommand will handle the actual insertion for undo/redo)
		ctx.mapService.map.removeJunction(junction);
		result.circleRoads.forEach(r => ctx.mapService.map.removeRoad(r));
		result.armRoads.forEach(r => ctx.mapService.map.removeRoad(r));

		for (const road of junction.getConnectingRoads()) {
			commands.push(new AddObjectCommand(road));
			createdIds.push({ type: 'road' as const, id: road.id });
		}

		return {
			summary: `Edited roundabout ${junctionId} to radius ${args.radius || 'unchanged'} and ${args.armCount || 'unchanged'} arms.`,
			commands: [new MultiCmdsCommand(commands)],
			createdIds
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		const junctionId = Number(args.junctionId ?? ctx.selection.selectedJunctionId);
		
		return {
			description: `Regenerating roundabout ${junctionId} with new parameters.`,
			diff: [
				{
					field: 'Roundabout Parameters',
					before: 'Current',
					after: `Radius: ${args.radius || 'keep'}, Arms: ${args.armCount || 'keep'}`
				}
			]
		};
	}
}

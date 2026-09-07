import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadCircleFactory } from 'app/factories/road-circle.factory';
import { RoadFactory } from 'app/factories/road-factory.service';
import { SplineGeometryGenerator } from 'app/services/spline/spline-geometry-generator';
import { JunctionFactory } from 'app/factories/junction.factory';
import { TvJunctionType } from 'app/map/models/junctions/tv-junction-type';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { Vector3 } from 'app/core/maths';
import { ConnectionFactory } from 'app/factories/connection.factory';
import { TvContactPoint } from 'app/map/models/tv-common';

export class CreateRoundaboutTool implements AiTool {
	name = 'create_roundabout';
	description = 'Create a roundabout (circular junction) at a given center position with a given radius and number of arms/entries.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'junction';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			centerX: { type: 'number' as const, description: 'X coordinate' },
			centerY: { type: 'number' as const, description: 'Y coordinate' },
			radius: { type: 'number' as const, minimum: 8, maximum: 60, description: 'Radius of roundabout' },
			armCount: { type: 'integer' as const, minimum: 3, maximum: 8, description: 'Number of arms' },
			armLength: { type: 'number' as const, minimum: 10, maximum: 500, description: 'Length of arms' },
			laneCount: { type: 'integer' as const, minimum: 1, maximum: 3, description: 'Number of lanes in roundabout' }
		},
		required: ['centerX', 'centerY', 'radius', 'armCount']
	};

	constructor(
		private roadCircleFactory: RoadCircleFactory,
		private roadFactory: RoadFactory,
		private splineBuilder: SplineGeometryGenerator,
		private connectionFactory: ConnectionFactory
	) {}

	validate(args: any): void {
		if (args.centerX === undefined || typeof args.centerX !== 'number') throw new AiToolValidationError('centerX is required and must be a number.');
		if (args.centerY === undefined || typeof args.centerY !== 'number') throw new AiToolValidationError('centerY is required and must be a number.');
		if (args.radius === undefined || typeof args.radius !== 'number') throw new AiToolValidationError('radius is required and must be a number.');
		if (args.armCount === undefined || typeof args.armCount !== 'number') throw new AiToolValidationError('armCount is required and must be a number.');

		const { radius, armCount } = args;
		const circumference = 2 * Math.PI * radius;
		const armSpacing = circumference / armCount;
		// rough heuristic: if arms are too close, they overlap
		if (armSpacing < 6) {
			throw new AiToolValidationError('Arms would intersect at the given radius/count. Please increase radius or decrease armCount.');
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args);

		const result = this.roadCircleFactory.makeRoundabout({
			center: new Vector3(args.centerX, args.centerY, 0),
			radius: args.radius,
			armCount: args.armCount,
			armLength: args.armLength ?? 40,
			laneCount: args.laneCount ?? 1,
			roadFactory: this.roadFactory,
			splineBuilder: this.splineBuilder
		});

		const junction = JunctionFactory.createByType(TvJunctionType.AUTO, 'Roundabout', 0);
		junction.centroid = new Vector3(args.centerX, args.centerY, 0);

		const createdIds = [];
		createdIds.push({ type: 'junction' as const, id: junction.id });

		for (const road of result.circleRoads) {
			road.junction = junction;
			createdIds.push({ type: 'road' as const, id: road.id });
		}
		
		for (const arm of result.armRoads) {
			arm.linkJunction(junction, TvContactPoint.END);
			createdIds.push({ type: 'road' as const, id: arm.id });
		}

		// Temporarily add to map so ConnectionFactory can find incoming roads
		ctx.mapService.map.addJunction(junction);
		result.circleRoads.forEach(r => ctx.mapService.map.addRoad(r));
		result.armRoads.forEach(r => ctx.mapService.map.addRoad(r));

		// Generate smoothed corners automatically
		this.connectionFactory.addCornerConnections(junction);

		// Collect connecting roads created by addCornerConnections
		const connectingRoads = junction.getConnectingRoads();
		for (const road of connectingRoads) {
			createdIds.push({ type: 'road' as const, id: road.id });
		}

		// Remove everything from map — the single AddObjectCommand will re-add atomically
		result.armRoads.forEach(r => ctx.mapService.map.removeRoad(r));
		result.circleRoads.forEach(r => ctx.mapService.map.removeRoad(r));
		connectingRoads.forEach(r => ctx.mapService.map.removeRoad(r));
		ctx.mapService.map.removeJunction(junction);

		// Build a single array: junction first, then all roads
		// AddObjectCommand supports arrays — this ensures atomic insertion
		const allObjects = [junction, ...result.circleRoads, ...result.armRoads, ...connectingRoads];

		return {
			summary: `Created roundabout at (${args.centerX}, ${args.centerY}) with radius ${args.radius} and ${args.armCount} arms.`,
			commands: [new AddObjectCommand(allObjects)],
			createdIds
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args);
		return {
			description: `Creating a roundabout at (${args.centerX}, ${args.centerY}) with radius ${args.radius}.`,
			diff: [
				{
					field: 'New Roundabout',
					before: 'None',
					after: `Radius ${args.radius}, Arms: ${args.armCount}`
				}
			]
		};
	}
}

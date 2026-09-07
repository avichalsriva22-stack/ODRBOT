import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { ConnectionFactory } from 'app/factories/connection.factory';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { TvRoad } from 'app/map/models/tv-road.model';

export class SmoothenJunctionTool implements AiTool {
	name = 'smoothen_junction';
	description = 'Generates smooth corner connections (fillets/slip lanes) for a selected junction or roundabout.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'junction';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			junctionId: { type: 'integer' as const, description: 'Numeric ID of the junction to smoothen (e.g. 0, 1, 2)' }
		},
		required: ['junctionId']
	};

	constructor(private connectionFactory: ConnectionFactory) {}

	validate(args: any, ctx: AiToolContext): void {
		const junctionId = args.junctionId ?? ctx.selection.selectedJunctionId;
		if (junctionId === undefined || junctionId === null) {
			throw new AiToolValidationError('Please specify a junctionId or select a junction first.');
		}
		const numId = Number(junctionId);
		if (isNaN(numId)) {
			throw new AiToolValidationError(`Invalid junction ID "${junctionId}". Junction IDs are numeric integers (e.g. 0, 1, 2).`);
		}
		try {
			ctx.mapService.map.getJunction(numId);
		} catch {
			throw new AiToolValidationError(`Junction ID ${numId} not found on the map.`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		
		const junctionId = Number(args.junctionId ?? ctx.selection.selectedJunctionId);
		const junction = ctx.mapService.map.getJunction(junctionId)!;
		
		// Capture existing connecting roads before adding new ones
		const existingConnectingRoads = new Set(junction.getConnectingRoads().map(r => r.id));

		// This will mutate the junction and map by adding fake corners internally,
		// but we should technically wrap it in an AddObjectCommand so it can be undone.
		// For this complex factory, we let it generate the roads, then extract the new ones.
		this.connectionFactory.addCornerConnections(junction);

		const allConnectingRoads = junction.getConnectingRoads();
		const newRoads = allConnectingRoads.filter(r => !existingConnectingRoads.has(r.id));

		const commands = newRoads.map(r => new AddObjectCommand(r));
		const createdIds = newRoads.map(r => ({ type: 'road' as const, id: r.id }));

		return {
			summary: `Smoothened junction ${junctionId} by generating ${newRoads.length} corner connections.`,
			commands,
			createdIds
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		const junctionId = args.junctionId || ctx.selection.selectedJunctionId;
		
		return {
			description: `Generating smooth corners (fillets) for junction ${junctionId}.`,
			diff: [
				{
					field: `Junction Corners`,
					before: `Straight connections`,
					after: `Smoothed arcs (fillets)`
				}
			]
		};
	}
}

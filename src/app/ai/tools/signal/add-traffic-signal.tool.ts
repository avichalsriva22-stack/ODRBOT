import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadSignalFactory } from 'app/map/road-signal/road-signal.factory';
import { AddRoadSignalCommand } from 'app/commands/add-road-signal-command';
import { TvOrientation } from 'app/map/models/tv-common';

export class AddTrafficSignalTool implements AiTool {
	name = 'add_traffic_signal';
	description = 'Add a traffic signal (traffic light) to a road at a given position, controlling a given direction.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'signal';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Road ID' },
			sOffset: { type: 'number' as const, minimum: 0, description: 'Longitudinal position' },
			side: { type: 'string' as const, enum: ['left', 'right'], description: 'Side of the road' },
			signalType: { type: 'string' as const, enum: ['trafficLight', 'stopSign', 'yieldSign'], description: 'Type of signal' }
		},
		required: ['roadId', 'sOffset', 'side']
	};

	constructor(private roadSignalFactory: RoadSignalFactory) {}

	validate(args: any, ctx: AiToolContext): void {
		const road = ctx.mapService.map.getRoad(args.roadId);
		if (!road) {
			throw new AiToolValidationError(`Road ID ${args.roadId} not found.`);
		}
		if (args.sOffset < 0 || args.sOffset > road.length) {
			throw new AiToolValidationError(`sOffset ${args.sOffset} is out of bounds [0, ${road.length}].`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const road = ctx.mapService.map.getRoad(args.roadId)!;
		
		// Typically right side means negative t in OpenDRIVE, left means positive t
		const t = args.side === 'right' ? -2.0 : 2.0; 
		const roadCoord = road.getRoadCoord(args.sOffset, t);

		const type = args.signalType || 'trafficLight';
		let signal;
		
		if (type === 'trafficLight') {
			signal = this.roadSignalFactory.createTrafficLight(roadCoord, 'TrafficLight', '1000001', '1');
		} else {
			signal = this.roadSignalFactory.createPoledSign(roadCoord, type, '206', '-1');
		}

		signal.orientation = args.side === 'right' ? TvOrientation.MINUS : TvOrientation.PLUS;

		const command = new AddRoadSignalCommand(road, signal);

		return {
			summary: `Added ${type} on road ${args.roadId} at s=${args.sOffset} on the ${args.side} side.`,
			commands: [command],
			createdIds: [{ type: 'object', id: signal.id }]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		this.validate(args, ctx);
		const type = args.signalType || 'trafficLight';
		return {
			description: `Adding a ${type} to road ${args.roadId} at s=${args.sOffset}.`,
			diff: [
				{
					field: 'New Signal',
					before: 'None',
					after: `${type} on ${args.side} side`
				}
			]
		};
	}
}

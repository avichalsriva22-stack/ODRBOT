import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { RoadSignalFactory } from 'app/map/road-signal/road-signal.factory';

export class AddTextMarkingTool implements AiTool {
	name = 'add_text_marking';
	description = 'Add painted text on the road surface, e.g. STOP, BUS LANE, SCHOOL.';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'marking';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Road ID' },
			sOffset: { type: 'number' as const, description: 'Longitudinal position' },
			lateralOffset: { type: 'number' as const, description: 'Lateral offset (t-coordinate)' },
			text: { type: 'string' as const, description: 'Text to paint' },
			height: { type: 'number' as const, minimum: 0.5, maximum: 5, description: 'Text height' }
		},
		required: ['roadId', 'sOffset', 'text']
	};

	constructor(private roadSignalFactory: RoadSignalFactory) {}

	validate(args: any, ctx: AiToolContext): void {
		const road = ctx.mapService.map.getRoad(args.roadId);
		if (!road) {
			throw new AiToolValidationError(`Road ID ${args.roadId} not found.`);
		}
		if (args.text.length < 1 || args.text.length > 20) {
			throw new AiToolValidationError(`Text must be between 1 and 20 characters.`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const road = ctx.mapService.map.getRoad(args.roadId)!;
		
		const s = args.sOffset;
		const t = args.lateralOffset ?? 0;
		const coord = road.getRoadCoord(s, t);

		const text = args.text.toUpperCase();
		
		const signal = this.roadSignalFactory.createTextRoadMarking(coord, text);
		signal.height = args.height ?? 2.0;

		const command = new AddObjectCommand(signal);

		return {
			summary: `Added text marking '${text}' on road ${args.roadId} at (s=${s}, t=${t}).`,
			commands: [command],
			createdIds: [{ type: 'object', id: signal.id }] 
		};
	}
}

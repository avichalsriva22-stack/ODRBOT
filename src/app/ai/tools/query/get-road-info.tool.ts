import { AiTool, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { AiContextService } from 'app/ai/services/ai-context.service';

export class GetRoadInfoTool implements AiTool {
	name = 'get_road_info';
	description = 'Get full details of a specific road: length, lane configuration, speed, type, connections.';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'query';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Road ID' }
		},
		required: ['roadId']
	};

	constructor(private aiContextService: AiContextService) {}

	validate(args: any, ctx: AiToolContext): void {
		const road = ctx.mapService.map.getRoad(args.roadId);
		if (!road) {
			throw new AiToolValidationError(`Road ID ${args.roadId} not found.`);
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);
		const road = ctx.mapService.map.getRoad(args.roadId)!;
		
		// Use a clever cast to access the private mapRoadSummary method
		const summary = (this.aiContextService as any).mapRoadSummary(road);

		return {
			summary: `Retrieved info for road ${args.roadId}`,
			commands: [],
			data: summary
		};
	}
}

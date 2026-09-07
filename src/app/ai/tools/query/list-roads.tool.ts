import { AiTool, AiToolContext, AiToolRunResult } from '../../models/ai-tool.model';
import { AiContextService } from 'app/ai/services/ai-context.service';

export class ListRoadsTool implements AiTool {
	name = 'list_roads';
	description = 'List all roads in the map with their basic info.';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'query';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {},
		required: []
	};

	constructor(private aiContextService: AiContextService) {}

	validate(args: any, ctx: AiToolContext): void {}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		const roads = ctx.mapService.map.getRoads();
		const data = roads.map(r => (this.aiContextService as any).mapRoadSummary(r));

		return {
			summary: `Retrieved ${roads.length} roads.`,
			commands: [],
			data
		};
	}
}

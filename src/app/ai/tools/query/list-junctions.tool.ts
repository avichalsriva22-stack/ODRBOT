import { AiTool, AiToolContext, AiToolRunResult } from '../../models/ai-tool.model';
import { AiContextService } from 'app/ai/services/ai-context.service';

export class ListJunctionsTool implements AiTool {
	name = 'list_junctions';
	description = 'List all junctions in the map with their basic info.';
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
		const junctions = ctx.mapService.map.getJunctions();
		const data = junctions.map(j => (this.aiContextService as any).mapJunctionSummary(j));

		return {
			summary: `Retrieved ${junctions.length} junctions.`,
			commands: [],
			data
		};
	}
}

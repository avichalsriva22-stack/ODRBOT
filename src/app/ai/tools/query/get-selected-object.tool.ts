import { AiTool, AiToolContext, AiToolRunResult, AiToolValidationError } from '../../models/ai-tool.model';
import { AiContextService } from 'app/ai/services/ai-context.service';

export class GetSelectedObjectTool implements AiTool {
	name = 'get_selected_object';
	description = 'Get details of whatever is currently selected in the editor (road, lane, junction, or nothing).';
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
		const context = this.aiContextService.buildContext();
		const selection = context.selection;

		return {
			summary: `Retrieved selected object: ${selection.type}`,
			commands: [],
			data: selection
		};
	}
}

import { AiTool, AiToolContext, AiToolRunResult } from '../../models/ai-tool.model';
import { CommandHistory } from 'app/commands/command-history';

export class UndoLastActionTool implements AiTool {
	name = 'undo_last_action';
	description = 'Undo the most recent change (equivalent to Ctrl+Z). Use only when the user explicitly asks to undo.';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'project';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {},
		required: []
	};

	constructor() {}

	validate(args: any, ctx: AiToolContext): void {}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		if (CommandHistory.getUndosCount() === 0) {
			return {
				summary: 'Nothing to undo.',
				commands: []
			};
		}

		CommandHistory.undo();

		return {
			summary: 'Undid the last action.',
			commands: [] // No commands to return, handled directly
		};
	}
}

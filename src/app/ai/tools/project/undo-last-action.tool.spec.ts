import { UndoLastActionTool } from './undo-last-action.tool';
import { AiToolContext } from '../../models/ai-tool.model';
import { CommandHistory } from 'app/commands/command-history';

describe('UndoLastActionTool', () => {
	let tool: UndoLastActionTool;
	let context: AiToolContext;

	beforeEach(() => {
		tool = new UndoLastActionTool();
		context = {} as any;
	});

	it('should return nothing to undo if count is 0', async () => {
		spyOn(CommandHistory, 'getUndosCount').and.returnValue(0);
		spyOn(CommandHistory, 'undo');

		const result = await tool.run({}, context);

		expect(result.summary).toContain('Nothing to undo');
		expect(CommandHistory.undo).not.toHaveBeenCalled();
	});

	it('should trigger undo if count > 0', async () => {
		spyOn(CommandHistory, 'getUndosCount').and.returnValue(1);
		spyOn(CommandHistory, 'undo');

		const result = await tool.run({}, context);

		expect(result.summary).toContain('Undid the last action');
		expect(CommandHistory.undo).toHaveBeenCalled();
	});
});

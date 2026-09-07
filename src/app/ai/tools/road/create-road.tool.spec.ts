import { CreateRoadTool } from './create-road.tool';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { AiToolContext } from '../../models/ai-tool.model';

describe('CreateRoadTool', () => {
	let tool: CreateRoadTool;
	let context: AiToolContext;

	beforeEach(() => {
		tool = new CreateRoadTool();
		context = {} as AiToolContext; // Minimal mock
	});

	it('should return AddObjectCommand containing a TvRoad in run', async () => {
		const result = await tool.run({
			length: 200,
			leftLaneCount: 1,
			rightLaneCount: 1,
			positionX: 10,
			positionY: 20
		}, context);

		expect(result.summary).toContain('Created new road');
		expect(result.commands?.length).toBe(1);
		
		const command = result.commands![0] as AddObjectCommand;
		expect(command instanceof AddObjectCommand).toBe(true);
		
		const road = (command as any).object as TvRoad;
		expect(road instanceof TvRoad).toBe(true);
		expect(road.length).toBe(200);
	});

	it('should return a preview with diffs', async () => {
		const result = await tool.preview({ length: 50 }, context);
		expect(result.diff.length).toBe(1);
		expect(result.diff[0].field).toBe('New Road');
	});
});

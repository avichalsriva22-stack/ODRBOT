import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry } from '../../models/ai-tool.model';
import { RoadFactory, RoadMakeOptions } from 'app/factories/road-factory.service';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { TvRoad } from 'app/map/models/tv-road.model';
import { ICommand } from 'app/commands/command';
import { Vector3 } from 'app/core/maths';

export class CreateRoadTool implements AiTool {
	name = 'create_road';
	description = 'Create a new standalone road snippet.';
	requiresPreview = true;
	category: import('../../models/ai-tool.model').AiToolCategory = 'road';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			length: { type: 'number' as const, description: 'Length of road' },
			leftLaneCount: { type: 'integer' as const, description: 'Number of left lanes' },
			rightLaneCount: { type: 'integer' as const, description: 'Number of right lanes' },
			leftLaneWidth: { type: 'number' as const, description: 'Width of left lanes' },
			rightLaneWidth: { type: 'number' as const, description: 'Width of right lanes' },
			positionX: { type: 'number' as const, description: 'X coordinate' },
			positionY: { type: 'number' as const, description: 'Y coordinate' },
			heading: { type: 'number' as const, description: 'Heading angle in degrees' }
		},
		required: ['length']
	};

	validate(args: any, ctx: AiToolContext): void {}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		const result = this.generateRoad(args);
		
		return {
			summary: `Created new road (ID: ${result.road.id}) with length ${args.length || 100}m.`,
			commands: [result.command],
			createdIds: [{ type: 'road', id: result.road.id }]
		};
	}

	async preview(args: any, ctx: AiToolContext): Promise<{ diff: AiDiffEntry[], description: string }> {
		return {
			description: `Creating a new road with length ${args.length || 100}m.`,
			diff: [
				{
					field: 'New Road',
					before: 'None',
					after: `At (${args.positionX ?? 0}, ${args.positionY ?? 0})`
				}
			]
		};
	}

	private generateRoad(args: any): { road: TvRoad, command: ICommand } {
		const options = new RoadMakeOptions();
		options.length = args.length ?? 100;
		options.leftLaneCount = args.leftLaneCount ?? 1;
		options.rightLaneCount = args.rightLaneCount ?? 1;
		options.leftWidth = args.leftLaneWidth ?? 3.6;
		options.rightWidth = args.rightLaneWidth ?? 3.6;
		
		const posX = args.positionX ?? 0;
		const posY = args.positionY ?? 0;
		options.position = new Vector3(posX, posY, 0);
		options.hdg = (args.heading ?? 0) * Math.PI / 180;

		const road = RoadFactory.makeRoad(options);
		const command = new AddObjectCommand(road);
		
		return { road, command };
	}
}

import { AddCrosswalkTool } from './add-crosswalk.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { TvRoadObjectType } from 'app/map/models/objects/tv-road-object';

describe('AddCrosswalkTool', () => {
	let tool: AddCrosswalkTool;
	let context: AiToolContext;

	beforeEach(() => {
		tool = new AddCrosswalkTool();
		
		const mockRoad = {
			id: 1,
			isJunction: false,
			length: 100,
			getRoadCoord: (s: number) => ({ road: mockRoad as any, s, t: 0 })
		};

		context = {
			selection: { selectedRoadId: 1 },
			mapService: {
				map: {
					getRoad: (id: number) => id === 1 ? mockRoad : undefined
				}
			}
		} as any;
	});

	it('should throw validation error if no road is selected', () => {
		context.selection.selectedRoadId = undefined;
		expect(() => tool.validate({ s: 50 }, context)).toThrowError(AiToolValidationError);
	});

	it('should throw validation error if s is out of bounds', () => {
		expect(() => tool.validate({ s: 150 }, context)).toThrowError(AiToolValidationError);
	});

	it('should create crosswalk command', async () => {
		const result = await tool.run({ s: 50 }, context);
		expect(result.commands?.length).toBe(1);
		expect(result.createdIds?.length).toBe(1);
	});
});

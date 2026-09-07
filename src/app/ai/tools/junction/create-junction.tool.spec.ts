import { CreateJunctionTool } from './create-junction.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { JunctionToolHelper } from 'app/modules/junction/junction-tool.helper';
import { Vector3 } from 'app/core/maths';

describe('CreateJunctionTool', () => {
	let tool: CreateJunctionTool;
	let context: AiToolContext;
	let junctionToolHelper: jasmine.SpyObj<JunctionToolHelper>;

	beforeEach(() => {
		junctionToolHelper = jasmine.createSpyObj('JunctionToolHelper', ['createCustomJunction']);
		tool = new CreateJunctionTool(junctionToolHelper);
		
		const mockJunction = {
			id: 42,
			getConnectingRoads: () => []
		} as any;
		
		const mockRoad = (id: number) => ({
			id,
			getStartPosTheta: () => ({ position: new Vector3(0, 0, 0) }),
			getEndPosTheta: () => ({ position: new Vector3(10, 0, 0) })
		});

		context = {
			mapService: {
				map: {
					getRoad: (id: number) => id === 1 || id === 2 ? mockRoad(id) : undefined
				}
			}
		} as any;
	});

	it('should throw validation error if road is too far', () => {
		expect(() => tool.validate({ roadIds: [1, 2], centerX: 100, centerY: 100 }, context)).toThrowError(AiToolValidationError);
	});

	it('should throw validation error if road not found', () => {
		expect(() => tool.validate({ roadIds: [3, 4], centerX: 0, centerY: 0 }, context)).toThrowError(AiToolValidationError);
	});

	it('should create junction and return command', async () => {
		junctionToolHelper.createCustomJunction.and.returnValue({ id: 99, getConnectingRoads: () => [] } as any);

		const result = await tool.run({ roadIds: [1, 2], centerX: 0, centerY: 0 }, context);

		expect(result.commands?.length).toBe(1);
		expect(junctionToolHelper.createCustomJunction).toHaveBeenCalled();
	});
});

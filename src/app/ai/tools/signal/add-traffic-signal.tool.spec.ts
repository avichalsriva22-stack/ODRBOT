import { AddTrafficSignalTool } from './add-traffic-signal.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadSignalFactory } from 'app/map/road-signal/road-signal.factory';
import { TvRoadSignal } from 'app/map/road-signal/tv-road-signal.model';
import { TvRoad } from 'app/map/models/tv-road.model';

describe('AddTrafficSignalTool', () => {
	let tool: AddTrafficSignalTool;
	let context: AiToolContext;
	let signalFactory: jasmine.SpyObj<RoadSignalFactory>;
	let mockRoad: TvRoad;

	beforeEach(() => {
		signalFactory = jasmine.createSpyObj('RoadSignalFactory', ['createTrafficLight', 'createPoledSign']);
		tool = new AddTrafficSignalTool(signalFactory);
		
		mockRoad = new TvRoad();
		Object.defineProperty(mockRoad, 'id', { value: 1, writable: true });
		Object.defineProperty(mockRoad, 'length', { value: 100, writable: true });
		spyOn(mockRoad, 'getRoadCoord').and.returnValue({ road: mockRoad, s: 50, t: -2.0 } as any);

		context = {
			mapService: {
				map: {
					getRoad: (id: number) => id === 1 ? mockRoad : undefined
				}
			}
		} as any;
	});

	it('should throw validation error if road not found', () => {
		expect(() => tool.validate({ roadId: 99, sOffset: 10 }, context)).toThrowError(AiToolValidationError);
	});

	it('should throw validation error if sOffset out of bounds', () => {
		expect(() => tool.validate({ roadId: 1, sOffset: 150 }, context)).toThrowError(AiToolValidationError);
	});

	it('should return command to add traffic light', async () => {
		signalFactory.createTrafficLight.and.returnValue({ id: 10 } as TvRoadSignal);

		const result = await tool.run({ roadId: 1, sOffset: 50, side: 'right' }, context);

		expect(result.commands?.length).toBe(1);
		expect(signalFactory.createTrafficLight).toHaveBeenCalled();
	});
});

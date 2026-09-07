import { AddTextMarkingTool } from './add-text-marking.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadSignalFactory } from 'app/map/road-signal/road-signal.factory';
import { TvRoadSignal } from 'app/map/road-signal/tv-road-signal.model';
import { TvRoad } from 'app/map/models/tv-road.model';

describe('AddTextMarkingTool', () => {
	let tool: AddTextMarkingTool;
	let context: AiToolContext;
	let signalFactory: jasmine.SpyObj<RoadSignalFactory>;
	let mockRoad: TvRoad;

	beforeEach(() => {
		signalFactory = jasmine.createSpyObj('RoadSignalFactory', ['createTextRoadMarking']);
		tool = new AddTextMarkingTool(signalFactory);
		
		mockRoad = new TvRoad();
		Object.defineProperty(mockRoad, 'id', { value: 1, writable: true });
		spyOn(mockRoad, 'getRoadCoord').and.returnValue({ road: mockRoad, s: 10, t: 2 } as any);

		context = {
			mapService: {
				map: {
					getRoad: (id: number) => id === 1 ? mockRoad : undefined
				}
			}
		} as any;
	});

	it('should throw validation error if road not found', () => {
		expect(() => tool.validate({ roadId: 99, sOffset: 10, text: 'STOP' }, context)).toThrowError(AiToolValidationError);
	});

	it('should create command to add text marking', async () => {
		const signal = new TvRoadSignal(1, 10, 2, 'stop');
		signalFactory.createTextRoadMarking.and.returnValue(signal);

		const result = await tool.run({ roadId: 1, sOffset: 10, lateralOffset: 2, text: 'stop', height: 3 }, context);

		expect(result.commands?.length).toBe(1);
		expect(signalFactory.createTextRoadMarking).toHaveBeenCalled();
		expect(signal.height).toBe(3);
	});
});

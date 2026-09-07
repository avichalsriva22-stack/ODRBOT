import { AddRoadSignTool } from './add-road-sign.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadSignalFactory } from 'app/map/road-signal/road-signal.factory';
import { TvRoadSignal } from 'app/map/road-signal/tv-road-signal.model';
import { TvRoad } from 'app/map/models/tv-road.model';

describe('AddRoadSignTool', () => {
	let tool: AddRoadSignTool;
	let context: AiToolContext;
	let signalFactory: jasmine.SpyObj<RoadSignalFactory>;
	let mockRoad: TvRoad;

	beforeEach(() => {
		signalFactory = jasmine.createSpyObj('RoadSignalFactory', ['createSignalFromAsset']);
		tool = new AddRoadSignTool(signalFactory);
		
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

	it('should throw validation error if sign not in catalog', () => {
		expect(() => tool.validate({ roadId: 1, sOffset: 10, side: 'right', signType: 'invalid_sign' }, context)).toThrowError(AiToolValidationError);
	});

	it('should return command to add road sign', async () => {
		signalFactory.createSignalFromAsset.and.returnValue({ id: 10 } as TvRoadSignal);

		const result = await tool.run({ roadId: 1, sOffset: 50, side: 'right', signType: 'stop' }, context);

		expect(result.commands?.length).toBe(1);
		expect(signalFactory.createSignalFromAsset).toHaveBeenCalled();
	});
});

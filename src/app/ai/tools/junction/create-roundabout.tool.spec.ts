import { CreateRoundaboutTool } from './create-roundabout.tool';
import { RoadCircleFactory } from 'app/factories/road-circle.factory';
import { RoadFactory } from 'app/factories/road-factory.service';
import { SplineGeometryGenerator } from 'app/services/spline/spline-geometry-generator';
import { AiToolValidationError } from '../../models/ai-tool.model';

describe('CreateRoundaboutTool', () => {
	let tool: CreateRoundaboutTool;
	let roadCircleFactory: jasmine.SpyObj<RoadCircleFactory>;
	let roadFactory: jasmine.SpyObj<RoadFactory>;
	let splineBuilder: jasmine.SpyObj<SplineGeometryGenerator>;
	let connectionFactory: jasmine.SpyObj<any>;

	beforeEach(() => {
		roadCircleFactory = jasmine.createSpyObj('RoadCircleFactory', ['makeRoundabout']);
		roadFactory = jasmine.createSpyObj('RoadFactory', ['createDefaultRoad']);
		splineBuilder = jasmine.createSpyObj('SplineGeometryGenerator', ['buildGeometry']);
		connectionFactory = jasmine.createSpyObj('ConnectionFactory', ['addCornerConnections']);

		tool = new CreateRoundaboutTool(roadCircleFactory, roadFactory, splineBuilder, connectionFactory);
	});

	it('should throw validation error if arms would overlap', () => {
		expect(() => tool.validate({ radius: 10, armCount: 15 })).toThrowError(AiToolValidationError);
	});

	it('should create roundabout and return commands', async () => {
		roadCircleFactory.makeRoundabout.and.returnValue({
			circleRoads: [{ id: 1, junction: null } as any],
			armRoads: []
		});

		const result = await tool.run({
			centerX: 0,
			centerY: 0,
			radius: 20,
			armCount: 4
		}, {
			mapService: {
				map: {
					addJunction: jasmine.createSpy('addJunction'),
					removeJunction: jasmine.createSpy('removeJunction'),
					addRoad: jasmine.createSpy('addRoad'),
					removeRoad: jasmine.createSpy('removeRoad')
				}
			}
		} as any);

		expect(result.commands?.length).toBe(2); // 1 junction + 1 road
		expect(result.createdIds?.length).toBe(2);
	});
});

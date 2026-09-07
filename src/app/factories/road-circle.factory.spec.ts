import { TestBed } from '@angular/core/testing';
import { RoadCircleFactory, RoundaboutMakeOptions } from './road-circle.factory';
import { Vector3 } from 'three';
import { RoadFactory } from './road-factory.service';
import { SplineGeometryGenerator } from 'app/services/spline/spline-geometry-generator';

describe('RoadCircleFactory', () => {
	let factory: RoadCircleFactory;
	let roadFactorySpy: jasmine.SpyObj<RoadFactory>;
	let splineBuilderSpy: jasmine.SpyObj<SplineGeometryGenerator>;

	beforeEach(() => {
		roadFactorySpy = jasmine.createSpyObj('RoadFactory', ['createDefaultRoad']);
		splineBuilderSpy = jasmine.createSpyObj('SplineGeometryGenerator', ['buildGeometry']);
		
		TestBed.configureTestingModule({
			providers: [
				RoadCircleFactory,
				{ provide: RoadFactory, useValue: roadFactorySpy },
				{ provide: SplineGeometryGenerator, useValue: splineBuilderSpy }
			]
		});
		factory = TestBed.inject(RoadCircleFactory);
	});

	it('should create circular roads for a roundabout', () => {
		// Mock createDefaultRoad to return a minimal TvRoad mock
		const mockRoad = {
			getPlanView: () => ({
				addGeometryArc: jasmine.createSpy('addGeometryArc').and.returnValue({
					getRoadCoord: () => ({ moveForward: () => ({ toVector3: () => new Vector3() }) }),
					endV3: new Vector3()
				})
			}),
			spline: {
				addControlPoint: jasmine.createSpy('addControlPoint')
			},
			linkSuccessorRoad: jasmine.createSpy('linkSuccessorRoad')
		};
		roadFactorySpy.createDefaultRoad.and.returnValue(mockRoad as any);

		const options: RoundaboutMakeOptions = {
			center: new Vector3(0, 0, 0),
			radius: 10,
			roadFactory: roadFactorySpy,
			splineBuilder: splineBuilderSpy
		};

		const result = factory.makeRoundabout(options);

		expect(result.circleRoads.length).toBe(4);
		expect(roadFactorySpy.createDefaultRoad).toHaveBeenCalledTimes(4);
		expect(splineBuilderSpy.buildGeometry).toHaveBeenCalledTimes(4);
		
		// All 4 roads should be linked
		expect(mockRoad.linkSuccessorRoad).toHaveBeenCalledTimes(4);
	});
});

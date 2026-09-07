import { TestBed } from '@angular/core/testing';
import { AiToolRegistry } from './ai-tool-registry.service';
import { AiContextService } from '../services/ai-context.service';
import { ExporterService } from 'app/services/exporter.service';
import { PropPointFactory } from 'app/map/prop-point/prop-point.factory';
import { PropCurveFactory } from 'app/modules/prop-curve/services/prop-curve.factory';
import { PropPolygonFactory } from 'app/map/prop-polygon/prop-polygon.factory';
import { RoadSignalFactory } from 'app/map/road-signal/road-signal.factory';
import { SurfaceFactory } from 'app/map/surface/surface.factory';
import { JunctionToolHelper } from 'app/modules/junction/junction-tool.helper';
import { RoadCircleFactory } from 'app/factories/road-circle.factory';
import { RoadFactory } from 'app/factories/road-factory.service';
import { SplineGeometryGenerator } from 'app/services/spline/spline-geometry-generator';

describe('AiToolRegistry', () => {
	let service: AiToolRegistry;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				AiToolRegistry,
				{ provide: AiContextService, useValue: jasmine.createSpyObj('AiContextService', ['buildContext']) },
				{ provide: ExporterService, useValue: jasmine.createSpyObj('ExporterService', ['export']) },
				{ provide: PropPointFactory, useValue: jasmine.createSpyObj('PropPointFactory', ['create']) },
				{ provide: PropCurveFactory, useValue: jasmine.createSpyObj('PropCurveFactory', ['create']) },
				{ provide: PropPolygonFactory, useValue: jasmine.createSpyObj('PropPolygonFactory', ['create']) },
				{ provide: RoadSignalFactory, useValue: jasmine.createSpyObj('RoadSignalFactory', ['create']) },
				{ provide: SurfaceFactory, useValue: jasmine.createSpyObj('SurfaceFactory', ['create']) },
				{ provide: JunctionToolHelper, useValue: jasmine.createSpyObj('JunctionToolHelper', ['create']) },
				{ provide: RoadCircleFactory, useValue: jasmine.createSpyObj('RoadCircleFactory', ['makeRoundabout']) },
				{ provide: RoadFactory, useValue: jasmine.createSpyObj('RoadFactory', ['create']) },
				{ provide: SplineGeometryGenerator, useValue: jasmine.createSpyObj('SplineGeometryGenerator', ['create']) }
			]
		});
		service = TestBed.inject(AiToolRegistry);
	});

	it('should be created', () => {
		expect(service).toBeTruthy();
	});

	it('should register exactly 30 tools', () => {
		const tools = service.getAll();
		expect(tools.length).toBe(30);
	});

	it('should throw error on duplicate registration', () => {
		const duplicateTool: any = { name: 'undo_last_action' };
		expect(() => service.register(duplicateTool)).toThrowError('Duplicate AI tool name registered: undo_last_action');
	});

	it('should get Anthropic tool schemas', () => {
		const schemas = service.getAnthropicToolSchemas();
		expect(schemas.length).toBe(30);
		expect(schemas[0].name).toBeDefined();
		expect(schemas[0].description).toBeDefined();
		expect(schemas[0].input_schema).toBeDefined();
	});

	it('should filter enabled tools when advanced enabled', () => {
		const schemas = service.getEnabledToolSchemas(true);
		expect(schemas.length).toBe(30);
	});

	it('should filter enabled tools when advanced disabled', () => {
		const schemas = service.getEnabledToolSchemas(false);
		expect(schemas.length).toBe(16);
	});
});

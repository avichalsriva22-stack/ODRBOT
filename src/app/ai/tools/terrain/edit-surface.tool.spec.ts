import { EditSurfaceTool } from './edit-surface.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { SurfaceFactory } from 'app/map/surface/surface.factory';
import { Surface } from 'app/map/surface/surface.model';
import { CatmullRomSpline } from 'app/core/shapes/catmull-rom-spline';
import { Maths } from 'app/utils/maths';

describe('EditSurfaceTool', () => {
	let tool: EditSurfaceTool;
	let context: AiToolContext;
	let surfaceFactory: jasmine.SpyObj<SurfaceFactory>;
	let mockSurface: Surface;

	beforeEach(() => {
		surfaceFactory = jasmine.createSpyObj('SurfaceFactory', ['createSurface']);
		tool = new EditSurfaceTool(surfaceFactory);
		
		mockSurface = new Surface('grass', new CatmullRomSpline(true, 'catmullrom', 0));
		Object.defineProperty(mockSurface, 'uuid', { value: 'surface-1' });

		context = {
			mapService: {
				map: {
					getSurfaces: () => [mockSurface]
				}
			}
		} as any;
		
		spyOn(Maths, 'isSimplePolygon').and.returnValue(true);
	});

	it('should throw validation error if new surface misses points', () => {
		expect(() => tool.validate({ material: 'grass' }, context)).toThrowError(AiToolValidationError);
	});

	it('should throw validation error if surfaceId not found', () => {
		expect(() => tool.validate({ surfaceId: 'invalid' }, context)).toThrowError(AiToolValidationError);
	});

	it('should create command to add new surface', async () => {
		const surface = new Surface('grass', new CatmullRomSpline(true, 'catmullrom', 0));
		surfaceFactory.createSurface.and.returnValue(surface);

		const result = await tool.run({ material: 'grass', points: [{x:0,y:0},{x:10,y:0},{x:10,y:10}] }, context);

		expect(result.commands?.length).toBe(1);
		expect(surfaceFactory.createSurface).toHaveBeenCalled();
	});

	it('should create command to edit existing surface', async () => {
		const result = await tool.run({ surfaceId: 'surface-1', material: 'concrete' }, context);

		expect(result.summary).toContain('surface');
		expect(result.commands?.length).toBe(1);
		// expect((result.commands![0] as any).propertyName).toBe('materialGuid');
		// expect((result.commands![0] as any).value).toBe('concrete');
	});
});

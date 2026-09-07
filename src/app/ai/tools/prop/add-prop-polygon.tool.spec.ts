import { AddPropPolygonTool } from './add-prop-polygon.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { PropPolygonFactory } from 'app/map/prop-polygon/prop-polygon.factory';
import { PropPolygon } from 'app/map/prop-polygon/prop-polygon.model';
import { Asset, AssetType } from 'app/assets/asset.model';

describe('AddPropPolygonTool', () => {
	let tool: AddPropPolygonTool;
	let context: AiToolContext;
	let propPolygonFactory: jasmine.SpyObj<PropPolygonFactory>;

	beforeEach(() => {
		propPolygonFactory = jasmine.createSpyObj('PropPolygonFactory', ['createFromAsset']);
		tool = new AddPropPolygonTool(propPolygonFactory);
		
		const mockAsset = new Asset(AssetType.MODEL, 'tree', 'tree.glb');
		const assetsMap = new Map<string, Asset>();
		assetsMap.set('1', mockAsset);

		context = {
			mapService: {
				assetService: {
					assets: assetsMap
				}
			}
		} as any;
	});

	it('should throw validation error if <3 points provided', () => {
		expect(() => tool.validate({ assetName: 'tree', points: [{x:0,y:0}, {x:1,y:1}] }, context)).toThrowError(AiToolValidationError);
	});

	it('should throw validation error if asset not found', () => {
		expect(() => tool.validate({ assetName: 'invalid', points: [{x:0,y:0}, {x:10,y:0}, {x:10,y:10}] }, context)).toThrowError(AiToolValidationError);
	});

	it('should create command to add prop polygon', async () => {
		const polygon = new PropPolygon('1');
		propPolygonFactory.createFromAsset.and.returnValue(polygon);

		const result = await tool.run({ assetName: 'tree', points: [{x:0,y:0}, {x:10,y:0}, {x:10,y:10}], density: 2 }, context);

		expect(result.commands?.length).toBe(1);
		expect(polygon.density).toBe(2);
		expect(polygon.spline.getControlPoints().length).toBe(3);
	});
});

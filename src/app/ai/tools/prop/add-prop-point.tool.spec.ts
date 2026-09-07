import { AddPropPointTool } from './add-prop-point.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { PropPointFactory } from 'app/map/prop-point/prop-point.factory';
import { PropInstance } from 'app/map/prop-point/prop-instance.object';
import { Asset, AssetType } from 'app/assets/asset.model';
import { Object3D } from 'three';

describe('AddPropPointTool', () => {
	let tool: AddPropPointTool;
	let context: AiToolContext;
	let propFactory: jasmine.SpyObj<PropPointFactory>;

	beforeEach(() => {
		propFactory = jasmine.createSpyObj('PropPointFactory', ['createFromAsset']);
		tool = new AddPropPointTool(propFactory);
		
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

	it('should throw validation error if asset not found', () => {
		expect(() => tool.validate({ assetName: 'invalid', x: 0, y: 0 }, context)).toThrowError(AiToolValidationError);
	});

	it('should create command to add prop', async () => {
		const prop = new PropInstance('1', new Object3D());
		propFactory.createFromAsset.and.returnValue(prop);

		const result = await tool.run({ assetName: 'tree', x: 10, y: 10, rotationDegrees: 90, scale: 2 }, context);

		expect(result.commands?.length).toBe(1);
		expect(prop.scale.x).toBe(2);
	});
});

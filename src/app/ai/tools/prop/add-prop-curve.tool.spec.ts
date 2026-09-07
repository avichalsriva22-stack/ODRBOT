import { AddPropCurveTool } from './add-prop-curve.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { PropCurveFactory } from 'app/modules/prop-curve/services/prop-curve.factory';
import { PropCurve } from 'app/map/prop-curve/prop-curve.model';
import { Asset, AssetType } from 'app/assets/asset.model';

describe('AddPropCurveTool', () => {
	let tool: AddPropCurveTool;
	let context: AiToolContext;
	let propCurveFactory: jasmine.SpyObj<PropCurveFactory>;

	beforeEach(() => {
		propCurveFactory = jasmine.createSpyObj('PropCurveFactory', ['createFromAsset']);
		tool = new AddPropCurveTool(propCurveFactory);
		
		const mockAsset = new Asset(AssetType.MODEL, 'fence', 'fence.glb');
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

	it('should throw validation error if <2 points provided', () => {
		expect(() => tool.validate({ assetName: 'fence', points: [{x:0,y:0}] }, context)).toThrowError(AiToolValidationError);
	});

	it('should throw validation error if asset not found', () => {
		expect(() => tool.validate({ assetName: 'invalid', points: [{x:0,y:0}, {x:10,y:10}] }, context)).toThrowError(AiToolValidationError);
	});

	it('should create command to add prop curve', async () => {
		const curve = new PropCurve('1');
		propCurveFactory.createFromAsset.and.returnValue(curve);

		const result = await tool.run({ assetName: 'fence', points: [{x:0,y:0}, {x:10,y:10}], spacing: 2 }, context);

		expect(result.commands?.length).toBe(1);
		expect(curve.spacing).toBe(2);
		expect(curve.getSpline().getControlPoints().length).toBe(2);
	});
});

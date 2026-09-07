import { AddPropSpanTool } from './add-prop-span.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadObjectFactory } from 'app/services/road-object/road-object.factory';
import { TvRoadObject, TvRoadObjectType } from 'app/map/models/objects/tv-road-object';
import { Asset, AssetType } from 'app/assets/asset.model';
import { TvRoad } from 'app/map/models/tv-road.model';

describe('AddPropSpanTool', () => {
	let tool: AddPropSpanTool;
	let context: AiToolContext;
	let mockRoad: TvRoad;
	let mockAsset: Asset;

	beforeEach(() => {
		tool = new AddPropSpanTool();
		
		mockAsset = new Asset(AssetType.MODEL, 'tree', 'tree.glb');
		const assetsMap = new Map<string, Asset>();
		assetsMap.set('1', mockAsset);

		mockRoad = new TvRoad();
		Object.defineProperty(mockRoad, 'id', { value: 1, writable: true });
		Object.defineProperty(mockRoad, 'length', { value: 100, writable: true });
		spyOn(mockRoad, 'getRoadCoord').and.returnValue({ position: { x: 0, y: 0, z: 0 }, hdg: 0 } as any);

		context = {
			mapService: {
				map: {
					getRoad: (id: number) => id === 1 ? mockRoad : undefined
				},
				assetService: {
					assets: assetsMap
				}
			}
		} as any;
	});

	it('should throw validation error if road not found', () => {
		expect(() => tool.validate({ roadId: 99, assetName: 'tree', side: 'left' }, context)).toThrowError(AiToolValidationError);
	});

	it('should throw validation error if sStart >= sEnd', () => {
		expect(() => tool.validate({ roadId: 1, assetName: 'tree', side: 'left', sStart: 10, sEnd: 5 }, context)).toThrowError(AiToolValidationError);
	});

	it('should throw validation error if asset not found', () => {
		expect(() => tool.validate({ roadId: 1, assetName: 'invalid', side: 'left' }, context)).toThrowError(AiToolValidationError);
	});

	it('should create command to add prop span', async () => {
		const roadObject = new TvRoadObject(TvRoadObjectType.tree, 'tree', 1, 0, -2.0);
		spyOn(roadObject, 'addRepeat');
		spyOn(RoadObjectFactory, 'createRoadObject').and.returnValue(roadObject as any);

		const result = await tool.run({ roadId: 1, assetName: 'tree', side: 'right', spacing: 20 }, context);

		expect(result.commands?.length).toBe(1);
		expect(RoadObjectFactory.createRoadObject).toHaveBeenCalled();
		expect(roadObject.addRepeat).toHaveBeenCalledWith(0, -1, 20);
	});
});

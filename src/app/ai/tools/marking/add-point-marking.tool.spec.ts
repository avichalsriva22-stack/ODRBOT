import { AddPointMarkingTool } from './add-point-marking.tool';
import { AiToolContext, AiToolValidationError } from '../../models/ai-tool.model';
import { RoadObjectFactory } from 'app/services/road-object/road-object.factory';
import { TvRoadObject, TvRoadObjectType } from 'app/map/models/objects/tv-road-object';
import { Asset, AssetType } from 'app/assets/asset.model';
import { TvRoad } from 'app/map/models/tv-road.model';

describe('AddPointMarkingTool', () => {
	let tool: AddPointMarkingTool;
	let context: AiToolContext;
	let mockRoad: TvRoad;
	let mockAsset: Asset;

	beforeEach(() => {
		tool = new AddPointMarkingTool();
		
		mockAsset = new Asset(AssetType.TEXTURE, 'arrow', 'arrow.png');
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
		expect(() => tool.validate({ roadId: 99, sOffset: 10, markingSymbol: 'arrow' }, context)).toThrowError(AiToolValidationError);
	});

	it('should throw validation error if marking symbol not found', () => {
		expect(() => tool.validate({ roadId: 1, sOffset: 10, markingSymbol: 'invalid' }, context)).toThrowError(AiToolValidationError);
	});

	it('should create command to add point marking', async () => {
		const roadObject = new TvRoadObject(TvRoadObjectType.roadMark, 'mark', 1, 10, 2);
		spyOn(RoadObjectFactory, 'createRoadObject').and.returnValue(roadObject as any);

		const result = await tool.run({ roadId: 1, sOffset: 10, lateralOffset: 2, markingSymbol: 'arrow' }, context);

		expect(result.commands?.length).toBe(1);
		expect(RoadObjectFactory.createRoadObject).toHaveBeenCalled();
		expect(roadObject.assetGuid).toBe(mockAsset.guid);
	});
});

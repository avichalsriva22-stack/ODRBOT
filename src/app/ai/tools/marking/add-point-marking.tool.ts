import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { Asset, AssetType } from 'app/assets/asset.model';
import { RoadObjectFactory } from 'app/services/road-object/road-object.factory';
import { TvRoadObjectType } from 'app/map/models/objects/tv-road-object';
import { TvOrientation } from 'app/map/models/tv-common';

export class AddPointMarkingTool implements AiTool {
	name = 'add_point_marking';
	description = 'Add a point marking (e.g. an arrow, a symbol) on the road surface.';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'marking';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Road ID' },
			sOffset: { type: 'number' as const, description: 'Longitudinal position' },
			lateralOffset: { type: 'number' as const, description: 'Lateral offset (t-coordinate)' },
			markingSymbol: { type: 'string' as const, description: 'Name of the marking asset' }
		},
		required: ['roadId', 'sOffset', 'markingSymbol']
	};

	constructor() {}

	private findAssetByName(name: string, ctx: AiToolContext): Asset | undefined {
		const assetsMap = (ctx.mapService as any).assetService?.assets as Map<string, Asset>;
		if (!assetsMap) return undefined;
		for (const asset of assetsMap.values()) {
			if (asset.name === name || asset.assetName === name) {
				return asset;
			}
		}
		return undefined;
	}

	validate(args: any, ctx: AiToolContext): void {
		const road = ctx.mapService.map.getRoad(args.roadId);
		if (!road) {
			throw new AiToolValidationError(`Road ID ${args.roadId} not found.`);
		}

		const asset = this.findAssetByName(args.markingSymbol, ctx);
		if (!asset) {
			const assetsMap = (ctx.mapService as any).assetService?.assets as Map<string, Asset>;
			if (assetsMap) {
				const names = Array.from(assetsMap.values())
					.filter(a => a.type === AssetType.TEXTURE || a.type === AssetType.MATERIAL)
					.map(a => a.assetName);
				const matches = names.filter(n => n.includes(args.markingSymbol)).slice(0, 5);
				const suggestions = matches.length > 0 ? matches : names.slice(0, 5);
				throw new AiToolValidationError(`Marking symbol '${args.markingSymbol}' not found. Suggestions: ${suggestions.join(', ')}`);
			} else {
				throw new AiToolValidationError(`Marking symbol '${args.markingSymbol}' not found.`);
			}
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const road = ctx.mapService.map.getRoad(args.roadId)!;
		const asset = this.findAssetByName(args.markingSymbol, ctx)!;
		
		const s = args.sOffset;
		const t = args.lateralOffset ?? 0;

		const coord = road.getRoadCoord(s, t);
		const roadObject = RoadObjectFactory.createRoadObject(TvRoadObjectType.roadMark, coord)!;
		roadObject.assetGuid = asset.guid;
		roadObject.width = 1;
		roadObject.length = 1;
		roadObject.height = 0.01;
		roadObject.zOffset = 0.005;
		roadObject.orientation = t > 0 ? TvOrientation.MINUS : TvOrientation.PLUS;

		const command = new AddObjectCommand(roadObject);

		return {
			summary: `Added point marking '${args.markingSymbol}' on road ${args.roadId} at (s=${s}, t=${t}).`,
			commands: [command],
			createdIds: [{ type: 'object', id: roadObject.id }] 
		};
	}
}

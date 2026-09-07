import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { Asset, AssetType } from 'app/assets/asset.model';
import { RoadObjectFactory } from 'app/services/road-object/road-object.factory';
import { TvRoadObjectType } from 'app/map/models/objects/tv-road-object';

export class AddPropSpanTool implements AiTool {
	name = 'add_prop_span';
	description = 'Place props along a road\'s geometry span (e.g. lamp posts every N meters along a road edge).';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'prop';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			roadId: { type: 'integer' as const, description: 'Road ID' },
			assetName: { type: 'string' as const, description: 'Name of the prop asset' },
			side: { type: 'string' as const, enum: ['left', 'right'], description: 'Side of the road' },
			spacing: { type: 'number' as const, minimum: 1, maximum: 200, description: 'Spacing between props' },
			sStart: { type: 'number' as const, description: 'Start s-coordinate' },
			sEnd: { type: 'number' as const, description: 'End s-coordinate' }
		},
		required: ['roadId', 'assetName', 'side']
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
		
		if (args.sStart !== undefined && args.sEnd !== undefined && args.sStart >= args.sEnd) {
			throw new AiToolValidationError(`sStart (${args.sStart}) must be less than sEnd (${args.sEnd}).`);
		}

		const asset = this.findAssetByName(args.assetName, ctx);
		if (!asset) {
			const assetsMap = (ctx.mapService as any).assetService?.assets as Map<string, Asset>;
			if (assetsMap) {
				const names = Array.from(assetsMap.values())
					.filter(a => a.type === AssetType.OBJECT || a.type === AssetType.MODEL)
					.map(a => a.assetName);
				const matches = names.filter(n => n.includes(args.assetName)).slice(0, 5);
				const suggestions = matches.length > 0 ? matches : names.slice(0, 5);
				throw new AiToolValidationError(`Asset '${args.assetName}' not found. Suggestions: ${suggestions.join(', ')}`);
			} else {
				throw new AiToolValidationError(`Asset '${args.assetName}' not found.`);
			}
		}
	}

	async run(args: any, ctx: AiToolContext): Promise<AiToolRunResult> {
		this.validate(args, ctx);

		const road = ctx.mapService.map.getRoad(args.roadId)!;
		const asset = this.findAssetByName(args.assetName, ctx)!;
		
		const sStart = args.sStart ?? 0;
		const t = args.side === 'right' ? -2.0 : 2.0;
		const spacing = args.spacing ?? 10.0;
		const repeatLength = args.sEnd !== undefined ? (args.sEnd - sStart) : -1;

		const coord = road.getRoadCoord(sStart, t);
		const roadObject = RoadObjectFactory.createRoadObject(TvRoadObjectType.tree, coord)!;
		roadObject.assetGuid = asset.guid;
		roadObject.width = 1;
		roadObject.length = 1;
		roadObject.height = 1;
		roadObject.addRepeat(sStart, repeatLength, spacing);

		const command = new AddObjectCommand(roadObject);

		return {
			summary: `Added prop span '${args.assetName}' on road ${args.roadId} at side ${args.side}.`,
			commands: [command],
			createdIds: [{ type: 'object', id: roadObject.id }] 
		};
	}
}

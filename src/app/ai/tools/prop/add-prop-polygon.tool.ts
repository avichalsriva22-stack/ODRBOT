import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { Vector3 } from 'app/core/maths';
import { Asset, AssetType } from 'app/assets/asset.model';
import { PropPolygonFactory } from 'app/map/prop-polygon/prop-polygon.factory';

export class AddPropPolygonTool implements AiTool {
	name = 'add_prop_polygon';
	description = 'Fill a polygonal area with repeated props (e.g. scatter trees/rocks across a region).';
	requiresPreview = false;
	category: import('../../models/ai-tool.model').AiToolCategory = 'prop';
	parameters: import('../../models/ai-tool.model').AiJsonSchema = {
		type: 'object' as const,
		properties: {
			assetName: { type: 'string' as const, description: 'Name of the prop asset' },
			points: { 
				type: 'array' as const, 
				items: { 
					type: 'object' as const,
					properties: {
						x: { type: 'number' as const, description: 'X coordinate' },
						y: { type: 'number' as const, description: 'Y coordinate' }
					},
					required: ['x', 'y'],
					description: 'Point coordinate'
				},
				description: 'Array of points forming the polygon boundary'
			},
			density: { type: 'number' as const, minimum: 0.05, maximum: 5, description: 'Props per square meter' }
		},
		required: ['assetName', 'points']
	};

	constructor(private propPolygonFactory: PropPolygonFactory) {}

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
		if (!args.points || args.points.length < 3) {
			throw new AiToolValidationError('At least 3 points are required for a prop polygon.');
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

		const asset = this.findAssetByName(args.assetName, ctx)!;
		
		const polygon = this.propPolygonFactory.createFromAsset(asset, new Vector3(args.points[0].x, args.points[0].y, 0));
		
		if (!polygon) {
			throw new Error(`Failed to instantiate prop polygon for asset: ${args.assetName}`);
		}
		
		polygon.density = args.density ?? 0.5;

		for (let i = 0; i < args.points.length; i++) {
			const pt = args.points[i];
			polygon.addPointAt(new Vector3(pt.x, pt.y, 0), i);
		}

		const command = new AddObjectCommand(polygon);

		return {
			summary: `Added prop polygon '${args.assetName}' with ${args.points.length} points and density ${polygon.density}.`,
			commands: [command],
			createdIds: [{ type: 'object', id: polygon['id'] || 0 }] 
		};
	}
}

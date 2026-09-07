import { AiTool, AiToolContext, AiToolRunResult, AiDiffEntry, AiToolValidationError } from '../../models/ai-tool.model';
import { AddObjectCommand } from 'app/commands/add-object-command';
import { Vector3 } from 'app/core/maths';
import { Asset, AssetType } from 'app/assets/asset.model';
import { PropCurveFactory } from 'app/modules/prop-curve/services/prop-curve.factory';
import { CatmullRomSpline } from 'app/core/shapes/catmull-rom-spline';

export class AddPropCurveTool implements AiTool {
	name = 'add_prop_curve';
	description = 'Place repeated props along a curve/line between two or more points (e.g. a row of streetlights or a fence).';
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
				description: 'Array of points forming the curve'
			},
			spacing: { type: 'number' as const, minimum: 0.5, maximum: 100, description: 'Spacing between props' }
		},
		required: ['assetName', 'points']
	};

	constructor(private propCurveFactory: PropCurveFactory) {}

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
		if (!args.points || args.points.length < 2) {
			throw new AiToolValidationError('At least 2 points are required for a prop curve.');
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
		
		const curve = this.propCurveFactory.createFromAsset(asset, new Vector3(args.points[0].x, args.points[0].y, 0));
		
		if (!curve) {
			throw new Error(`Failed to instantiate prop curve for asset: ${args.assetName}`);
		}
		
		curve.spacing = args.spacing ?? 5.0;

		const spline = new CatmullRomSpline(false, 'catmullrom', 0.001);
		for (const pt of args.points) {
			spline.addControlPoint(new Vector3(pt.x, pt.y, 0));
		}
		
		curve.setSpline(spline);

		const command = new AddObjectCommand(curve);

		return {
			summary: `Added prop curve '${args.assetName}' with ${args.points.length} points at spacing ${curve.spacing}.`,
			commands: [command],
			createdIds: [{ type: 'object', id: curve['id'] || 0 }] // PropCurve might use different id logic
		};
	}
}
